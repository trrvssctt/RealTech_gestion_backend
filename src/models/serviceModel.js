import pool from '../config/pg.js';

async function createService({ nom, description, prix_unitaire, actif = true }) {
  const sql = `
    INSERT INTO service (nom, description, prix_unitaire, actif)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `;
  const values = [nom, description, prix_unitaire, actif];
  const { rows } = await pool.query(sql, values);
  return rows[0];
}

async function getServiceById(id) {
  const { rows } = await pool.query(
    `SELECT * FROM service WHERE id = $1 AND actif = true`,
    [id]
  );
  return rows[0] || null;
}

async function getServices({ page = 1, limit = 10, search, actif, minPrice, maxPrice, sortBy = 'createdat', sortOrder = 'desc' }) {
  let where = [`actif = true`];
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
    SELECT * FROM service
    ${whereClause}
    ORDER BY "${sortBy}" ${sortOrder === 'desc' ? 'DESC' : 'ASC'}
    LIMIT $${idx} OFFSET $${idx + 1}
  `;
  values.push(Number(limit), Number(offset));

  const { rows } = await pool.query(sql, values);

  // Count total
  const countSql = `
    SELECT COUNT(*) AS count FROM service
    ${whereClause}
  `;
  const { rows: countRows } = await pool.query(countSql, values.slice(0, idx - 1));
  const total = Number(countRows[0].count);

  return {
    services: rows,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: Number(page),
  };
}

async function updateService(id, updateData) {
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
    UPDATE service SET ${fields.join(', ')}, updatedat = CURRENT_TIMESTAMP
    WHERE id = $${idx}
    RETURNING *
  `;
  const { rows } = await pool.query(sql, values);
  return rows[0];
}

async function softDeleteService(id) {
  const sql = `
    UPDATE service SET updatedat = CURRENT_TIMESTAMP, actif = false, deletedat = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *
  `;
  const { rows } = await pool.query(sql, [id]);
  return rows[0];
}

async function restoreService(id) {
  const sql = `
    UPDATE service SET updatedat = CURRENT_TIMESTAMP, actif = true, deletedat = NULL
    WHERE id = $1
    RETURNING *
  `;
  const { rows } = await pool.query(sql, [id]);
  return rows[0];
}

export default {
  createService,
  getServiceById,
  getServices,
  updateService,
  softDeleteService,
  restoreService,
};