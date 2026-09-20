import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchPage, normalizeUrl } from "./lib/fetcher.js";
import { buildReport } from "./lib/analyzer.js";
import {
  INDUSTRIES,
  DEVICE_RATES,
  DEVICE_SOURCE,
  GLOBAL_ABANDONMENT,
  REGION_EMEA,
  RESEARCH_ONLY_SHARE,
  RESEARCH_ONLY_SOURCE,
  ABANDONMENT_REASONS_SOURCE,
  industryById,
} from "./lib/benchmarks.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/benchmarks", (_req, res) => {
  res.json({
    industries: INDUSTRIES,
    devices: DEVICE_RATES,
    deviceSource: DEVICE_SOURCE,
    global: GLOBAL_ABANDONMENT,
    emea: REGION_EMEA,
    researchOnlyShare: RESEARCH_ONLY_SHARE,
    researchOnlySource: RESEARCH_ONLY_SOURCE,
    reasonsSource: ABANDONMENT_REASONS_SOURCE,
  });
});

app.post("/api/analyze", async (req, res) => {
  const rawUrls = Array.isArray(req.body?.urls) ? req.body.urls : [];
  const normalized = rawUrls.map(normalizeUrl).filter(Boolean);

  if (normalized.length === 0) {
    return res.status(400).json({ error: "Bitte mindestens eine gültige URL angeben (z. B. die Startseite des Shops)." });
  }
  if (normalized.length > 3) {
    return res.status(400).json({ error: "Maximal 3 Seiten pro Analyse (Startseite, Produktseite, Checkout/Warenkorb)." });
  }

  try {
    const pages = await Promise.all(normalized.map((u) => fetchPage(u)));
    const report = buildReport(pages);
    // Die gewählte Branche wandert mit in den Bericht, damit archivierte
    // Läufe ihren Benchmark-Bezug behalten.
    report.industry = industryById(req.body?.industry);
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: "Unerwarteter Fehler bei der Analyse: " + (err.message || err) });
  }
});

app.listen(PORT, () => {
  console.log(`Cockpit läuft auf http://localhost:${PORT}`);
});
