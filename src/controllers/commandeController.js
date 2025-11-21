/**
 * Get deleted commandes (historique)
 */
export const getDeletedCommandes = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search,
    clientId,
    dateFrom,
    dateTo,
    sortBy = 'deletedat',
    sortOrder = 'desc'
  } = req.query;
  const result = await CommandeModel.getDeletedCommandes({
    page: Number(page),
    limit: Number(limit),
    search,
    client_id: clientId ? Number(clientId) : undefined,
    minDate: dateFrom,
    maxDate: dateTo,
    sortBy,
    sortOrder,
  });
  res.json({ commandes: result });
});
/**
 * Soft delete a commande (if no payment)
 */
export const deleteCommande = asyncHandler(async (req, res) => {
  const { id } = req.params;
  // Vérifier qu'il n'y a pas de paiement
  const hasPayments = await CommandeModel.hasPayments(id);
  if (hasPayments) {
    throw new ApiError(400, 'Impossible de supprimer : des paiements sont associés à cette commande.');
  }
  // Soft delete
  const deleted = await CommandeModel.softDeleteCommande(id);
  if (!deleted) throw new ApiError(404, 'Commande non trouvée');
  res.json({ success: true, commande: deleted });
});
import CommandeModel from '../models/commandeModel.js';
import ProductModel from '../models/productModel.js';
import InventoryModel from '../models/inventoryModel.js';
import ServiceModel from '../models/serviceModel.js';
import VenteModel from '../models/venteModel.js';
import PaiementModel from '../models/paiementModel.js';
import ClientModel from '../models/clientModel.js';
import pool from '../config/pg.js';
import { ApiError, asyncHandler } from '../middlewares/errorHandler.js';
import { generateCode, generateSequentialNumber } from '../utils/codeGenenrator.js';
import { generateInvoicePNG, generateReceiptPNG, generateInvoicePDF, generateReceiptPDF } from '../services/pdfService.js';
import { config } from '../config/index.js';
import fs from 'fs/promises';
import path from 'path';
import fsSync from 'fs';
import os from 'os';

/**
 * Get all commandes with pagination and filters
 */
export const getCommandes = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search,
    statut,
    clientId,
    dateFrom,
    dateTo,
    sortBy = 'createdat',
    sortOrder = 'desc'
  } = req.query;

  const result = await CommandeModel.getCommandes({
    page: Number(page),
    limit: Number(limit),
    search,
    statut,
    client_id: clientId ? Number(clientId) : undefined,
    minDate: dateFrom,
    maxDate: dateTo,
    sortBy,
    sortOrder,
  });

  // compute payment summary fields for each commande from paiement table (batch)
  const commandes = result.commandes || [];
  const cmdIds = commandes.map(c => c.id).filter(Boolean);
  let paiementSums = [];
  if (cmdIds.length > 0) {
    try {
      paiementSums = await PaiementModel.sumPaiementsForCommandes(cmdIds);
    } catch (e) {
      paiementSums = [];
    }
  }
  const sumMap = new Map(paiementSums.map(r => [Number(r.commande_id), Number(r.total || 0)]));
  const commandesWithPayment = commandes.map((c) => {
    const total = Number(c.total_cmd ?? c.montant_total ?? 0);
    const paid = Number(sumMap.get(Number(c.id)) ?? Number(c.montant_paye ?? 0) ?? 0);
    const statutPaiement = paid <= 0 ? 'NON_PAYEE' : (paid >= total ? 'PAYEE' : 'PARTIELLE');
    const montant_restant = Math.max(total - paid, 0);
    return Object.assign({}, c, { montant_paye: paid, montant_restant, statut_paiement: statutPaiement });
  });

  res.json({
    success: true,
    data: {
      commandes: commandesWithPayment,
      pagination: {
        currentPage: result.currentPage,
        totalPages: result.totalPages,
        totalItems: result.total,
        itemsPerPage: Number(limit),
        hasNextPage: result.currentPage < result.totalPages,
        hasPrevPage: result.currentPage > 1,
      },
    },
  });
});

/**
 * Get commande by ID
 */
export const getCommandeById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const commande = await CommandeModel.getCommandeById(Number(id));
  if (!commande) {
    throw new ApiError(404, 'Commande non trouvée');
  }

  // attach computed payment summary fields (read authoritative sums from paiement table)
  const total = Number(commande.total_cmd ?? commande.montant_total ?? 0);
  let paid = 0;
  try {
    paid = Number(await PaiementModel.sumPaiementsByCommande(Number(id)) || 0);
  } catch (e) {
    paid = Number(commande.montant_paye ?? 0);
  }
  const statutPaiement = paid <= 0 ? 'NON_PAYEE' : (paid >= total ? 'PAYEE' : 'PARTIELLE');
  const montant_restant = Math.max(total - paid, 0);
  const enriched = Object.assign({}, commande, { montant_paye: paid, montant_restant, statut_paiement: statutPaiement });

  res.json({
    success: true,
    data: { commande: enriched },
  });
});

/**
 * Create new commande
 */
export const createCommande = asyncHandler(async (req, res) => {
  const { clientId, produits = [], services = [] } = req.body;
  const createurId = req.user?.userId;

  if ((produits.length === 0) && (services.length === 0)) {
    throw new ApiError(400, 'La commande doit contenir au moins un produit ou service');
  }

  // Verify client if provided
  if (clientId) {
    const client = await ClientModel.getClientById(Number(clientId));
    if (!client || client.actif === false) {
      throw new ApiError(400, 'Client non trouvé ou inactif');
    }
  }

  let totalCmd = 0;
  const itemsForInsert = [];

  // Process products
  if (produits.length > 0) {
    for (const it of produits) {
      const product = await ProductModel.getProductById(Number(it.id));
      if (!product || product.actif === false) {
        throw new ApiError(400, `Produit non trouvé ou inactif (id: ${it.id})`);
      }
      const qty = Number(it.quantite);
      if (product.stock_actuel < qty) {
        throw new ApiError(400, `Stock insuffisant pour ${product.nom} (disponible: ${product.stock_actuel})`);
      }
      const itemTotal = Number(product.prix_unitaire) * qty;
      totalCmd += itemTotal;
      itemsForInsert.push({
        produit_id: product.id,
        nom: product.nom,
        quantite: qty,
        prix_unitaire: Number(product.prix_unitaire),
        total: itemTotal,
      });
    }
  }

  // Process services
  if (services.length > 0) {
    for (const it of services) {
      const service = await ServiceModel.getServiceById(Number(it.id));
      if (!service || service.actif === false) {
        throw new ApiError(400, `Service non trouvé ou inactif (id: ${it.id})`);
      }
      const qty = Number(it.quantite);
      const itemTotal = Number(service.prix_unitaire) * qty;
      totalCmd += itemTotal;
      // include service_id (la table commandeservice exige serviceid non null)
      itemsForInsert.push({
        produit_id: null,
        service_id: service.id,    // <-- added service_id
        nom: service.nom,
        quantite: qty,
        prix_unitaire: Number(service.prix_unitaire),
        total: itemTotal,
      });
    }
  }

  // Generate codes / numbers
  const code = generateCode('CMD');
  const last = (await CommandeModel.getCommandes({ 
    page: 1, 
    limit: 1, 
    sortBy: 'id', 
    sortOrder: 'desc',
    minDate: undefined,
    maxDate: undefined
  })).commandes[0];
  const lastNumber = last?.numero ? parseInt(String(last.numero).replace(/^C/, '')) : 0;
  const numero = generateSequentialNumber('C', lastNumber);

  // Create commande (include code and utilisateurid)
  const commande = await CommandeModel.createCommande({
    code,
    numero,
    client_id: clientId ? Number(clientId) : null,
    utilisateur_id: createurId ? Number(createurId) : null,
    date_commande: new Date(),
    montant_total: totalCmd,
    statut: 'PENDING',
    items: itemsForInsert,
  });

  // Create notification for new commande (broadcast to all users)
  try {
    const NotificationModel = await import('../models/notificationModel.js');
    NotificationModel.default.createNotification({ titre: 'Nouvelle commande', message: `Commande ${commande.numero || commande.code} créée`, meta: { commandeId: commande.id }, lu: false });
  } catch (e) {
    console.warn('Failed to create notification for new commande', e);
  }

  // Note: do NOT decrement stock at creation time. Stock will be checked and decremented
  // when the commande is validated (statut -> VALIDE) or when fully paid. This avoids
  // prematurely reserving stock for PENDING commandes.

  res.status(201).json({
    success: true,
    data: { commande },
    message: 'Commande créée avec succès',
  });
});

/**
 * Update commande
 */
export const updateCommande = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const existing = await CommandeModel.getCommandeById(Number(id));
  if (!existing) {
    throw new ApiError(404, 'Commande non trouvée');
  }

  // Role-based restrictions: EMPLOYE may process commandes (change statut) but
  // we keep other sensitive fields restricted. Remove strict ownership check so
  // employees can mark commandes as validées/confirmées/delivered when needed.
  const callerRole = String(req.user?.role || '').toUpperCase();
  if (callerRole === 'EMPLOYE') {
    // Allow employees to change processing-related statuses but still prevent
    // them from changing arbitrary fields (enforced by front-end & validators)
    const allowedStatuses = ['VALIDE','VALIDEE','CONFIRME','CONFIRMEE','LIVREE','TERMINE','TERMINEE','ANNULEE'];
    if (updateData.statut && !allowedStatuses.includes(String(updateData.statut).toUpperCase())) {
      throw new ApiError(403, 'Permissions insuffisantes: les employés peuvent uniquement mettre à jour le statut vers un état de traitement (valider/confirmer/livrer/annuler).');
    }
    // Note: ownership is not enforced here; ensure auditing/authorization elsewhere if needed
  }

  if (updateData.client_id) {
    const client = await ClientModel.getClientById(Number(updateData.client_id));
    if (!client || client.actif === false) {
      throw new ApiError(400, 'Client non trouvé ou inactif');
    }
  }

  // Prevent modifying a commande if payments have already been recorded against it
  // Business rule: only commandes with statut === 'EN_ATTENTE' can be modified.
  // If the commande is already PARTIELLE or PAYEE, reject modifications.
  const hasPayments = await CommandeModel.hasPayments(Number(id));
  const currentStatutPaiement = (existing.statut_paiement || '').toUpperCase();
  if (hasPayments || currentStatutPaiement === 'PARTIELLE' || currentStatutPaiement === 'PAYEE') {
    throw new ApiError(400, 'Impossible de modifier la commande: la commande est partiellement ou totalement réglée.');
  }

  // If statut is being changed to a final state => apply stock changes for produits
  const newStatut = typeof updateData.statut === 'string' ? String(updateData.statut).trim().toUpperCase() : null;
  const oldStatut = typeof existing.statut === 'string' ? String(existing.statut).trim().toUpperCase() : null;
  // Treat confirmed/validated/finished states as final — cannot be edited
  const finalStatuts = ['VALIDE','VALIDEE','CONFIRME','CONFIRMEE','TERMINE','TERMINEE','LIVREE','COMPLETED','FINISHED'];

  // If the commande is already in a final state, disallow any modification (business rule)
  if (oldStatut && finalStatuts.includes(oldStatut)) {
    throw new ApiError(400, 'Impossible de modifier la commande: la commande est confirmée ou dans un état final.');
  }

  // Only apply stock update when changing from a non-final to a final statut
  const shouldApplyStock = newStatut && !finalStatuts.includes(oldStatut) && finalStatuts.includes(newStatut);

  if (shouldApplyStock) {
    const clientConn = await pool.connect();
    try {
      await clientConn.query('BEGIN');

      // fetch produit lines locked FOR UPDATE to prevent race conditions
      const { rows: produitLignes } = await clientConn.query(
        `SELECT produitid AS produit_id, quantite
         FROM commandeproduit
         WHERE commandeid = $1 AND (deletedat IS NULL)`,
        [Number(id)]
      );

      // decrement stock for each product line
      for (const line of produitLignes) {
        const produitId = line.produit_id;
        const qty = Number(line.quantite || 0);
        if (!produitId) continue; // skip service lines or malformed

        // lock the product row
        const { rows: pRows } = await clientConn.query(
          `SELECT stock_actuel FROM produit WHERE id = $1 FOR UPDATE`,
          [produitId]
        );
        const prodRow = pRows[0];
        if (!prodRow) {
          throw new ApiError(400, `Produit introuvable (id: ${produitId})`);
        }
        const currentStock = Number(prodRow.stock_actuel || 0);
        if (currentStock < qty) {
          throw new ApiError(400, `Stock insuffisant pour le produit id=${produitId} (disponible: ${currentStock}, requis: ${qty})`);
        }

        await clientConn.query(
          `UPDATE produit SET stock_actuel = stock_actuel - $1, updatedat = CURRENT_TIMESTAMP WHERE id = $2`,
          [qty, produitId]
        );
      }

      // update commande statut within same transaction
      const fields = [];
      const values = [];
      let idx = 1;
      for (const key in updateData) {
        fields.push(`"${key}" = $${idx}`);
        values.push(updateData[key]);
        idx++;
      }
      values.push(Number(id));
      const sql = `
        UPDATE commande SET ${fields.join(', ')}, updatedat = CURRENT_TIMESTAMP
        WHERE id = $${idx}
        RETURNING *
      `;
      const { rows: updatedRows } = await clientConn.query(sql, values);
      const updatedCommande = updatedRows[0];

      await clientConn.query('COMMIT');
      // After commit, create a Vente record representing this finalized commande
      try {
        // build items array from commandeproduit and commandeservice
        const { rows: produitLignes } = await pool.query(
          `SELECT cp.id, cp.produitid AS produit_id, cp.quantite, cp.prix_total as prix_total, p.nom AS produit_nom, p.prix_unitaire AS produit_prix_unitaire
           FROM commandeproduit cp
           LEFT JOIN produit p ON p.id = cp.produitid
           WHERE cp.commandeid = $1 AND (cp.deletedat IS NULL) ORDER BY cp.id`,
          [Number(id)]
        );
        const { rows: serviceLignes } = await pool.query(
          `SELECT cs.id, cs.serviceid AS service_id, cs.quantite, cs.prix_total as prix_total, s.nom AS service_nom, s.prix_unitaire AS service_prix_unitaire
           FROM commandeservice cs
           LEFT JOIN service s ON s.id = cs.serviceid
           WHERE cs.commandeid = $1 AND (cs.deletedat IS NULL) ORDER BY cs.id`,
          [Number(id)]
        );

        const venteItems = [];
        for (const pl of produitLignes) {
          venteItems.push({ produit_id: pl.produit_id, service_id: null, commande_id: Number(id), nom: pl.produit_nom || `Produit #${pl.produit_id}`, quantite: pl.quantite, prix_unitaire: pl.produit_prix_unitaire || 0, total: Number(pl.prix_total || 0) });
        }
        for (const sl of serviceLignes) {
          venteItems.push({ produit_id: null, service_id: sl.service_id, commande_id: Number(id), nom: sl.service_nom || `Service #${sl.service_id}`, quantite: sl.quantite, prix_unitaire: sl.service_prix_unitaire || 0, total: Number(sl.prix_total || 0) });
        }

        // create Vente record
        const venteCode = `VTE-${Date.now()}`;
        const lastVente = (await VenteModel.getVentes({ page: 1, limit: 1, sortBy: 'id', sortOrder: 'desc' })).ventes[0];
        const lastNumero = lastVente?.numero ? parseInt(String(lastVente.numero).replace(/^V/, '')) : 0;
        const venteNumero = `V${(lastNumero + 1).toString().padStart(6, '0')}`;

        const vente = await VenteModel.createVente({ code: venteCode, numero: venteNumero, montant: updatedCommande.total_cmd || updatedCommande.montant_total || 0, statut: 'VALIDE', date: new Date(), commandeId: Number(id), utilisateurId: req.user?.userId ? Number(req.user.userId) : null, items: venteItems });
      } catch (errCreateVente) {
        // log and continue — vente creation failure shouldn't break the update response
        console.error('Erreur création vente après validation commande:', errCreateVente);
      }

      // return fresh commande (DB committed)
      res.json({
        success: true,
        data: { commande: updatedCommande },
        message: 'Commande mise à jour et stocks ajustés (si applicable)',
      });
    } catch (err) {
      await clientConn.query('ROLLBACK').catch(() => {});
      if (err instanceof ApiError) throw err;
      throw new ApiError(500, 'Erreur lors de la validation de la commande', err.message);
    } finally {
      clientConn.release();
    }
  } else {
    // If items (produits/services) are provided, apply item diffs atomically
    if ((Array.isArray(updateData.produits) && updateData.produits.length > 0) || (Array.isArray(updateData.services) && updateData.services.length > 0)) {
      const clientConn = await pool.connect();
      try {
        await clientConn.query('BEGIN');

        // --- PRODUITS ---
        const incomingProds = Array.isArray(updateData.produits) ? updateData.produits : [];
        const { rows: existingProds } = await clientConn.query(`SELECT id, produitid, quantite FROM commandeproduit WHERE commandeid = $1 AND (deletedat IS NULL)`, [Number(id)]);
        const existingByLineId = new Map(existingProds.map(r => [Number(r.id), r]));
        const existingByProductId = new Map(existingProds.filter(r => r.produitid).map(r => [Number(r.produitid), r]));

        // Track which existing line ids were matched by incoming items
        const matchedLineIds = new Set();

        // Process incoming items: they may be in one of formats:
        // - { id: <productId>, quantite }  => means add/merge product line
        // - { lineId: <commandeproduit id>, quantite } => update existing line
        // - { id: <existing commandeproduit id>, quantite } => ambiguous; we attempt to resolve by checking existing line id first
        for (const p of incomingProds) {
          const rawId = p.id ?? p.produit_id ?? p.produitid ?? null;
          const lineIdCandidate = p.lineId ?? p.itemId ?? null;
          const qty = Number(p.quantite ?? p.qte ?? 1);

          // Prefer explicit lineId
          if (lineIdCandidate) {
            const lineId = Number(lineIdCandidate);
            const existing = existingByLineId.get(lineId);
            if (!existing) throw new ApiError(400, `Ligne produit introuvable (id: ${lineId})`);
            matchedLineIds.add(lineId);
            // update quantity if changed
            if (Number(existing.quantite || 0) !== qty) {
              const pRow = (await clientConn.query('SELECT prix_unitaire FROM produit WHERE id = $1', [Number(existing.produitid)])).rows[0];
              const unit = pRow ? Number(pRow.prix_unitaire || 0) : 0;
              const prix_total = unit * qty;
              await clientConn.query(`UPDATE commandeproduit SET quantite = $1, prix_total = $2, updatedat = CURRENT_TIMESTAMP WHERE id = $3`, [qty, prix_total, lineId]);
            }
            continue;
          }

          // If rawId corresponds to an existing line id (sent by some clients), prefer that
          const rawAsNum = Number(rawId);
          if (!Number.isNaN(rawAsNum) && existingByLineId.has(rawAsNum)) {
            const existing = existingByLineId.get(rawAsNum);
            matchedLineIds.add(rawAsNum);
            if (Number(existing.quantite || 0) !== qty) {
              const pRow = (await clientConn.query('SELECT prix_unitaire FROM produit WHERE id = $1', [Number(existing.produitid)])).rows[0];
              const unit = pRow ? Number(pRow.prix_unitaire || 0) : 0;
              const prix_total = unit * qty;
              await clientConn.query(`UPDATE commandeproduit SET quantite = $1, prix_total = $2, updatedat = CURRENT_TIMESTAMP WHERE id = $3`, [qty, prix_total, rawAsNum]);
            }
            continue;
          }

          // Otherwise, treat rawId as a productId -> add or merge into existing product line
          if (!Number.isNaN(rawAsNum)) {
            const prodId = rawAsNum;
            const existingLine = existingByProductId.get(prodId);
            if (existingLine) {
              // update existing product line quantity
              const newQty = Number(existingLine.quantite || 0) !== qty ? qty : existingLine.quantite;
              if (Number(existingLine.quantite || 0) !== qty) {
                const pRow = (await clientConn.query('SELECT prix_unitaire FROM produit WHERE id = $1', [prodId])).rows[0];
                const unit = pRow ? Number(pRow.prix_unitaire || 0) : 0;
                const prix_total = unit * qty;
                await clientConn.query(`UPDATE commandeproduit SET quantite = $1, prix_total = $2, updatedat = CURRENT_TIMESTAMP WHERE id = $3`, [qty, prix_total, Number(existingLine.id)]);
              }
              matchedLineIds.add(Number(existingLine.id));
              continue;
            }

            // New product insertion
            const pRow = (await clientConn.query('SELECT id, nom, prix_unitaire, stock_actuel FROM produit WHERE id = $1', [prodId])).rows[0];
            if (!pRow) throw new ApiError(400, `Produit introuvable (id: ${prodId})`);
            if (Number(pRow.stock_actuel || 0) < qty) {
              throw new ApiError(400, `Stock insuffisant pour ${pRow.nom} (disponible: ${pRow.stock_actuel})`);
            }
            const unit = Number(pRow.prix_unitaire || 0);
            const total = unit * qty;
            await clientConn.query(`INSERT INTO commandeproduit (quantite, prix_total, produitid, commandeid, createdat) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`, [qty, total, prodId, Number(id)]);
            continue;
          }

          // If we reach here, we couldn't interpret the incoming item
          throw new ApiError(400, 'Format invalide pour une ligne produit');
        }

        // Delete any existing product lines that were not present in incoming payload
        for (const ep of existingProds) {
          if (!matchedLineIds.has(Number(ep.id))) {
            await clientConn.query(`DELETE FROM commandeproduit WHERE id = $1`, [Number(ep.id)]);
          }
        }

        // --- SERVICES ---
        const incomingServs = Array.isArray(updateData.services) ? updateData.services : [];
        const { rows: existingServs } = await clientConn.query(`SELECT id, serviceid, quantite FROM commandeservice WHERE commandeid = $1 AND (deletedat IS NULL)`, [Number(id)]);
        const existingServByLineId = new Map(existingServs.map(r => [Number(r.id), r]));
        const existingServByServiceId = new Map(existingServs.filter(r => r.serviceid).map(r => [Number(r.serviceid), r]));

        const matchedServLineIds = new Set();

        for (const s of incomingServs) {
          const rawId = s.id ?? s.service_id ?? s.serviceid ?? null;
          const lineIdCandidate = s.lineId ?? s.itemId ?? null;
          const qty = Number(s.quantite ?? s.qte ?? 1);

          if (lineIdCandidate) {
            const lineId = Number(lineIdCandidate);
            const existing = existingServByLineId.get(lineId);
            if (!existing) throw new ApiError(400, `Ligne service introuvable (id: ${lineId})`);
            matchedServLineIds.add(lineId);
            if (Number(existing.quantite || 0) !== qty) {
              const sRow = (await clientConn.query('SELECT prix_unitaire FROM service WHERE id = $1', [Number(existing.serviceid)])).rows[0];
              const unit = sRow ? Number(sRow.prix_unitaire || 0) : 0;
              const prix_total = unit * qty;
              await clientConn.query(`UPDATE commandeservice SET quantite = $1, prix_total = $2, updatedat = CURRENT_TIMESTAMP WHERE id = $3`, [qty, prix_total, lineId]);
            }
            continue;
          }

          const rawAsNum = Number(rawId);
          if (!Number.isNaN(rawAsNum) && existingServByLineId.has(rawAsNum)) {
            const existing = existingServByLineId.get(rawAsNum);
            matchedServLineIds.add(rawAsNum);
            if (Number(existing.quantite || 0) !== qty) {
              const sRow = (await clientConn.query('SELECT prix_unitaire FROM service WHERE id = $1', [Number(existing.serviceid)])).rows[0];
              const unit = sRow ? Number(sRow.prix_unitaire || 0) : 0;
              const prix_total = unit * qty;
              await clientConn.query(`UPDATE commandeservice SET quantite = $1, prix_total = $2, updatedat = CURRENT_TIMESTAMP WHERE id = $3`, [qty, prix_total, rawAsNum]);
            }
            continue;
          }

          if (!Number.isNaN(rawAsNum)) {
            const serviceId = rawAsNum;
            const existingLine = existingServByServiceId.get(serviceId);
            if (existingLine) {
              if (Number(existingLine.quantite || 0) !== qty) {
                const sRow = (await clientConn.query('SELECT prix_unitaire FROM service WHERE id = $1', [serviceId])).rows[0];
                const unit = sRow ? Number(sRow.prix_unitaire || 0) : 0;
                const prix_total = unit * qty;
                await clientConn.query(`UPDATE commandeservice SET quantite = $1, prix_total = $2, updatedat = CURRENT_TIMESTAMP WHERE id = $3`, [qty, prix_total, Number(existingLine.id)]);
              }
              matchedServLineIds.add(Number(existingLine.id));
              continue;
            }

            // Insert new service line
            const sRow = (await clientConn.query('SELECT id, nom, prix_unitaire FROM service WHERE id = $1', [serviceId])).rows[0];
            if (!sRow) throw new ApiError(400, `Service introuvable (id: ${serviceId})`);
            const unit = Number(sRow.prix_unitaire || 0);
            const total = unit * qty;
            await clientConn.query(`INSERT INTO commandeservice (quantite, prix_total, serviceid, commandeid, createdat) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`, [qty, total, serviceId, Number(id)]);
            continue;
          }

          throw new ApiError(400, 'Format invalide pour une ligne service');
        }

        // Delete any existing service lines not matched
        for (const es of existingServs) {
          if (!matchedServLineIds.has(Number(es.id))) {
            await clientConn.query(`DELETE FROM commandeservice WHERE id = $1`, [Number(es.id)]);
          }
        }

        // Recompute totals
        const { rows: prodSumRows } = await clientConn.query(`SELECT COALESCE(SUM(prix_total),0) AS sum FROM commandeproduit WHERE commandeid = $1 AND (deletedat IS NULL)`, [Number(id)]);
        const { rows: servSumRows } = await clientConn.query(`SELECT COALESCE(SUM(prix_total),0) AS sum FROM commandeservice WHERE commandeid = $1 AND (deletedat IS NULL)`, [Number(id)]);
        const prodSum = Number(prodSumRows[0]?.sum || 0);
        const servSum = Number(servSumRows[0]?.sum || 0);
        const totalNew = prodSum + servSum;

        // Update commande totals (DB column is `total_cmd`; avoid referencing non-existent `montant_total`)
        await clientConn.query(`UPDATE commande SET total_cmd = $1, updatedat = CURRENT_TIMESTAMP WHERE id = $2`, [totalNew, Number(id)]);

        await clientConn.query('COMMIT');
        clientConn.release();

        const refreshed = await CommandeModel.getCommandeById(Number(id));
        return res.json({ success: true, data: { commande: refreshed }, message: 'Commande et lignes mises à jour' });
      } catch (e) {
        await clientConn.query('ROLLBACK').catch(() => {});
        try { clientConn.release(); } catch (er) { /* ignore */ }
        // Log incoming payload and user context to help debugging
        console.error('updateCommande lines error: payload=', { id: Number(id), body: updateData, user: req.user?.userId || null }, e && e.stack ? e.stack : e);
        if (e instanceof ApiError) throw e;
        // Surface the original error message to the client for diagnostics
        throw new ApiError(500, `Erreur lors de la mise à jour des lignes de commande: ${e?.message || String(e)}`);
      }
    }

    // fallback: normal update (no stock changes)
    const commande = await CommandeModel.updateCommande(Number(id), updateData);
    res.json({
      success: true,
      data: { commande },
      message: 'Commande mise à jour avec succès',
    });
  }
});

/**
 * Generate invoice for commande
 */
export const generateInvoice = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const commande = await CommandeModel.getCommandeById(Number(id));
  if (!commande) throw new ApiError(404, 'Commande non trouvée');
  // Use a DB transaction and row-level locking to avoid race conditions when
  // generating invoices concurrently. If an invoice already exists for this
  // commande, return it instead of throwing a 409 error.
  const clientConn = await pool.connect();
  try {
    await clientConn.query('BEGIN');

    // Lock any existing facture rows for this commande (if present)
    const { rows: existingInvoices } = await clientConn.query('SELECT * FROM facture WHERE commandeid = $1 FOR UPDATE', [commande.id]);
    if (existingInvoices.length > 0) {
      const invoice = existingInvoices[0];
      const downloadUrl = `/api/commandes/${commande.id}/invoice/download`;
      await clientConn.query('COMMIT');
      clientConn.release();
      return res.json({ success: true, data: { invoice, downloadUrl }, message: 'Facture déjà générée pour cette commande' });
    }

    // Fetch ligne produits and services under same connection
    const { rows: produits } = await clientConn.query(
      `SELECT cp.*, p.nom AS produit_nom, p.prix_unitaire AS produit_prix_unitaire
       FROM commandeproduit cp
       LEFT JOIN produit p ON p.id = cp.produitid
       WHERE cp.commandeid = $1 AND (cp.deletedat IS NULL) ORDER BY cp.id`,
      [commande.id]
    );
    const { rows: services } = await clientConn.query(
      `SELECT cs.*, s.nom AS service_nom, s.prix_unitaire AS service_prix_unitaire
       FROM commandeservice cs
       LEFT JOIN service s ON s.id = cs.serviceid
       WHERE cs.commandeid = $1 AND (cs.deletedat IS NULL) ORDER BY cs.id`,
      [commande.id]
    );

    const items = [];
    for (const p of produits) {
      const qty = Number(p.quantite || 0);
      const total = Number(p.prix_total || 0);
      const unit = p.produit_prix_unitaire != null ? Number(p.produit_prix_unitaire) : (qty ? total / qty : 0);
      items.push({ nom: p.produit_nom || `Produit #${p.produitid || p.id}`, quantite: qty, prix_unitaire: unit, total });
    }
    for (const s of services) {
      const qty = Number(s.quantite || 0);
      const total = Number(s.prix_total || 0);
      const unit = s.service_prix_unitaire != null ? Number(s.service_prix_unitaire) : (qty ? total / qty : 0);
      items.push({ nom: s.service_nom || `Service #${s.serviceid || s.id}`, quantite: qty, prix_unitaire: unit, total });
    }

    const totalFromDb = commande.total_cmd ?? commande.montant_total ?? null;
    const totalSum = items.reduce((acc, it) => acc + (Number(it.total) || 0), 0);
    const total = Number(totalFromDb != null ? totalFromDb : totalSum);

    // Generate invoice number/code (deterministic sequential)
    const lastInvoiceRow = (await clientConn.query('SELECT numero FROM facture ORDER BY id DESC LIMIT 1')).rows[0];
    const lastNumber = lastInvoiceRow?.numero ? parseInt(String(lastInvoiceRow.numero).replace(/^F/, '')) : 0;
    const numero = generateSequentialNumber('F', lastNumber);
    const code = generateCode('FAC');

  const clientInfo = commande.client || { nom: commande.client_nom, prenom: commande.client_prenom, email: commande.client_email, telephone: commande.client_telephone || '' };
  const invoiceData = { numero, date: new Date(), client: { nom: clientInfo.nom || '', prenom: clientInfo.prenom || '', email: clientInfo.email || '', telephone: clientInfo.telephone || '' }, items, total };

    // create PNG + PDF using service
    const { pngPath, pdfPath } = await generateInvoicePDF(invoiceData);

    // Insert invoice record under the same transaction
    const { rows } = await clientConn.query(
      `INSERT INTO facture (code, numero, fichier, fichier_pdf, commandeid, date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [code, numero, pngPath, pdfPath, commande.id, new Date()]
    );
  const invoice = rows[0];
  const downloadUrl = `/api/commandes/${commande.id}/invoice/download`;

  await clientConn.query('COMMIT');
  clientConn.release();

  return res.json({ success: true, data: { invoice, downloadUrl }, message: 'Facture générée avec succès' });
  } catch (err) {
    await clientConn.query('ROLLBACK').catch(() => {});
    clientConn.release();
    console.error('generateInvoice error:', err && err.stack ? err.stack : err);
    if (err instanceof ApiError) throw err;
    throw new ApiError(500, 'Erreur lors de la génération de la facture', err?.message || String(err));
  }
});


/**
 * Add a produit line to a commande
 */
export const addProduitLine = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { produitId, quantite } = req.body;
  if (!produitId) throw new ApiError(400, 'Produit id requis');
  const produit = await ProductModel.getProductById(Number(produitId));
  if (!produit) throw new ApiError(404, 'Produit non trouvé');
  const qty = Number(quantite || 1);
  // Strict availability check
  if (Number(produit.stock_actuel || 0) < qty) {
    throw new ApiError(400, `Stock insuffisant pour ${produit.nom} (disponible: ${produit.stock_actuel})`);
  }
  const total = Number(produit.prix_unitaire || 0) * qty;
  // Prevent duplicate unique constraint by merging with existing ligne if present
  const { rows: existingRows } = await pool.query(
    `SELECT id, quantite FROM commandeproduit WHERE commandeid = $1 AND produitid = $2 AND (deletedat IS NULL) LIMIT 1`,
    [Number(id), Number(produitId)]
  );
  if (existingRows.length > 0) {
    const existing = existingRows[0];
    const newQty = Number(existing.quantite || 0) + qty;
    const newTotal = Number(produit.prix_unitaire || 0) * newQty;
    const updated = await CommandeModel.updateCommandeProduit(Number(existing.id), { quantite: newQty, prix_total: newTotal });
    return res.status(200).json({ success: true, data: { item: updated }, message: 'Ligne produit mise à jour (fusionnée)' });
  }

  const item = await CommandeModel.addCommandeProduit(Number(id), { produit_id: Number(produitId), nom: produit.nom, quantite: qty, prix_unitaire: Number(produit.prix_unitaire), total });
  res.status(201).json({ success: true, data: { item }, message: 'Ligne produit ajoutée' });
});

/**
 * Update a produit line
 */
export const updateProduitLine = asyncHandler(async (req, res) => {
  const { id, itemId } = req.params;
  const { quantite } = req.body;
  // fetch the existing ligne to determine produit id
  const { rows: lignes } = await pool.query(`SELECT produitid AS produit_id FROM commandeproduit WHERE id = $1`, [Number(itemId)]);
  const ligne = lignes[0];
  if (!ligne) throw new ApiError(404, 'Ligne produit non trouvée');
  const produitId = ligne.produit_id;
  // fetch product to get unit price
  const product = produitId ? await ProductModel.getProductById(Number(produitId)) : null;
  const unitPrice = product ? Number(product.prix_unitaire || 0) : 0;
  const qty = Number(quantite || 0);
  // Strict availability check - allow update only if stock suffices (current stock + existing line qty)
  // fetch existing line qty
  const { rows: existingLineRows } = await pool.query(`SELECT quantite FROM commandeproduit WHERE id = $1`, [Number(itemId)]);
  const existingQty = existingLineRows[0] ? Number(existingLineRows[0].quantite || 0) : 0;
  const available = product ? Number(product.stock_actuel || 0) + existingQty : 0;
  if (available < qty) {
    throw new ApiError(400, `Stock insuffisant pour ${product.nom} (disponible: ${product.stock_actuel}, ligne actuelle: ${existingQty})`);
  }
  const prix_total = Number(unitPrice) * qty;
  const updated = await CommandeModel.updateCommandeProduit(Number(itemId), { quantite, prix_total });
  if (!updated) throw new ApiError(404, 'Ligne produit non trouvée');
  res.json({ success: true, data: { item: updated }, message: 'Ligne produit mise à jour' });
});

/**
 * Delete a produit line
 */
export const deleteProduitLine = asyncHandler(async (req, res) => {
  const { id, itemId } = req.params;
  await CommandeModel.removeCommandeProduit(Number(itemId));
  res.json({ success: true, message: 'Ligne produit supprimée' });
});

// Services lines
export const addServiceLine = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { serviceId, quantite } = req.body;
  if (!serviceId) throw new ApiError(400, 'Service id requis');
  const service = await ServiceModel.getServiceById(Number(serviceId));
  if (!service) throw new ApiError(404, 'Service non trouvé');
  const qty = Number(quantite || 1);
  const total = Number(service.prix_unitaire || 0) * qty;
  // Prevent duplicate (commandeid, serviceid) unique constraint error by merging if exists
  const { rows: existingRows } = await pool.query(
    `SELECT id, quantite FROM commandeservice WHERE commandeid = $1 AND serviceid = $2 AND (deletedat IS NULL) LIMIT 1`,
    [Number(id), Number(serviceId)]
  );
  if (existingRows.length > 0) {
    const existing = existingRows[0];
    const newQty = Number(existing.quantite || 0) + qty;
    const newTotal = Number(service.prix_unitaire || 0) * newQty;
    const updated = await CommandeModel.updateCommandeService(Number(existing.id), { quantite: newQty, prix_total: newTotal });
    return res.status(200).json({ success: true, data: { item: updated }, message: 'Ligne service mise à jour (fusionnée)' });
  }

  const item = await CommandeModel.addCommandeService(Number(id), { service_id: Number(serviceId), nom: service.nom, quantite: qty, prix_unitaire: Number(service.prix_unitaire), total });
  res.status(201).json({ success: true, data: { item }, message: 'Ligne service ajoutée' });
});

export const updateServiceLine = asyncHandler(async (req, res) => {
  const { id, itemId } = req.params;
  const { quantite } = req.body;
  // fetch the existing ligne to determine service id
  const { rows: lignes } = await pool.query(`SELECT serviceid AS service_id FROM commandeservice WHERE id = $1`, [Number(itemId)]);
  const ligne = lignes[0];
  if (!ligne) throw new ApiError(404, 'Ligne service non trouvée');
  const serviceId = ligne.service_id;
  // fetch service to get unit price
  const service = serviceId ? await ServiceModel.getServiceById(Number(serviceId)) : null;
  const unitPrice = service ? Number(service.prix_unitaire || 0) : 0;
  const prix_total = Number(unitPrice) * Number(quantite || 0);
  const updated = await CommandeModel.updateCommandeService(Number(itemId), { quantite, prix_total });
  if (!updated) throw new ApiError(404, 'Ligne service non trouvée');
  res.json({ success: true, data: { item: updated }, message: 'Ligne service mise à jour' });
});

export const deleteServiceLine = asyncHandler(async (req, res) => {
  const { id, itemId } = req.params;
  await CommandeModel.removeCommandeService(Number(itemId));
  res.json({ success: true, message: 'Ligne service supprimée' });
});

/**
 * Register a payment for a commande and generate documents according to payment status
 * POST /api/commandes/:id/payments
 * body: { montant, statut_paiement: 'PAYEE'|'PARTIELLE'|'NON_PAYEE', methode }
 */
/**
 * Register a payment for a commande and generate documents according to payment status
 * POST /api/commandes/:id/payments
 * body: { montant, statut_paiement: 'PAYEE'|'PARTIELLE'|'NON_PAYEE', methode }
 */
/**
 * Register a payment for a commande and generate documents according to payment status
 * POST /api/commandes/:id/payments
 * body: { montant, statut_paiement: 'PAYEE'|'PARTIELLE'|'NON_PAYEE', methode }
 */
export const registerPayment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  // NOTE: use the real name "statut_paiement" so subsequent references exist
  const {
    montant: rawMontant = 0,
    statut_paiement = 'NON_PAYEE',
    methode = 'UNKNOWN',
    mode_paiement = null,
  } = req.body;

  // Normalize payment mode: accept mode_paiement or methode
  const allowedModes = ['cash', 'mobile_money', 'carte', 'cheque', 'virement'];
  const mode = (mode_paiement || methode || '').toString().toLowerCase();
  if (!allowedModes.includes(mode)) {
    throw new ApiError(400, `Mode de paiement invalide. Valeurs acceptées: ${allowedModes.join(', ')}`);
  }

  // Normalize/validate montant
  const montant = Number(rawMontant || 0);
  if (Number.isNaN(montant) || montant < 0) {
    throw new ApiError(400, 'Montant invalide pour le paiement');
  }

  console.info(`[registerPayment] start - commande=${id} montant=${montant} statut_paiement=${statut_paiement} user=${req.user?.userId || 'anon'}`);

  const commande = await CommandeModel.getCommandeById(Number(id));
  if (!commande) throw new ApiError(404, 'Commande non trouvée');

  // Disallow payments if already fully paid
  const totalOrderCheck = Number(commande.total_cmd ?? commande.montant_total ?? 0);
  const previousPaid = Number(await PaiementModel.sumPaiementsByCommande(commande.id) || 0);
  if (previousPaid >= totalOrderCheck && totalOrderCheck > 0) {
    throw new ApiError(400, 'Commande déjà réglée');
  }

  const clientConn = await pool.connect();
  try {
    await clientConn.query('BEGIN');

    // lock product rows and ensure availability (corrige LEFT JOIN -> INNER JOIN + FOR UPDATE)
    const { rows: produitLignesLocked } = await clientConn.query(
      `SELECT cp.id, cp.produitid AS produit_id, cp.quantite, p.stock_actuel
       FROM commandeproduit cp
       INNER JOIN produit p ON p.id = cp.produitid
       WHERE cp.commandeid = $1 AND (cp.deletedat IS NULL) AND cp.produitid IS NOT NULL
       FOR UPDATE OF p`,
      [Number(id)]
    );

    for (const pl of produitLignesLocked) {
      const need = Number(pl.quantite || 0);
      const avail = Number(pl.stock_actuel || 0);
      if (avail < need) {
        throw new ApiError(400, `Stock insuffisant pour le produit id=${pl.produit_id} (disponible: ${avail}, requis: ${need})`);
      }
    }

    // Validate montant against remaining before inserting
    const remainingBefore = Math.max(totalOrderCheck - previousPaid, 0);
    if (montant > remainingBefore + 0.0001) {
      throw new ApiError(400, `Montant trop élevé, il reste seulement ${remainingBefore} à payer`);
    }

    // Build vente items (idem)
    const { rows: produits } = await clientConn.query(
      `SELECT cp.*, p.nom AS produit_nom, p.prix_unitaire AS produit_prix_unitaire
       FROM commandeproduit cp
       LEFT JOIN produit p ON p.id = cp.produitid
       WHERE cp.commandeid = $1 AND (cp.deletedat IS NULL) ORDER BY cp.id`,
      [commande.id]
    );
    const { rows: services } = await clientConn.query(
      `SELECT cs.*, s.nom AS service_nom, s.prix_unitaire AS service_prix_unitaire
       FROM commandeservice cs
       LEFT JOIN service s ON s.id = cs.serviceid
       WHERE cs.commandeid = $1 AND (cs.deletedat IS NULL) ORDER BY cs.id`,
      [commande.id]
    );

    const venteItems = [];
    for (const p of produits) {
      venteItems.push({
        produit_id: p.produitid,
        service_id: null,
        commande_id: commande.id,
        nom: p.produit_nom || `Produit #${p.produitid}`,
        quantite: Number(p.quantite || 0),
        prix_unitaire: Number(p.produit_prix_unitaire || 0),
        total: Number(p.prix_total || 0)
      });
    }
    for (const s of services) {
      venteItems.push({
        produit_id: null,
        service_id: s.serviceid,
        commande_id: commande.id,
        nom: s.service_nom || `Service #${s.serviceid}`,
        quantite: Number(s.quantite || 0),
        prix_unitaire: Number(s.service_prix_unitaire || 0),
        total: Number(s.prix_total || 0)
      });
    }

    // Persist canonical paiement record
    let paiementRecord = null;
    try {
      paiementRecord = await PaiementModel.createPaiement({ commande_id: commande.id, montant: montant, mode_paiement: mode }, clientConn);
    } catch (ePai) {
      console.error('[registerPayment] failed to insert into paiement table', ePai && ePai.stack ? ePai.stack : ePai);
      // continue, but throw since paiement is fundamental
      throw new ApiError(500, 'Erreur lors de l enregistrement du paiement (insertion paiement)');
    }

    // Defer creating vente (receipt) until after commit to keep the request fast.
    // We keep venteItems in memory and create the vente in postCommitJob (after COMMIT).
    let vente = null;

    // Compute aggregates (now with new paiement inserted)
    const newPaid = previousPaid + montant;
    const remaining = Math.max(totalOrderCheck - newPaid, 0);

    const computedStatutPaiement = newPaid >= totalOrderCheck ? 'PAYEE' : 'PARTIELLE';
    const computedStatut = newPaid >= totalOrderCheck ? 'TERMINEE' : 'PARTIELLE';

    // Persist canonical payment aggregates into commande (within transaction)
    try {
      const colsRes2 = await clientConn.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'commande' AND column_name IN ('montant_paye','montant_restant','statut','statut_paiement')`);
      const existingCols2 = new Set(colsRes2.rows.map(r => r.column_name));
      const setParts2 = [];
      const values2 = [];
      let idx2 = 1;

      if (existingCols2.has('montant_paye')) {
        setParts2.push(`montant_paye = $${idx2}`);
        values2.push(newPaid);
        idx2++;
      }
      if (existingCols2.has('montant_restant')) {
        setParts2.push(`montant_restant = $${idx2}`);
        values2.push(remaining);
        idx2++;
      }
      if (existingCols2.has('statut')) {
        setParts2.push(`statut = $${idx2}`);
        values2.push(computedStatut);
        idx2++;
      }
      if (existingCols2.has('statut_paiement')) {
        setParts2.push(`statut_paiement = $${idx2}`);
        values2.push(computedStatutPaiement);
        idx2++;
      }

      if (setParts2.length > 0) {
        const sql2 = `UPDATE commande SET ${setParts2.join(', ')}, updatedat = CURRENT_TIMESTAMP WHERE id = $${idx2}`;
        values2.push(commande.id);
        await clientConn.query(sql2, values2);
      } else {
        await clientConn.query(`UPDATE commande SET updatedat = CURRENT_TIMESTAMP WHERE id = $1`, [commande.id]);
      }
    } catch (eUpCmd) {
      console.error(`[registerPayment] failed to update commande aggregates commande=${id} user=${req.user?.userId || 'anon'}`, eUpCmd && eUpCmd.stack ? eUpCmd.stack : eUpCmd);
      throw new ApiError(500, 'Erreur mise à jour commande', eUpCmd?.message || String(eUpCmd));
    }

    // If commande is CONFIRMEE or payment fully covers total, decrement stock now (we already locked produit rows earlier)
    const shouldDecrementStock = (String(commande.statut || '').toUpperCase() === 'CONFIRMEE') || (computedStatutPaiement === 'PAYEE');
    if (shouldDecrementStock) {
      for (const pl of produitLignesLocked) {
        const qty = Number(pl.quantite || 0);
        if (!pl.produit_id) continue;
        // Use product model to update stock within the transaction so business rules apply
        try {
          await ProductModel.updateStock(Number(pl.produit_id), qty, 'SUBTRACT', clientConn);
        } catch (eUpd) {
          console.error('[registerPayment] failed to decrement product stock via model', eUpd && eUpd.stack ? eUpd.stack : eUpd);
          throw new ApiError(500, 'Erreur lors de la mise à jour du stock produit');
        }

        // Record inventory movement (OUT) within the same transaction for auditing
        try {
          await InventoryModel.createMovement({ produitid: Number(pl.produit_id), quantite: qty, type: 'OUT', source: 'VENTE', utilisateurid: req.user?.userId || null, note: `Vente commande ${commande.id}`, client: clientConn });
        } catch (eMove) {
          // movement failure shouldn't block the payment if stock update succeeded, but log it
          console.warn('[registerPayment] failed to create inventory movement', eMove && eMove.stack ? eMove.stack : eMove);
        }
      }
    }

    // Load company info (best-effort)
    let company = null;
    try {
      const filePath = `${config.UPLOAD_PATH}/company.json`;
      const raw = await fs.readFile(filePath, 'utf-8');
      company = JSON.parse(raw);
    } catch (e) {
      company = null;
    }

    await clientConn.query('COMMIT');

    // respond quickly; then run post-commit job asynchronously
    const responseData = { vente, paiement: paiementRecord };
    responseData.payment = { montant_paye: newPaid, montant_restant: remaining, statut_paiement: computedStatutPaiement };

    // If there was already a partial payment previously (previousPaid > 0 && previousPaid < totalOrderCheck)
    if (previousPaid > 0 && previousPaid < totalOrderCheck) {
      return res.json({ success: true, data: responseData, message: `Attention, un paiement partiel existe déjà. Montant restant dû : ${remaining}` });
    }

    // Standard success message
    res.json({ success: true, data: responseData, message: 'Paiement enregistré avec succès', meta: { reste_a_payer: remaining, etat_paiement: computedStatutPaiement } });

    // fire-and-forget
    setImmediate(async () => {
      try {
        // Refresh commande (fresh snapshot)
        const freshCmd = await CommandeModel.getCommandeById(Number(id));
        // create notification about payment
        try {
          const NotificationModel = await import('../models/notificationModel.js');
          const titre = 'Paiement enregistré';
          const msg = `Paiement de ${montant} enregistré pour la commande ${freshCmd.numero || freshCmd.code}`;
          const notifMeta = { commandeId: freshCmd.id, montant };
          if (req.user && req.user.userId) notifMeta.utilisateurId = Number(req.user.userId);
          await NotificationModel.default.createNotification({ titre, message: msg, meta: notifMeta, lu: false });
          // if partial payment, notify about remaining
          if (remaining > 0) {
            const meta2 = { commandeId: freshCmd.id, reste: remaining };
            if (req.user && req.user.userId) meta2.utilisateurId = Number(req.user.userId);
            await NotificationModel.default.createNotification({ titre: 'Paiement partiel', message: `Il reste ${remaining} à payer pour la commande ${freshCmd.numero || freshCmd.code}`, meta: meta2, lu: false });
          }
        } catch (eNotif) {
          console.error('[postCommitJob] failed to create payment notification', eNotif);
        }
        let invoiceRecord = null;
        try {
          invoiceRecord = await generateInvoiceForCommande(freshCmd, company, { note: computedStatutPaiement === 'PARTIELLE' ? 'PAYEMENT PARTIEL' : undefined });
        } catch (eInvGen) {
          console.error(`[postCommitJob] invoice generation failed commande=${id}`, eInvGen && eInvGen.stack ? eInvGen.stack : eInvGen);
          invoiceRecord = null;
        }

        // Create vente/receipt outside the transaction so the initial /paiement response is fast.
        try {
          // If we didn't create a vente during transaction, create it now based on the paiement
              if (!vente && paiementRecord) {
            try {
              const venteCode = `VTE-${Date.now()}`;
              const lastVente = (await VenteModel.getVentes({ page: 1, limit: 1, sortBy: 'id', sortOrder: 'desc' })).ventes[0];
              const lastNumero = lastVente?.numero ? parseInt(String(lastVente.numero).replace(/^V/, '')) : 0;
              const venteNumero = `V${(lastNumero + 1).toString().padStart(6, '0')}`;
              vente = await VenteModel.createVente({
                code: venteCode,
                numero: venteNumero,
                montant: Number(paiementRecord.montant || montant || 0),
                statut: computedStatutPaiement === 'PAYEE' ? 'PAYEE' : 'PARTIELLE',
                date: new Date(),
                commandeId: freshCmd.id,
                utilisateurId: req.user?.userId ? Number(req.user.userId) : null,
                items: venteItems || []
              });
            } catch (eCreateV) {
              console.error('[postCommitJob] failed to create vente (deferred):', eCreateV && eCreateV.stack ? eCreateV.stack : eCreateV);
              vente = null;
            }
          }

          // Generate receipt (no DB transaction) and attempt to insert recu record
          // fetch utilisateur name for receipt metadata
          let emissionUser = null;
          try {
            const ures = await pool.query('SELECT id, nom, prenom FROM utilisateur WHERE id = $1 LIMIT 1', [req.user?.userId || null]);
            emissionUser = ures.rows[0] || null;
          } catch (eU) {
            emissionUser = null;
          }

          const receiptData = {
            numero: vente?.numero || `R-${Date.now()}`,
            date: new Date(),
            montant: Number(paiementRecord.montant || montant || 0),
            montant_deja_paye: newPaid,
            montant_restant: remaining,
            commande: { numero: freshCmd.numero, client: { prenom: freshCmd.client_prenom || freshCmd.client?.prenom, nom: freshCmd.client_nom || freshCmd.client?.nom } },
            utilisateur: emissionUser ? { id: emissionUser.id, nom: emissionUser.nom, prenom: emissionUser.prenom } : (req.user ? { id: req.user.userId } : null),
            paiement: { mode: mode, montant: Number(paiementRecord.montant || montant || 0) }
          };
          const { pngPath: recuPng, pdfPath: recuPdf } = await generateReceiptPDF(receiptData);
          try {
            const colRes = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'recu' AND column_name IN ('fichier','fichier_pdf')`);
            const recuCols = new Set(colRes.rows.map(r => r.column_name));
            if (recuCols.has('fichier_pdf')) {
              await pool.query(`INSERT INTO recu (code, numero, fichier, fichier_pdf, venteid, createdat) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`, [vente?.code || null, vente?.numero || null, recuPng || null, recuPdf || null, vente?.id || null]);
            } else if (recuCols.has('fichier')) {
              await pool.query(`INSERT INTO recu (code, numero, fichier, venteid, createdat) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`, [vente?.code || null, vente?.numero || null, recuPng || null, vente?.id || null]);
            } else {
              console.warn('[postCommitJob] recu table missing expected fichier columns; skipping recu insert');
            }
          } catch (eRecIns) {
            console.error(`[postCommitJob] failed to insert recu commande=${id}`, eRecIns && eRecIns.stack ? eRecIns.stack : eRecIns);
          }
        } catch (eRecGen) {
          console.error(`[postCommitJob] receipt generation failed commande=${id}`, eRecGen && eRecGen.stack ? eRecGen.stack : eRecGen);
        }

        // Copy invoice to Downloads (best-effort)
        try {
          const invoiceToUse = invoiceRecord || (await pool.query(`SELECT * FROM facture WHERE commandeid = $1 ORDER BY id DESC LIMIT 1`, [Number(id)])).rows[0];
          const fileRel = invoiceToUse?.fichier_pdf || invoiceToUse?.fichier || null;
          if (fileRel) {
            const uploadBase = (process.env.UPLOAD_PATH || (process.cwd() + '/realtech-backend/uploads'));
            const absPath = path.isAbsolute(fileRel) ? fileRel : path.join(uploadBase, fileRel.replace(/^\//, ''));
            if (fsSync.existsSync(absPath)) {
              const homedir = os.homedir();
              const downloadsDir = path.join(homedir, 'Downloads');
              try { await fs.mkdir(downloadsDir, { recursive: true }); } catch (e) {}
              const destPdf = path.join(downloadsDir, `facture_commande_${id}.pdf`);
              try { await fs.copyFile(absPath, destPdf); console.info(`[postCommitJob] copied invoice to ${destPdf}`); } catch (eCopy) { console.error('[postCommitJob] copy failed', eCopy); }
            }
          }
        } catch (eDI) {
          console.error('[postCommitJob] download info collection failed:', eDI && eDI.stack ? eDI.stack : eDI);
        }
      } catch (e) {
        console.error('[postCommitJob] unexpected error:', e && e.stack ? e.stack : e);
      }
    });

  } catch (err) {
    await clientConn.query('ROLLBACK').catch(() => {});
    console.error('registerPayment error:', err && err.stack ? err.stack : err);
    if (err instanceof ApiError) throw err;
    throw new ApiError(500, 'Erreur lors de l enregistrement du paiement', err?.message || String(err));
  } finally {
    clientConn.release();
  }
});

/**
 * Get list of payments for a commande
 * GET /api/commandes/:id/paiements
 */
export const getPaiementsForCommande = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const commande = await CommandeModel.getCommandeById(Number(id));
  if (!commande) throw new ApiError(404, 'Commande non trouvée');

  const paiements = await PaiementModel.getPaiementsByCommande(Number(id));
  const total = Number(commande.total_cmd ?? commande.montant_total ?? 0);
  const paid = Number(await PaiementModel.sumPaiementsByCommande(Number(id)) || 0);
  const statutPaiement = paid <= 0 ? 'NON_PAYEE' : (paid >= total ? 'PAYEE' : 'PARTIELLE');
  const montant_restant = Math.max(total - paid, 0);

  res.json({ success: true, data: { paiements, paiement_summary: { montant_paye: paid, montant_restant, statut_paiement: statutPaiement } } });
});

// helper to generate invoice and save record (creates PNG and PDF)
async function generateInvoiceForCommande(commande, company = null, opts = {}) {
  const { rows: produits } = await pool.query(
    `SELECT cp.*, p.nom AS produit_nom, p.prix_unitaire AS produit_prix_unitaire
     FROM commandeproduit cp
     LEFT JOIN produit p ON p.id = cp.produitid
     WHERE cp.commandeid = $1 AND (cp.deletedat IS NULL) ORDER BY cp.id`,
    [commande.id]
  );
  const { rows: services } = await pool.query(
    `SELECT cs.*, s.nom AS service_nom, s.prix_unitaire AS service_prix_unitaire
     FROM commandeservice cs
     LEFT JOIN service s ON s.id = cs.serviceid
     WHERE cs.commandeid = $1 AND (cs.deletedat IS NULL) ORDER BY cs.id`,
    [commande.id]
  );
  const items = [];
  for (const p of produits) {
    const qty = Number(p.quantite || 0);
    const total = Number(p.prix_total || 0);
    const unit = p.produit_prix_unitaire != null ? Number(p.produit_prix_unitaire) : (qty ? total / qty : 0);
    items.push({ nom: p.produit_nom || `Produit #${p.produitid || p.id}`, quantite: qty, prix_unitaire: unit, total });
  }
  for (const s of services) {
    const qty = Number(s.quantite || 0);
    const total = Number(s.prix_total || 0);
    const unit = s.service_prix_unitaire != null ? Number(s.service_prix_unitaire) : (qty ? total / qty : 0);
    items.push({ nom: s.service_nom || `Service #${s.serviceid || s.id}`, quantite: qty, prix_unitaire: unit, total });
  }
  const totalFromDb = commande.total_cmd ?? commande.montant_total ?? null;
  const totalSum = items.reduce((acc, it) => acc + (Number(it.total) || 0), 0);
  const total = Number(totalFromDb != null ? totalFromDb : totalSum);

  // Generate invoice number/code
  const lastInvoiceRow = (await pool.query('SELECT numero FROM facture ORDER BY id DESC LIMIT 1')).rows[0];
  const lastNumber = lastInvoiceRow?.numero ? parseInt(String(lastInvoiceRow.numero).replace(/^F/, '')) : 0;
  const numero = generateSequentialNumber('F', lastNumber);
  const code = generateCode('FAC');

  const clientInfo = commande.client || { nom: commande.client_nom, prenom: commande.client_prenom, email: commande.client_email, telephone: commande.client_telephone || '' };
  const invoiceData = { numero, date: new Date(), client: { nom: clientInfo.nom || '', prenom: clientInfo.prenom || '', email: clientInfo.email || '', telephone: clientInfo.telephone || '' }, items, total, company, opts };
  // create PNG + PDF
  const { pngPath, pdfPath } = await generateInvoicePDF(invoiceData);
  const { rows } = await pool.query(`INSERT INTO facture (code, numero, fichier, fichier_pdf, commandeid, date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`, [code, numero, pngPath, pdfPath, commande.id, new Date()]);
  return rows[0];
}

// Stream/download an invoice file for a given commande id
export const downloadInvoice = asyncHandler(async (req, res) => {
  const { id } = req.params;
  // find invoice record
  const { rows: rowsF } = await pool.query(`SELECT * FROM facture WHERE commandeid = $1 ORDER BY id DESC LIMIT 1`, [Number(id)]);
  const invoice = rowsF[0];
  if (!invoice) {
    return res.status(404).json({ success: false, message: 'Facture introuvable pour cette commande' });
  }

  // prefer fichier_pdf then fichier
  const fileRel = invoice.fichier_pdf || invoice.fichier || invoice.fichier_pdf_path || invoice.fichier_path || null;
  if (!fileRel) {
    return res.status(404).json({ success: false, message: 'Aucun fichier associé à la facture' });
  }

  // Resolve absolute path (handle several path shapes produced by our services)
  const uploadBase = (process.env.UPLOAD_PATH || (process.cwd() + '/realtech-backend/uploads'));
  let absPath = null;
  if (path.isAbsolute(fileRel)) {
    absPath = fileRel;
  } else if (fileRel.startsWith('./') || fileRel.startsWith('../')) {
    // relative path from project root
    absPath = path.resolve(process.cwd(), fileRel);
  } else if (fileRel.startsWith('uploads/') || fileRel.toLowerCase().includes('uploads')) {
    // already contains uploads folder, resolve from project root
    absPath = path.resolve(process.cwd(), fileRel);
  } else {
    absPath = path.join(uploadBase, fileRel.replace(/^\//, ''));
  }

  if (!fsSync.existsSync(absPath)) {
    return res.status(404).json({ success: false, message: 'Fichier facture non trouvé sur le serveur' });
  }

  // determine content-type
  const ext = path.extname(absPath).toLowerCase();
  const mime = ext === '.pdf' ? 'application/pdf' : (ext === '.png' ? 'image/png' : (ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'application/octet-stream'));
  // Support inline viewing or attachment download
  // Query param `inline=true` will set Content-Disposition:inline so browsers open the PDF in a tab
  const inline = String(req.query.inline || '').toLowerCase();

  // For HEAD requests, return headers only (so frontend polling with HEAD works)
  if (req.method === 'HEAD') {
    try {
      const stats = fsSync.statSync(absPath);
      res.setHeader('Content-Type', mime);
      res.setHeader('Content-Length', String(stats.size));
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.status(200).end();
    } catch (e) {
      return res.status(500).end();
    }
  }

  // Stream file with appropriate Content-Disposition
  res.setHeader('Content-Type', mime);
  const filename = `facture-${invoice.numero || invoice.id}${ext}`;
  if (inline === '1' || inline === 'true' || inline === 'yes') {
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  } else {
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  }
  res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');

  const stream = fsSync.createReadStream(absPath);
  stream.on('error', (err) => {
    console.error('stream error:', err);
    if (!res.headersSent) res.status(500).end('Erreur lecture fichier');
  });
  stream.pipe(res);
});

/**
 * Stream/download a receipt (reçu) associated with a commande.
 * We'll attempt to find a recu by joining the recu table to vente and commande.
 */
export const downloadReceipt = asyncHandler(async (req, res) => {
  const { id } = req.params; // commande id

  // attempt to find the most recent recu linked to a vente for this commande
  const { rows: recuRows } = await pool.query(
    `SELECT r.* FROM recu r
     LEFT JOIN vente v ON v.id = r.venteid
     WHERE (r.venteid IS NOT NULL AND v.commandeid = $1) OR (r.commandeid = $1) OR (r.fk_commandeid = $1)
     ORDER BY r.createdat DESC LIMIT 1`,
    [Number(id)]
  );

  const recu = recuRows[0];
  if (!recu) {
    return res.status(404).json({ success: false, message: 'Reçu introuvable pour cette commande' });
  }

  const fileRel = recu.fichier_pdf || recu.fichier || recu.fichier_pdf_path || recu.fichier_path || null;
  if (!fileRel) return res.status(404).json({ success: false, message: 'Aucun fichier associé au reçu' });

  const uploadBase = (process.env.UPLOAD_PATH || (process.cwd() + '/realtech-backend/uploads'));
  let absPath = null;
  if (path.isAbsolute(fileRel)) {
    absPath = fileRel;
  } else if (fileRel.startsWith('./') || fileRel.startsWith('../')) {
    absPath = path.resolve(process.cwd(), fileRel);
  } else {
    absPath = path.join(uploadBase, fileRel);
  }

  if (!fsSync.existsSync(absPath)) return res.status(404).json({ success: false, message: 'Fichier reçu introuvable sur le serveur' });

  const ext = path.extname(absPath).toLowerCase();
  const mime = ext === '.pdf' ? 'application/pdf' : (ext === '.png' ? 'image/png' : (ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'application/octet-stream'));

  if (req.method === 'HEAD') {
    res.setHeader('Content-Type', mime);
    return res.status(200).end();
  }

  res.setHeader('Content-Type', mime);
  const filename = `recu-${recu.numero || recu.id}${ext}`;
  const inline = String(req.query.inline || '').toLowerCase();
  if (inline === '1' || inline === 'true' || inline === 'yes') {
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  } else {
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  }
  res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');

  const stream = fsSync.createReadStream(absPath);
  stream.on('error', (err) => { console.error('recu stream error', err); try { res.end(); } catch (e) {} });
  stream.pipe(res);
});
