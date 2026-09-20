const form = document.getElementById("audit-form");
const submitBtn = document.getElementById("submit-btn");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");

const scoreDial = document.getElementById("score-dial");
const scoreValue = document.getElementById("score-value");
const gradeNote = document.getElementById("grade-note");
const gradeLabel = document.getElementById("grade-label");
const categoryBars = document.getElementById("category-bars");
const categoryDetails = document.getElementById("category-details");
const pagesList = document.getElementById("pages-list");

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
    renderReport(data);
  } catch (err) {
    setStatus("Verbindung zum Server fehlgeschlagen: " + err.message, "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Analyse starten";
  }
});

function renderReport(report) {
  resultsEl.classList.remove("hidden");

  scoreValue.textContent = report.overall;
  const color = colorForScore(report.overall);
  scoreDial.style.background = `radial-gradient(closest-side, #0b1424 74%, transparent 75% 100%), conic-gradient(${color} ${report.overall * 3.6}deg, var(--panel-border) 0deg)`;
  gradeNote.textContent = report.grade.note;
  gradeNote.style.color = color;
  gradeLabel.textContent = report.grade.label;

  categoryBars.innerHTML = "";
  report.categories.forEach((cat) => {
    const row = document.createElement("div");
    row.className = "cat-bar-row";
    const c = colorForScore(cat.score);
    row.innerHTML = `
      <span class="name">${cat.name}</span>
      <span class="cat-bar-track"><span class="cat-bar-fill" style="width:${cat.score}%;background:${c}"></span></span>
      <span class="val">${cat.score}</span>
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
