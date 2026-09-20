export default function ImpressumPage() {
  return (
    <div className="container-page py-12 max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">Impressum</h1>
      <p className="text-sm text-muted mb-6">
        Dies ist ein Demo-/MVP-Projekt. Die folgenden Angaben sind Platzhalter und dienen
        ausschließlich Demonstrationszwecken.
      </p>
      <div className="card p-6 space-y-4 text-sm leading-relaxed">
        <div>
          <h2 className="font-semibold mb-1">Angaben gemäß § 5 TMG</h2>
          <p>
            HalpingHand GmbH (Demo)
            <br />
            Musterstraße 1<br />
            10115 Berlin
            <br />
            Deutschland
          </p>
        </div>
        <div>
          <h2 className="font-semibold mb-1">Kontakt</h2>
          <p>
            Telefon: 030 12345678
            <br />
            E-Mail: kontakt@halpinghand.de (Demo)
          </p>
        </div>
        <div>
          <h2 className="font-semibold mb-1">Vertreten durch</h2>
          <p>Max Mustermann (Geschäftsführung, Demo)</p>
        </div>
        <div>
          <h2 className="font-semibold mb-1">Registereintrag</h2>
          <p>
            Eintragung im Handelsregister (Demo).
            <br />
            Registergericht: Amtsgericht Berlin-Charlottenburg
            <br />
            Registernummer: HRB 000000 (Demo)
          </p>
        </div>
        <div>
          <h2 className="font-semibold mb-1">Umsatzsteuer-ID</h2>
          <p>DE000000000 (Demo)</p>
        </div>
      </div>
    </div>
  );
}
