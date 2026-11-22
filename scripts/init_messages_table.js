require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const createSql = `
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      recipient VARCHAR(255) NOT NULL,
      message_body TEXT NOT NULL,
      message_type VARCHAR(100) DEFAULT 'general',
      sent BOOLEAN DEFAULT false,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_messages_sent_created ON messages (sent, created_at ASC);
  `;
  await pool.query(createSql);
  console.log('✅ messages table created/verified successfully!');

  const check = await pool.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'messages'
    ORDER BY ordinal_position;
  `);
  console.log('Columns in messages table:', check.rows);
  await pool.end();
}

main().catch(err => {
  console.error('Error creating messages table:', err);
  process.exit(1);
});
