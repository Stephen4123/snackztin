const { Pool } = require('pg');
const FALLBACK_DB_URL = Buffer.from('cG9zdGdyZXNxbDovL25lb25kYl9vd25lcjpucGdfcmFRbzJnd2pSNG54QGVwLXByb3VkLWJyb29rLWJlZDM4Zjc5LXBvb2xlci5jLTkudXMtZWFzdC0yLmF3cy5uZW9uLnRlY2gvbmVvbmRiP3NzbG1vZGU9cmVxdWlyZQ==', 'base64').toString('utf8');
const pool = new Pool({ connectionString: process.env.DATABASE_URL || FALLBACK_DB_URL, ssl: { rejectUnauthorized: false } });

async function migrate() {
  console.log('Migrating database schema for customer authentication and user orders...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Update choco_users columns to support full customer accounts
    await client.query(`
      ALTER TABLE choco_users ADD COLUMN IF NOT EXISTS name VARCHAR(255);
      ALTER TABLE choco_users ADD COLUMN IF NOT EXISTS phone VARCHAR(32);
      ALTER TABLE choco_users ADD COLUMN IF NOT EXISTS address TEXT;
      ALTER TABLE choco_users ADD COLUMN IF NOT EXISTS city VARCHAR(100);
      ALTER TABLE choco_users ADD COLUMN IF NOT EXISTS state VARCHAR(100);
      ALTER TABLE choco_users ADD COLUMN IF NOT EXISTS pincode VARCHAR(32);
      ALTER TABLE choco_users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255);
      ALTER TABLE choco_users ADD COLUMN IF NOT EXISTS reset_token_expiry TIMESTAMP WITH TIME ZONE;
    `);

    // Ensure email index
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_choco_users_unique_lower_email 
      ON choco_users (LOWER(TRIM(email))) WHERE email IS NOT NULL AND email <> '';
      CREATE INDEX IF NOT EXISTS idx_choco_users_phone ON choco_users(phone);
    `);

    // 2. Add user_uid to choco_orders
    await client.query(`
      ALTER TABLE choco_orders ADD COLUMN IF NOT EXISTS user_uid VARCHAR(64);
      CREATE INDEX IF NOT EXISTS idx_choco_orders_user_uid ON choco_orders(user_uid);
    `);

    await client.query('COMMIT');
    console.log('✅ Schema migration completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
