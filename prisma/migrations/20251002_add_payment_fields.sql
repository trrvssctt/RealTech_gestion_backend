-- Migration: add payment tracking and pdf file columns
-- Date: 2025-10-02

ALTER TABLE IF EXISTS "commande"
  ADD COLUMN IF NOT EXISTS montant_paye numeric DEFAULT 0;

ALTER TABLE IF EXISTS "commande"
  ADD COLUMN IF NOT EXISTS montant_restant numeric DEFAULT 0;

ALTER TABLE IF EXISTS "commande"
  ADD COLUMN IF NOT EXISTS statut_paiement varchar DEFAULT 'NON_PAYEE';

ALTER TABLE IF EXISTS "facture"
  ADD COLUMN IF NOT EXISTS fichier_pdf varchar;

ALTER TABLE IF EXISTS "recu"
  ADD COLUMN IF NOT EXISTS fichier_pdf varchar;

-- Optional: backfill montant_restant as total_cmd - montant_paye (if montant_paye exists already)
UPDATE "commande" SET montant_restant = COALESCE(total_cmd,0) - COALESCE(montant_paye,0) WHERE montant_restant IS NULL;
