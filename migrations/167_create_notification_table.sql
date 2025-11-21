-- Migration: create notification table

CREATE TABLE IF NOT EXISTS notification (
  id SERIAL PRIMARY KEY,
  utilisateur_id INTEGER NULL,
  titre VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  meta JSONB NULL,
  lu BOOLEAN DEFAULT FALSE,
  createdat TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updatedat TIMESTAMP WITH TIME ZONE NULL
);

-- Index for faster read of unread notifications per user
CREATE INDEX IF NOT EXISTS idx_notification_user_lu_createdat ON notification (utilisateur_id, lu, createdat DESC);
