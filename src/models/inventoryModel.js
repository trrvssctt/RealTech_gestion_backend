import pool from '../config/pg.js';

async function createMovement({ produitid, quantite, type, source = 'MANUEL', utilisateurid = null, note = null, client = pool }) {
  const sql = `
    INSERT INTO inventory_mouvement (produitid, quantite, type, source, utilisateurid, note)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `;
  const values = [produitid, quantite, type, source, utilisateurid, note];
  const { rows } = await client.query(sql, values);
  return rows[0];
}

async function listMovements({ produitid, page = 1, limit = 50, type, since }) {
  const where = [];
  const values = [];
  let idx = 1;

  if (produitid) {
    where.push(`produitid = $${idx}`);
    values.push(produitid);
    idx++;
  }
  if (type) {
    where.push(`type = $${idx}`);
    values.push(type);
    idx++;
  }
  if (since) {
    where.push(`createdat >= $${idx}`);
    values.push(since);
    idx++;
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const sql = `
    SELECT * FROM inventory_mouvement
    ${whereClause}
    ORDER BY createdat DESC
    LIMIT $${idx} OFFSET $${idx + 1}
  `;
  values.push(limit, offset);

  const { rows } = await pool.query(sql, values);
  return rows;
}

export default {
  createMovement,
  listMovements,
};
