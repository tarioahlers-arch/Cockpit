import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.SHOPPULSE_DATA_DIR ?? path.resolve(__dirname, '../../data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_FILE = process.env.SHOPPULSE_DB ?? path.join(DATA_DIR, 'shoppulse.db');

export const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8'));

export interface ShopRow {
  id: number;
  name: string;
  domain: string;
  platform: string;
  niche: string;
  public_key: string;
  is_demo: number;
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
