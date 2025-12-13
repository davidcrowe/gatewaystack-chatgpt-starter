import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

let db: Database.Database | null = null;

function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function getCrmDb() {
  if (db) return db;

  const filePath = (process.env.CRM_DB_PATH || "./data/crm.sqlite").trim();
  ensureDir(filePath);

  db = new Database(filePath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      user_key TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS deals (
      id TEXT PRIMARY KEY,
      user_key TEXT NOT NULL,
      account TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      close_date TEXT NOT NULL,   -- ISO yyyy-mm-dd
      stage TEXT NOT NULL,        -- e.g. "won", "lost", "open"
      created_at INTEGER NOT NULL,
      FOREIGN KEY(user_key) REFERENCES users(user_key)
    );

    CREATE INDEX IF NOT EXISTS idx_deals_user_close ON deals(user_key, close_date);
    CREATE INDEX IF NOT EXISTS idx_deals_user_stage ON deals(user_key, stage);
  `);

  return db;
}

function scalarCount(db: Database.Database, sql: string): number {
  const row = db.prepare(sql).get() as { c: number } | undefined;
  return Number(row?.c ?? 0);
}

export function getGlobalCounts() {
  const db = getCrmDb();
  const users = scalarCount(db, `SELECT COUNT(*) as c FROM users`);
  const deals = scalarCount(db, `SELECT COUNT(*) as c FROM deals`);
  return { users, deals, entries: users + deals };
}

