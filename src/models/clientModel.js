import pool from '../config/pg.js';

async function createClient({ nom, prenom, email, telephone, actif = true }) {
  const sql = `
    INSERT INTO client (nom, prenom, email, telephone, actif)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `;
  const values = [nom, prenom, email, telephone, actif];
  const { rows } = await pool.query(sql, values);
  return rows[0];
}

async function getClientById(id) {
  const { rows } = await pool.query(
    `SELECT * FROM client WHERE id = $1 AND actif = true`,
    [id]
  );
  return rows[0] || null;
}

async function getClients({ page = 1, limit = 10, search, actif, sortBy = 'createdat', sortOrder = 'desc' }) {
  let where = [`actif = true`];
  let values = [];
  let idx = 1;

  if (search) {
    where.push(`(nom ILIKE $${idx} OR prenom ILIKE $${idx} OR email ILIKE $${idx})`);
    values.push(`%${search}%`);
    idx++;
  }
  if (actif !== undefined) {
    where.push(`actif = $${idx}`);
    values.push(actif === true || actif === 'true');
    idx++;
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const sql = `
    SELECT * FROM client
    ${whereClause}
    ORDER BY "${sortBy}" ${sortOrder === 'desc' ? 'DESC' : 'ASC'}
    LIMIT $${idx} OFFSET $${idx + 1}
  `;
  values.push(Number(limit), Number(offset));

  const { rows } = await pool.query(sql, values);

  // Count total
  const countSql = `
    SELECT COUNT(*) AS count FROM client
    ${whereClause}
  `;
  const { rows: countRows } = await pool.query(countSql, values.slice(0, idx - 1));
  const total = Number(countRows[0].count);

  return {
    clients: rows,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: Number(page),
  };
}

async function updateClient(id, updateData) {
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
    UPDATE client SET ${fields.join(', ')}, updatedat = CURRENT_TIMESTAMP
    WHERE id = $${idx}
    RETURNING *
  `;
  const { rows } = await pool.query(sql, values);
  return rows[0];
}

async function softDeleteClient(id) {
  const sql = `
    UPDATE client SET deletedat = CURRENT_TIMESTAMP,updatedat = CURRENT_TIMESTAMP, actif = false
    WHERE id = $1
    RETURNING *
  `;
  const { rows } = await pool.query(sql, [id]);
  return rows[0];
}

async function restoreClient(id) {
  const sql = `
    UPDATE client SET deletedat = NULL, updatedat = current_timestamp, actif = true
    WHERE id = $1
    RETURNING *
  `;
  const { rows } = await pool.query(sql, [id]);
  return rows[0];
}

export default {
  createClient,
  getClientById,
  getClients,
  updateClient,
  softDeleteClient,
  restoreClient,
};