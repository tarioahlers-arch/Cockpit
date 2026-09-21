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
  -- 'full' = goodFil-Testkauf inkl. manueller Checkliste; 'lead_scan' = automatisierter
  -- Batch-Analyzer-Lauf (Modul 2) ohne manuelle Kriterien, nur zur Lead-Priorisierung.
  mode TEXT NOT NULL DEFAULT 'full' CHECK (mode IN ('full', 'lead_scan')),
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

-- ============================================================
-- Zusatzmodul: Automatisierte Firmenrecherche & Prospecting
-- ============================================================

-- Modul 1: Zielkunden-Kandidaten. Belegpflicht ist ein DB-Constraint:
-- quelle_url/quelle_typ sind NOT NULL, ein Datensatz ohne Fundstelle
-- kann also gar nicht erst geschrieben werden.
CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_normalized TEXT NOT NULL,
  domain TEXT,
  url TEXT,
  branche TEXT,
  region TEXT,
  quelle_url TEXT NOT NULL,
  quelle_typ TEXT NOT NULL,
  gefunden_am TEXT NOT NULL DEFAULT (datetime('now')),
  verifiziert INTEGER NOT NULL DEFAULT 0,
  hat_online_shop INTEGER,
  status TEXT NOT NULL DEFAULT 'neu' CHECK (status IN ('neu', 'analysiert', 'qualifiziert', 'abgelehnt')),
  shop_id INTEGER REFERENCES shops(id),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (name_normalized, domain)
);

CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status);
CREATE INDEX IF NOT EXISTS idx_companies_domain ON companies(domain);

-- Ein Recherche-Lauf mit den Such-Parametern des Nutzers.
CREATE TABLE IF NOT EXISTS research_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  branche TEXT NOT NULL,
  region TEXT NOT NULL,
  exclusions TEXT,
  max_results INTEGER NOT NULL DEFAULT 20,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  error TEXT
);

-- Protokoll jedes Recherche-Laufs: was wurde gefunden, was uebersprungen
-- (Duplikat, kein erkennbarer Online-Shop, Quellenfehler) und warum.
CREATE TABLE IF NOT EXISTS research_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  research_run_id INTEGER NOT NULL REFERENCES research_runs(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('gefunden', 'duplikat', 'kein_shop_erkannt', 'robots_disallow', 'fehler')),
  name TEXT,
  domain TEXT,
  quelle_url TEXT,
  quelle_typ TEXT,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_research_log_run ON research_log(research_run_id);

-- Staging-Tabelle: Treffer eines Laufs, BEVOR der Nutzer sie in die
-- companies-Tabelle uebernimmt (Vorschau-vor-Speichern-Pflicht aus dem Auftrag).
CREATE TABLE IF NOT EXISTS research_candidates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  research_run_id INTEGER NOT NULL REFERENCES research_runs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_normalized TEXT NOT NULL,
  domain TEXT,
  url TEXT,
  quelle_url TEXT NOT NULL,
  quelle_typ TEXT NOT NULL,
  hat_online_shop INTEGER,
  selected INTEGER NOT NULL DEFAULT 1,
  committed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_research_candidates_run ON research_candidates(research_run_id);
