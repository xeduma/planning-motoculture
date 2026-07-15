const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const config = require('../config');

const dbDir = path.dirname(config.db.path);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(config.db.path);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS machines (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  client_name           TEXT NOT NULL,
  client_type           TEXT NOT NULL CHECK (client_type IN ('professionnel', 'particulier')) DEFAULT 'particulier',
  machine_type          TEXT NOT NULL,
  machine_label         TEXT,
  repair_type           TEXT NOT NULL CHECK (repair_type IN ('reparation', 'diagnostic')) DEFAULT 'reparation',
  is_occasion           INTEGER NOT NULL DEFAULT 0,
  description           TEXT,
  deposit_date          TEXT NOT NULL,
  status                TEXT NOT NULL CHECK (status IN ('en_attente', 'en_cours', 'termine')) DEFAULT 'en_attente',
  status_manual_override INTEGER NOT NULL DEFAULT 0,
  urgency_level         INTEGER NOT NULL CHECK (urgency_level IN (1,2,3)) DEFAULT 2,
  urgency_manual_override INTEGER NOT NULL DEFAULT 0,
  invoice_id            TEXT,
  invoice_number        TEXT,
  invoice_paid          INTEGER NOT NULL DEFAULT 0,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_machines_status ON machines(status);
CREATE INDEX IF NOT EXISTS idx_machines_urgency ON machines(urgency_level);
CREATE INDEX IF NOT EXISTS idx_machines_invoice ON machines(invoice_id);

CREATE TABLE IF NOT EXISTS invoices_cache (
  id              TEXT PRIMARY KEY,
  number          TEXT,
  client_name     TEXT,
  amount          REAL,
  paid            INTEGER NOT NULL DEFAULT 0,
  raw_json        TEXT,
  fetched_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sync_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at      TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at     TEXT,
  success         INTEGER NOT NULL DEFAULT 0,
  invoices_synced INTEGER NOT NULL DEFAULT 0,
  machines_updated INTEGER NOT NULL DEFAULT 0,
  error_message   TEXT
);
`);

module.exports = db;
