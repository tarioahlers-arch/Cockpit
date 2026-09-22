import { db } from '../db/index.js';
import { CONNECTORS } from './connectors/index.js';
import { ingestInventory, type IngestResult, type SourceRow } from './ingest.js';
import type { FetchLike, SourceType } from './types.js';
import { guardedFetch } from '../security/outbound.js';

/**
 * Einzige Ausnahme vom SSRF-Schutz: der vom Server selbst bereitgestellte ERP-Feed eines
 * Demo-Shops (localhost, exakt der Pfad dieses Shops).
 */
function isOwnDemoFeed(source: SourceRow, config: Record<string, string>): boolean {
  if (source.type !== 'csv_url' || !config.url) return false;
  const shop = db.prepare('SELECT is_demo FROM shops WHERE id = ?').get(source.shop_id) as { is_demo: number } | undefined;
  if (!shop?.is_demo) return false;
  try {
    const u = new URL(config.url);
    const port = process.env.PORT ?? '4100';
    return u.protocol === 'http:' && u.hostname === 'localhost' && u.port === port && u.pathname === `/demo-shop/${source.shop_id}/erp-bestand.csv` && !u.search;
  } catch {
    return false;
  }
}

const running = new Set<number>();

/** Fuehrt einen Abgleich fuer eine Pull-Quelle aus und protokolliert ihn. */
export async function runSync(
  sourceId: number,
  opts: { fetchImpl?: FetchLike; force?: boolean } = {},
): Promise<IngestResult | { status: 'error'; message: string }> {
  const source = db.prepare('SELECT * FROM inventory_sources WHERE id = ?').get(sourceId) as SourceRow | undefined;
  if (!source) return { status: 'error', message: 'Quelle nicht gefunden.' };
  const connector = CONNECTORS[source.type as SourceType];
  if (!connector) return { status: 'error', message: 'Diese Quelle liefert selbst (Push) und kann nicht abgerufen werden.' };
  if (running.has(sourceId)) return { status: 'error', message: 'Abgleich läuft bereits.' };

  running.add(sourceId);
  const runId = Number(
    db.prepare(`INSERT INTO inventory_sync_runs (source_id, status) VALUES (?, 'running')`).run(sourceId).lastInsertRowid,
  );
  try {
    const config = JSON.parse(source.config) as Record<string, string>;
    const snapshot = await connector.fetchSnapshot(config, guardedFetch({ allowPrivate: isOwnDemoFeed(source, config) }, opts.fetchImpl ?? fetch));
    const result = ingestInventory(source, snapshot, 'snapshot', { force: opts.force });
    finish(source.id, runId, result.status, result.items, result.message);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    finish(source.id, runId, 'error', 0, message);
    return { status: 'error', message };
  } finally {
    running.delete(sourceId);
  }
}

/** Protokolliert einen Push/Upload wie einen Abgleich. */
export function recordPush(sourceId: number, result: IngestResult) {
  const runId = Number(
    db.prepare(`INSERT INTO inventory_sync_runs (source_id, status) VALUES (?, 'running')`).run(sourceId).lastInsertRowid,
  );
  finish(sourceId, runId, result.status, result.items, result.message);
}

function finish(sourceId: number, runId: number, status: string, items: number, message: string) {
  db.prepare(`UPDATE inventory_sync_runs SET status = ?, items = ?, message = ?, finished_at = datetime('now') WHERE id = ?`).run(
    status,
    items,
    message,
    runId,
  );
  db.prepare(
    `UPDATE inventory_sources SET last_sync_at = datetime('now'), last_status = ?, last_message = ? WHERE id = ?`,
  ).run(status, message, sourceId);
}

/** Prueft jede Minute, welche Pull-Quellen faellig sind, und gleicht sie nacheinander ab. */
export function startInventoryScheduler(intervalMs = 60_000) {
  const tick = async () => {
    const due = db
      .prepare(
        `SELECT id FROM inventory_sources
         WHERE active = 1 AND type != 'push'
           AND (last_sync_at IS NULL OR last_sync_at <= datetime('now', '-' || sync_interval_min || ' minutes'))`,
      )
      .all() as { id: number }[];
    for (const { id } of due) await runSync(id);
  };
  const timer = setInterval(() => void tick().catch((e) => console.error('Lager-Sync:', e)), intervalMs);
  timer.unref();
  return timer;
}
