import VenteModel from '../models/venteModel.js';
import CommandeModel from '../models/commandeModel.js';
import PaiementModel from '../models/paiementModel.js';
import pool from '../config/pg.js';
import { generateReceiptPNG } from '../services/pdfService.js';
import {generateCode} from '../utils/helpers.js'; // si generateCode est exporté différemment, adapte l'import
import { ApiError, asyncHandler } from '../middlewares/errorHandler.js';

/**
 * Create vente (reçu)
 */
export const createVente = asyncHandler(async (req, res) => {
  // optionally accept paiementId to build a vente from a paiement
  let { commandeId = null, montant = 0, statut = 'PENDING', items = [], clientId = null, paiementId = null } = req.body;

  // If paiementId provided, try to enrich info from paiement (prefer this)
  let commande = null;
  let paiement = null;
  if (paiementId) {
    paiement = await PaiementModel.getPaiementById(Number(paiementId));
    if (paiement) {
      // override montant and commandeId when paiement exists
      commandeId = Number(paiement.commande_id);
      // montant = Number(paiement.montant);
    }
  }

  if (commandeId) {
    commande = await CommandeModel.getCommandeById(Number(commandeId));
    if (!commande) throw new ApiError(400, 'Commande introuvable');
  }

  // Générer code et numéro si non fournis (évite violation NOT NULL sur la colonne code)
  const code = generateCode ? generateCode('REC') : `REC-${Date.now()}`;
  const numero = await getNextRecuNumero();

  const venteMontant = paiement ? Number(paiement.montant || montant || 0) : Number(montant || 0);
  const vente = await VenteModel.createVente({
    code,
    numero,
    montant: venteMontant,
    statut,
    date: new Date(),
    commandeId: commandeId ? Number(commandeId) : null,
    utilisateurId: req.user && req.user.userId ? Number(req.user.userId) : null,
    items,
  });

  // generation du reçu + enregistrement
  const receiptData = {
    numero,
    date: new Date(),
    montant: venteMontant,
    commande: commande
      ? {
          numero: commande.numero,
          client: {
            prenom: commande.client_prenom || commande.client_prenom,
            nom: commande.client_nom || commande.client_nom,
          },
        }
      : { numero: null, client: null },
    paiement: paiement || null,
  };

  const recuPath = await generateReceiptPNG(receiptData);

  const { rows } = await pool.query(
    `INSERT INTO recu (code, numero, fichier, venteid, createdat) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) RETURNING *`,
    [code, numero, recuPath, vente.id]
  );
  const recu = rows[0];

  res.status(201).json({ success: true, data: { vente, recu }, message: 'Vente créée et reçu généré' });
});

/**
 * Get ventes (paginated)
 */
export const getVentes = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search,
    statut,
    clientId,
    commandeId,
    dateFrom,
    dateTo,
    sortBy = 'createdat',
    sortOrder = 'desc'
  } = req.query;
  
  const source = String(req.query.source || '').toLowerCase();

  let result;
  if (source === 'paiement') {
    result = await VenteModel.getPaiementsAsVentes({ page: Number(page), limit: Number(limit), search, client_id: clientId ? Number(clientId) : undefined, commandeId: commandeId ? Number(commandeId) : undefined, minDate: dateFrom, maxDate: dateTo, sortBy, sortOrder });
  } else {
    result = await VenteModel.getVentes({
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
  }

  res.json({
    success: true,
    data: {
      ventes: result.ventes,
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
 * Get vente by id
 */
export const getVenteById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const vente = await VenteModel.getVenteById(Number(id));
  if (!vente) throw new ApiError(404, 'Vente non trouvée');
  res.json({ success: true, data: { vente } });
});

/**
 * Update vente
 */
export const updateVente = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const existing = await VenteModel.getVenteById(Number(id));
  if (!existing) throw new ApiError(404, 'Vente non trouvée');

  const vente = await VenteModel.updateVente(Number(id), updateData);
  res.json({ success: true, data: { vente }, message: 'Vente mise à jour' });
});

/**
 * Soft delete vente
 */
export const deleteVente = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existing = await VenteModel.getVenteById(Number(id));
  if (!existing) throw new ApiError(404, 'Vente non trouvée');

  await VenteModel.softDeleteVente(Number(id));
  res.json({ success: true, message: 'Vente supprimée (soft delete)' });
});

/**
 * Helper: next recu numero (pads to 4)
 */
async function getNextRecuNumero() {
  const result = await VenteModel.getVentes({ page: 1, limit: 1, sortBy: 'id', sortOrder: 'desc' });
  const last = result.ventes && result.ventes[0];
  const lastNum = last?.numero ? parseInt(String(last.numero).replace(/\D/g, ''), 10) : 0;
  const next = lastNum + 1;
  return String(next).padStart(4, '0');
}