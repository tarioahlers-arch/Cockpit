-- ShopPulse Datenmodell
CREATE TABLE IF NOT EXISTS shops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'custom',       -- shopify | shopware | woocommerce | custom
  niche TEXT NOT NULL DEFAULT 'allgemein',       -- Nischenfokus, z. B. mode, b2b
  public_key TEXT NOT NULL UNIQUE,               -- im Tracking-Snippet, kein Geheimnis
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Rohereignisse aus dem Snippet. visitor_id ist eine zufaellige, pseudonyme ID,
-- die das Snippet erst nach Consent erzeugt. Keine IP, kein User-Agent.
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  type TEXT NOT NULL,          -- page_view | scroll_depth | hesitation | add_to_cart | checkout_start | purchase | price_filter | nudge_view
  page_type TEXT,              -- home | category | product | cart | checkout | other
  sku TEXT,
  value REAL,                  -- Scrolltiefe in %, Zoegerdauer in ms, Bestellwert in EUR
  experiment_id INTEGER,
  variant TEXT,                -- control | treatment
  ts TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_shop_ts ON events(shop_id, ts);
CREATE INDEX IF NOT EXISTS idx_events_shop_visitor ON events(shop_id, visitor_id);

CREATE TABLE IF NOT EXISTS experiments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  nudge_type TEXT NOT NULL,    -- anchoring | social_proof | scarcity | decoy
  page_type TEXT NOT NULL DEFAULT 'product',
  config TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',  -- draft | running | stopped
  traffic_split REAL NOT NULL DEFAULT 0.5,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  stopped_at TEXT
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  ean TEXT,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  unit_cost REAL,
  stock INTEGER,
  UNIQUE(shop_id, sku)
);

-- Eigene Preis-/Absatzhistorie je SKU, Basis fuer die Elastizitaetsschaetzung
CREATE TABLE IF NOT EXISTS price_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price REAL NOT NULL,
  units_sold INTEGER NOT NULL,
  period_start TEXT NOT NULL,
  period_days INTEGER NOT NULL DEFAULT 7
);

-- Wettbewerbsangebote (Import per API/CSV). matched_product_id wird durch SKU-Matching gesetzt.
CREATE TABLE IF NOT EXISTS competitor_offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  competitor TEXT NOT NULL,
  title TEXT NOT NULL,
  ean TEXT,
  price REAL NOT NULL,
  url TEXT,
  matched_product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  match_method TEXT,           -- ean | title | manual
  match_confidence REAL,
  observed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- Lager & Verfuegbarkeit
-- ---------------------------------------------------------------------------

-- Eine Quelle = ein Tool, das Bestaende liefert (Shopsystem, ERP, WMS, Filial-Kasse ...).
CREATE TABLE IF NOT EXISTS inventory_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,                 -- shopify | shopware | woocommerce | csv_url | push
  config TEXT NOT NULL DEFAULT '{}',  -- Zugangsdaten/URLs (werden in API-Antworten maskiert)
  push_token TEXT UNIQUE,             -- nur fuer type = push
  sync_interval_min INTEGER NOT NULL DEFAULT 15,
  active INTEGER NOT NULL DEFAULT 1,
  last_sync_at TEXT,
  last_status TEXT,                   -- ok | error | blocked
  last_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Lagerorte gehoeren genau einer Quelle – so koennen sich Tools nicht gegenseitig ueberschreiben.
CREATE TABLE IF NOT EXISTS inventory_locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  source_id INTEGER NOT NULL REFERENCES inventory_sources(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'warehouse',       -- warehouse | store | supplier
  counts_for_online INTEGER NOT NULL DEFAULT 1, -- zaehlt zum online bestellbaren Bestand
  customer_visible INTEGER NOT NULL DEFAULT 0,  -- Kund:innen sehen die Verfuegbarkeit dieses Orts (z. B. Filiale)
  UNIQUE(source_id, external_id)
);

CREATE TABLE IF NOT EXISTS inventory_levels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  location_id INTEGER NOT NULL REFERENCES inventory_locations(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  ean TEXT,
  quantity INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(location_id, sku)
);
CREATE INDEX IF NOT EXISTS idx_inventory_levels_shop_sku ON inventory_levels(shop_id, sku);

CREATE TABLE IF NOT EXISTS inventory_sync_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL REFERENCES inventory_sources(id) ON DELETE CASCADE,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  status TEXT NOT NULL,               -- ok | error | blocked
  items INTEGER NOT NULL DEFAULT 0,
  message TEXT
);

-- Regeln fuer die Anzeige gegenueber Kund:innen
CREATE TABLE IF NOT EXISTS inventory_settings (
  shop_id INTEGER PRIMARY KEY REFERENCES shops(id) ON DELETE CASCADE,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,  -- ab hier "Nur noch X Stück"
  max_age_hours INTEGER NOT NULL DEFAULT 24,       -- aeltere Daten werden Kund:innen nicht gezeigt
  show_store_availability INTEGER NOT NULL DEFAULT 1
);

-- ---------------------------------------------------------------------------
-- Mandanten & Anmeldung
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organizations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'owner',   -- owner | member
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Gespeichert wird nur der SHA-256-Hash des Session-Tokens, nie das Token selbst.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

-- Einladungen in eine Organisation (Token nur als Hash)
CREATE TABLE IF NOT EXISTS invitations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL COLLATE NOCASE,
  role TEXT NOT NULL,                  -- owner | editor | viewer
  token_hash TEXT NOT NULL UNIQUE,
  invited_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Passwort-Reset (einmalig verwendbar, kurze Gueltigkeit)
CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

-- Fehlversuche (Login, Reset) – in der Datenbank, damit die Sperre Neustarts ueberdauert und
-- fuer alle Prozesse gilt, die dieselbe Datenbank nutzen
CREATE TABLE IF NOT EXISTS auth_attempts (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  reset_at INTEGER NOT NULL            -- Unix-Zeit in ms
);
