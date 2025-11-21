import pool from '../config/pg.js';

async function createPaiement({ commande_id, montant = 0, mode_paiement = 'cash', date_paiement = null }, clientConn = null) {
  const conn = clientConn || pool;
  // Use database timestamp columns naming convention (createdat/updatedat)
  const sql = `INSERT INTO paiement (commande_id, montant, mode_paiement, date_paiement, createdat, updatedat) VALUES ($1, $2, $3, COALESCE($4, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *`;
  const params = [Number(commande_id), Number(montant), String(mode_paiement), date_paiement];
  const { rows } = await conn.query(sql, params);
  return rows[0];
}

async function getPaiementsByCommande(commandeId) {
  const { rows } = await pool.query(`SELECT * FROM paiement WHERE commande_id = $1 ORDER BY date_paiement DESC, id DESC`, [Number(commandeId)]);
  return rows;
}

async function getPaiementById(id) {
  const { rows } = await pool.query(`SELECT * FROM paiement WHERE id = $1`, [Number(id)]);
  return rows[0] || null;
}

async function sumPaiementsByCommande(commandeId, clientConn = null) {
  const conn = clientConn || pool;
  const { rows } = await conn.query(`SELECT COALESCE(SUM(montant)::numeric,0) AS total FROM paiement WHERE commande_id = $1`, [Number(commandeId)]);
  return Number(rows[0]?.total || 0);
}

async function sumPaiementsForCommandes(commandeIds = []) {
  if (!Array.isArray(commandeIds) || commandeIds.length === 0) return [];
  const params = [commandeIds.map(id => Number(id))];
  const { rows } = await pool.query(`SELECT commande_id, COALESCE(SUM(montant)::numeric,0) AS total FROM paiement WHERE commande_id = ANY($1::int[]) GROUP BY commande_id`, params);
  return rows; // [{ commande_id: X, total: '123.45' }, ...]
}

export default {
  createPaiement,
  getPaiementsByCommande,
  sumPaiementsByCommande,
  sumPaiementsForCommandes,
  getPaiementById,
};
