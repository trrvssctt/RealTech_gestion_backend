import InventoryModel from '../models/inventoryModel.js';
import ProductModel from '../models/productModel.js';
import pool from '../config/pg.js';
import { ApiError, asyncHandler } from '../middlewares/errorHandler.js';

export const listMovements = asyncHandler(async (req, res) => {
  const { produitid, page = 1, limit = 50, type, since } = req.query;
  const movements = await InventoryModel.listMovements({ produitid, page: Number(page), limit: Number(limit), type, since });
  res.json({ success: true, data: { movements } });
});

export const createMovement = asyncHandler(async (req, res) => {
  const { produitid, quantite, type, source, note } = req.body;
  if (!produitid || !quantite || !type) throw new ApiError(400, 'produitid, quantite et type sont requis');

  const utilisateurid = req.user?.userId || null;

  // map API type to productModel.updateStock type
  const updateType = String(type).toUpperCase() === 'IN' ? 'ADD' : String(type).toUpperCase() === 'OUT' ? 'SUBTRACT' : null;
  if (!updateType) throw new ApiError(400, 'Type invalide, doit être IN ou OUT');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // lock product row and fetch current stock
    const { rows: prodRows } = await client.query('SELECT * FROM produit WHERE id = $1 FOR UPDATE', [produitid]);
    const productRow = prodRows[0];
    if (!productRow) throw new ApiError(404, 'Produit non trouvé');

    const currentStock = Number(productRow.stock_actuel || 0);
    // If OUT, enforce stock rules
    if (updateType === 'SUBTRACT') {
      if (currentStock === 0) {
        throw new ApiError(400, 'Impossible de faire une sortie : le produit est en rupture (stock = 0)');
      }
      if (Number(quantite) > currentStock) {
        throw new ApiError(400, `Impossible de sortir ${quantite} unités : le stock actuel est de ${currentStock}`);
      }
    }

    // update stock within the transaction
    const updatedProduct = await ProductModel.updateStock(Number(produitid), quantite, updateType, client);
    if (!updatedProduct) throw new ApiError(404, 'Produit non trouvé');

    // insert movement using same client (transactional)
    const movement = await InventoryModel.createMovement({ produitid, quantite, type: String(type).toUpperCase(), source: source || 'MANUEL', utilisateurid, note, client });

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: { movement, product: updatedProduct }, message: 'Mouvement enregistré et stock mis à jour' });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});
