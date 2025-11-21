import pool from '../config/pg.js';

async function createProduct({ nom, description, prix_unitaire, stock_actuel = 0, actif = true }) {
  const sql = `
    INSERT INTO produit (nom, description, prix_unitaire, stock_actuel, actif)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `;
  const values = [nom, description, prix_unitaire, stock_actuel, actif];
  const { rows } = await pool.query(sql, values);
  return rows[0];
}

async function getProductById(id, client = pool) {
  const { rows } = await client.query(
    `SELECT * FROM produit WHERE id = $1 AND actif = true`,
    [id]
  );
  return rows[0] || null;
}

async function getProducts({ page = 1, limit = 10, search, actif, enStock, minPrice, maxPrice, sortBy = 'createdat', sortOrder = 'desc' }) {
  let where = [`actif = TRUE`];
  let values = [];
  let idx = 1;

  if (search) {
    where.push(`(nom ILIKE $${idx} OR description ILIKE $${idx})`);
    values.push(`%${search}%`);
    idx++;
  }
  if (actif !== undefined) {
    where.push(`actif = $${idx}`);
    values.push(actif === true || actif === 'true');
    idx++;
  }
  if (enStock !== undefined) {
    if (enStock === true || enStock === 'true') {
      where.push(`stock_actuel > 0`);
    } else {
      where.push(`stock_actuel <= 0`);
    }
  }
  if (minPrice !== undefined) {
    where.push(`prix_unitaire >= $${idx}`);
    values.push(Number(minPrice));
    idx++;
  }
  if (maxPrice !== undefined) {
    where.push(`prix_unitaire <= $${idx}`);
    values.push(Number(maxPrice));
    idx++;
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const sql = `
    SELECT * FROM produit
    ${whereClause}
    ORDER BY "${sortBy}" ${sortOrder === 'desc' ? 'DESC' : 'ASC'}
    LIMIT $${idx} OFFSET $${idx + 1}
  `;
  values.push(Number(limit), Number(offset));

  const { rows } = await pool.query(sql, values);

  // Count total
  const countSql = `
    SELECT COUNT(*) AS count FROM produit
    ${whereClause}
  `;
  const { rows: countRows } = await pool.query(countSql, values.slice(0, idx - 1));
  const total = Number(countRows[0].count);

  return {
    products: rows,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: Number(page),
  };
}

async function updateProduct(id, updateData) {
  const fields = [];
  const values = [];
  let idx = 1;

  for (const key in updateData) {
    fields.push(`"${key}" = $${idx}`);
    values.push(updateData[key]);
    idx++;
  }
  values.push(id);

  const sql = `
    UPDATE produit SET ${fields.join(', ')}, updatedat = CURRENT_TIMESTAMP
    WHERE id = $${idx}
    RETURNING *
  `;
  const { rows } = await pool.query(sql, values);
  return rows[0];
}

async function updateStock(id, quantite, type, client = pool) {
  // Récupère le produit (use provided client for transaction safety)
  const product = await getProductById(id, client);
  if (!product) return null;

  let newStock;
  switch (type) {
    case 'ADD':
      newStock = product.stock_actuel + Number(quantite);
      break;
    case 'SUBTRACT':
      newStock = product.stock_actuel - Number(quantite);
      if (newStock < 0) throw new Error('Stock insuffisant');
      break;
    case 'SET':
      newStock = Number(quantite);
      if (newStock < 0) throw new Error('Le stock ne peut pas être négatif');
      break;
    default:
      throw new Error('Type de mise à jour invalide');
  }

  const sql = `
    UPDATE produit SET stock_actuel = $1, updatedAt = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *
  `;
  const { rows } = await client.query(sql, [newStock, id]);
  const updated = rows[0];

  // If stock is low, create a notification (best-effort)
  try {
    if (updated && Number(updated.stock_actuel) <= 5) {
      const NotificationModel = await import('./notificationModel.js');
      // utilisateur_id null means broadcast to all users
      await NotificationModel.default.createNotification({ titre: 'Stock faible', message: `Stock du produit ${updated.nom} est bas (${updated.stock_actuel})`, meta: { produitId: id, stock: updated.stock_actuel }, lu: false });
    }
  } catch (e) {
    console.warn('Failed to create low stock notification', e);
  }

  return updated;
}

async function softDeleteProduct(id) {
  const sql = `
    UPDATE produit SET actif = false, deletedat = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *
  `;
  const { rows } = await pool.query(sql, [id]);
  return rows[0];
}

async function restoreProduct(id) {
  const sql = `
    UPDATE produit SET actif = true, deletedat = NULL
    WHERE id = $1
    RETURNING *
  `;
  const { rows } = await pool.query(sql, [id]);
  return rows[0];
}

export default {
  createProduct,
  getProductById,
  getProducts,
  updateProduct,
  updateStock,
  softDeleteProduct,
  restoreProduct,
};