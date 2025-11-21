import pool from '../config/pg.js';

/**
 * Updated Vente model to match schema:
 * vente (id, code, numero, montant, statut, "date", "commandeId", "utilisateurId", deletedat, actif, createdat, updatedat)
 * vente_item (id, vente_id, produit_id, service_id, commande_id, nom, quantite, prix_unitaire, total, actif, createdat, updatedat, deletedat)
 */

async function createVente({ code = null, numero = null, montant = 0, statut = 'PENDING', date = new Date(), commandeId = null, utilisateurId = null, items = [] }) {
  const { rows } = await pool.query(
    `INSERT INTO vente (code, numero, montant, statut, "date", "commandeid", "utilisateurid", actif, createdat)
     VALUES ($1, $2, $3, $4, $5, $6, $7, true, CURRENT_TIMESTAMP)
     RETURNING *`,
    [code, numero, montant, statut, date, commandeId, utilisateurId]
  );
  const vente = rows[0];

  if (items && items.length) {
    const insertPromises = items.map(item =>
      pool.query(
        `INSERT INTO vente_item (vente_id, produit_id, service_id, commande_id, nom, quantite, prix_unitaire, total, actif, createdat)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, CURRENT_TIMESTAMP) RETURNING *`,
        [
          vente.id,
          item.produit_id || null,
          item.service_id || null,
          item.commande_id || commandeId || null,
          item.nom || null,
          Number(item.quantite || 1),
          Number(item.prix_unitaire || 0),
          Number(item.total || 0)
        ]
      )
    );
    const results = await Promise.all(insertPromises);
    vente.items = results.flatMap(r => r.rows);
  } else {
    vente.items = [];
  }

  return vente;
}

async function getVenteById(id) {
  const { rows } = await pool.query(
    `SELECT v.*,
            cmd.id AS commande_id, cmd.numero AS commande_numero,
            cl.id AS client_id, cl.nom AS client_nom, cl.prenom AS client_prenom, cl.email AS client_email, cl.telephone AS client_telephone,
            u.id AS utilisateur_id, u.nom AS utilisateur_nom, u.prenom AS utilisateur_prenom
     FROM vente v
     LEFT JOIN commande cmd ON cmd.id = v."commandeid"
     LEFT JOIN client cl ON cl.id = cmd.clientid
     LEFT JOIN utilisateur u ON u.id = v."utilisateurid"
     WHERE v.id = $1`,
    [id]
  );
  const vente = rows[0] || null;
  if (!vente) return null;

  const { rows: items } = await pool.query(
    `SELECT * FROM vente_item WHERE vente_id = $1 AND (deletedat IS NULL) ORDER BY id`,
    [id]
  );
  vente.items = items;
  return vente;
}

async function getVentes({ page = 1, limit = 10, search, statut, client_id, commandeId, utilisateurId, minDate, maxDate, sortBy = 'createdat', sortOrder = 'desc' }) {
  const where = [];
  const values = [];
  let idx = 1;

  // non-deleted
  where.push(`v.deletedat IS NULL`);

  // search by numero or montant
  if (search !== undefined && String(search).trim() !== '') {
    where.push(`(v.numero ILIKE $${idx} OR CAST(v.montant AS TEXT) ILIKE $${idx})`);
    values.push(`%${String(search).trim()}%`);
    idx++;
  }

  if (statut !== undefined && String(statut).trim() !== '') {
    where.push(`v.statut = $${idx}`);
    values.push(String(statut).trim());
    idx++;
  }

  // filter by commandeId directly
  if (commandeId !== undefined && commandeId !== null && String(commandeId).trim() !== '') {
    where.push(`v."commandeid" = $${idx}`);
    values.push(Number(commandeId));
    idx++;
  }

  // filter by utilisateurId
  if (utilisateurId !== undefined && utilisateurId !== null && String(utilisateurId).trim() !== '') {
    where.push(`v."utilisateurid" = $${idx}`);
    values.push(Number(utilisateurId));
    idx++;
  }

  // filter by client_id through commande table (if client_id provided)
  let joinCommandeForClient = false;
  if (client_id !== undefined && client_id !== null && String(client_id).trim() !== '') {
    // add join condition instead of direct where on v
    joinCommandeForClient = true;
    where.push(`cmd.clientid = $${idx}`);
    values.push(Number(client_id));
    idx++;
  }

  // date filters on v."date" column (date only)
  if (minDate !== undefined && minDate !== null && String(minDate).trim() !== '') {
    const d = new Date(minDate);
    if (!Number.isNaN(d.getTime())) {
      where.push(`v."date"::date >= $${idx}::date`);
      values.push(d.toISOString().slice(0, 10));
      idx++;
    }
  }
  if (maxDate !== undefined && maxDate !== null && String(maxDate).trim() !== '') {
    const d2 = new Date(maxDate);
    if (!Number.isNaN(d2.getTime())) {
      where.push(`v."date"::date <= $${idx}::date`);
      values.push(d2.toISOString().slice(0, 10));
      idx++;
    }
  }

  // whitelist sort columns
  const allowedSorts = ['id', 'code', 'numero', 'montant', 'statut', 'date', 'createdat', 'updatedat'];
  const sortCol = allowedSorts.includes(String(sortBy).toLowerCase()) ? String(sortBy).toLowerCase() : 'createdat';
  const order = String(sortOrder).toLowerCase() === 'desc' ? 'DESC' : 'ASC';

  const joinClause = joinCommandeForClient ? 'LEFT JOIN commande cmd ON cmd.id = v."commandeid"' : '';
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (Number(page) - 1) * Number(limit);

  const sql = `
    SELECT v.* FROM vente v
    ${joinClause}
    ${whereClause}
    ORDER BY "${sortCol}" ${order}
    LIMIT $${idx} OFFSET $${idx + 1}
  `;
  values.push(Number(limit), Number(offset));

  const { rows } = await pool.query(sql, values);

  const countSql = `
    SELECT COUNT(*) AS count FROM vente v
    ${joinClause}
    ${whereClause}
  `;
  const countValues = values.slice(0, Math.max(0, idx - 1));
  const { rows: countRows } = await pool.query(countSql, countValues);
  const total = Number(countRows[0]?.count || 0);

  return {
    ventes: rows,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: Number(page),
  };
}

async function getPaiementsAsVentes({ page = 1, limit = 10, search, client_id, commandeId, minDate, maxDate, sortBy = 'date_paiement', sortOrder = 'desc' }) {
  const where = [];
  const values = [];
  let idx = 1;

  if (search !== undefined && String(search).trim() !== '') {
    where.push(`CAST(montant AS TEXT) ILIKE $${idx}`);
    values.push(`%${String(search).trim()}%`);
    idx++;
  }
  if (commandeId !== undefined && commandeId !== null && String(commandeId).trim() !== '') {
    where.push(`commande_id = $${idx}`);
    values.push(Number(commandeId));
    idx++;
  }
  if (client_id !== undefined && client_id !== null && String(client_id).trim() !== '') {
    // join via commande table
    where.push(`commande_id IN (SELECT id FROM commande WHERE clientid = $${idx})`);
    values.push(Number(client_id));
    idx++;
  }
  if (minDate) { where.push(`date_paiement::date >= $${idx}`); values.push(new Date(minDate).toISOString().slice(0,10)); idx++; }
  if (maxDate) { where.push(`date_paiement::date <= $${idx}`); values.push(new Date(maxDate).toISOString().slice(0,10)); idx++; }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (Number(page) - 1) * Number(limit);
  const sql = `SELECT * FROM paiement ${whereClause} ORDER BY ${sortBy} ${sortOrder === 'desc' ? 'DESC' : 'ASC'} LIMIT $${idx} OFFSET $${idx+1}`;
  values.push(Number(limit), Number(offset));
  const { rows } = await pool.query(sql, values);

  const countSql = `SELECT COUNT(*) AS count FROM paiement ${whereClause}`;
  const { rows: countRows } = await pool.query(countSql, values.slice(0, Math.max(0, idx-1)));
  const total = Number(countRows[0]?.count || 0);

  // map paiement rows to vente-like objects
  const ventes = rows.map(r => ({ id: r.id, code: `PAY-${r.id}`, numero: String(r.id).padStart(6,'0'), montant: Number(r.montant), statut: 'PAYMENT', date: r.date_paiement, commandeid: r.commande_id, mode_paiement: r.mode_paiement }));

  return {
    ventes,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: Number(page),
  };
}

async function updateVente(id, updateData) {
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
    UPDATE vente SET ${fields.join(', ')}, updatedat = CURRENT_TIMESTAMP
    WHERE id = $${idx}
    RETURNING *
  `;
  const { rows } = await pool.query(sql, values);
  return rows[0] || null;
}

async function addVenteItem(vente_id, { produit_id = null, service_id = null, commande_id = null, nom = null, quantite = 1, prix_unitaire = 0, total = 0 }) {
  const { rows } = await pool.query(
    `INSERT INTO vente_item (vente_id, produit_id, service_id, commande_id, nom, quantite, prix_unitaire, total, actif, createdat)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, CURRENT_TIMESTAMP) RETURNING *`,
    [vente_id, produit_id, service_id, commande_id, nom, quantite, prix_unitaire, total]
  );
  return rows[0];
}

async function updateVenteItem(itemId, updateData) {
  const fields = [];
  const values = [];
  let idx = 1;
  for (const key in updateData) {
    fields.push(`"${key}" = $${idx}`);
    values.push(updateData[key]);
    idx++;
  }
  values.push(itemId);
  const sql = `
    UPDATE vente_item SET ${fields.join(', ')}, updatedat = CURRENT_TIMESTAMP
    WHERE id = $${idx}
    RETURNING *
  `;
  const { rows } = await pool.query(sql, values);
  return rows[0] || null;
}

async function removeVenteItem(itemId) {
  await pool.query(`DELETE FROM vente_item WHERE id = $1`, [itemId]);
  return true;
}

async function softDeleteVente(id) {
  const { rows } = await pool.query(
    `UPDATE vente SET deletedat = CURRENT_TIMESTAMP, actif = false WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0] || null;
}

async function restoreVente(id) {
  const { rows } = await pool.query(
    `UPDATE vente SET deletedat = NULL, actif = true WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0] || null;
}

export default {
  createVente,
  getVenteById,
  getVentes,
  getPaiementsAsVentes,
  updateVente,
  addVenteItem,
  updateVenteItem,
  removeVenteItem,
  softDeleteVente,
  restoreVente,
};