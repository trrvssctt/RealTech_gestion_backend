import pool from '../config/pg.js';
import { asyncHandler, ApiError } from '../middlewares/errorHandler.js';
import ProductModel from '../models/productModel.js';
import ServiceModel from '../models/serviceModel.js';
import TaskModel from '../models/taskModel.js';
import CommandeModel from '../models/commandeModel.js';
import VenteModel from '../models/venteModel.js';

/**
 * Get dashboard statistics (no Prisma) - Admin full view, employees restricted view
 */
export const getDashboardStats = asyncHandler(async (req, res) => {
  const userId = req.user?.userId ?? null;
  const role = String(req.user?.role || '').toUpperCase();
  if (!userId) throw new ApiError(401, 'Authentification requise');

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const isAdmin = ['ADMIN', 'SUPERADMIN', 'MANAGER'].includes(role);

  if (isAdmin) {
    // Parallel queries using raw SQL and existing models
    const [
      totalUsersQ,
      activeUsersQ,
      totalClientsQ,
      activeClientsQ,
      totalProductsQ,
      activeProductsQ,
      lowStockProductsQ,
      totalServicesQ,
      activeServicesQ,
      totalTasksQ,
      pendingTasksQ,
      completedTasksQ,
      totalOrdersQ,
      todayOrdersQ,
      monthlyOrdersQ,
      yearlyOrdersQ,
      ordersByStatusQ,
      totalSalesQ,
      todaySalesQ,
      monthlySalesQ,
      yearlySalesQ,
      salesByStatusQ,
  totalRevenueQ,
  monthlyRevenueQ,
  yearlyRevenueQ,
      avgOrderValueQ,
      avgSaleValueQ,
      topProductsQ,
      topClientsQ,
      recentOrdersQ,
      recentSalesQ,
      recentTasksQ,
      monthlyRevenueSeriesQ
    ] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS count FROM utilisateur'),
      pool.query('SELECT COUNT(*)::int AS count FROM utilisateur WHERE actif = true'),
      pool.query('SELECT COUNT(*)::int AS count FROM client'),
      pool.query('SELECT COUNT(*)::int AS count FROM client WHERE actif = true'),
      pool.query('SELECT COUNT(*)::int AS count FROM produit WHERE deletedat IS NULL'),
      pool.query('SELECT COUNT(*)::int AS count FROM produit WHERE actif = true AND deletedat IS NULL'),
      pool.query('SELECT COUNT(*)::int AS count FROM produit WHERE actif = true AND deletedat IS NULL AND stock_actuel <= 5'),
      pool.query('SELECT COUNT(*)::int AS count FROM service WHERE deletedat IS NULL'),
      pool.query('SELECT COUNT(*)::int AS count FROM service WHERE actif = true AND deletedat IS NULL'),
      pool.query('SELECT COUNT(*)::int AS count FROM tache'),
      pool.query("SELECT COUNT(*)::int AS count FROM tache WHERE statut = 'EN_ATTENTE'"),
      pool.query("SELECT COUNT(*)::int AS count FROM tache WHERE statut = 'TERMINEE'"),
      pool.query('SELECT COUNT(*)::int AS count FROM commande'),
      pool.query('SELECT COUNT(*)::int AS count FROM commande WHERE createdat >= $1', [startOfToday]),
      pool.query('SELECT COUNT(*)::int AS count FROM commande WHERE createdat >= $1', [startOfMonth]),
      pool.query('SELECT COUNT(*)::int AS count FROM commande WHERE createdat >= $1', [startOfYear]),
      pool.query('SELECT statut, COUNT(*)::int AS count FROM commande GROUP BY statut'),
      pool.query('SELECT COUNT(*)::int AS count FROM vente'),
      pool.query('SELECT COUNT(*)::int AS count FROM vente WHERE createdat >= $1', [startOfToday]),
      pool.query('SELECT COUNT(*)::int AS count FROM vente WHERE createdat >= $1', [startOfMonth]),
      pool.query('SELECT COUNT(*)::int AS count FROM vente WHERE createdat >= $1', [startOfYear]),
      pool.query('SELECT statut, COUNT(*)::int AS count FROM vente GROUP BY statut'),
  // Use ventes.montant for realized revenue (payments)
  pool.query('SELECT COALESCE(SUM(montant),0) AS total FROM vente'),
  pool.query('SELECT COALESCE(SUM(montant),0) AS total FROM vente WHERE createdat >= $1', [startOfMonth]),
  pool.query('SELECT COALESCE(SUM(montant),0) AS total FROM vente WHERE createdat >= $1', [startOfYear]),
      pool.query('SELECT COALESCE(AVG(total_cmd),0) AS avg FROM commande'),
      pool.query('SELECT COALESCE(AVG(montant),0) AS avg FROM vente'),
      // top products by revenue from commandeproduit
      pool.query(`
        SELECT produitid, SUM(prix_total)::numeric AS total_revenue, SUM(quantite)::numeric AS total_qty
        FROM commandeproduit
        WHERE deletedat IS NULL
        GROUP BY produitid
        ORDER BY SUM(prix_total) DESC
        LIMIT 10
      `),
      // top clients by commandes
      pool.query(`
        SELECT clientid, SUM(total_cmd)::numeric AS total_revenue
        FROM commande
        WHERE deletedat IS NULL
        GROUP BY clientid
        ORDER BY SUM(total_cmd) DESC
        LIMIT 10
      `),
      // recent commandes
      pool.query(`
        SELECT c.id, c.numero, c.total_cmd, c.statut, c.createdat,
               cl.id AS client_id, cl.nom AS client_nom, cl.prenom AS client_prenom
        FROM commande c
        LEFT JOIN client cl ON cl.id = c.clientid
        WHERE c.deletedat IS NULL
        ORDER BY c.createdat DESC LIMIT 10
      `),
      // recent ventes
      pool.query(`
        SELECT v.id, v.numero, v.montant, v.statut, v.createdat, v."commandeid"
        FROM vente v
        WHERE v.deletedat IS NULL
        ORDER BY v.createdat DESC LIMIT 10
      `),
      // recent tasks
      pool.query(`
        SELECT t.id, t.nom AS nom, t.statut, t.importance, t.updatedat, t.utilisateurid
        FROM tache t
        ORDER BY t.updatedat DESC LIMIT 10
      `),
      // monthly revenue series (last 12 months) based on vente.createdat
      pool.query(
        `
        SELECT to_char(date_trunc('month', createdat), 'YYYY-MM') AS month,
               COALESCE(SUM(montant),0)::numeric AS total
        FROM vente
        WHERE createdat >= $1
        GROUP BY date_trunc('month', createdat)
        ORDER BY 1
        `,
        [twelveMonthsAgo]
      )
    ]);

    // transform results
    const totalUsers = Number(totalUsersQ.rows[0].count || 0);
    const activeUsers = Number(activeUsersQ.rows[0].count || 0);
    const totalClients = Number(totalClientsQ.rows[0].count || 0);
    const activeClients = Number(activeClientsQ.rows[0].count || 0);
    const totalProducts = Number(totalProductsQ.rows[0].count || 0);
    const activeProducts = Number(activeProductsQ.rows[0].count || 0);
    const lowStockProducts = Number(lowStockProductsQ.rows[0].count || 0);
    const totalServices = Number(totalServicesQ.rows[0].count || 0);
    const activeServices = Number(activeServicesQ.rows[0].count || 0);
    const totalTasks = Number(totalTasksQ.rows[0].count || 0);
    const pendingTasks = Number(pendingTasksQ.rows[0].count || 0);
    const completedTasks = Number(completedTasksQ.rows[0].count || 0);
    const totalOrders = Number(totalOrdersQ.rows[0].count || 0);
    const todayOrders = Number(todayOrdersQ.rows[0].count || 0);
    const monthlyOrders = Number(monthlyOrdersQ.rows[0].count || 0);
    const yearlyOrders = Number(yearlyOrdersQ.rows[0].count || 0);

    const ordersByStatus = {};
    ordersByStatusQ.rows.forEach(r => { ordersByStatus[r.statut] = Number(r.count); });

    const totalSales = Number(totalSalesQ.rows[0].count || 0);
    const todaySales = Number(todaySalesQ.rows[0].count || 0);
    const monthlySales = Number(monthlySalesQ.rows[0].count || 0);
    const yearlySales = Number(yearlySalesQ.rows[0].count || 0);

    const salesByStatus = {};
    salesByStatusQ.rows.forEach(r => { salesByStatus[r.statut] = Number(r.count); });

    const totalRevenue = Number(totalRevenueQ.rows[0].total || 0);
    const monthlyRevenue = Number(monthlyRevenueQ.rows[0].total || 0);
    const yearlyRevenue = Number(yearlyRevenueQ.rows[0].total || 0);
    const avgOrderValue = Number(avgOrderValueQ.rows[0].avg || 0);
    const avgSaleValue = Number(avgSaleValueQ.rows[0].avg || 0);

    const topProducts = topProductsQ.rows.map(r => ({
      produitId: r.produitid,
      totalRevenue: Number(r.total_revenue || 0),
      totalQuantity: Number(r.total_qty || 0)
    }));
    const topClients = topClientsQ.rows.map(r => ({
      clientId: r.clientid,
      totalRevenue: Number(r.total_revenue || 0)
    }));

    // enrich top products and clients with basic info
    const productIds = topProducts.map(t => t.produitId).filter(Boolean);
    const clientIds = topClients.map(c => c.clientId).filter(Boolean);

    const [productsInfo, clientsInfo] = await Promise.all([
      productIds.length ? pool.query(`SELECT id, nom, prix_unitaire FROM produit WHERE id = ANY($1::int[])`, [productIds]) : { rows: [] },
      clientIds.length ? pool.query(`SELECT id, nom, prenom, email FROM client WHERE id = ANY($1::int[])`, [clientIds]) : { rows: [] }
    ]);

    const topProductsWithDetails = topProducts.map(tp => ({
      produitId: tp.produitId,
      totalQuantity: tp.totalQuantity,
      totalRevenue: tp.totalRevenue,
      product: productsInfo.rows.find(p => p.id === tp.produitId) || null
    }));
    const topClientsWithDetails = topClients.map(tc => ({
      clientId: tc.clientId,
      totalRevenue: tc.totalRevenue,
      client: clientsInfo.rows.find(c => c.id === tc.clientId) || null
    }));

    // normalize recent rows to predictable shapes
    const recentOrders = recentOrdersQ.rows.map(r => ({
      id: r.id,
      numero: r.numero,
      total_cmd: r.total_cmd,
      montant: r.total_cmd,
      statut: r.statut,
      createdAt: r.createdat,
      client: r.client_id ? { id: r.client_id, nom: r.client_nom, prenom: r.client_prenom } : null
    }));

    const recentSales = recentSalesQ.rows.map(r => ({
      id: r.id,
      numero: r.numero,
      montant: r.montant,
      statut: r.statut,
      createdAt: r.createdat,
      commandeId: r.commandeid ?? r.commandeId
    }));

    const recentTasks = recentTasksQ.rows.map(r => ({
      id: r.id,
      titre: r.nom || r.titre,
      nom: r.nom || r.titre,
      statut: r.statut,
      importance: r.importance,
      updatedAt: r.updatedat
    }));

    const monthlyRevenueSeries = monthlyRevenueSeriesQ.rows.map(r => ({ month: r.month, total: Number(r.total || 0) }));

    return res.json({
      success: true,
      data: {
        users: { total: totalUsers, active: activeUsers, inactive: totalUsers - activeUsers },
        clients: { total: totalClients, active: activeClients, inactive: totalClients - activeClients },
        products: { total: totalProducts, active: activeProducts, lowStock: lowStockProducts },
        services: { total: totalServices, active: activeServices },
        tasks: { total: totalTasks, pending: pendingTasks, completed: completedTasks },
        orders: { total: totalOrders, today: todayOrders, month: monthlyOrders, year: yearlyOrders, byStatus: ordersByStatus },
        sales: { total: totalSales, today: todaySales, month: monthlySales, year: yearlySales, byStatus: salesByStatus },
        revenue: { total: totalRevenue, monthly: monthlyRevenue, yearly: yearlyRevenue },
        avgs: { avgOrderValue, avgSaleValue },
        topProducts: topProductsWithDetails,
        topClients: topClientsWithDetails,
        // both shapes provided for frontend flexibility
        recent: { orders: recentOrders, sales: recentSales, tasks: recentTasks },
        recentOrders,
        recentSales,
        recentTasks,
        monthlyRevenueSeries
      }
    });
  } else {
    // Employee-level restricted view (only data related to the user)
    // Use the assignment pivot table to compute per-user stats (tache_assignments)
    const [
      myTasksCountQ,
      myPendingTasksQ,
      myCompletedTasksQ,
      myRecentTasksQ,
      mySalesCountQ,
      mySalesMonthCountQ,
      mySalesYearCountQ,
      myRecentSalesQ,
      myRecentOrdersQ,
      lowStockProductsQ
    ] = await Promise.all([
      // total assignments for this user
      pool.query('SELECT COUNT(*) AS count FROM tache_assignments WHERE utilisateur_id = $1 AND deletedat IS NULL', [userId]),
      // pending = assignments not yet completed
      pool.query("SELECT COUNT(*) AS count FROM tache_assignments ta JOIN tache t ON t.id = ta.tache_id WHERE ta.utilisateur_id = $1 AND ta.est_terminee = false", [userId]),
      // completed = assignments marked done
      pool.query("SELECT COUNT(*) AS count FROM tache_assignments WHERE utilisateur_id = $1 AND est_terminee = true", [userId]),
      // recent tasks assigned to the user (include task info)
      pool.query(
        `
        SELECT t.id, t.nom, t.statut, t.importance, t.updatedat, ta.est_terminee, ta.date_terminee
        FROM tache_assignments ta
        JOIN tache t ON t.id = ta.tache_id
        WHERE ta.utilisateur_id = $1 AND ta.deletedat IS NULL
        ORDER BY ta.updatedat DESC
        LIMIT 10
        `,
        [userId]
      ),
      pool.query('SELECT COUNT(*)::int AS count FROM vente WHERE utilisateurid = $1', [userId]),
  pool.query('SELECT COUNT(*)::int AS count FROM vente WHERE utilisateurid = $1 AND createdat >= $2', [userId, startOfMonth]),
  pool.query('SELECT COUNT(*)::int AS count FROM vente WHERE utilisateurid = $1 AND createdat >= $2', [userId, startOfYear]),
      pool.query('SELECT v.id, v.numero, v.montant, v.statut, v.createdat, v."commandeid" FROM vente v WHERE v.utilisateurid = $1 ORDER BY v.createdat DESC LIMIT 10', [userId]),
      pool.query('SELECT c.id, c.numero, c.total_cmd, c.statut, c.createdat FROM commande c WHERE c.utilisateurid = $1 ORDER BY c.createdat DESC LIMIT 10', [userId]),
      pool.query('SELECT COUNT(*)::int AS count FROM produit WHERE actif = true AND deletedat IS NULL AND stock_actuel <= 5')
    ]);

    const myTasksTotal = Number(myTasksCountQ.rows[0].count || 0);
    const myPendingTasks = Number(myPendingTasksQ.rows[0].count || 0);
    const myCompletedTasks = Number(myCompletedTasksQ.rows[0].count || 0);
    const myRecentTasks = myRecentTasksQ.rows.map(r => ({
      id: r.id,
      titre: r.nom,
      statut: r.statut,
      importance: r.importance,
      est_terminee: r.est_terminee,
      date_terminee: r.date_terminee,
      updatedAt: r.updatedat
    }));
    const mySalesTotal = Number(mySalesCountQ.rows[0].count || 0);
    const mySalesThisMonth = Number(mySalesMonthCountQ.rows[0].count || 0);
    const mySalesThisYear = Number(mySalesYearCountQ.rows[0].count || 0);
    const mySalesList = myRecentSalesQ.rows.map(r => ({
      id: r.id, numero: r.numero, montant: r.montant, statut: r.statut, createdAt: r.createdat
    }));
    const myOrdersAssigned = myRecentOrdersQ.rows.map(r => ({
      id: r.id, numero: r.numero, total_cmd: r.total_cmd, statut: r.statut, createdAt: r.createdat
    }));
    const lowStockProducts = Number(lowStockProductsQ.rows[0].count || 0);

    return res.json({
      success: true,
      data: {
        tasks: { total: myTasksTotal, pending: myPendingTasks, completed: myCompletedTasks, recent: myRecentTasks },
        mySales: { totalCount: mySalesTotal, monthCount: mySalesThisMonth, yearCount: mySalesThisYear, recent: mySalesList },
        myOrders: { recentAssigned: myOrdersAssigned },
        products: { lowStock: lowStockProducts },
        message: 'Vue restreinte pour utilisateur non-admin'
      }
    });
  }
});

/**
 * Monthly sales chart
 */
export const getMonthlySalesChart = asyncHandler(async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const sql = `
    SELECT EXTRACT(MONTH FROM createdat) AS month, COALESCE(SUM(montant),0)::numeric AS total, COUNT(*)::int AS count
    FROM vente
    WHERE EXTRACT(YEAR FROM createdat) = $1
    GROUP BY EXTRACT(MONTH FROM createdat)
    ORDER BY month
  `;
  const { rows } = await pool.query(sql, [year]);
  const chartData = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const r = rows.find(rr => Number(rr.month) === month);
    return {
      month,
      monthName: new Date(year, index).toLocaleString('fr-FR', { month: 'long' }),
      total: r ? Number(r.total) : 0,
      count: r ? Number(r.count) : 0
    };
  });
  res.json({ success: true, data: { chartData, year } });
});

/**
 * Top products
 */
export const getTopProducts = asyncHandler(async (req, res) => {
  const limit = Number(req.query.limit) || 10;
  const sql = `
    SELECT produitid, SUM(prix_total)::numeric AS total_revenue, SUM(quantite)::numeric AS total_qty
    FROM commandeproduit
    WHERE deletedat IS NULL
    GROUP BY produitid
    ORDER BY SUM(prix_total) DESC
    LIMIT $1
  `;
  const { rows } = await pool.query(sql, [limit]);
  const productIds = rows.map(r => r.produitid).filter(Boolean);
  const productsInfo = productIds.length ? (await pool.query(`SELECT id, nom, prix_unitaire FROM produit WHERE id = ANY($1::int[])`, [productIds])).rows : [];
  const result = rows.map(r => ({
    product: productsInfo.find(p => p.id === r.produitid) || null,
    totalQuantity: Number(r.total_qty || 0),
    totalRevenue: Number(r.total_revenue || 0)
  }));
  res.json({ success: true, data: { topProducts: result } });
});

/**
 * Recent activity
 */
export const getRecentActivity = asyncHandler(async (req, res) => {
  const limit = Number(req.query.limit) || 20;
  const [recentOrdersQ, recentTasksQ, recentSalesQ] = await Promise.all([
    pool.query(`
      SELECT c.id, c.numero, c.total_cmd, c.statut, c.createdat,
             cl.nom AS client_nom, cl.prenom AS client_prenom
      FROM commande c
      LEFT JOIN client cl ON cl.id = c.clientid
      WHERE c.deletedat IS NULL
      ORDER BY c.createdat DESC LIMIT $1
    `, [limit]),
    pool.query(`
      SELECT id, nom AS nom, statut, importance, updatedat, utilisateurid
      FROM tache
      ORDER BY updatedat DESC LIMIT $1
    `, [limit]),
    pool.query(`
      SELECT v.id, v.numero, v.montant, v.statut, v.createdat
      FROM vente v
      WHERE v.deletedat IS NULL
      ORDER BY v.createdat DESC LIMIT $1
    `, [limit])
  ]);

  res.json({
    success: true,
    data: {
      recentOrders: recentOrdersQ.rows,
      recentTasks: recentTasksQ.rows,
      recentSales: recentSalesQ.rows
    }
  });
});