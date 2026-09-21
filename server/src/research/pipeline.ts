import { db } from '../db/index.js';
import { launchBrowser } from '../browser.js';
import { RESEARCH_CONNECTORS } from './connectors/index.js';
import type { RawCandidate, SearchParams } from './connectors/types.js';
import { normalizeCompanyName, normalizeDomain } from './normalize.js';
import { checkHasOnlineShop } from './ecommerceCheck.js';

interface RunRow {
  id: number;
  branche: string;
  region: string;
  exclusions: string | null;
  max_results: number;
}

function insertLog(
  runId: number,
  entry: {
    type: 'gefunden' | 'duplikat' | 'kein_shop_erkannt' | 'robots_disallow' | 'fehler';
    name?: string | null;
    domain?: string | null;
    quelleUrl?: string | null;
    quelleTyp?: string | null;
    detail: string;
  },
) {
  db.prepare(
    `INSERT INTO research_log (research_run_id, type, name, domain, quelle_url, quelle_typ, detail)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(runId, entry.type, entry.name ?? null, entry.domain ?? null, entry.quelleUrl ?? null, entry.quelleTyp ?? null, entry.detail);
}

function existsInCompanies(nameNormalized: string, domain: string | null): boolean {
  const row = db
    .prepare(`SELECT id FROM companies WHERE name_normalized = ? AND domain IS ?`)
    .get(nameNormalized, domain);
  return !!row;
}

/**
 * Fuehrt einen Recherche-Lauf synchron aus: fragt die relevanten Phase-1-Quellen
 * ab, dedupliziert, prueft je Kandidat kurz auf einen erkennbaren Online-Shop,
 * und schreibt akzeptierte Treffer als research_candidates (NICHT direkt in
 * companies - das passiert erst nach Nutzerbestaetigung, siehe /commit-Route).
 */
export async function runResearch(runId: number): Promise<void> {
  const run = db.prepare('SELECT * FROM research_runs WHERE id = ?').get(runId) as RunRow | undefined;
  if (!run) throw new Error(`Recherche-Lauf ${runId} nicht gefunden.`);

  const params: SearchParams = {
    branche: run.branche,
    region: run.region,
    exclusions: run.exclusions ?? undefined,
    maxResults: run.max_results,
  };

  const seenThisRun = new Set<string>();
  let remainingBudget = run.max_results;
  const connectors = RESEARCH_CONNECTORS.filter((c) => c.isRelevant(params));

  const browser = await launchBrowser();
  try {
    for (const connector of connectors) {
      if (remainingBudget <= 0) break;

      const result = await connector.search({ ...params, maxResults: remainingBudget });

      for (const logEntry of result.log) {
        insertLog(runId, { type: logEntry.type, quelleUrl: logEntry.quelleUrl, quelleTyp: logEntry.quelleTyp, detail: logEntry.detail });
      }

      for (const candidate of result.candidates) {
        if (remainingBudget <= 0) break;
        await processCandidate(runId, candidate, seenThisRun);
        // processCandidate entscheidet selbst, ob das Budget verbraucht wurde
        // (nur ein tatsaechlich uebernommener Kandidat zaehlt).
        remainingBudget = run.max_results - countAccepted(runId);
      }
    }

    db.prepare(`UPDATE research_runs SET status = 'completed', finished_at = datetime('now') WHERE id = ?`).run(runId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler beim Recherche-Lauf.';
    db.prepare(`UPDATE research_runs SET status = 'failed', error = ?, finished_at = datetime('now') WHERE id = ?`).run(
      message,
      runId,
    );
  } finally {
    await browser.close();
  }

  async function processCandidate(rid: number, candidate: RawCandidate, seen: Set<string>) {
    const nameNormalized = normalizeCompanyName(candidate.name);
    const domain = candidate.domain ?? normalizeDomain(candidate.url);
    const dedupKey = `${nameNormalized}::${domain ?? ''}`;

    if (seen.has(dedupKey) || existsInCompanies(nameNormalized, domain)) {
      insertLog(rid, {
        type: 'duplikat',
        name: candidate.name,
        domain,
        quelleUrl: candidate.quelleUrl,
        quelleTyp: candidate.quelleTyp,
        detail: 'Firma existiert bereits (Name+Domain) oder wurde in diesem Lauf schon gefunden.',
      });
      return;
    }
    seen.add(dedupKey);

    if (!candidate.url) {
      insertLog(rid, {
        type: 'kein_shop_erkannt',
        name: candidate.name,
        domain,
        quelleUrl: candidate.quelleUrl,
        quelleTyp: candidate.quelleTyp,
        detail: 'Quelle lieferte keine Ziel-URL, E-Commerce-Vorpruefung nicht moeglich.',
      });
      return;
    }

    const check = await checkHasOnlineShop(browser, candidate.url);
    if (!check.hasShop) {
      insertLog(rid, {
        type: 'kein_shop_erkannt',
        name: candidate.name,
        domain,
        quelleUrl: candidate.quelleUrl,
        quelleTyp: candidate.quelleTyp,
        detail: check.detail,
      });
      return;
    }

    db.prepare(
      `INSERT INTO research_candidates
         (research_run_id, name, name_normalized, domain, url, quelle_url, quelle_typ, hat_online_shop, selected, committed)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, 0)`,
    ).run(rid, candidate.name, nameNormalized, domain, candidate.url, candidate.quelleUrl, candidate.quelleTyp);

    insertLog(rid, {
      type: 'gefunden',
      name: candidate.name,
      domain,
      quelleUrl: candidate.quelleUrl,
      quelleTyp: candidate.quelleTyp,
      detail: check.detail,
    });
  }

  function countAccepted(rid: number): number {
    const row = db.prepare('SELECT COUNT(*) as n FROM research_candidates WHERE research_run_id = ?').get(rid) as {
      n: number;
    };
    return row.n;
  }
}
