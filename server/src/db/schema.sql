-- ShopFil Datenbankschema
-- Testkauf-Cockpit fuer den Online-Handel (goodFil-Logik + Behamics-Verhaltensoekonomie)

CREATE TABLE IF NOT EXISTS shops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  product_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS criteria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('AUFTRITT', 'SERVICE', 'VERHALTENSOEKONOMIE', 'VERTRAUEN')),
  label TEXT NOT NULL,
  description TEXT NOT NULL,
  weight REAL NOT NULL DEFAULT 5,
  automated INTEGER NOT NULL DEFAULT 0,
  recommendation TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'goodfil'
);

CREATE TABLE IF NOT EXISTS audit_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'automated_pending' CHECK (status IN ('automated_pending', 'awaiting_manual', 'completed', 'failed')),
  overall_score REAL,
  error TEXT
);

CREATE TABLE IF NOT EXISTS criterion_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  audit_run_id INTEGER NOT NULL REFERENCES audit_runs(id) ON DELETE CASCADE,
  criterion_id INTEGER NOT NULL REFERENCES criteria(id),
  score REAL,
  passed INTEGER,
  notes TEXT,
  detail TEXT,
  UNIQUE (audit_run_id, criterion_id)
);

CREATE INDEX IF NOT EXISTS idx_audit_runs_shop ON audit_runs(shop_id);
CREATE INDEX IF NOT EXISTS idx_criterion_results_run ON criterion_results(audit_run_id);
