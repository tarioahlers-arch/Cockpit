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
