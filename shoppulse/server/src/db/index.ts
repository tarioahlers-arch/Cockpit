import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';
import { decryptSecret, encryptSecret, isEncrypted, needsReencryption } from '../security/secrets.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = config.dataDir;
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_FILE = process.env.SHOPPULSE_DB ?? path.join(DATA_DIR, 'shoppulse.db');

export const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8'));

function columns(table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);
}

/** Migrationen fuer Datenbanken aus aelteren Versionen (idempotent). */
function migrate() {
  // Mandantentrennung: jeder Shop gehoert genau einer Organisation
  if (!columns('shops').includes('org_id')) {
    db.exec('ALTER TABLE shops ADD COLUMN org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE');
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_shops_org ON shops(org_id)');

  // Push-Tokens nur noch als Hash speichern; bestehende Klartext-Tokens umwandeln
  if (!columns('inventory_sources').includes('push_token_hash')) {
    db.exec('ALTER TABLE inventory_sources ADD COLUMN push_token_hash TEXT');
    db.exec('ALTER TABLE inventory_sources ADD COLUMN push_token_hint TEXT');
  }
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_sources_push_hash ON inventory_sources(push_token_hash)');
  const plain = db.prepare('SELECT id, push_token FROM inventory_sources WHERE push_token IS NOT NULL').all() as {
    id: number;
    push_token: string;
  }[];
  const upd = db.prepare('UPDATE inventory_sources SET push_token_hash = ?, push_token_hint = ?, push_token = NULL WHERE id = ?');
  for (const r of plain) upd.run(sha256(r.push_token), r.push_token.slice(-4), r.id);

  // Autopilot: vom Autopiloten angelegte Experimente markieren
  if (!columns('experiments').includes('created_by_autopilot')) {
    db.exec('ALTER TABLE experiments ADD COLUMN created_by_autopilot INTEGER NOT NULL DEFAULT 0');
  }

  // Schwarmwissen: Teilnahme je Shop, Token fuer den pseudonymen Quellschluessel
  if (!columns('shops').includes('swarm_opt_in')) {
    db.exec('ALTER TABLE shops ADD COLUMN swarm_opt_in INTEGER NOT NULL DEFAULT 0');
    db.exec('ALTER TABLE shops ADD COLUMN swarm_token TEXT');
  }
  // Segment-Targeting fuer Tests und Rollouts (NULL = alle Besucher:innen)
  if (!columns('experiments').includes('target_segments')) {
    db.exec('ALTER TABLE experiments ADD COLUMN target_segments TEXT');
    db.exec('ALTER TABLE experiments ADD COLUMN swarm_contributed_at TEXT');
  }
  if (!columns('nudge_rollouts').includes('target_segments')) {
    db.exec('ALTER TABLE nudge_rollouts ADD COLUMN target_segments TEXT');
  }

  // Rollenmodell owner | editor | viewer (fruehere Bezeichnung "member" = editor)
  db.exec(`UPDATE users SET role = 'editor' WHERE role = 'member'`);

  // Zugangsdaten der Quellen verschluesselt ablegen (nur Klartext aus aelteren Versionen umwandeln;
  // Wechsel des Schluessels erfolgt bewusst per `npm run rotate-secrets`)
  reencryptSourceConfigs('plaintext');
}

/**
 * Verschluesselt Quellen-Konfigurationen mit dem aktuellen Schluessel.
 *  - "plaintext": nur unverschluesselte Altdaten (beim Start, braucht keinen alten Schluessel)
 *  - "all": zusaetzlich alles, was mit einem frueheren Schluessel verschluesselt ist (Rotation)
 */
export function reencryptSourceConfigs(scope: 'plaintext' | 'all' = 'all'): number {
  const rows = db.prepare('SELECT id, config FROM inventory_sources').all() as { id: number; config: string }[];
  const upd = db.prepare('UPDATE inventory_sources SET config = ? WHERE id = ?');
  let n = 0;
  db.transaction(() => {
    for (const r of rows) {
      if (scope === 'plaintext' ? isEncrypted(r.config) : !needsReencryption(r.config)) continue;
      upd.run(encryptSecret(decryptSecret(r.config)), r.id);
      n += 1;
    }
  })();
  return n;
}

export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

migrate();

export interface ShopRow {
  id: number;
  name: string;
  domain: string;
  platform: string;
  niche: string;
  public_key: string;
  is_demo: number;
  org_id: number | null;
  swarm_opt_in: number;
  swarm_token: string | null;
  created_at: string;
}

export interface EventRow {
  id: number;
  shop_id: number;
  visitor_id: string;
  session_id: string;
  type: string;
  page_type: string | null;
  sku: string | null;
  value: number | null;
  experiment_id: number | null;
  variant: string | null;
  ts: string;
}

export interface ExperimentRow {
  id: number;
  shop_id: number;
  name: string;
  nudge_type: string;
  page_type: string;
  config: string;
  status: string;
  traffic_split: number;
  created_at: string;
  started_at: string | null;
  stopped_at: string | null;
  created_by_autopilot: number;
  target_segments: string | null;
  swarm_contributed_at: string | null;
}

export interface ProductRow {
  id: number;
  shop_id: number;
  sku: string;
  ean: string | null;
  name: string;
  price: number;
  unit_cost: number | null;
  stock: number | null;
}

export function getShop(id: number | string): ShopRow | undefined {
  return db.prepare('SELECT * FROM shops WHERE id = ?').get(id) as ShopRow | undefined;
}

/**
 * Kurzlebiger In-Memory-Cache der Rohereignisse (max. 90 Tage je Shop). Das Materialisieren
 * hunderttausender Zeilen ist der teuerste Schritt jeder Auswertung; Dashboard-Tabs teilen sich
 * daher einen Ladevorgang. Neue Ereignisse erscheinen nach spaetestens CACHE_TTL_MS.
 * Im Produktivbetrieb uebernimmt diese Rolle der Feature Store hinter der Event-Pipeline.
 */
const CACHE_TTL_MS = Number(process.env.SHOPPULSE_CACHE_TTL_MS ?? 60_000);
const MAX_DAYS = 90;
const eventCache = new Map<number, { loadedAt: number; events: EventRow[] }>();

export function invalidateEvents(shopId: number) {
  eventCache.delete(shopId);
}

/** SQLite-Zeitstempel ('YYYY-MM-DD HH:MM:SS', UTC) fuer "jetzt minus ms". */
export function sqliteTs(msAgo: number): string {
  return new Date(Date.now() - msAgo).toISOString().slice(0, 19).replace('T', ' ');
}

/** Ereignisse der letzten `days` Tage (Default 30, max. 90), chronologisch. */
export function recentEvents(shopId: number, days = 30): EventRow[] {
  let entry = eventCache.get(shopId);
  if (!entry || Date.now() - entry.loadedAt > CACHE_TTL_MS) {
    const events = db
      .prepare(`SELECT * FROM events WHERE shop_id = ? AND ts >= datetime('now', ?) ORDER BY ts ASC`)
      .all(shopId, `-${MAX_DAYS} days`) as EventRow[];
    entry = { loadedAt: Date.now(), events };
    eventCache.set(shopId, entry);
  }
  if (days >= MAX_DAYS) return entry.events;
  const cutoff = sqliteTs(days * 86_400_000);
  return entry.events.filter((e) => e.ts >= cutoff);
}

/** Zugangsdaten einer Quelle lesen (entschluesselt). */
export function readSourceConfig(stored: string): Record<string, string> {
  return JSON.parse(decryptSecret(stored)) as Record<string, string>;
}

/** Zugangsdaten einer Quelle zum Speichern vorbereiten (verschluesselt). */
export function writeSourceConfig(value: Record<string, string>): string {
  return encryptSecret(JSON.stringify(value));
}
