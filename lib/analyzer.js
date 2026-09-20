import * as cheerio from "cheerio";
import { CATEGORIES, CHECKS, INVERTED_CATEGORIES, gradeFor } from "./checks.js";
import { MEASURES } from "./measures.js";
import { ABANDONMENT_REASONS } from "./benchmarks.js";

export function buildReport(pages) {
  const validPages = pages.filter((p) => p.ok && p.html);

  const pageSummaries = pages.map((p) => ({
    url: p.url,
    finalUrl: p.finalUrl,
    ok: p.ok,
    status: p.status,
    error: p.error,
    loadTimeMs: p.loadTimeMs,
    sizeKb: Math.round((p.sizeBytes || 0) / 1024),
    mode: p.mode || "html",
  }));

  if (validPages.length === 0) {
    return {
      error:
        "Keine der angegebenen Seiten konnte geladen werden. Bitte URL(s) prüfen (z. B. Bot-Schutz des Shops, falsche Domain).",
      pages: pageSummaries,
    };
  }

  const docs = validPages.map((p) => cheerio.load(p.html));
  const text = docs
    .map(($) => $("body").text())
    .join(" \n ")
    .toLowerCase()
    .replace(/\s+/g, " ");
  const html = validPages.map((p) => p.html).join(" ").toLowerCase();
  const urls = validPages.map((p) => p.finalUrl || p.url);

  const ctx = { docs, text, html, urls, pages: validPages };

  const buckets = {};
  for (const key of Object.keys(CATEGORIES)) {
    buckets[key] = { weightSum: 0, scoreSum: 0, findings: [] };
  }

  for (const check of CHECKS) {
    let ratio;
    try {
      ratio = Math.max(0, Math.min(1, check.passRatio(ctx)));
    } catch {
      ratio = 0;
    }
    const bucket = buckets[check.category];
    bucket.weightSum += check.weight;
    bucket.scoreSum += check.weight * ratio;
    const passed = ratio >= 0.999;
    const gap = 1 - ratio; // Anteil der Lücke, die noch offen ist
    const appliedImpact = {
      min: Math.round(check.impact.min * gap * 1000) / 1000,
      max: Math.round(check.impact.max * gap * 1000) / 1000,
    };
    const meta = MEASURES[check.id];
    bucket.findings.push({
      id: check.id,
      category: check.category,
      categoryName: CATEGORIES[check.category],
      label: check.label,
      nudge: check.nudge,
      passed,
      ratio: Math.round(ratio * 100),
      tip: passed ? null : check.tip(ctx, ratio),
      impact: appliedImpact,
      measure: meta.measure,
      effort: meta.effort,
    });
  }

  const categories = Object.entries(CATEGORIES).map(([key, name]) => {
    const b = buckets[key];
    const score = b.weightSum ? Math.round((b.scoreSum / b.weightSum) * 100) : 0;
    const findings = b.findings.sort((a, b2) => Number(a.passed) - Number(b2.passed));
    return { key, name, score, findings, inverted: INVERTED_CATEGORIES.has(key) };
  });

  // Der Gesamtscore misst die Qualität der Kaufstrecke. Die Fairness-Befunde
  // sind eine eigene Risikodimension und werden bewusst nicht eingerechnet:
  // Ein Shop ohne Dark Patterns ist deshalb noch nicht verkaufsstark, und ein
  // Fund soll nicht in einem Mittelwert verschwinden.
  const scored = categories.filter((c) => !c.inverted);
  const overall = Math.round(scored.reduce((sum, c) => sum + c.score, 0) / scored.length);

  const allFindings = categories.flatMap((c) => c.findings);

  const fairnessFindings = categories.find((c) => c.key === "fairness").findings;
  const fairness = {
    flagged: fairnessFindings.filter((f) => !f.passed),
    checked: fairnessFindings.length,
  };

  // Zuordnung der offenen Punkte zu den Selbstauskünften der Abbrecher
  // (Stripe). Das übersetzt die Befunde in die Sprache der Abbruchgründe.
  const byId = Object.fromEntries(allFindings.map((f) => [f.id, f]));
  const reasons = ABANDONMENT_REASONS.map((r) => {
    const related = r.checks.map((id) => byId[id]).filter(Boolean);
    const open = related.filter((f) => !f.passed);
    return {
      id: r.id,
      name: r.name,
      share: r.share,
      openCount: open.length,
      totalCount: related.length,
      open: open.map((f) => ({ id: f.id, label: f.label, measure: f.measure })),
    };
  }).sort((a, b2) => b2.share - a.share);
  // Kombination unabhängiger Uplift-Anteile via 1 - Produkt(1 - p_i), damit
  // die Summe nie über 100% steigen kann (vereinfachtes Modell, siehe Hinweis
  // in checks.js).
  const combinedLow = 1 - allFindings.reduce((acc, f) => acc * (1 - f.impact.min), 1);
  const combinedHigh = 1 - allFindings.reduce((acc, f) => acc * (1 - f.impact.max), 1);

  const topFindings = allFindings
    .filter((f) => !f.passed && f.impact.max > 0)
    .sort((a, b2) => (b2.impact.min + b2.impact.max) - (a.impact.min + a.impact.max))
    .slice(0, 5);

  // Der Erfassungsmodus bestimmt, wie belastbar die Befunde sind: Ohne
  // Rendering fehlen alle per JavaScript nachgeladenen Inhalte.
  const renderedCount = validPages.filter((p) => p.mode === "rendered").length;
  const renderMode =
    renderedCount === validPages.length ? "rendered" : renderedCount === 0 ? "html" : "mixed";

  return {
    overall,
    grade: gradeFor(overall),
    categories,
    fairness,
    reasons,
    renderMode,
    pages: pageSummaries,
    impact: {
      combinedLow: Math.round(combinedLow * 1000) / 1000,
      combinedHigh: Math.round(combinedHigh * 1000) / 1000,
      topFindings,
    },
  };
}
