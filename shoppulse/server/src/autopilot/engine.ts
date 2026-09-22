import { db, recentEvents, type ExperimentRow, type ShopRow } from '../db/index.js';
import { analyzeExperiment } from '../analytics/experiments.js';
import { NUDGES, isNudgeType, type NudgeType } from '../analytics/nudges.js';
import { computeOverview } from '../services/overview.js';
import { SEGMENTS, type SegmentKey } from '../analytics/segmentation.js';
import { assessExperiment, contributePending, getPrior, targetSegmentsForNewTest, targetSegmentsForRollout } from '../swarm/swarm.js';

/**
 * Growth-Autopilot: fuehrt den Kreislauf Empfehlung -> Test -> Auswertung -> Rollout selbststaendig.
 *
 * Leitplanken:
 *  - arbeitet nur, wenn im Shop ausdruecklich eingeschaltet (einmalige Freigabe)
 *  - Modus "suggest": legt Tests nur als Entwurf an; "auto": startet sie selbst
 *  - verwaltet nur seine eigenen Experimente und hoechstens eines gleichzeitig
 *  - Preise werden nie automatisch geaendert (bleiben Empfehlungen im Pricing-Modul)
 *  - Sicherheitsstopp, sobald Variante B signifikant Conversion kostet (p < 0,01)
 *  - jede Aktion wird mit Begruendung protokolliert
 */

export interface AutopilotSettings {
  shop_id: number;
  enabled: number;
  mode: 'suggest' | 'auto';
  holdout_share: number;
  allowed_nudges: string;
  updated_by: number | null;
  updated_at: string | null;
  last_run_at: string | null;
}

export const DEFAULT_SETTINGS = {
  enabled: 0,
  mode: 'suggest' as const,
  holdout_share: 0.05,
  allowed_nudges: '["social_proof","scarcity","anchoring"]',
};

/** Nudges, die der Autopilot selbst testen darf. Decoy braucht Sortimentsgestaltung durch den Shop. */
export const AUTOPILOT_NUDGES: NudgeType[] = ['social_proof', 'scarcity', 'anchoring'];

const GUARDRAIL_P = 0.01;
const GUARDRAIL_MIN_VISITORS = 200;
const MIN_SESSIONS_FOR_TESTS = 200;
/** Ein beendeter Test desselben Typs wird fruehestens nach dieser Zeit erneut versucht */
const RETEST_AFTER_DAYS = 90;

export function getAutopilotSettings(shopId: number): AutopilotSettings {
  return (
    (db.prepare('SELECT * FROM autopilot_settings WHERE shop_id = ?').get(shopId) as AutopilotSettings | undefined) ?? {
      shop_id: shopId,
      ...DEFAULT_SETTINGS,
      updated_by: null,
      updated_at: null,
      last_run_at: null,
    }
  );
}

export function allowedNudges(s: AutopilotSettings): NudgeType[] {
  try {
    return (JSON.parse(s.allowed_nudges) as unknown[]).filter(isNudgeType).filter((n) => AUTOPILOT_NUDGES.includes(n));
  } catch {
    return [];
  }
}

export function logAction(
  shopId: number,
  action: string,
  title: string,
  reason: string,
  refs: { experimentId?: number | null; rolloutId?: number | null } = {},
) {
  db.prepare(
    'INSERT INTO autopilot_log (shop_id, action, title, reason, experiment_id, rollout_id) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(shopId, action, title, reason, refs.experimentId ?? null, refs.rolloutId ?? null);
}

export interface RunResult {
  ran: boolean;
  actions: { action: string; title: string }[];
  message: string;
}

export function runAutopilot(shop: ShopRow): RunResult {
  const settings = getAutopilotSettings(shop.id);
  if (!settings.enabled) return { ran: false, actions: [], message: 'Autopilot ist für diesen Shop ausgeschaltet.' };
  const actions: RunResult['actions'] = [];
  const act = (action: string, title: string, reason: string, refs?: { experimentId?: number | null; rolloutId?: number | null }) => {
    logAction(shop.id, action, title, reason, refs);
    actions.push({ action, title });
  };

  // 1) Laufende eigene Experimente auswerten
  const running = db
    .prepare(`SELECT * FROM experiments WHERE shop_id = ? AND status = 'running' AND created_by_autopilot = 1`)
    .all(shop.id) as ExperimentRow[];
  for (const exp of running) {
    const since = exp.started_at ?? exp.created_at;
    const a = analyzeExperiment(exp, recentEvents(shop.id, 90).filter((e) => e.ts >= since));
    // Schwarmwissen: fruehere Entscheidung, wenn eigene Daten und Netzwerk uebereinstimmen
    const swarm = a.verdict === 'collecting' ? assessExperiment(shop, exp, a) : null;
    const verdict = swarm?.earlyDecision ?? a.verdict;
    const early = !!swarm?.earlyDecision;
    const stop = () =>
      db.prepare(`UPDATE experiments SET status = 'stopped', stopped_at = datetime('now') WHERE id = ?`).run(exp.id);
    const label = NUDGES[exp.nudge_type as NudgeType]?.label ?? exp.nudge_type;

    if (
      a.control.visitors >= GUARDRAIL_MIN_VISITORS &&
      a.treatment.visitors >= GUARDRAIL_MIN_VISITORS &&
      a.test.absoluteDiff < 0 &&
      a.test.pValue < GUARDRAIL_P
    ) {
      stop();
      act('guardrail_stop', `Sicherheitsstopp: ${exp.name}`, `Variante B kostet signifikant Conversion (${a.headline}). Test sofort beendet, nichts ausgerollt.`, {
        experimentId: exp.id,
      });
    } else if (verdict === 'winner') {
      stop();
      const exists = db
        .prepare('SELECT id FROM nudge_rollouts WHERE shop_id = ? AND nudge_type = ? AND page_type = ? AND active = 1')
        .get(shop.id, exp.nudge_type, exp.page_type) as { id: number } | undefined;
      // Segment-Targeting: nur dort ausspielen, wo der Nudge nachweislich nicht schadet
      const testSegments = exp.target_segments ? (JSON.parse(exp.target_segments) as string[]) : null;
      const target = targetSegmentsForRollout(shop, exp, a);
      const segments = testSegments ?? target.segments;
      const rolloutId =
        exists?.id ??
        Number(
          db
            .prepare('INSERT INTO nudge_rollouts (shop_id, nudge_type, page_type, config, source_experiment_id, target_segments) VALUES (?, ?, ?, ?, ?, ?)')
            .run(shop.id, exp.nudge_type, exp.page_type, exp.config, exp.id, segments ? JSON.stringify(segments) : null).lastInsertRowid,
        );
      const scope = segments
        ? `Ausgespielt nur für: ${segments.map((k) => SEGMENTS[k as SegmentKey]?.label ?? k).join(', ')}.${target.reasons.length ? ' Ausgenommen – ' + target.reasons.join('; ') + '.' : ''}`
        : 'Der Nudge gilt für alle Besucher:innen außer der Kontrollgruppe.';
      act(
        'rollout',
        `Gewinner ausgerollt: ${label}${early ? ' (mit Schwarmwissen früher entschieden)' : ''}`,
        `${early ? 'Schwarmwissen: ' + swarm!.text : a.headline} ${scope} Die Wirkung wird im Uplift-Nachweis weiter gemessen.`,
        { experimentId: exp.id, rolloutId },
      );
    } else if (verdict === 'loser') {
      stop();
      act('stopped_loser', `Test beendet: ${exp.name}`, `${early ? 'Schwarmwissen: ' + swarm!.text + ' ' : a.headline} Nicht ausgerollt.`, { experimentId: exp.id });
    } else if (a.verdict === 'inconclusive') {
      stop();
      act('stopped_inconclusive', `Test ohne Effekt beendet: ${exp.name}`, `${a.headline} Der nächste Test kann starten.`, {
        experimentId: exp.id,
      });
    }
  }

  // 2) Naechsten Test waehlen, wenn keiner (mehr) laeuft
  const stillRunning = (
    db.prepare(`SELECT COUNT(*) as n FROM experiments WHERE shop_id = ? AND status = 'running' AND created_by_autopilot = 1`).get(shop.id) as {
      n: number;
    }
  ).n;
  const openDraft = db
    .prepare(`SELECT id FROM experiments WHERE shop_id = ? AND status = 'draft' AND created_by_autopilot = 1`)
    .get(shop.id) as { id: number } | undefined;

  if (!stillRunning && !(settings.mode === 'suggest' && openDraft)) {
    const overview = computeOverview(shop, 30);
    if (overview.funnel.sessions < MIN_SESSIONS_FOR_TESTS) {
      if (!actions.length) {
        return finish(`Zu wenig Traffic für Tests (${overview.funnel.sessions} Sessions in 30 Tagen, mindestens ${MIN_SESSIONS_FOR_TESTS}).`);
      }
    } else {
      const blocked = new Set<string>();
      for (const r of db.prepare('SELECT nudge_type FROM nudge_rollouts WHERE shop_id = ? AND active = 1').all(shop.id) as { nudge_type: string }[]) {
        blocked.add(r.nudge_type);
      }
      for (const r of db
        .prepare(
          `SELECT nudge_type FROM experiments WHERE shop_id = ?
           AND (status IN ('running', 'draft') OR (status = 'stopped' AND stopped_at >= datetime('now', ?)))`,
        )
        .all(shop.id, `-${RETEST_AFTER_DAYS} days`) as { nudge_type: string }[]) {
        blocked.add(r.nudge_type);
      }
      const allowed = allowedNudges(settings);
      // Kandidaten aus den Empfehlungen; Schwarmwissen sortiert aus, was in vergleichbaren Shops nicht wirkt
      const skippedBySwarm: string[] = [];
      const candidates = overview.recommendations.filter(
        (r) => r.nudgeType && allowed.includes(r.nudgeType) && !blocked.has(r.nudgeType) && !r.id.startsWith('rollout-'),
      );
      const scored = candidates
        .map((r) => ({ rec: r, prior: getPrior(shop, r.nudgeType!, 'all') }))
        .filter(({ rec, prior }) => {
          if (prior && prior.liftInterval[1] <= 0) {
            skippedBySwarm.push(`${NUDGES[rec.nudgeType!].label} (im Schwarm ${prior.shops} Shops ohne Nutzen)`);
            return false;
          }
          return true;
        })
        // Mit Schwarmwissen: erwarteter Effekt gewichtet das Potenzial; ohne: Reihenfolge der Empfehlungen
        .sort((x, y) => (y.prior ? 1 + y.prior.lift : 1) * y.rec.potentialPerMonth - (x.prior ? 1 + x.prior.lift : 1) * x.rec.potentialPerMonth);
      const candidate = scored[0]?.rec;
      const candidatePrior = scored[0]?.prior ?? null;
      if (candidate?.nudgeType) {
        const nudge = NUDGES[candidate.nudgeType];
        const start = settings.mode === 'auto';
        const target = targetSegmentsForNewTest(shop, candidate.nudgeType);
        const expId = Number(
          db
            .prepare(
              `INSERT INTO experiments (shop_id, name, nudge_type, page_type, config, status, traffic_split, started_at, created_by_autopilot, target_segments)
               VALUES (?, ?, ?, 'product', ?, ?, 0.5, ${start ? "datetime('now')" : 'NULL'}, 1, ?)`,
            )
            .run(
              shop.id,
              `Autopilot: ${nudge.label}`,
              candidate.nudgeType,
              JSON.stringify(nudge.defaultConfig),
              start ? 'running' : 'draft',
              target.segments ? JSON.stringify(target.segments) : null,
            ).lastInsertRowid,
        );
        const swarmNote = candidatePrior
          ? ` Schwarmwissen: In ${candidatePrior.shops} vergleichbaren Shops im Schnitt ${candidatePrior.lift >= 0 ? '+' : ''}${(candidatePrior.lift * 100).toFixed(1).replace('.', ',')} % Conversion.`
          : '';
        const targetNote = target.segments
          ? ` Getestet nur für: ${target.segments.map((k) => SEGMENTS[k as SegmentKey]?.label ?? k).join(', ')} (${target.reasons.join('; ')}).`
          : '';
        const skipNote = skippedBySwarm.length ? ` Übersprungen: ${skippedBySwarm.join(', ')}.` : '';
        act(
          start ? 'test_started' : 'test_proposed',
          start ? `Test gestartet: ${nudge.label}` : `Test vorgeschlagen: ${nudge.label} (wartet auf Freigabe)`,
          `Grundlage: „${candidate.title}“ – ${candidate.why}${swarmNote}${targetNote}${skipNote}`,
          { experimentId: expId },
        );
      } else if (!actions.length) {
        return finish('Keine neue testbare Maßnahme: alle erlaubten Nudges laufen bereits, sind ausgerollt oder wurden kürzlich getestet.');
      }
    }
  }

  return finish(actions.length ? `${actions.length} Aktion(en) ausgeführt.` : 'Keine Aktion nötig – laufender Test sammelt noch Daten.');

  function finish(message: string): RunResult {
    // Beendete Tests ins Schwarmwissen uebernehmen (nur bei Teilnahme)
    try {
      contributePending(db.prepare('SELECT * FROM shops WHERE id = ?').get(shop.id) as ShopRow);
    } catch (e) {
      console.error('Schwarmwissen:', e);
    }
    db.prepare(
      `INSERT INTO autopilot_settings (shop_id, last_run_at) VALUES (?, datetime('now'))
       ON CONFLICT(shop_id) DO UPDATE SET last_run_at = excluded.last_run_at`,
    ).run(shop.id);
    return { ran: true, actions, message };
  }
}

/** Alle 15 Minuten fuer alle Shops mit eingeschaltetem Autopiloten. */
export function startAutopilotScheduler(intervalMs = 15 * 60 * 1000) {
  const tick = () => {
    const shops = db
      .prepare('SELECT s.* FROM shops s JOIN autopilot_settings a ON a.shop_id = s.id WHERE a.enabled = 1')
      .all() as ShopRow[];
    for (const shop of shops) {
      try {
        runAutopilot(shop);
      } catch (e) {
        console.error(`Autopilot Shop #${shop.id}:`, e);
      }
    }
  };
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  return timer;
}
