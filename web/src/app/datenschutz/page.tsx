export default function DatenschutzPage() {
  return (
    <div className="container-page py-12 max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">Datenschutzerklärung</h1>
      <p className="text-sm text-muted mb-6">
        Dies ist ein Demo-/MVP-Projekt. Die folgenden Angaben sind Platzhalter und ersetzen
        keine rechtsverbindliche Datenschutzerklärung nach DSGVO.
      </p>
      <div className="card p-6 space-y-4 text-sm leading-relaxed">
        <div>
          <h2 className="font-semibold mb-1">1. Verantwortlicher</h2>
          <p>
            HalpingHand GmbH (Demo), Musterstraße 1, 10115 Berlin. Kontakt für
            Datenschutzanfragen: datenschutz@halpinghand.de (Demo).
          </p>
        </div>
        <div>
          <h2 className="font-semibold mb-1">2. Erhobene Daten</h2>
          <p>
            Im Rahmen der Nutzung von HalpingHand verarbeiten wir Kontodaten (Name, E-Mail,
            Telefon, Stadt), Aufgabendaten sowie Kommunikationsdaten (Chatnachrichten), um
            die Vermittlung zwischen Auftraggebern und Helfern zu ermöglichen.
          </p>
        </div>
        <div>
          <h2 className="font-semibold mb-1">3. Zweck der Verarbeitung</h2>
          <p>
            Die Daten werden ausschließlich zur Bereitstellung der Plattform, Abwicklung von
            Zahlungen (Stripe, Testmodus) und Kommunikation zwischen Nutzern verwendet.
          </p>
        </div>
        <div>
          <h2 className="font-semibold mb-1">4. Deine Rechte</h2>
          <p>
            Du hast das Recht auf Auskunft, Berichtigung, Löschung und Einschränkung der
            Verarbeitung deiner personenbezogenen Daten gemäß Art. 15–18 DSGVO.
          </p>
        </div>
        <div>
          <h2 className="font-semibold mb-1">5. Hinweis</h2>
          <p>
            Da es sich um ein Demo-/MVP-Projekt handelt, werden keine echten Zahlungen oder
            E-Mails versendet. Alle Testdaten können jederzeit gelöscht werden.
          </p>
        </div>
      </div>
    </div>
  );
}
