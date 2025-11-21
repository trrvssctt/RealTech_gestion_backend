import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: process.env.DB_HOST || 'postgresql-gestionapp.alwaysdata.net',
  user: process.env.DB_USER || 'gestionapp',
  password: process.env.DB_PASSWORD || 'Dianka16', // <-- doit être une string
  database: process.env.DB_NAME || 'gestionapp_sidy_application',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
});

export default pool;