import pool from '../config/pg.js';

// simple cache for table columns
const columnExistsCache = {};

async function hasColumn(table, column) {
  const key = `${table}.${column}`;
  if (columnExistsCache[key] !== undefined) return columnExistsCache[key];
  const { rows } = await pool.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2 LIMIT 1`,
    [table, column]
  );
  const exists = rows.length > 0;
  columnExistsCache[key] = exists;
  return exists;
}

// Core tache operations using tache and tache_assignments tables
async function createTask(data) {
  // Build insert dynamically depending on whether optional columns exist in the DB
  const {
    nom,
    description,
    date_debut,
    date_fin,
    frequence,
    importance,
    statut = 'EN_ATTENTE',
    cible_table = null,
    cible_id = null,
    utilisateurid = null,
  } = data || {};

  const cols = ['nom', 'description', 'date_debut', 'date_fin', 'frequence', 'importance', 'statut'];
  const vals = [nom, description, date_debut, date_fin, frequence, importance, statut];

  // include utilisateurid if column exists and a value was provided
  if (utilisateurid !== null && utilisateurid !== undefined) {
    if (await hasColumn('tache', 'utilisateurid')) {
      cols.push('utilisateurid');
      vals.push(Number(utilisateurid));
    } else if (await hasColumn('tache', 'utilisateur_id')) {
      cols.push('utilisateur_id');
      vals.push(Number(utilisateurid));
    }
  }

  if (await hasColumn('tache', 'cible_table') && (cible_table !== null && cible_table !== undefined)) {
    cols.push('cible_table');
    vals.push(cible_table);
  }
  if (await hasColumn('tache', 'cible_id') && (cible_id !== null && cible_id !== undefined)) {
    cols.push('cible_id');
    vals.push(cible_id);
  }

  // createdAt/updatedAt set by DB
  const placeholders = vals.map((_, i) => `$${i + 1}`).join(',');
  const sql = `INSERT INTO tache (${cols.join(',')}, createdat, updatedat) VALUES (${placeholders}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *`;
  const { rows } = await pool.query(sql, vals);
  return rows[0];
}

async function getTaskById(id) {
  const { rows } = await pool.query(`SELECT * FROM tache WHERE id = $1 AND deletedAt IS NULL`, [id]);
  return rows[0] || null;
}

async function getTasks({ page = 1, limit = 10, search, statut, priorite, utilisateur_id, sortBy = 'createdat', sortOrder = 'desc' }) {
  const where = [`deletedAt IS NULL`];
  const values = [];
  let idx = 1;

  if (search) {
    where.push(`(nom ILIKE $${idx} OR description ILIKE $${idx})`);
    values.push(`%${search}%`);
    idx++;
  }
  if (statut) {
    where.push(`statut = $${idx}`);
    values.push(statut);
    idx++;
  }
  if (priorite) {
    where.push(`importance = $${idx}`);
    values.push(priorite);
    idx++;
  }

  // If filtering by utilisateur, join assignments
  let joinAssign = '';
  if (utilisateur_id) {
    joinAssign = `INNER JOIN tache_assignments ta ON ta.tache_id = tache.id`;
    where.push(`ta.utilisateur_id = $${idx}`);
    values.push(utilisateur_id);
    idx++;
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const sql = `
    SELECT DISTINCT tache.* FROM tache
    ${joinAssign}
    ${whereClause}
    ORDER BY "${sortBy}" ${sortOrder === 'desc' ? 'DESC' : 'ASC'}
    LIMIT $${idx} OFFSET $${idx + 1}
  `;
  values.push(Number(limit), Number(offset));

  const { rows } = await pool.query(sql, values);

  const countSql = `SELECT COUNT(DISTINCT tache.id) AS count FROM tache ${joinAssign} ${whereClause}`;
  const { rows: countRows } = await pool.query(countSql, values.slice(0, idx - 1));
  const total = Number(countRows[0]?.count || 0);

  return {
    tasks: rows,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: Number(page),
  };
}

async function updateTask(id, updateData) {
  const fields = [];
  const values = [];
  let idx = 1;
  // Only include fields that actually exist in the table to avoid SQL errors
  for (const key in updateData) {
    // skip undefined
    if (updateData[key] === undefined) continue;
    // check column existence for potentially optional columns
    const exists = await hasColumn('tache', key.toLowerCase());
    if (!exists) {
      // skip unknown column
      continue;
    }
    fields.push(`"${key}" = $${idx}`);
    values.push(updateData[key]);
    idx++;
  }
  values.push(id);

  if (fields.length === 0) {
    // nothing to update
    const { rows } = await pool.query(`SELECT * FROM tache WHERE id = $1`, [id]);
    return rows[0] || null;
  }

  const sql = `UPDATE tache SET ${fields.join(', ')}, "updatedat" = CURRENT_TIMESTAMP WHERE id = $${idx} RETURNING *`;
  const { rows } = await pool.query(sql, values);
  return rows[0] || null;
}

async function softDeleteTask(id) {
  const { rows } = await pool.query(`UPDATE tache SET deletedAt = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`, [id]);
  return rows[0] || null;
}

async function restoreTask(id) {
  const { rows } = await pool.query(`UPDATE tache SET deletedAt = NULL WHERE id = $1 RETURNING *`, [id]);
  return rows[0] || null;
}

// Assign a task to multiple users (replace existing assignments if provided)
async function assignTaskToUsers(tacheId, utilisateurIds = []) {
  // Insert assignments if not exists
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Optionally clear existing assignments (keep existing? here we append)
    for (const uid of utilisateurIds) {
      await client.query(
        `INSERT INTO tache_assignments (tache_id, utilisateur_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [tacheId, uid]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  // Create notifications for assigned users (best-effort)
  try {
    const NotificationModel = await import('./notificationModel.js');
    for (const uid of utilisateurIds) {
      await NotificationModel.default.createNotification({ utilisateur_id: Number(uid), titre: 'Tâche assignée', message: `Une tâche vous a été assignée (ID: ${tacheId})`, meta: { tacheId }, lu: false });
    }
  } catch (e) {
    console.warn('Failed to create notifications for task assignments', e);
  }
  return true;
}

async function unassignTaskFromUser(tacheId, utilisateurId) {
  const { rows } = await pool.query(`DELETE FROM tache_assignments WHERE tache_id = $1 AND utilisateur_id = $2 RETURNING *`, [tacheId, utilisateurId]);
  return rows[0] || null;
}

async function markAssignmentDone(tacheId, utilisateurId) {
  const { rows } = await pool.query(`UPDATE tache_assignments SET est_terminee = TRUE, date_terminee = CURRENT_TIMESTAMP WHERE tache_id = $1 AND utilisateur_id = $2 RETURNING *`, [tacheId, utilisateurId]);
  return rows[0] || null;
}

async function getTasksByUserId(userId) {
  const { rows } = await pool.query(
    `SELECT t.*, ta.est_terminee, ta.date_terminee FROM tache t INNER JOIN tache_assignments ta ON ta.tache_id = t.id WHERE ta.utilisateur_id = $1 AND t.deletedAt IS NULL ORDER BY t.date_debut ASC`,
    [userId]
  );
  return rows;
}

export default {
  createTask,
  getTaskById,
  getTasks,
  updateTask,
  softDeleteTask,
  restoreTask,
  assignTaskToUsers,
  unassignTaskFromUser,
  markAssignmentDone,
  getTasksByUserId,
};