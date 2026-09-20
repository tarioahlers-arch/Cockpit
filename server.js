import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchPage, normalizeUrl } from "./lib/fetcher.js";
import { buildReport } from "./lib/analyzer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

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
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: "Unerwarteter Fehler bei der Analyse: " + (err.message || err) });
  }
});

app.listen(PORT, () => {
  console.log(`Cockpit läuft auf http://localhost:${PORT}`);
});
