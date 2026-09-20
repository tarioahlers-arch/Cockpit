import * as cheerio from "cheerio";
import { CATEGORIES, CHECKS, gradeFor } from "./checks.js";

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
    bucket.findings.push({
      id: check.id,
      label: check.label,
      nudge: check.nudge,
      passed,
      ratio: Math.round(ratio * 100),
      tip: passed ? null : check.tip(ctx, ratio),
    });
  }

  const categories = Object.entries(CATEGORIES).map(([key, name]) => {
    const b = buckets[key];
    const score = b.weightSum ? Math.round((b.scoreSum / b.weightSum) * 100) : 0;
    const findings = b.findings.sort((a, b2) => Number(a.passed) - Number(b2.passed));
    return { key, name, score, findings };
  });

  const overall = Math.round(
    categories.reduce((sum, c) => sum + c.score, 0) / categories.length
  );

  return {
    overall,
    grade: gradeFor(overall),
    categories,
    pages: pageSummaries,
  };
}
