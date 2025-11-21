-- Migration: Add inventory_mouvement table to track stock IN/OUT movements
CREATE TABLE IF NOT EXISTS inventory_mouvement (
  id SERIAL PRIMARY KEY,
  produitid INTEGER REFERENCES produit(id) ON DELETE SET NULL,
  quantite INTEGER NOT NULL,
  type VARCHAR(10) NOT NULL, -- 'IN' or 'OUT'
  source VARCHAR(100), -- e.g., 'MANUAL', 'VENTE', 'COMMANDE'
  utilisateurid INTEGER,
  note TEXT,
  createdat TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inventory_mouvement_produitid ON inventory_mouvement(produitid);
