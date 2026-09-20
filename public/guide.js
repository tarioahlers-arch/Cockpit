// Testleitfaden für den menschlichen Testkauf. Der automatisierte Check
// bewertet Seiteninhalte, nicht das Erlebnis im Bestellprozess – Zahlung,
// Lieferung, Retoure und Kundenservice bleiben ihm verschlossen. Dieser
// Leitfaden übergibt die Befunde an den Tester: Er sagt, worauf bei diesem
// konkreten Shop besonders zu achten ist, und führt durch die Stationen,
// die nur ein Mensch beurteilen kann.

const guideSection = document.getElementById("test-guide");
const guideDoc = document.getElementById("guide-doc");
const openGuideBtn = document.getElementById("open-guide-btn");
const guideBackBtn = document.getElementById("guide-back-btn");
const guidePrintBtn = document.getElementById("guide-print-btn");

// Stationen der Kaufstrecke. Die letzten vier kann der automatisierte Check
// grundsätzlich nicht erfassen – sie sind der eigentliche Grund für den Test.
const JOURNEY = [
  {
    title: "Erster Eindruck und Orientierung",
    device: "Desktop und Smartphone",
    actions: [
      "Shop über eine Suchmaschine aufrufen, nicht über einen Direktlink.",
      "Zehn Sekunden auf der Startseite verweilen, dann notieren: Was verkauft dieser Shop, und wirkt er vertrauenswürdig?",
      "Ein bekanntes Produkt einmal über die Suche und einmal über die Navigation ansteuern.",
    ],
    observe: [
      "Zeit bis zur Bedienbarkeit der Startseite",
      "Auffindbarkeit von Suche und Hauptkategorien",
      "Sichtbare Vertrauenssignale ohne Scrollen",
      "Cookie-Banner: Ist Ablehnen genauso leicht wie Zustimmen?",
    ],
  },
  {
    title: "Produktauswahl",
    device: "Desktop und Smartphone",
    actions: [
      "Produktseite vollständig durchsehen, ohne zu scrollen beginnen.",
      "Alle Produktbilder öffnen und die Beschreibung auf offene Fragen prüfen.",
      "Verfügbarkeit, Lieferzeit und Endpreis notieren.",
    ],
    observe: [
      "Ist der Endpreis inklusive Versand erkennbar, oder nur der Produktpreis?",
      "Werden Bewertungen gezeigt, und wirken sie echt?",
      "Wird Knappheit behauptet, und ist die Angabe nachvollziehbar?",
      "Sind Rückgabebedingungen in Sichtweite des Kaufbuttons?",
    ],
  },
  {
    title: "Warenkorb",
    device: "Desktop und Smartphone",
    actions: [
      "Produkt in den Warenkorb legen und den Warenkorb öffnen.",
      "Menge ändern und ein zweites Produkt hinzufügen.",
      "Den Warenkorb verlassen und nach fünf Minuten zurückkehren.",
    ],
    observe: [
      "An welcher Stelle erscheinen die Versandkosten erstmals beziffert?",
      "Kommen Gebühren hinzu, die vorher nicht genannt wurden?",
      "Wird eine Versandkostenfrei-Schwelle mit Restbetrag angezeigt?",
      "Bleibt der Warenkorb nach Rückkehr erhalten?",
    ],
  },
  {
    title: "Checkout",
    device: "Desktop und Smartphone",
    actions: [
      "Bestellung beginnen und bewusst versuchen, ohne Kundenkonto fortzufahren.",
      "Alle Schritte bis zur letzten Bestätigungsseite durchlaufen.",
      "Einmal absichtlich eine ungültige Eingabe machen und die Fehlermeldung notieren.",
    ],
    observe: [
      "Ist eine Gastbestellung möglich? Falls nein, an welcher Stelle wird zum Konto gezwungen?",
      "Anzahl der Schritte und der Pflichtfelder",
      "Ist erkennbar, wie viele Schritte noch folgen?",
      "Welche Optionen sind vorangekreuzt, und was kosten sie?",
      "Stimmt der Endbetrag mit der Erwartung aus dem Warenkorb überein?",
    ],
  },
  {
    title: "Kauf und Bestätigung",
    device: "ein Gerät genügt",
    humanOnly: true,
    actions: [
      "Bestellung tatsächlich abschließen und bezahlen.",
      "Zeitpunkt der Bestellung und den gezahlten Betrag notieren.",
      "Auf die Bestätigung per E-Mail warten und die Wartezeit festhalten.",
    ],
    observe: [
      "Verlief die Zahlung ohne Brüche oder Fehlermeldungen?",
      "Wie schnell kam die Bestätigung, und war sie vollständig?",
      "Enthält sie Lieferzeit, Widerrufsbelehrung und einen Ansprechpartner?",
      "Folgt ungefragte Werbung, die nicht bestellt wurde?",
    ],
  },
  {
    title: "Lieferung",
    device: "—",
    humanOnly: true,
    actions: [
      "Versandbenachrichtigung und Sendungsverfolgung festhalten.",
      "Tatsächliches Zustelldatum notieren und mit der Zusage vergleichen.",
      "Zustand von Verpackung und Ware dokumentieren, mit Fotos.",
    ],
    observe: [
      "Wurde die zugesagte Lieferzeit eingehalten?",
      "War die Sendungsverfolgung nutzbar und aktuell?",
      "Entspricht die Ware der Darstellung im Shop?",
      "Liegen Rechnung und Retourenunterlagen bei?",
    ],
  },
  {
    title: "Retoure",
    device: "—",
    humanOnly: true,
    actions: [
      "Retoure innerhalb der Frist anmelden und den Weg dorthin dokumentieren.",
      "Ware zurücksenden und die entstandenen Kosten notieren.",
      "Bis zur Erstattung warten und die Dauer festhalten.",
    ],
    observe: [
      "Wie viele Schritte waren bis zur Retourenanmeldung nötig?",
      "Wer trägt die Rücksendekosten, und stimmt das mit der Zusage überein?",
      "Wie lange dauerte die Erstattung, und wurde sie angekündigt?",
      "Wurde versucht, die Retoure durch Gutschrift statt Geld abzuwenden?",
    ],
  },
  {
    title: "Kundenservice",
    device: "—",
    humanOnly: true,
    actions: [
      "Dieselbe sachliche Frage über alle angebotenen Kanäle stellen (Telefon, E-Mail, Chat).",
      "Zeitpunkt der Anfrage und der Antwort je Kanal notieren.",
    ],
    observe: [
      "Reaktionszeit je Kanal",
      "Wurde die Frage tatsächlich beantwortet oder nur auf FAQ verwiesen?",
      "Tonfall und Kompetenz der Antwort",
      "War erkennbar, ob ein Mensch oder ein Automat geantwortet hat?",
    ],
  },
];

const PREPARATION = [
  "Neutrale E-Mail-Adresse und Telefonnummer verwenden, die nicht mit früheren Tests verknüpft sind.",
  "Im privaten Fenster und ohne Kundenkonto starten, damit keine alten Daten das Ergebnis verfälschen.",
  "Zahlungsmittel bereitlegen, mindestens zwei verschiedene Arten.",
  "Bildschirmaufzeichnung starten oder an jeder Station einen Screenshot anfertigen.",
  "Uhrzeit bei jedem Schritt mitschreiben – Wartezeiten sind ein zentrales Ergebnis.",
  "Testbudget und Rückgabefrist vorab mit der Projektleitung klären.",
];

const CLOSING_NOTES = [
  "Während des Tests nicht zu erkennen geben, dass es sich um einen Testkauf handelt.",
  "Nichts beschönigen und nichts dramatisieren: Notiert wird, was beobachtet wurde, nicht was vermutet wird.",
  "Retoure fristgerecht durchführen, auch wenn die Ware behalten werden dürfte.",
  "Alle Belege, E-Mails und Screenshots bis zum Abschluss des Projekts aufbewahren.",
];

function ratingRow(label) {
  return `
    <div class="guide-rate">
      <span class="guide-rate-label">${escapeHtml(label)}</span>
      <span class="guide-rate-boxes">1 ☐ &nbsp; 2 ☐ &nbsp; 3 ☐ &nbsp; 4 ☐ &nbsp; 5 ☐ &nbsp; 6 ☐</span>
    </div>
    <div class="guide-lines"><span></span><span></span></div>`;
}

function buildFocusPoints(report) {
  const open = report.categories
    .filter((c) => !c.inverted)
    .flatMap((c) => c.findings)
    .filter((f) => !f.passed && f.verify)
    .sort((a, b) => b.impact.min + b.impact.max - (a.impact.min + a.impact.max))
    .slice(0, 8);

  const flagged = (report.fairness?.flagged || []).filter((f) => f.verify);

  if (open.length === 0 && flagged.length === 0) {
    return `<p>Die Vorab-Analyse hat keine offenen Punkte ergeben. Der Test folgt dem
    Standardablauf und dient der Bestätigung.</p>`;
  }

  let html = "";

  if (open.length > 0) {
    html += `
      <p>Die folgenden Punkte sind in der automatisierten Vorab-Analyse als offen aufgefallen.
      Sie sind im Test vorrangig zu klären – geordnet nach erwarteter Wirkung:</p>
      <table class="doc-table">
        <thead><tr><th>Prüfauftrag</th><th>Bereich</th><th>Befund</th></tr></thead>
        <tbody>
          ${open
            .map(
              (f) => `
            <tr>
              <td><strong>${escapeHtml(f.verify)}</strong></td>
              <td class="doc-small">${escapeHtml(f.categoryName)}</td>
              <td class="doc-small doc-muted">${escapeHtml(f.label)}</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>`;
  }

  if (flagged.length > 0) {
    html += `
      <h3>Hinweise auf manipulative Muster</h3>
      <p>Bei diesen Punkten deutet die Vorab-Analyse auf Gestaltungsmuster hin, die dem Kunden
      schaden könnten. Sie sind im Test gezielt zu verifizieren und im Zweifel zu dokumentieren:</p>
      <ul class="doc-list">
        ${flagged.map((f) => `<li>${escapeHtml(f.verify)}</li>`).join("")}
      </ul>`;
  }

  if (report.renderMode !== "rendered") {
    html += `
      <div class="guide-warning">
        <strong>Gegenprüfung erforderlich.</strong> Die Vorab-Analyse konnte kein JavaScript
        ausführen. Inhalte, die der Shop erst nachlädt – häufig Bewertungen, Gütesiegel und
        Countdown-Banner – erscheinen darin möglicherweise zu Unrecht als fehlend. Jeder oben
        genannte Punkt ist deshalb im Browser gegenzuprüfen, bevor er als Mangel berichtet wird.
      </div>`;
  }

  return html;
}

function buildJourney() {
  return JOURNEY.map((phase, i) => {
    const actions = phase.actions.map((a) => `<li>${escapeHtml(a)}</li>`).join("");
    const observe = phase.observe.map((o) => `<li>${escapeHtml(o)}</li>`).join("");
    const marker = phase.humanOnly
      ? `<span class="guide-badge">nur im Testkauf prüfbar</span>`
      : "";
    return `
      <div class="guide-phase">
        <h3>${i + 1}. ${escapeHtml(phase.title)} ${marker}</h3>
        <p class="doc-muted doc-small">Gerät: ${escapeHtml(phase.device)}</p>
        <p class="guide-label">Durchzuführen</p>
        <ol class="doc-list">${actions}</ol>
        <p class="guide-label">Zu notieren</p>
        <ul class="doc-list">${observe}</ul>
        ${ratingRow("Bewertung dieser Station")}
      </div>`;
  }).join("");
}

function renderGuide() {
  if (!currentReport) return;

  const report = currentReport;
  const domain = currentReportMeta.domain;
  const client = document.getElementById("report-client").value.trim();
  const author = document.getElementById("report-author").value.trim();
  const industry = report.industry;

  guideDoc.innerHTML = `
    <header class="doc-header">
      <div class="doc-kicker">Testleitfaden &middot; E-Commerce Mystery Shopping</div>
      <h1>${escapeHtml(domain)}</h1>
      <div class="doc-meta">
        ${client ? `<span><strong>Auftraggeber:</strong> ${escapeHtml(client)}</span>` : ""}
        ${author ? `<span><strong>Erstellt von:</strong> ${escapeHtml(author)}</span>` : ""}
        <span><strong>Stand:</strong> ${formatDateTime(currentReportMeta.ts)}</span>
      </div>
    </header>

    <section class="doc-section">
      <h2>Auftragsrahmen</h2>
      <table class="doc-table">
        <tbody>
          <tr><td>Shop</td><td>${escapeHtml(domain)}</td></tr>
          ${industry ? `<tr><td>Branche</td><td>${escapeHtml(industry.name)} · Abbruchrate ${formatPct(industry.rate)}</td></tr>` : ""}
          <tr><td>Testperson</td><td class="guide-fill"></td></tr>
          <tr><td>Testdatum</td><td class="guide-fill"></td></tr>
          <tr><td>Geräte</td><td class="guide-fill"></td></tr>
          <tr><td>Testbudget</td><td class="guide-fill"></td></tr>
        </tbody>
      </table>
      <p class="doc-hint">Der Test wird auf Desktop und Smartphone durchgeführt. Der Unterschied
      zwischen beiden Geräten ist erfahrungsgemäß erheblich: Auf dem Smartphone wird häufiger in
      den Warenkorb gelegt, aber deutlich seltener abgeschlossen.</p>
    </section>

    <section class="doc-section">
      <h2>Vorbereitung</h2>
      <ul class="doc-list">${PREPARATION.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul>
    </section>

    <section class="doc-section">
      <h2>Schwerpunkte aus der Vorab-Analyse</h2>
      ${buildFocusPoints(report)}
    </section>

    <section class="doc-section">
      <h2>Testablauf</h2>
      <p>Jede Station wird vollständig durchlaufen und einzeln bewertet. Die Bewertung erfolgt
      als Schulnote von 1 bis 6, ergänzt um eine kurze Begründung.</p>
      ${buildJourney()}
    </section>

    <section class="doc-section">
      <h2>Abschluss</h2>
      <p class="guide-label">Wo genau hätte ein echter Kunde abgebrochen?</p>
      <div class="guide-lines"><span></span><span></span><span></span></div>
      <p class="guide-label">Stärkster positiver Eindruck</p>
      <div class="guide-lines"><span></span><span></span></div>
      <p class="guide-label">Gravierendster Mangel</p>
      <div class="guide-lines"><span></span><span></span></div>
      ${ratingRow("Gesamtnote des Testkaufs")}
    </section>

    <section class="doc-section">
      <h2>Hinweise für die Testperson</h2>
      <ul class="doc-list">${CLOSING_NOTES.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>
    </section>
  `;
}

function openGuide() {
  if (!currentReport) return;
  renderGuide();
  document.getElementById("results").classList.add("hidden");
  document.getElementById("history-panel").classList.add("hidden");
  document.getElementById("consulting-report").classList.add("hidden");
  guideSection.classList.remove("hidden");
  document.body.classList.add("report-mode");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function closeGuide() {
  guideSection.classList.add("hidden");
  document.getElementById("results").classList.remove("hidden");
  document.getElementById("history-panel").classList.remove("hidden");
  document.body.classList.remove("report-mode");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

openGuideBtn.addEventListener("click", openGuide);
guideBackBtn.addEventListener("click", closeGuide);
guidePrintBtn.addEventListener("click", () => window.print());
