'use strict';
const { Pool } = require('pg');
const { config } = require('./config');

let pool;

function db() {
  if (!pool) {
    pool = new Pool({
      connectionString: config.databaseUrl,
      ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
      // своя схема внутри чужой базы (например, базы платформы), чтобы таблицы не пересекались
      options: config.dbSchema ? `-c search_path=${config.dbSchema}` : undefined,
      max: 5
    });
  }
  return pool;
}

const q = (text, params) => db().query(text, params);

async function migrate() {
  if (config.dbSchema) await q(`CREATE SCHEMA IF NOT EXISTS ${config.dbSchema}`);
  // Защита общей базы: если хостинг не применил search_path, таблицы магазина (users и др.)
  // попали бы в схему платформы. Тогда не создаём ничего и останавливаем только магазин.
  if (config.dbSchema) {
    const { rows } = await q('SELECT current_schema() AS s');
    if (rows[0].s !== config.dbSchema) {
      throw new Error(`база не переключилась на схему ${config.dbSchema} (сейчас ${rows[0].s}); магазин не создаёт таблицы, чтобы не задеть таблицы платформы`);
    }
  }
  await q(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGINT PRIMARY KEY,
      username TEXT,
      first_name TEXT,
      start_param TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS purchases (
      id SERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id),
      sku TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('free','paid','granted')),
      amount_rub INTEGER NOT NULL DEFAULT 0,
      tg_charge_id TEXT UNIQUE,
      provider_charge_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS purchases_user ON purchases(user_id);
    CREATE TABLE IF NOT EXISTS deliveries (
      user_id BIGINT NOT NULL REFERENCES users(id),
      sku TEXT NOT NULL,
      via_purchase INTEGER REFERENCES purchases(id),
      delivered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, sku)
    );
    CREATE TABLE IF NOT EXISTS links (
      token TEXT PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id),
      sku TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      opened_count INTEGER NOT NULL DEFAULT 0,
      UNIQUE (user_id, sku)
    );
    CREATE TABLE IF NOT EXISTS followups (
      user_id BIGINT NOT NULL REFERENCES users(id),
      kind TEXT NOT NULL,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, kind)
    );
    CREATE TABLE IF NOT EXISTS kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

async function upsertUser(from, startParam) {
  await q(
    `INSERT INTO users (id, username, first_name, start_param) VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, first_name = EXCLUDED.first_name,
       last_seen_at = now(), start_param = COALESCE(users.start_param, EXCLUDED.start_param)`,
    [from.id, from.username || null, from.first_name || null, startParam || null]
  );
}

async function getUser(id) {
  const r = await q('SELECT * FROM users WHERE id = $1', [id]);
  return r.rows[0] || null;
}

async function findUserByUsername(username) {
  const r = await q('SELECT * FROM users WHERE lower(username) = lower($1)', [username.replace(/^@/, '')]);
  return r.rows[0] || null;
}

async function addPurchase({ userId, sku, kind, amountRub = 0, tgChargeId = null, providerChargeId = null }) {
  const r = await q(
    `INSERT INTO purchases (user_id, sku, kind, amount_rub, tg_charge_id, provider_charge_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (tg_charge_id) DO NOTHING
     RETURNING *`,
    [userId, sku, kind, amountRub, tgChargeId, providerChargeId]
  );
  return r.rows[0] || null; // null = такой платёж уже записан
}

async function userPurchases(userId) {
  const r = await q('SELECT * FROM purchases WHERE user_id = $1 ORDER BY created_at', [userId]);
  return r.rows;
}

async function hasPurchase(userId, sku) {
  const r = await q('SELECT 1 FROM purchases WHERE user_id = $1 AND sku = $2 LIMIT 1', [userId, sku]);
  return r.rowCount > 0;
}

async function buyersOf(sku) {
  const r = await q('SELECT DISTINCT user_id FROM purchases WHERE sku = $1', [sku]);
  return r.rows.map(x => Number(x.user_id));
}

async function markDelivered(userId, sku, purchaseId) {
  const r = await q(
    `INSERT INTO deliveries (user_id, sku, via_purchase) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, sku) DO NOTHING RETURNING *`,
    [userId, sku, purchaseId || null]
  );
  return r.rowCount > 0;
}

async function isDelivered(userId, sku) {
  const r = await q('SELECT 1 FROM deliveries WHERE user_id = $1 AND sku = $2', [userId, sku]);
  return r.rowCount > 0;
}

async function deliveredSkus(userId) {
  const r = await q('SELECT sku FROM deliveries WHERE user_id = $1 ORDER BY delivered_at', [userId]);
  return r.rows.map(x => x.sku);
}

async function linkFor(userId, sku, newToken) {
  const r = await q(
    `INSERT INTO links (token, user_id, sku) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, sku) DO UPDATE SET user_id = links.user_id
     RETURNING token`,
    [newToken, userId, sku]
  );
  return r.rows[0].token;
}

async function resolveLink(token) {
  const r = await q(
    `UPDATE links SET opened_count = opened_count + 1 WHERE token = $1
     RETURNING links.*, (SELECT username FROM users WHERE users.id = links.user_id) AS username`,
    [token]
  );
  return r.rows[0] || null;
}

// Кому пора отправить напоминание: получил бесплатный урок давно, платных покупок нет, напоминание не отправлялось
async function dueFollowups(hours) {
  const r = await q(
    `SELECT DISTINCT p.user_id FROM purchases p
     WHERE p.kind = 'free' AND p.created_at < now() - ($1 || ' hours')::interval
       AND NOT EXISTS (SELECT 1 FROM purchases x WHERE x.user_id = p.user_id AND x.kind = 'paid')
       AND NOT EXISTS (SELECT 1 FROM followups f WHERE f.user_id = p.user_id AND f.kind = 'after_free')`,
    [String(hours)]
  );
  return r.rows.map(x => Number(x.user_id));
}

async function markFollowup(userId, kind) {
  await q('INSERT INTO followups (user_id, kind) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, kind]);
}

async function stats() {
  const r = await q(`
    SELECT
      (SELECT count(*) FROM users)::int AS users,
      (SELECT count(*) FROM users WHERE created_at > now() - interval '7 days')::int AS users_7d,
      (SELECT count(DISTINCT user_id) FROM purchases WHERE kind = 'free')::int AS free_takers,
      (SELECT count(*) FROM purchases WHERE kind = 'paid')::int AS paid,
      (SELECT count(DISTINCT user_id) FROM purchases WHERE kind = 'paid')::int AS payers,
      (SELECT COALESCE(sum(amount_rub), 0) FROM purchases WHERE kind = 'paid')::int AS revenue,
      (SELECT COALESCE(sum(amount_rub), 0) FROM purchases WHERE kind = 'paid' AND created_at > now() - interval '30 days')::int AS revenue_30d
  `);
  const bySku = await q(`SELECT sku, kind, count(*)::int AS n, COALESCE(sum(amount_rub),0)::int AS rub
                         FROM purchases GROUP BY sku, kind ORDER BY sku, kind`);
  const sources = await q(`SELECT COALESCE(start_param, '-') AS src, count(*)::int AS n FROM users
                           GROUP BY 1 ORDER BY n DESC LIMIT 10`);
  return { ...r.rows[0], bySku: bySku.rows, sources: sources.rows };
}

async function kvGet(key) {
  const r = await q('SELECT value FROM kv WHERE key = $1', [key]);
  return r.rows[0] ? r.rows[0].value : null;
}

async function kvSet(key, value) {
  await q('INSERT INTO kv (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [key, String(value)]);
}

async function close() {
  if (pool) await pool.end();
  pool = null;
}

module.exports = {
  q, migrate, upsertUser, getUser, findUserByUsername, addPurchase, userPurchases, hasPurchase, buyersOf,
  markDelivered, isDelivered, deliveredSkus, linkFor, resolveLink, dueFollowups, markFollowup, stats, kvGet, kvSet, close
};
