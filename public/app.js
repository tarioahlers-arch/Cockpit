const HISTORY_KEY = "cockpit_history_v1";
const MAX_RUNS_PER_DOMAIN = 8;

const form = document.getElementById("audit-form");
const submitBtn = document.getElementById("submit-btn");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");

const archiveBanner = document.getElementById("archive-banner");
const reportMeta = document.getElementById("report-meta");
const printBtn = document.getElementById("print-btn");

const scoreDial = document.getElementById("score-dial");
const scoreValue = document.getElementById("score-value");
const gradeNote = document.getElementById("grade-note");
const gradeLabel = document.getElementById("grade-label");
const scoreDelta = document.getElementById("score-delta");
const categoryBars = document.getElementById("category-bars");
const categoryDetails = document.getElementById("category-details");
const pagesList = document.getElementById("pages-list");

const historyEmpty = document.getElementById("history-empty");
const historyList = document.getElementById("history-list");
const clearHistoryBtn = document.getElementById("clear-history-btn");

const impactInfoToggle = document.getElementById("impact-info-toggle");
const impactDisclaimer = document.getElementById("impact-disclaimer");
const calcIndustry = document.getElementById("calc-industry");
const calcCarts = document.getElementById("calc-carts");
const calcAov = document.getElementById("calc-aov");
const impactSummary = document.getElementById("impact-summary");
const topFindingsEl = document.getElementById("top-findings");
const benchmarkBox = document.getElementById("benchmark-box");
const reasonsBox = document.getElementById("reasons-box");
const fairnessPanel = document.getElementById("fairness-panel");

const CALC_KEY = "cockpit_calc_v1";
let currentReport = null;
let currentReportMeta = { domain: "", ts: Date.now() };

// Inhalte aus fremden Quellen (z. B. Redirect-Ziele der geprüften Shops) und
// Nutzereingaben landen per innerHTML im DOM und müssen escaped werden.
function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}

function colorForScore(score) {
  if (score >= 80) return "var(--good)";
  if (score >= 50) return "var(--warn)";
  return "var(--bad)";
}

function setStatus(message, type) {
  statusEl.textContent = message;
  statusEl.classList.remove("hidden", "error");
  if (type === "error") statusEl.classList.add("error");
}

function clearStatus() {
  statusEl.classList.add("hidden");
  statusEl.textContent = "";
}

function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function formatDateTime(ts) {
  return new Date(ts).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------- History storage (localStorage, per Browser/Gerät) ----------

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(list) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch {
    // Storage voll oder blockiert (z. B. privater Modus) - Verlauf wird dann nicht gespeichert.
  }
}

function addHistoryEntry(report, inputUrls) {
  const domain = domainOf(inputUrls.home);
  const entry = {
    id: (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
    ts: Date.now(),
    domain,
    urls: inputUrls,
    overall: report.overall,
    gradeNote: report.grade.note,
    report,
  };

  const list = loadHistory();
  list.push(entry);

  const perDomainCount = {};
  const kept = [...list]
    .sort((a, b) => b.ts - a.ts)
    .filter((e) => {
      perDomainCount[e.domain] = (perDomainCount[e.domain] || 0) + 1;
      return perDomainCount[e.domain] <= MAX_RUNS_PER_DOMAIN;
    })
    .sort((a, b) => a.ts - b.ts);

  saveHistory(kept);
  return entry;
}

function getPreviousEntry(domain, excludeId) {
  return loadHistory()
    .filter((e) => e.domain === domain && e.id !== excludeId)
    .sort((a, b) => b.ts - a.ts)[0] || null;
}

function getDomainSeries(domain) {
  return loadHistory()
    .filter((e) => e.domain === domain)
    .sort((a, b) => a.ts - b.ts);
}

function getAllDomainsLatest() {
  const byDomain = {};
  for (const e of loadHistory()) {
    if (!byDomain[e.domain] || byDomain[e.domain].ts < e.ts) byDomain[e.domain] = e;
  }
  return Object.values(byDomain).sort((a, b) => b.ts - a.ts);
}

// ---------- Warenkorbabbruch-Rechner ----------

let benchmarks = null;

function loadCalcInputs() {
  try {
    const raw = localStorage.getItem(CALC_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCalcInputs() {
  try {
    localStorage.setItem(
      CALC_KEY,
      JSON.stringify({ industry: calcIndustry.value, carts: calcCarts.value, aov: calcAov.value })
    );
  } catch {
    // ignorieren (z. B. privater Modus)
  }
}

async function initBenchmarks() {
  try {
    const res = await fetch("/api/benchmarks");
    benchmarks = await res.json();
  } catch {
    return;
  }

  calcIndustry.innerHTML = benchmarks.industries
    .map((i) => `<option value="${i.id}">${escapeHtml(i.name)} · ${formatPct(i.rate)}</option>`)
    .join("");

  const saved = loadCalcInputs();
  if (saved.industry) calcIndustry.value = saved.industry;
  if (saved.carts) calcCarts.value = saved.carts;
  if (saved.aov) calcAov.value = saved.aov;
}

function selectedIndustry() {
  if (!benchmarks) return null;
  return benchmarks.industries.find((i) => i.id === calcIndustry.value) || benchmarks.industries[0];
}

// Verlustrechnung nach dem Strategiebericht: abgebrochener Warenkorbwert,
// bereinigt um den Anteil reiner Rechercheure (43%, Stripe). Erst der Rest
// ist durch Gestaltung überhaupt adressierbar.
function abandonmentModel() {
  const industry = selectedIndustry();
  const carts = parseFloat(calcCarts.value);
  const aov = parseFloat(calcAov.value);
  if (!industry || !(carts > 0) || !(aov > 0)) return null;

  const researchShare = benchmarks.researchOnlyShare;
  const abandonedCarts = carts * industry.rate;
  const lostValue = abandonedCarts * aov;
  const addressable = lostValue * (1 - researchShare);

  return { industry, carts, aov, researchShare, abandonedCarts, lostValue, addressable };
}

function formatPct(fraction) {
  return `${(fraction * 100).toFixed(1).replace(/\.0$/, "").replace(".", ",")}%`;
}

function formatEur(n) {
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

function renderImpact(report) {
  const impact = report.impact;

  if (!impact) {
    impactSummary.innerHTML = `<div class="impact-note">Für diese ältere, lokal gespeicherte Analyse liegt noch keine Potenzial-Berechnung vor. Führe die Analyse erneut aus, um sie zu sehen.</div>`;
    topFindingsEl.innerHTML = "";
    return;
  }

  const model = abandonmentModel();
  const industry = selectedIndustry();

  // Benchmark-Einordnung: steht auch ohne eingegebene Kennzahlen.
  if (industry && benchmarks) {
    benchmarkBox.innerHTML = `
      <div class="bm-row">
        <span class="bm-label">Abbruchrate ${escapeHtml(industry.name)}</span>
        <span class="bm-value">${formatPct(industry.rate)}</span>
      </div>
      <div class="bm-row">
        <span class="bm-label">Weltweiter Durchschnitt</span>
        <span class="bm-value">${formatPct(benchmarks.global.rate)}</span>
      </div>
      <div class="bm-row">
        <span class="bm-label">Mobile vs. Desktop</span>
        <span class="bm-value">${formatPct(benchmarks.devices[0].rate)} vs. ${formatPct(benchmarks.devices[2].rate)}</span>
      </div>
      ${industry.driver ? `<p class="bm-driver">Haupttreiber der Branche: ${escapeHtml(industry.driver)}</p>` : ""}
      <p class="bm-source">Quellen: ${escapeHtml(benchmarks.global.source)}; ${escapeHtml(benchmarks.deviceSource)}</p>
    `;
  }

  let eurHtml;
  if (model) {
    const recoveredLow = model.addressable * impact.combinedLow;
    const recoveredHigh = model.addressable * impact.combinedHigh;
    eurHtml = `
      <div class="impact-calc">
        <div class="calc-row"><span>Abgebrochene Warenkörbe</span><span>${Math.round(model.abandonedCarts).toLocaleString("de-DE")} / Monat</span></div>
        <div class="calc-row"><span>Abgebrochener Warenkorbwert</span><span>${formatEur(model.lostValue)} / Monat</span></div>
        <div class="calc-row muted"><span>abzüglich ${formatPct(model.researchShare)} reine Rechercheure</span><span>− ${formatEur(model.lostValue - model.addressable)}</span></div>
        <div class="calc-row strong"><span>Adressierbarer Verlust</span><span>${formatEur(model.addressable)} / Monat</span></div>
        <div class="calc-row accent"><span>Davon über die gefundenen Lücken erreichbar</span><span>${formatEur(recoveredLow)} – ${formatEur(recoveredHigh)} / Monat</span></div>
      </div>`;
  } else {
    eurHtml = `<div class="impact-eur">Warenkörbe/Monat und Ø Bestellwert eintragen, um die Verlustrechnung in Euro zu sehen.</div>`;
  }

  impactSummary.innerHTML = `
    <div class="impact-pct">${formatPct(impact.combinedLow)} &ndash; ${formatPct(impact.combinedHigh)} Wirkungsgrad der offenen Maßnahmen</div>
    ${eurHtml}
    <div class="impact-note">Modellrechnung zur Priorisierung, keine Zusage &mdash; siehe „Wie wird das berechnet?“</div>
  `;

  // Offene Punkte in der Sprache der Abbruchgründe (Selbstauskunft, Stripe).
  if (report.reasons) {
    const rows = report.reasons
      .map((r) => {
        const state = r.openCount === 0 ? "ok" : r.openCount === r.totalCount ? "bad" : "partial";
        const text =
          r.openCount === 0
            ? "keine offenen Punkte"
            : `${r.openCount} von ${r.totalCount} Kriterien offen`;
        return `
          <div class="reason-row ${state}">
            <span class="reason-share">${formatPct(r.share)}</span>
            <span class="reason-name">${escapeHtml(r.name)}</span>
            <span class="reason-state">${text}</span>
          </div>`;
      })
      .join("");
    reasonsBox.innerHTML = `
      <h3>Abgleich mit den genannten Abbruchgründen</h3>
      <p class="hint">Anteil der Abbrecher, die diesen Grund selbst nennen – und ob der Shop an dieser Stelle offene Punkte hat.</p>
      ${rows}
      <p class="bm-source">Quelle: ${escapeHtml(benchmarks ? benchmarks.reasonsSource : "Stripe 2026")}</p>
    `;
  }

  topFindingsEl.innerHTML = "";
  if (impact.topFindings.length > 0) {
    const heading = document.createElement("h3");
    heading.textContent = "Top-Hebel mit dem größten Potenzial";
    topFindingsEl.appendChild(heading);

    impact.topFindings.forEach((f, i) => {
      const row = document.createElement("div");
      row.className = "top-finding-row";
      let impactTxt = `${formatPct(f.impact.min)}–${formatPct(f.impact.max)} Wirkung`;
      if (model) {
        const low = model.addressable * f.impact.min;
        const high = model.addressable * f.impact.max;
        impactTxt = `${formatEur(low)}–${formatEur(high)} / Monat`;
      }
      row.innerHTML = `
        <span class="tf-rank">${i + 1}.</span>
        <div class="tf-body">
          <span class="tf-label">${escapeHtml(f.label)}</span><span class="tf-nudge">${escapeHtml(f.nudge)}</span>
        </div>
        <span class="tf-impact">+${impactTxt}</span>
      `;
      topFindingsEl.appendChild(row);
    });
  }
}

// ---------- Fairness-Befunde ----------

function renderFairness(report) {
  const fairness = report.fairness;
  if (!fairness) {
    fairnessPanel.classList.add("hidden");
    return;
  }

  fairnessPanel.classList.remove("hidden");

  if (fairness.flagged.length === 0) {
    fairnessPanel.className = "panel fairness-panel clean";
    fairnessPanel.innerHTML = `
      <h2>Fairness &amp; Transparenz: unauffällig</h2>
      <p class="hint">In den geprüften Seiten wurden keine Hinweise auf manipulative Muster (Dark Patterns) gefunden. Geprüft wurden ${fairness.checked} Kriterien. Vorgänge, die sich erst im Bestellablauf zeigen, erfordern weiterhin einen manuellen Test.</p>
    `;
    return;
  }

  fairnessPanel.className = "panel fairness-panel flagged";
  const items = fairness.flagged
    .map(
      (f) => `
      <div class="fairness-item">
        <div class="fairness-item-head">${escapeHtml(f.label.replace(/^Keine?n? /, "").replace(/^Kein /, ""))}</div>
        <p>${escapeHtml(f.tip || "")}</p>
      </div>`
    )
    .join("");

  fairnessPanel.innerHTML = `
    <h2>Fairness &amp; Transparenz: ${fairness.flagged.length} ${fairness.flagged.length === 1 ? "Hinweis" : "Hinweise"} zur Prüfung</h2>
    <p class="hint">Diese Befunde fließen bewusst <strong>nicht</strong> in den Score ein. Sie sind Prüfaufträge für den manuellen Test, keine abschließende Feststellung. Manipulative Muster senken kurzfristig die Abbruchrate, beschädigen aber Vertrauen und Reputation und geraten regulatorisch zunehmend unter Druck.</p>
    ${items}
  `;
}

impactInfoToggle.addEventListener("click", () => {
  impactDisclaimer.classList.toggle("hidden");
});

[calcIndustry, calcCarts, calcAov].forEach((input) => {
  input.addEventListener("input", () => {
    saveCalcInputs();
    if (currentReport) renderImpact(currentReport);
  });
});

initBenchmarks().then(() => {
  if (currentReport) renderImpact(currentReport);
});

// ---------- Form submit ----------

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const home = document.getElementById("url-home").value.trim();
  const product = document.getElementById("url-product").value.trim();
  const checkout = document.getElementById("url-checkout").value.trim();
  const urls = [home, product, checkout].filter(Boolean);

  if (!home) {
    setStatus("Bitte mindestens die Startseite angeben.", "error");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Analysiere …";
  resultsEl.classList.add("hidden");
  archiveBanner.classList.add("hidden");
  setStatus("Seiten werden geladen und ausgewertet – das kann bis zu ~15 Sekunden dauern …");

  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls, industry: calcIndustry.value }),
    });
    const data = await res.json();

    if (!res.ok || data.error) {
      setStatus(data.error || "Unbekannter Fehler bei der Analyse.", "error");
      if (data.pages) renderPages(data.pages);
      return;
    }

    clearStatus();
    const entry = addHistoryEntry(data, { home, product, checkout });
    const previous = getPreviousEntry(entry.domain, entry.id);
    renderReport(data, { domain: entry.domain, ts: entry.ts, previous, archived: false });
    renderHistory();
  } catch (err) {
    setStatus("Verbindung zum Server fehlgeschlagen: " + err.message, "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Analyse starten";
  }
});

printBtn.addEventListener("click", () => window.print());

clearHistoryBtn.addEventListener("click", () => {
  if (!confirm("Gesamten lokal gespeicherten Verlauf löschen?")) return;
  saveHistory([]);
  renderHistory();
});

// ---------- Report rendering ----------

function renderReport(report, meta) {
  resultsEl.classList.remove("hidden");
  currentReport = report;
  currentReportMeta = { domain: meta.domain, ts: meta.ts };
  renderImpact(report);
  renderFairness(report);

  if (meta.archived) {
    archiveBanner.classList.remove("hidden");
    archiveBanner.innerHTML = `
      <span>Archiv-Ansicht vom ${formatDateTime(meta.ts)} für <strong>${escapeHtml(meta.domain)}</strong></span>
      <button type="button" class="ghost-btn small" id="back-to-current-btn">Zur aktuellen Analyse</button>
    `;
    document.getElementById("back-to-current-btn").addEventListener("click", () => {
      resultsEl.classList.add("hidden");
      archiveBanner.classList.add("hidden");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  } else {
    archiveBanner.classList.add("hidden");
  }

  reportMeta.textContent = `Analysiert am ${formatDateTime(meta.ts)} · ${meta.domain}`;

  scoreValue.textContent = report.overall;
  const color = colorForScore(report.overall);
  scoreDial.style.background = `radial-gradient(closest-side, var(--dial-hole) 74%, transparent 75% 100%), conic-gradient(${color} ${report.overall * 3.6}deg, var(--panel-border) 0deg)`;
  gradeNote.textContent = report.grade.note;
  gradeNote.style.color = color;
  gradeLabel.textContent = report.grade.label;

  scoreDelta.className = "score-delta";
  if (meta.previous) {
    const diff = report.overall - meta.previous.overall;
    if (diff > 0) {
      scoreDelta.classList.add("up");
      scoreDelta.textContent = `▲ +${diff} seit ${formatDateTime(meta.previous.ts)}`;
    } else if (diff < 0) {
      scoreDelta.classList.add("down");
      scoreDelta.textContent = `▼ ${diff} seit ${formatDateTime(meta.previous.ts)}`;
    } else {
      scoreDelta.textContent = `± 0 seit ${formatDateTime(meta.previous.ts)}`;
    }
  } else {
    scoreDelta.textContent = "Erste gespeicherte Analyse für diesen Shop";
  }

  const prevCatByKey = {};
  if (meta.previous) {
    meta.previous.report.categories.forEach((c) => (prevCatByKey[c.key] = c.score));
  }

  categoryBars.innerHTML = "";
  // Fairness hat ein eigenes Panel und zählt nicht zum Score - sie gehört
  // deshalb nicht in die Score-Aufschlüsselung.
  report.categories.filter((c) => !c.inverted).forEach((cat) => {
    const row = document.createElement("div");
    row.className = "cat-bar-row";
    const c = colorForScore(cat.score);
    const prev = prevCatByKey[cat.key];
    const deltaTxt =
      prev === undefined ? "" : prev === cat.score ? " (±0)" : cat.score > prev ? ` (+${cat.score - prev})` : ` (${cat.score - prev})`;
    row.innerHTML = `
      <span class="name">${cat.name}</span>
      <span class="cat-bar-track"><span class="cat-bar-fill" style="width:${cat.score}%;background:${c}"></span></span>
      <span class="val">${cat.score}${deltaTxt}</span>
    `;
    categoryBars.appendChild(row);
  });

  categoryDetails.innerHTML = "";
  report.categories.forEach((cat) => {
    const card = document.createElement("div");
    card.className = "panel category-card";
    const c = colorForScore(cat.score);
    const findingsHtml = cat.findings
      .map(
        (f) => `
        <div class="finding ${f.passed ? "passed" : "failed"}">
          <span class="icon">${f.passed ? "✓" : "✗"}</span>
          <div class="body">
            <span class="label">${f.label}</span><span class="nudge">${f.nudge}</span>
            ${!f.passed && f.impact && f.impact.max > 0 ? `<span class="impact-badge">+${formatPct(f.impact.min)}–${formatPct(f.impact.max)}</span>` : ""}
            ${f.tip ? `<p class="tip">${f.tip}</p>` : ""}
          </div>
        </div>`
      )
      .join("");
    card.innerHTML = `
      <h3>${escapeHtml(cat.name)} <span class="cat-score" style="background:${c}22;color:${c}">${cat.inverted ? "nicht im Score" : `${cat.score}/100`}</span></h3>
      ${findingsHtml}
    `;
    categoryDetails.appendChild(card);
  });

  renderPages(report.pages, report.renderMode);
}

function renderPages(pages, renderMode) {
  pagesList.innerHTML = "";

  if (renderMode) {
    const note = document.createElement("div");
    if (renderMode === "rendered") {
      note.className = "mode-note rendered";
      note.innerHTML = `<strong>Erfassung mit JavaScript-Rendering.</strong> Auch nachgeladene Inhalte wie Bewertungs-Widgets, Trust-Siegel und Countdown-Banner wurden ausgewertet.`;
    } else if (renderMode === "html") {
      note.className = "mode-note html";
      note.innerHTML = `<strong>Erfassung ohne JavaScript-Rendering.</strong> Inhalte, die ein Shop erst per JavaScript nachlädt (häufig Bewertungen, Trust-Siegel, Countdowns), konnten nicht erfasst werden und können hier fälschlich als fehlend erscheinen.`;
    } else {
      note.className = "mode-note html";
      note.innerHTML = `<strong>Gemischte Erfassung.</strong> Ein Teil der Seiten wurde ohne JavaScript-Rendering erfasst; dort können nachgeladene Inhalte fälschlich als fehlend erscheinen.`;
    }
    pagesList.appendChild(note);
  }

  pages.forEach((p) => {
    const row = document.createElement("div");
    row.className = "page-row" + (p.ok ? "" : " error");
    const mode = p.mode === "rendered" ? "gerendert" : "nur HTML";
    row.innerHTML = `
      <span class="url">${escapeHtml(p.finalUrl || p.url)}</span>
      <span class="meta">${p.ok ? `${mode} · ${p.status} · ${p.loadTimeMs} ms · ${p.sizeKb} KB` : escapeHtml(p.error || "Fehler")}</span>
    `;
    pagesList.appendChild(row);
  });
}

// ---------- History panel rendering ----------

function buildSparkline(scores) {
  const w = 140;
  const h = 32;
  if (scores.length < 2) {
    return `<svg class="sparkline" width="${w}" height="${h}"></svg>`;
  }
  const max = 100;
  const min = 0;
  const stepX = w / (scores.length - 1);
  const points = scores
    .map((s, i) => {
      const x = i * stepX;
      const y = h - ((s - min) / (max - min)) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const last = scores[scores.length - 1];
  const color = last >= 80 ? "var(--good)" : last >= 50 ? "var(--warn)" : "var(--bad)";
  return `<svg class="sparkline" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  </svg>`;
}

function renderHistory() {
  const latestPerDomain = getAllDomainsLatest();

  if (latestPerDomain.length === 0) {
    historyEmpty.classList.remove("hidden");
    historyList.innerHTML = "";
    return;
  }
  historyEmpty.classList.add("hidden");

  historyList.innerHTML = "";
  latestPerDomain.forEach((latest) => {
    const series = getDomainSeries(latest.domain);
    const scores = series.map((e) => e.overall);
    const previous = series.length > 1 ? series[series.length - 2] : null;
    const color = colorForScore(latest.overall);

    let deltaHtml = "";
    if (previous) {
      const diff = latest.overall - previous.overall;
      const cls = diff > 0 ? "up" : diff < 0 ? "down" : "";
      const sign = diff > 0 ? "▲ +" : diff < 0 ? "▼ " : "± ";
      deltaHtml = `<span class="domain-delta ${cls}">${sign}${diff === 0 ? 0 : diff}</span>`;
    }

    const card = document.createElement("div");
    card.className = "domain-card";
    card.innerHTML = `
      <div class="domain-card-head">
        <span class="domain-name">${latest.domain}</span>
        ${buildSparkline(scores)}
        <span class="domain-score" style="color:${color}">${latest.overall}</span>
        ${deltaHtml}
        <span class="toggle-icon">Verlauf (${series.length}) ▾</span>
      </div>
      <div class="run-list hidden"></div>
    `;

    const head = card.querySelector(".domain-card-head");
    const runList = card.querySelector(".run-list");
    const toggleIcon = card.querySelector(".toggle-icon");

    [...series].reverse().forEach((run) => {
      const row = document.createElement("div");
      row.className = "run-row";
      row.innerHTML = `<span>${formatDateTime(run.ts)}</span><span class="run-score" style="color:${colorForScore(run.overall)}">${run.overall} (Note ${run.gradeNote})</span>`;
      row.addEventListener("click", () => {
        const prevEntry = getPreviousEntry(run.domain, run.id);
        renderReport(run.report, { domain: run.domain, ts: run.ts, previous: prevEntry, archived: true });
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
      runList.appendChild(row);
    });

    head.addEventListener("click", () => {
      const isHidden = runList.classList.contains("hidden");
      runList.classList.toggle("hidden");
      toggleIcon.textContent = `Verlauf (${series.length}) ${isHidden ? "▴" : "▾"}`;
    });

    historyList.appendChild(card);
  });
}

renderHistory();
