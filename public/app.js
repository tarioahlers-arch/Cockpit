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
      body: JSON.stringify({ urls }),
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

  if (meta.archived) {
    archiveBanner.classList.remove("hidden");
    archiveBanner.innerHTML = `
      <span>Archiv-Ansicht vom ${formatDateTime(meta.ts)} für <strong>${meta.domain}</strong></span>
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
  report.categories.forEach((cat) => {
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
            ${f.tip ? `<p class="tip">${f.tip}</p>` : ""}
          </div>
        </div>`
      )
      .join("");
    card.innerHTML = `
      <h3>${cat.name} <span class="cat-score" style="background:${c}22;color:${c}">${cat.score}/100</span></h3>
      ${findingsHtml}
    `;
    categoryDetails.appendChild(card);
  });

  renderPages(report.pages);
}

function renderPages(pages) {
  pagesList.innerHTML = "";
  pages.forEach((p) => {
    const row = document.createElement("div");
    row.className = "page-row" + (p.ok ? "" : " error");
    row.innerHTML = `
      <span class="url">${p.finalUrl || p.url}</span>
      <span class="meta">${p.ok ? `${p.status} · ${p.loadTimeMs} ms · ${p.sizeKb} KB` : p.error || "Fehler"}</span>
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
