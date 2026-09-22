import type { EventRow, ExperimentRow } from '../db/index.js';
import { NUDGES, type NudgeType } from './nudges.js';
import { SEGMENTS, segmentVisitors, type SegmentKey } from './segmentation.js';
import { requiredSampleSize, twoProportionTest, type ProportionTest } from './stats.js';

interface VariantStats {
  visitors: number;
  conversions: number;
  revenue: number;
  revenuePerVisitor: number;
}

export interface SegmentEffect {
  segment: SegmentKey;
  label: string;
  control: VariantStats;
  treatment: VariantStats;
  absoluteDiff: number;
}

export interface ExperimentAnalysis {
  experimentId: number;
  control: VariantStats;
  treatment: VariantStats;
  test: ProportionTest;
  requiredPerVariant: number;
  progress: number;
  verdict: 'winner' | 'loser' | 'inconclusive' | 'collecting';
  headline: string;
  explanation: string[];
  segmentEffects: SegmentEffect[];
}

const DEFAULT_MDE = 0.2;
const EARLY_STOP_P = 0.001;

function emptyStats(): VariantStats {
  return { visitors: 0, conversions: 0, revenue: 0, revenuePerVisitor: 0 };
}

/**
 * Auswertung auf Besucherebene: Ein Besucher zaehlt fuer die Variante, der er beim ersten
 * "exposure"-Ereignis zugewiesen wurde. Konvertiert hat er, wenn danach ein Kauf folgt.
 */
export function analyzeExperiment(experiment: ExperimentRow, shopEvents: EventRow[]): ExperimentAnalysis {
  const exposures = new Map<string, { variant: string; ts: string }>();
  for (const e of shopEvents) {
    if (e.type === 'exposure' && e.experiment_id === experiment.id && e.variant && !exposures.has(e.visitor_id)) {
      exposures.set(e.visitor_id, { variant: e.variant, ts: e.ts });
    }
  }

  const purchasesByVisitor = new Map<string, EventRow[]>();
  for (const e of shopEvents) {
    if (e.type !== 'purchase' || !exposures.has(e.visitor_id)) continue;
    const list = purchasesByVisitor.get(e.visitor_id) ?? [];
    list.push(e);
    purchasesByVisitor.set(e.visitor_id, list);
  }

  const { assignments } = segmentVisitors(shopEvents.filter((e) => exposures.has(e.visitor_id)));

  const control = emptyStats();
  const treatment = emptyStats();
  const bySegment = new Map<SegmentKey, { control: VariantStats; treatment: VariantStats }>();

  for (const [visitorId, exp] of exposures) {
    const target = exp.variant === 'treatment' ? treatment : control;
    const after = (purchasesByVisitor.get(visitorId) ?? []).filter((p) => p.ts >= exp.ts);
    const converted = after.length > 0;
    const revenue = after.reduce((s, p) => s + (p.value ?? 0), 0);

    target.visitors += 1;
    if (converted) target.conversions += 1;
    target.revenue += revenue;

    const seg = assignments.get(visitorId)?.segment ?? 'undetermined';
    const segEntry = bySegment.get(seg) ?? { control: emptyStats(), treatment: emptyStats() };
    const segTarget = exp.variant === 'treatment' ? segEntry.treatment : segEntry.control;
    segTarget.visitors += 1;
    if (converted) segTarget.conversions += 1;
    segTarget.revenue += revenue;
    bySegment.set(seg, segEntry);
  }
  for (const s of [control, treatment, ...[...bySegment.values()].flatMap((v) => [v.control, v.treatment])]) {
    s.revenue = Math.round(s.revenue * 100) / 100;
    s.revenuePerVisitor = s.visitors ? Math.round((s.revenue / s.visitors) * 100) / 100 : 0;
  }

  const test = twoProportionTest(control.conversions, control.visitors, treatment.conversions, treatment.visitors);
  const config = JSON.parse(experiment.config) as { mde?: number };
  const mde = typeof config.mde === 'number' && config.mde > 0 ? config.mde : DEFAULT_MDE;
  const baseline = test.controlRate > 0 ? test.controlRate : 0.02;
  const requiredPerVariant = requiredSampleSize(baseline, mde);
  const progress = Math.min(1, Math.min(control.visitors, treatment.visitors) / requiredPerVariant);

  const segmentEffects: SegmentEffect[] = [...bySegment.entries()]
    .filter(([segment, v]) => segment !== 'undetermined' && v.control.visitors >= 20 && v.treatment.visitors >= 20)
    .map(([segment, v]) => ({
      segment,
      label: SEGMENTS[segment].label,
      control: v.control,
      treatment: v.treatment,
      absoluteDiff:
        v.treatment.conversions / v.treatment.visitors - v.control.conversions / v.control.visitors,
    }))
    .sort((a, b) => b.absoluteDiff - a.absoluteDiff);

  let verdict: ExperimentAnalysis['verdict'];
  // Gegen "Peeking": vor Erreichen der geplanten Stichprobe nur bei sehr starker Evidenz entscheiden
  // (Haybittle-Peto-Grenze p < 0,001), danach mit dem regulaeren Niveau p < 0,05.
  const decisive = progress >= 1 ? test.significant : test.pValue < EARLY_STOP_P;
  if (control.visitors < 100 || treatment.visitors < 100) verdict = 'collecting';
  else if (decisive) verdict = test.absoluteDiff > 0 ? 'winner' : 'loser';
  else verdict = progress >= 1 ? 'inconclusive' : 'collecting';

  const { headline, explanation } = explain(experiment, verdict, test, segmentEffects, progress, requiredPerVariant, mde);

  return {
    experimentId: experiment.id,
    control,
    treatment,
    test,
    requiredPerVariant,
    progress,
    verdict,
    headline,
    explanation,
    segmentEffects,
  };
}

const pct = (v: number, digits = 1) => `${(v * 100).toFixed(digits).replace('.', ',')} %`;
const pValue = (p: number) => (p < 0.001 ? 'p < 0,001' : `p = ${p.toFixed(3).replace('.', ',')}`);
const pp = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2).replace('.', ',')} pp`;

/** Klartext-Erklaerung: "Warum performt Variante B besser?" */
function explain(
  experiment: ExperimentRow,
  verdict: ExperimentAnalysis['verdict'],
  test: ProportionTest,
  segmentEffects: SegmentEffect[],
  progress: number,
  required: number,
  mde: number,
): { headline: string; explanation: string[] } {
  const nudge = NUDGES[experiment.nudge_type as NudgeType];
  const lines: string[] = [];
  let headline: string;

  const uplift = test.relativeUplift !== null ? `${test.relativeUplift >= 0 ? '+' : ''}${pct(test.relativeUplift)}` : 'n/a';

  switch (verdict) {
    case 'winner':
      headline = `Variante B (${nudge.label}) gewinnt: Conversion ${pct(test.treatmentRate, 2)} statt ${pct(test.controlRate, 2)} (${uplift}).`;
      lines.push(
        `Der Unterschied ist statistisch signifikant (${pValue(test.pValue)}). Das 95-%-Konfidenzintervall liegt zwischen ${pp(test.ci95[0])} und ${pp(test.ci95[1])}.`,
      );
      break;
    case 'loser':
      headline = `Variante B (${nudge.label}) schneidet signifikant schlechter ab (${uplift}). Empfehlung: nicht ausrollen.`;
      lines.push(
        `${pValue(test.pValue)}. Ein negativer Effekt deutet oft darauf hin, dass der Hinweis als aufdringlich oder unglaubwürdig empfunden wird.`,
      );
      break;
    case 'inconclusive':
      headline = `Kein belastbarer Unterschied messbar (${uplift}, p = ${test.pValue.toFixed(2).replace('.', ',')}).`;
      lines.push(
        `Die geplante Stichprobe ist erreicht, der Effekt ist jedoch kleiner als ${Math.round(mde * 100)} % relativ oder nicht vorhanden. Der Nudge kann beibehalten werden, wenn er Kund:innen echten Informationswert bietet – ein Umsatzhebel ist er hier nicht.`,
      );
      break;
    default:
      if (experiment.status === 'draft') {
        headline = 'Entwurf – noch nicht gestartet.';
        lines.push(
          `Nach dem Start teilt das Snippet die Besucher:innen ${Math.round((1 - experiment.traffic_split) * 100)}/${Math.round(experiment.traffic_split * 100)} auf Kontrolle (A) und ${nudge.label} (B) auf. Benötigt werden ca. ${required.toLocaleString('de-DE')} Besucher:innen je Variante (Effekt ≥ ${Math.round(mde * 100)} % relativ, Power 80 %).`,
        );
        break;
      }
      headline = `Test läuft – ${Math.round(progress * 100)} % der benötigten Stichprobe erreicht.`;
      lines.push(
        `Für einen belastbaren Befund (Effekt ≥ ${Math.round(mde * 100)} % relativ, Power 80 %) werden ca. ${required.toLocaleString('de-DE')} Besucher:innen je Variante benötigt. Aktuell: ${pct(test.controlRate, 2)} (A) vs. ${pct(test.treatmentRate, 2)} (B), p = ${test.pValue.toFixed(2).replace('.', ',')} – Zwischenstände bitte nicht vorzeitig als Ergebnis werten.`,
      );
  }

  lines.push(`Wirkmechanismus – ${nudge.principle}: ${nudge.mechanism}`);

  if (segmentEffects.length >= 2 && (verdict === 'winner' || verdict === 'loser')) {
    const top = segmentEffects[0];
    const bottom = segmentEffects[segmentEffects.length - 1];
    lines.push(
      `Der Effekt ist nicht gleich verteilt: Am stärksten reagiert das Segment "${top.label}" (${pp(top.absoluteDiff)}), am schwächsten "${bottom.label}" (${pp(bottom.absoluteDiff)}).`,
    );
    const fits = Object.entries(SEGMENTS)
      .filter(([, s]) => s.nudgeFit.includes(experiment.nudge_type))
      .map(([k]) => k);
    if (fits.includes(top.segment) && verdict === 'winner') {
      lines.push(
        `Das deckt sich mit der verhaltensökonomischen Erwartung: ${nudge.label} adressiert genau die Entscheidungsmuster dieses Segments.`,
      );
    }
  }

  if (verdict === 'inconclusive' && segmentEffects.length >= 2 && segmentEffects[0].absoluteDiff >= 0.02) {
    const top = segmentEffects[0];
    lines.push(
      `Hypothese für den nächsten Test: Im Segment "${top.label}" zeigt sich ein Unterschied von ${pp(top.absoluteDiff)}. Da Segment-Auswertungen nachträglich gebildet werden, ist das kein Beleg – ein gezielter Test nur für dieses Segment wäre der nächste Schritt.`,
    );
  }

  return { headline, explanation: lines };
}
