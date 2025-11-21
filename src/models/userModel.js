/**
 * Get employee activity stats (commandes, ventes, tâches)
 */
async function getEmployeeStats() {
  // Récupérer tous les employés actifs
  const { rows: users } = await pool.query(`SELECT id, nom, prenom, email, telephone, role FROM utilisateur WHERE role = 'EMPLOYE' AND actif = true`);
  // Pour chaque employé, compter commandes, ventes, tâches
  const stats = [];
  for (const u of users) {
    // Commandes créées
    const { rows: commandes } = await pool.query(`SELECT COUNT(*) AS count FROM commande WHERE utilisateurid = $1`, [u.id]);
    // Ventes réalisées
    const { rows: ventes } = await pool.query(`SELECT COUNT(*) AS count FROM vente WHERE utilisateurid = $1`, [u.id]);
    // Tâches terminées
    const { rows: taches } = await pool.query(`SELECT COUNT(*) AS count FROM tache WHERE utilisateurid = $1 AND statut = 'TERMINEE'`, [u.id]);
    stats.push({
      id: u.id,
      nom: u.nom,
      prenom: u.prenom,
      email: u.email,
      telephone: u.telephone,
      commandes: Number(commandes[0]?.count || 0),
      ventes: Number(ventes[0]?.count || 0),
      taches: Number(taches[0]?.count || 0),
    });
  }
  return stats;
}
import pool from '../config/pg.js';

// Create a user. password should be already hashed when passed here.
async function createUser({ email, password, password_hash, nom, prenom, telephone, role, actif = true }) {
  // Accept either `password` or `password_hash` (some callers pass the latter)
  const pw = password || password_hash;
  const sql = `INSERT INTO utilisateur (email, password_hash, nom, prenom, telephone, role, actif, "createdat", "updatedat") VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id, nom, prenom, email, telephone, role, actif, "createdat"`;
  const values = [email, pw, nom, prenom, telephone, role, actif];
  const { rows } = await pool.query(sql, values);
  return rows[0];
}

async function getUserById(id) {
  // include password as password_hash for internal use (auth, change password)
  const { rows } = await pool.query(`SELECT id, nom, prenom, email, telephone, role, actif, password_hash AS password_hash, "createdat", "updatedat" FROM utilisateur WHERE id = $1`, [id]);
  return rows[0] || null;
}

async function getUserByEmail(email) {
  // return password as password_hash to match the rest of the codebase
  const { rows } = await pool.query(`SELECT id, nom, prenom, email, telephone, role, actif, password_hash AS password_hash, "createdat" FROM utilisateur WHERE email = $1`, [email]);
  return rows[0] || null;
}

async function updateUser(id, updateData) {
  const fields = [];
  const values = [];
  let idx = 1;
  for (const key in updateData) {
    fields.push(`"${key}" = $${idx}`);
    values.push(updateData[key]);
    idx++;
  }
  if (fields.length === 0) return getUserById(id);
  values.push(id);
  const sql = `UPDATE utilisateur SET ${fields.join(', ')}, "updatedat" = CURRENT_TIMESTAMP WHERE id = $${idx} RETURNING id, nom, prenom, email, telephone, role, actif, "updatedat"`;
  const { rows } = await pool.query(sql, values);
  return rows[0] || null;
}

async function deactivateUser(id) {
  const { rows } = await pool.query(`UPDATE utilisateur SET actif = false, "updatedat" = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id, actif`, [id]);
  return rows[0] || null;
}

async function reactivateUser(id) {
  const { rows } = await pool.query(`UPDATE utilisateur SET actif = true, "updatedat" = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id, actif`, [id]);
  return rows[0] || null;
}

async function count_users() {
  const { rows } = await pool.query('SELECT COUNT(*) AS count FROM utilisateur');
  return Number(rows[0].count);
}

/**
 * Get users with pagination and optional filters
 * options: { page, limit, search, role, actif, sortBy, sortOrder }
 */
async function getUsers(options = {}) {
  const {
    page = 1,
    limit = 10,
    search,
    role,
    actif,
    sortBy = '"createdat"',
    sortOrder = 'DESC'
  } = options;

  const offset = (page - 1) * limit;
  const where = [];
  const values = [];
  let idx = 1;

  if (search) {
    where.push(`(nom ILIKE $${idx} OR prenom ILIKE $${idx} OR email ILIKE $${idx})`);
    values.push(`%${search}%`);
    idx++;
  }
  if (role) {
    where.push(`role = $${idx}`);
    values.push(role);
    idx++;
  }
  if (typeof actif !== 'undefined') {
    where.push(`actif = $${idx}`);
    values.push(actif === 'true' || actif === true);
    idx++;
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const sql = `SELECT id, nom, prenom, email, telephone, role, actif, "createdat" FROM utilisateur ${whereClause} ORDER BY ${sortBy} ${sortOrder} LIMIT $${idx} OFFSET $${idx + 1}`;
  values.push(Number(limit), Number(offset));
  const { rows } = await pool.query(sql, values);

  // total count
  const countSql = `SELECT COUNT(*) AS count FROM utilisateur ${whereClause}`;
  const { rows: countRows } = await pool.query(countSql, values.slice(0, Math.max(0, idx - 1)));
  const total = Number(countRows[0]?.count || 0);

  return { users: rows, total };
}

/**
 * Get user with related commandes (recent) and taches
 */
async function getUserWithRelations(id) {
  const user = await getUserById(id);
  if (!user) return null;

  const { rows: commandes } = await pool.query(
    `SELECT id, numero, total_cmd, statut, createdat FROM commande WHERE utilisateurid = $1 ORDER BY createdat DESC LIMIT 10`,
    [id]
  );

  const { rows: taches } = await pool.query(
    `SELECT id, nom, statut, importance, date_debut, date_fin FROM tache WHERE utilisateurid = $1 ORDER BY date_debut ASC LIMIT 10`,
    [id]
  );

  return { ...user, commandesCrees: commandes, tachesAssignees: taches };
}

export default {
  getEmployeeStats,
  createUser,
  getUserById,
  getUserByEmail,
  updateUser,
  //updatePasswordHash,
  //deleteUser,
  count_users,
  getUsers,
  getUserWithRelations,
  deactivateUser,
  reactivateUser,
};