import pool from '../config/pg.js';
import { ApiError } from './errorHandler.js';

/**
 * Factory middleware: allow creation if user is ADMIN/MANAGER or assigned to an active
 * task targeting the provided `targetTable` (case-insensitive comparison).
 * Returns an express middleware.
 */
export function allowCreateIfAssignedToTarget(targetTable) {
  return async (req, res, next) => {
    try {
      const role = req.user?.role;
      const userId = Number(req.user?.userId);

      if (!userId) return next(new ApiError(401, 'Authentification requise'));
      if (role === 'ADMIN' || role === 'MANAGER') return next();

      // Check if the optional column cible_table exists in tache
      const { rows: colRows } = await pool.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = 'tache' AND column_name = 'cible_table' LIMIT 1`
      );
      if (colRows.length === 0) {
        return next(new ApiError(403, `Accès refusé: la base de données n\'inclut pas la colonne tache.cible_table. Exécutez la migration pour activer ce contrôle.`));
      }

      const target = String(targetTable || '').toLowerCase();
      const sql = `
        SELECT ta.* FROM tache_assignments ta
        INNER JOIN tache t ON t.id = ta.tache_id
        WHERE ta.utilisateur_id = $1
          AND ta.est_terminee = FALSE
          AND t.deletedat IS NULL
          AND (LOWER(t.cible_table) = $2 OR LOWER(t.cible_table) = $3)
        LIMIT 1
      `;

      const { rows } = await pool.query(sql, [userId, target, `${target}s`]);
      if (rows.length > 0) return next();

      return next(new ApiError(403, 'Accès refusé: vous n\'êtes pas autorisé à effectuer cette action'));
    } catch (err) {
      return next(err);
    }
  };
}

export const allowCreateProductIfAssigned = allowCreateIfAssignedToTarget('produit');
export const allowCreateServiceIfAssigned = allowCreateIfAssignedToTarget('service');

export default { allowCreateIfAssignedToTarget, allowCreateProductIfAssigned, allowCreateServiceIfAssigned };
