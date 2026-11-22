/**
 * PostgreSQL Authentication State Provider for Baileys WhatsApp Web Client
 * Persists WhatsApp credentials and session keys directly inside Neon PostgreSQL.
 * Tailored for ChocoLux with isolated session namespace 'choco_default'.
 */

const { initAuthCreds, BufferJSON, proto } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

async function usePostgreAuthState(pool, sessionId = 'choco_default', localAuthFolder = null) {
  // 1. Ensure the auth storage table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS choco_whatsapp_auth_keys (
      session_id VARCHAR(64) NOT NULL DEFAULT 'choco_default',
      key_id VARCHAR(255) NOT NULL,
      key_data TEXT NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (session_id, key_id)
    )
  `);

  // 2. Local auth migration if exists
  if (localAuthFolder && fs.existsSync(localAuthFolder)) {
    try {
      const dbCreds = await pool.query(
        'SELECT key_id FROM choco_whatsapp_auth_keys WHERE session_id = $1 AND key_id = $2',
        [sessionId, 'creds']
      );
      if (dbCreds.rows.length === 0) {
        const credsFile = path.join(localAuthFolder, 'creds.json');
        if (fs.existsSync(credsFile)) {
          console.log('[ChocoLux WhatsApp PG Auth] 🔄 Migrating existing local disk session to PostgreSQL...');
          const files = fs.readdirSync(localAuthFolder);
          const entries = [];
          for (const file of files) {
            if (!file.endsWith('.json')) continue;
            const keyId = file.replace(/\.json$/, '');
            const filePath = path.join(localAuthFolder, file);
            try {
              const raw = fs.readFileSync(filePath, 'utf8');
              JSON.parse(raw);
              entries.push({ keyId, raw });
            } catch (_) {}
          }

          const chunkSize = 200;
          for (let i = 0; i < entries.length; i += chunkSize) {
            const chunk = entries.slice(i, i + chunkSize);
            const sessionIds = chunk.map(() => sessionId);
            const keyIds = chunk.map(c => c.keyId);
            const keyDatas = chunk.map(c => c.raw);
            await pool.query(
              `INSERT INTO choco_whatsapp_auth_keys (session_id, key_id, key_data, updated_at)
               SELECT s, k, d, CURRENT_TIMESTAMP
               FROM UNNEST($1::varchar[], $2::varchar[], $3::text[]) AS t(s, k, d)
               ON CONFLICT (session_id, key_id) DO NOTHING`,
              [sessionIds, keyIds, keyDatas]
            );
          }
          console.log(`[ChocoLux WhatsApp PG Auth] ✅ Migrated ${entries.length} keys to PostgreSQL.`);
        }
      }
    } catch (migErr) {
      console.warn('[ChocoLux WhatsApp PG Auth] Local session migration error:', migErr.message);
    }
  }

  // 3. Load or initialize base credentials ('creds')
  let creds;
  try {
    const credsRes = await pool.query(
      'SELECT key_data FROM choco_whatsapp_auth_keys WHERE session_id = $1 AND key_id = $2',
      [sessionId, 'creds']
    );
    if (credsRes.rows.length > 0) {
      creds = JSON.parse(credsRes.rows[0].key_data, BufferJSON.reviver);
    }
  } catch (err) {
    console.warn('[ChocoLux WhatsApp PG Auth] Failed to read creds from DB:', err.message);
  }

  if (!creds) {
    creds = initAuthCreds();
  }

  // Helper to persist creds
  async function saveCreds() {
    try {
      const serialized = JSON.stringify(creds, BufferJSON.replacer);
      await pool.query(
        `INSERT INTO choco_whatsapp_auth_keys (session_id, key_id, key_data, updated_at)
         VALUES ($1, 'creds', $2, CURRENT_TIMESTAMP)
         ON CONFLICT (session_id, key_id)
         DO UPDATE SET key_data = EXCLUDED.key_data, updated_at = CURRENT_TIMESTAMP`,
        [sessionId, serialized]
      );
    } catch (err) {
      console.error('[ChocoLux WhatsApp PG Auth] Error saving creds to DB:', err.message);
    }
  }

  // 4. In-memory read-through cache for signal keys
  const keysCache = new Map();

  async function getKeys(type, ids) {
    const data = {};
    const missingIds = [];

    for (const id of ids) {
      const cacheKey = `${type}-${id}`;
      if (keysCache.has(cacheKey)) {
        data[id] = keysCache.get(cacheKey);
      } else {
        missingIds.push(id);
      }
    }

    if (missingIds.length > 0) {
      const keyIds = missingIds.map(id => `${type}-${id}`);
      try {
        const res = await pool.query(
          `SELECT key_id, key_data FROM choco_whatsapp_auth_keys
           WHERE session_id = $1 AND key_id = ANY($2::text[])`,
          [sessionId, keyIds]
        );

        for (const row of res.rows) {
          const rawId = row.key_id.replace(`${type}-`, '');
          let value = JSON.parse(row.key_data, BufferJSON.reviver);
          if (type === 'app-state-sync-key' && value) {
            value = proto.Message.AppStateSyncKeyData.fromObject(value);
          }
          data[rawId] = value;
          keysCache.set(row.key_id, value);
        }
      } catch (err) {
        console.error(`[ChocoLux WhatsApp PG Auth] Error fetching keys for ${type}:`, err.message);
      }
    }

    return data;
  }

  async function setKeys(data) {
    const tasks = [];
    const inserts = [];
    const deletes = [];

    for (const category in data) {
      for (const id in data[category]) {
        const val = data[category][id];
        const keyId = `${category}-${id}`;

        if (val) {
          keysCache.set(keyId, val);
          inserts.push({
            keyId,
            val: JSON.stringify(val, BufferJSON.replacer)
          });
        } else {
          keysCache.delete(keyId);
          deletes.push(keyId);
        }
      }
    }

    if (inserts.length > 0) {
      const keyIds = inserts.map(i => i.keyId);
      const keyDatas = inserts.map(i => i.val);
      const sessionIds = inserts.map(() => sessionId);

      tasks.push(
        pool.query(
          `INSERT INTO choco_whatsapp_auth_keys (session_id, key_id, key_data, updated_at)
           SELECT s, k, d, CURRENT_TIMESTAMP
           FROM UNNEST($1::varchar[], $2::varchar[], $3::text[]) AS t(s, k, d)
           ON CONFLICT (session_id, key_id)
           DO UPDATE SET key_data = EXCLUDED.key_data, updated_at = CURRENT_TIMESTAMP`,
          [sessionIds, keyIds, keyDatas]
        )
      );
    }

    if (deletes.length > 0) {
      tasks.push(
        pool.query(
          `DELETE FROM choco_whatsapp_auth_keys
           WHERE session_id = $1 AND key_id = ANY($2::text[])`,
          [sessionId, deletes]
        )
      );
    }

    await Promise.all(tasks);
  }

  async function clearSession() {
    keysCache.clear();
    await pool.query(
      'DELETE FROM choco_whatsapp_auth_keys WHERE session_id = $1',
      [sessionId]
    );
  }

  return {
    state: {
      creds,
      keys: {
        get: getKeys,
        set: setKeys
      }
    },
    saveCreds,
    clearSession
  };
}

module.exports = { usePostgreAuthState };
