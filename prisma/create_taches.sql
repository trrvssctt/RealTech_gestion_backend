-- Create tasks table and assignment pivot table
-- Run this in your Postgres database

CREATE TABLE IF NOT EXISTS tache (
  id SERIAL PRIMARY KEY,
  nom TEXT NOT NULL,
  description TEXT,
  date_debut TIMESTAMP WITH TIME ZONE,
  date_fin TIMESTAMP WITH TIME ZONE,
  frequence TEXT,
  importance TEXT,
  statut TEXT DEFAULT 'EN_ATTENTE',
  cible_table TEXT, -- optional: table the task refers to (ex: produit, service)
  cible_id INTEGER, -- optional: id in the target table
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deletedAt TIMESTAMP WITH TIME ZONE
);

-- Pivot table to assign tasks to multiple users
CREATE TABLE IF NOT EXISTS tache_assignments (
  id SERIAL PRIMARY KEY,
  tache_id INTEGER NOT NULL REFERENCES tache(id) ON DELETE CASCADE,
  utilisateur_id INTEGER NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
  est_terminee BOOLEAN DEFAULT FALSE,
  date_terminee TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tache_utilisateur ON tache_assignments(utilisateur_id);
CREATE INDEX IF NOT EXISTS idx_tache_status ON tache(statut);
CREATE INDEX IF NOT EXISTS idx_tache_importance ON tache(importance);
