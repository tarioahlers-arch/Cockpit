// Consulting-Report: baut aus den Analysedaten ein präsentationsfertiges
// Beratungsdokument (Management Summary, Bewertung, Handlungsfelder,
// priorisierte Roadmap, Business Case). Rein deterministisch aus den Daten
// formuliert – kein externer Dienst, keine API-Keys nötig.

const REPORT_META_KEY = "cockpit_report_meta_v1";

const reportSection = document.getElementById("consulting-report");
const reportDoc = document.getElementById("report-doc");
const reportClientInput = document.getElementById("report-client");
const reportAuthorInput = document.getElementById("report-author");
const openReportBtn = document.getElementById("open-report-btn");
const reportBackBtn = document.getElementById("report-back-btn");
const reportPrintBtn = document.getElementById("report-print-btn");

let reportContext = null; // { report, domain, ts }

const CATEGORY_PURPOSE = {
  trust:
    "Ob der Shop auf den ersten Blick als seriös und sicher wahrgenommen wird – die Grundvoraussetzung für jeden Erstkauf.",
  social_proof:
    "Ob andere Kunden sichtbar für den Shop bürgen – der stärkste Hebel bei unentschlossenen Besuchern.",
  urgency:
    "Ob es einen Grund gibt, jetzt statt später zu kaufen – gegen das Aufschieben der Kaufentscheidung.",
  pricing:
    "Ob der Preis eingeordnet werden kann – ohne Referenzpunkt wirkt jeder Preis zunächst hoch.",
  friction:
    "Wie viele Hürden zwischen Kaufwunsch und Abschluss liegen – hier gehen die meisten Käufe verloren.",
  mobile_perf:
    "Ob der Shop auf dem Smartphone schnell und bedienbar ist – dort entsteht der Großteil des Traffics.",
  navigation:
    "Ob Besucher finden, wonach sie suchen – ohne Orientierung entsteht gar keine Kaufabsicht.",
};

const BAND_VERDICT = {
  stark: "Hier ist der Shop gut aufgestellt; Handlungsbedarf besteht allenfalls im Feinschliff.",
  solide: "Die Basis stimmt, einzelne Elemente lassen sich aber noch gezielt nachschärfen.",
  ausbaufaehig:
    "Wesentliche Elemente fehlen oder sind nur teilweise umgesetzt – hier liegt ungenutztes Potenzial.",
  kritisch:
    "In diesem Bereich fehlen zentrale Bausteine; das kostet den Shop messbar Abschlüsse.",
};

const PHASES = [
  {
    effort: "niedrig",
    title: "Phase 1 – Sofortmaßnahmen",
    horizon: "0–4 Wochen",
    intro:
      "Mit geringem Aufwand umsetzbar, überwiegend redaktionell oder gestalterisch. Diese Maßnahmen sollten ohne Projektvorlauf starten.",
  },
  {
    effort: "mittel",
    title: "Phase 2 – Mittelfristige Maßnahmen",
    horizon: "1–3 Monate",
    intro:
      "Erfordern die Anbindung eines Tools oder Anpassungen am Shop-Template und damit etwas Vorlauf in der Umsetzung.",
  },
  {
    effort: "hoch",
    title: "Phase 3 – Strukturelle Maßnahmen",
    horizon: "3–6 Monate",
    intro:
      "Greifen tiefer in Technik, Prozesse oder Dienstleisterverträge ein und gehören in die mittelfristige Planung.",
  },
];

function scoreBand(score) {
  if (score >= 85) return { key: "stark", label: "Stark" };
  if (score >= 70) return { key: "solide", label: "Solide" };
  if (score >= 50) return { key: "ausbaufaehig", label: "Ausbaufähig" };
  return { key: "kritisch", label: "Kritisch" };
}

function overallAssessment(score) {
  if (score >= 85) return "durchweg professionell aufgestellt";
  if (score >= 70)
    return "insgesamt solide aufgestellt, mit klar benennbaren Optimierungshebeln";
  if (score >= 55)
    return "in den Grundzügen funktionsfähig, weist aber in mehreren Bereichen deutliche Lücken auf";
  return "in mehreren zentralen Bereichen unvollständig – die Lücken betreffen die Grundlagen der Kaufentscheidung";
}

function combineUplift(findings, bound) {
  return 1 - findings.reduce((acc, f) => acc * (1 - f.impact[bound]), 1);
}

function loadReportMeta() {
  try {
    const raw = localStorage.getItem(REPORT_META_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveReportMeta() {
  try {
    localStorage.setItem(
      REPORT_META_KEY,
      JSON.stringify({ client: reportClientInput.value, author: reportAuthorInput.value })
    );
  } catch {
    // ignorieren (z. B. privater Modus)
  }
}

(function initReportMeta() {
  const saved = loadReportMeta();
  if (saved.client) reportClientInput.value = saved.client;
  if (saved.author) reportAuthorInput.value = saved.author;
})();

function currentKpis() {
  const visitors = parseFloat(document.getElementById("calc-visitors").value);
  const cr = parseFloat(document.getElementById("calc-cr").value);
  const aov = parseFloat(document.getElementById("calc-aov").value);
  if (!(visitors > 0 && cr > 0 && aov > 0)) return null;
  return { visitors, cr, aov, monthlyRevenue: visitors * (cr / 100) * aov };
}

function upliftText(low, high, kpis) {
  const pct = `${formatPct(low)} – ${formatPct(high)}`;
  if (!kpis) return pct;
  return `${pct} (${formatEur(kpis.monthlyRevenue * low)} – ${formatEur(kpis.monthlyRevenue * high)} / Monat)`;
}

// ---------- Textbausteine ----------

function buildSummary(report, domain, kpis, phaseGroups) {
  const sorted = [...report.categories].sort((a, b) => b.score - a.score);
  const strong = sorted.slice(0, 2).map((c) => c.name);
  const weak = sorted.slice(-2).reverse().map((c) => c.name);
  const impact = report.impact;

  const quickWins = phaseGroups[0].findings;
  const quickLow = combineUplift(quickWins, "min");
  const quickHigh = combineUplift(quickWins, "max");

  const parts = [];

  parts.push(
    `Der Online-Shop <strong>${escapeHtml(domain)}</strong> erreicht in der Analyse einen Gesamtwert von <strong>${report.overall} von 100 Punkten</strong> (Note ${report.grade.note} – ${report.grade.label}). Damit ist der Shop ${overallAssessment(report.overall)}.`
  );

  parts.push(
    `Seine Stärken liegen in den Bereichen <strong>${escapeHtml(strong.join(" und "))}</strong>. Der deutlichste Handlungsbedarf zeigt sich bei <strong>${escapeHtml(weak.join(" und "))}</strong>.`
  );

  if (impact.combinedHigh > 0) {
    parts.push(
      `Über alle identifizierten Lücken hinweg ergibt sich ein geschätztes Conversion-Potenzial von <strong>${upliftText(impact.combinedLow, impact.combinedHigh, kpis)}</strong>.`
    );
  } else {
    parts.push(
      `Alle geprüften Kriterien sind erfüllt – aus dieser Analyse ergibt sich kein weiteres quantifizierbares Potenzial.`
    );
  }

  if (quickWins.length > 0) {
    parts.push(
      `Unsere Empfehlung: zunächst die <strong>${quickWins.length} Sofortmaßnahmen</strong> umsetzen. Sie sind ohne nennenswerten technischen Aufwand realisierbar und heben für sich genommen bereits ein Potenzial von <strong>${upliftText(quickLow, quickHigh, kpis)}</strong>.`
    );
  } else if (impact.combinedHigh > 0) {
    parts.push(
      `Die offenen Punkte erfordern durchgehend Umsetzungsaufwand – wir empfehlen, mit den Maßnahmen der Phase 2 in eine konkrete Planung zu gehen.`
    );
  }

  return parts.map((p) => `<p>${p}</p>`).join("");
}

function buildStrengths(report) {
  const passed = report.categories
    .flatMap((c) => c.findings.filter((f) => f.passed).map((f) => ({ ...f, catName: c.name })))
    .slice(0, 8);

  if (passed.length === 0) {
    return `<p>In der automatisierten Prüfung konnte keines der Kriterien vollständig erfüllt nachgewiesen werden. Das ist zugleich die größte Chance: Die Grundlagen lassen sich mit überschaubarem Aufwand schaffen.</p>`;
  }

  const items = passed
    .map(
      (f) =>
        `<li><strong>${escapeHtml(f.label)}</strong> <span class="doc-muted">(${escapeHtml(f.catName)})</span></li>`
    )
    .join("");

  return `
    <p>Folgende Elemente sind bereits vorhanden und wirken positiv auf die Kaufentscheidung. Sie sollten bei künftigen Anpassungen unbedingt erhalten bleiben:</p>
    <ul class="doc-list">${items}</ul>
  `;
}

function buildCategoryTable(report) {
  const rows = report.categories
    .map((cat) => {
      const band = scoreBand(cat.score);
      return `
        <tr>
          <td>
            <strong>${escapeHtml(cat.name)}</strong>
            <div class="doc-muted doc-small">${escapeHtml(CATEGORY_PURPOSE[cat.key] || "")}</div>
          </td>
          <td class="doc-num">${cat.score}</td>
          <td><span class="doc-band doc-band-${band.key}">${band.label}</span></td>
        </tr>`;
    })
    .join("");

  // Der Bewertungssatz steht bewusst nur einmal für den schwächsten Bereich
  // statt als Spalte je Zeile - sonst wiederholt sich derselbe Satz mehrfach.
  const weakest = [...report.categories].sort((a, b) => a.score - b.score)[0];
  const weakestBand = scoreBand(weakest.score);

  return `
    <table class="doc-table">
      <thead>
        <tr><th>Bereich</th><th class="doc-num">Score</th><th>Einordnung</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p>Den größten Nachholbedarf hat der Bereich <strong>${escapeHtml(weakest.name)}</strong>
    (${weakest.score} von 100). ${escapeHtml(BAND_VERDICT[weakestBand.key])}</p>
  `;
}

function groupByPhase(report) {
  const open = report.categories
    .flatMap((c) => c.findings)
    .filter((f) => !f.passed && f.impact.max > 0)
    .sort((a, b) => b.impact.min + b.impact.max - (a.impact.min + a.impact.max));

  return PHASES.map((phase) => ({
    ...phase,
    findings: open.filter((f) => f.effort === phase.effort),
  }));
}

function buildPhases(phaseGroups, kpis) {
  const active = phaseGroups.filter((p) => p.findings.length > 0);

  if (active.length === 0) {
    return `<p>Aus der Analyse ergeben sich derzeit keine offenen Maßnahmen.</p>`;
  }

  return active
    .map((phase) => {
      const rows = phase.findings
        .map(
          (f) => `
          <tr>
            <td>
              <strong>${escapeHtml(f.measure)}</strong>
              <div class="doc-muted doc-small">${escapeHtml(f.tip || "")}</div>
            </td>
            <td class="doc-small">${escapeHtml(f.categoryName)}</td>
            <td class="doc-small">${escapeHtml(f.nudge)}</td>
            <td class="doc-num doc-nowrap">+${upliftText(f.impact.min, f.impact.max, kpis)}</td>
          </tr>`
        )
        .join("");

      const low = combineUplift(phase.findings, "min");
      const high = combineUplift(phase.findings, "max");

      return `
        <div class="doc-phase">
          <h3>${escapeHtml(phase.title)} <span class="doc-muted doc-small">(${escapeHtml(phase.horizon)})</span></h3>
          <p>${escapeHtml(phase.intro)}</p>
          <table class="doc-table">
            <thead>
              <tr><th>Maßnahme</th><th>Bereich</th><th>Wirkprinzip</th><th class="doc-num">Erwarteter Effekt</th></tr>
            </thead>
            <tbody>${rows}</tbody>
            <tfoot>
              <tr>
                <td colspan="3"><strong>Summe Phase (kombiniert)</strong></td>
                <td class="doc-num doc-nowrap"><strong>+${upliftText(low, high, kpis)}</strong></td>
              </tr>
            </tfoot>
          </table>
        </div>`;
    })
    .join("");
}

function buildBusinessCase(report, phaseGroups, kpis) {
  const impact = report.impact;

  if (impact.combinedHigh === 0) {
    return `<p>Da alle geprüften Kriterien erfüllt sind, weist diese Analyse kein zusätzliches Umsatzpotenzial aus.</p>`;
  }

  let kpiBlock;
  if (kpis) {
    kpiBlock = `
      <p>Grundlage der Hochrechnung sind die hinterlegten Kennzahlen:
      <strong>${kpis.visitors.toLocaleString("de-DE")} Besucher/Monat</strong>,
      <strong>${kpis.cr.toLocaleString("de-DE")}% Conversion-Rate</strong> und
      <strong>${formatEur(kpis.aov)} Ø Bestellwert</strong> –
      entsprechend rund <strong>${formatEur(kpis.monthlyRevenue)} Umsatz pro Monat</strong>.</p>`;
  } else {
    kpiBlock = `
      <p class="doc-hint">Für eine Hochrechnung in Euro können im Analyse-Bereich Besucherzahl,
      Conversion-Rate und durchschnittlicher Bestellwert hinterlegt werden. Ohne diese Angaben
      wird das Potenzial ausschließlich als Conversion-Spanne ausgewiesen.</p>`;
  }

  const phaseRows = phaseGroups
    .filter((p) => p.findings.length > 0)
    .map((p) => {
      const low = combineUplift(p.findings, "min");
      const high = combineUplift(p.findings, "max");
      return `
        <tr>
          <td>${escapeHtml(p.title)} <span class="doc-muted doc-small">(${escapeHtml(p.horizon)})</span></td>
          <td class="doc-num">${p.findings.length}</td>
          <td class="doc-num doc-nowrap">+${upliftText(low, high, kpis)}</td>
        </tr>`;
    })
    .join("");

  return `
    ${kpiBlock}
    <table class="doc-table">
      <thead>
        <tr><th>Umsetzungsphase</th><th class="doc-num">Maßnahmen</th><th class="doc-num">Potenzial</th></tr>
      </thead>
      <tbody>${phaseRows}</tbody>
      <tfoot>
        <tr>
          <td><strong>Gesamt (kombiniert)</strong></td>
          <td class="doc-num"><strong>${phaseGroups.reduce((s, p) => s + p.findings.length, 0)}</strong></td>
          <td class="doc-num doc-nowrap"><strong>+${upliftText(impact.combinedLow, impact.combinedHigh, kpis)}</strong></td>
        </tr>
      </tfoot>
    </table>
    <p class="doc-hint">Die Phasenwerte addieren sich nicht linear zum Gesamtwert: Überlappende
    Effekte werden über ein multiplikatives Modell zusammengeführt, damit die Summe realistisch bleibt.</p>
  `;
}

function buildNextSteps(phaseGroups) {
  const quick = phaseGroups[0].findings.length;
  const mid = phaseGroups[1].findings.length;
  const deep = phaseGroups[2].findings.length;

  const steps = [];
  if (quick > 0) {
    steps.push(
      `<li><strong>Sofort starten:</strong> Die ${quick} Maßnahmen der Phase 1 sind ohne Projektstruktur umsetzbar und liefern den schnellsten Effekt.</li>`
    );
  }
  if (mid > 0) {
    steps.push(
      `<li><strong>Umsetzung planen:</strong> Für die ${mid} Maßnahmen der Phase 2 Verantwortlichkeiten und Termine festlegen, idealerweise gebündelt in einem Release.</li>`
    );
  }
  if (deep > 0) {
    steps.push(
      `<li><strong>Strategisch einplanen:</strong> Die ${deep} strukturellen Maßnahmen gehören in die mittelfristige Roadmap und benötigen Abstimmung mit Technik bzw. Dienstleistern.</li>`
    );
  }
  steps.push(
    `<li><strong>Wirkung messen:</strong> Nach Umsetzung eine erneute Analyse durchführen. Der Score-Verlauf zeigt, ob die Maßnahmen die erwartete Wirkung entfalten.</li>`
  );

  return `<ul class="doc-list">${steps.join("")}</ul>`;
}

// ---------- Rendering ----------

function renderConsultingReport() {
  if (!reportContext) return;

  const { report, domain, ts } = reportContext;
  const kpis = currentKpis();
  const phaseGroups = groupByPhase(report);
  const client = reportClientInput.value.trim();
  const author = reportAuthorInput.value.trim();

  const checkedPages = report.pages
    .filter((p) => p.ok)
    .map((p) => `<li>${escapeHtml(p.finalUrl || p.url)}</li>`)
    .join("");

  reportDoc.innerHTML = `
    <header class="doc-header">
      <div class="doc-kicker">Shop-Analyse &amp; Handlungsempfehlungen</div>
      <h1>${escapeHtml(domain)}</h1>
      <div class="doc-meta">
        ${client ? `<span><strong>Erstellt für:</strong> ${escapeHtml(client)}</span>` : ""}
        ${author ? `<span><strong>Erstellt von:</strong> ${escapeHtml(author)}</span>` : ""}
        <span><strong>Stand:</strong> ${formatDateTime(ts)}</span>
      </div>
    </header>

    <section class="doc-section doc-summary">
      <h2>1. Management Summary</h2>
      ${buildSummary(report, domain, kpis, phaseGroups)}
    </section>

    <section class="doc-section">
      <h2>2. Ausgangslage</h2>
      <p>Der Shop wurde anhand von 27 Kriterien aus sieben Bereichen geprüft, die jeweils einen
      belegten Einfluss auf die Kaufentscheidung im Online-Handel haben. Die folgende Übersicht
      zeigt, wo der Shop heute steht:</p>
      ${buildCategoryTable(report)}
    </section>

    <section class="doc-section">
      <h2>3. Was bereits gut funktioniert</h2>
      ${buildStrengths(report)}
    </section>

    <section class="doc-section">
      <h2>4. Handlungsempfehlungen</h2>
      <p>Die identifizierten Lücken sind nach Umsetzungsaufwand in drei Phasen gegliedert und
      innerhalb jeder Phase nach erwarteter Wirkung sortiert. Das Wirkprinzip benennt den
      verhaltenswissenschaftlichen Mechanismus, auf dem die jeweilige Maßnahme beruht.</p>
      ${buildPhases(phaseGroups, kpis)}
    </section>

    <section class="doc-section">
      <h2>5. Wirtschaftliche Einordnung</h2>
      ${buildBusinessCase(report, phaseGroups, kpis)}
    </section>

    <section class="doc-section">
      <h2>6. Empfohlenes Vorgehen</h2>
      ${buildNextSteps(phaseGroups)}
    </section>

    <section class="doc-section doc-method">
      <h2>7. Methodik und Hinweise</h2>
      <p>Grundlage ist eine automatisierte Analyse der öffentlich abrufbaren Shop-Seiten. Geprüft wurden:</p>
      <ul class="doc-list">${checkedPages}</ul>
      <p>Erkannt werden Signale im ausgelieferten Seiteninhalt (Text- und Strukturmuster). Jedem
      Kriterium ist ein Uplift-Richtwert aus in der CRO- und Verhaltensforschung verbreiteten
      Größenordnungen zugeordnet; offene Lücken werden multiplikativ zu einem Gesamtpotenzial
      kombiniert.</p>
      <p class="doc-hint"><strong>Wichtiger Hinweis:</strong> Die ausgewiesenen Potenziale sind
      Modellschätzungen zur Priorisierung, keine zugesicherten Ergebnisse. Die tatsächliche Wirkung
      hängt von Sortiment, Zielgruppe, Wettbewerbsumfeld und der konkreten Umsetzung ab. Inhalte,
      die sich erst durch Interaktion zeigen (etwa Schritte innerhalb des Checkouts), können
      automatisiert nur eingeschränkt erfasst werden und sollten ergänzend manuell geprüft werden.</p>
    </section>
  `;
}

function openReport() {
  if (!currentReport) return;
  reportContext = {
    report: currentReport,
    domain: currentReportMeta.domain,
    ts: currentReportMeta.ts,
  };
  renderConsultingReport();
  document.getElementById("results").classList.add("hidden");
  document.getElementById("history-panel").classList.add("hidden");
  reportSection.classList.remove("hidden");
  // Im Report-Modus tritt die Tool-Oberfläche zurück: Das gedruckte Dokument
  // soll beim Kunden nicht die Kopfzeile des Werkzeugs tragen.
  document.body.classList.add("report-mode");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function closeReport() {
  reportSection.classList.add("hidden");
  document.getElementById("results").classList.remove("hidden");
  document.getElementById("history-panel").classList.remove("hidden");
  document.body.classList.remove("report-mode");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

openReportBtn.addEventListener("click", openReport);
reportBackBtn.addEventListener("click", closeReport);
reportPrintBtn.addEventListener("click", () => window.print());

[reportClientInput, reportAuthorInput].forEach((input) => {
  input.addEventListener("input", () => {
    saveReportMeta();
    renderConsultingReport();
  });
});
