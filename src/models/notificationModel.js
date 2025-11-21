import pool from '../config/pg.js';

async function createNotification({ utilisateur_id = null, titre, message, meta = null, lu = false }, client = pool) {
  const sql = `
    INSERT INTO notification (utilisateur_id, titre, message, meta, lu, createdat)
    VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
    RETURNING *
  `;
  const values = [utilisateur_id, titre, message, meta ? JSON.stringify(meta) : null, lu];
  const { rows } = await client.query(sql, values);
  return rows[0];
}

async function markAsRead(id, client = pool) {
  const sql = `UPDATE notification SET lu = true, updatedat = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`;
  const { rows } = await client.query(sql, [id]);
  return rows[0];
}

async function listForUser(userId, limit = 10) {
  const sql = `SELECT * FROM notification WHERE (utilisateur_id = $1 OR utilisateur_id IS NULL) ORDER BY lu ASC, createdat DESC LIMIT $2`;
  const { rows } = await pool.query(sql, [userId, Number(limit)]);
  return rows;
}

export default {
  createNotification,
  markAsRead,
  listForUser,
};
