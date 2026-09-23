import type { Shop } from '../api';

const origin = typeof window !== 'undefined' ? window.location.origin : '';

const PLATFORM_STEPS: Record<Shop['platform'], string[]> = {
  shopify: [
    'Online Store → Themes → "Code bearbeiten" → layout/theme.liquid öffnen.',
    'Snippet direkt vor </head> einfügen.',
    'In product.liquid den Kauf-Button um data-sp-add-to-cart ergänzen und <body> mit den data-sp-* Attributen annotieren.',
    'Customer Events / Bestellstatusseite: ShopPulse.track("purchase", { value, skus }) aufrufen.',
  ],
  shopware: [
    'Theme-Plugin: in Resources/views/storefront/base.html.twig den Block base_script_hmr_mode / layout_head_javascript erweitern.',
    'Snippet einfügen, Kauf-Button in buy-widget-form.html.twig um data-sp-add-to-cart ergänzen.',
    'In checkout/finish/index.html.twig Bestellwert per data-sp-order-value übergeben.',
  ],
  woocommerce: [
    'Snippet per Plugin "Code Snippets" oder im Child-Theme (wp_head-Hook) einbinden.',
    'Hook woocommerce_before_add_to_cart_button: Nudge-Slot <div data-sp-nudge-slot></div> ausgeben.',
    'Hook woocommerce_thankyou: ShopPulse.track("purchase", { value, skus }) ausgeben.',
  ],
  custom: [
    'Snippet im <head> aller Seiten einbinden.',
    'Seitentyp und Produktdaten per data-sp-* Attribut am <body> setzen.',
    'Kauf-Button mit data-sp-add-to-cart markieren, Bestellbestätigung mit data-sp-order-value.',
  ],
};

export default function SnippetInstructions({ shop }: { shop: Shop }) {
  const snippet = `<!-- ShopPulse -->
<script src="${origin}/snippet.js" data-key="${shop.public_key}" async></script>
<script>
  // Aus Ihrem Consent-Banner aufrufen, sobald die Einwilligung vorliegt:
  // window.ShopPulse && ShopPulse.consent(true);
  // oder: document.dispatchEvent(new CustomEvent('shoppulse:consent'));
</script>`;

  const annotation = `<body data-sp-page="product"
      data-sp-sku="NL-JACKE-01"
      data-sp-price="129.90"
      data-sp-reference-price="149.90"   <!-- nur echte Referenzpreise! -->
      data-sp-stock="6">                 <!-- nur echter Bestand -->
  ...
  <div data-sp-nudge-slot></div>         <!-- optional: Platz für Nudges -->
  <button data-sp-add-to-cart>In den Warenkorb</button>
  <select data-sp-price-filter>…</select>

<!-- Bestellbestätigung -->
<body data-sp-page="confirmation" data-sp-order-value="159.80" data-sp-order-skus="NL-JACKE-01,NL-SOCKEN-3">`;

  return (
    <div>
      <p className="section-title" style={{ marginBottom: 8 }}>1. Snippet einbinden</p>
      <pre className="code-block">{snippet}</pre>
      <button className="btn secondary small" style={{ marginTop: 8 }} onClick={() => navigator.clipboard?.writeText(snippet)}>
        Kopieren
      </button>

      <p className="section-title" style={{ margin: '20px 0 8px' }}>2. Seiten annotieren</p>
      <pre className="code-block">{annotation}</pre>

      <p className="section-title" style={{ margin: '20px 0 8px' }}>3. Schritte für Ihre Plattform</p>
      <ol className="reasons" style={{ fontSize: 13 }}>
        {PLATFORM_STEPS[shop.platform].map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>

      <div className="info-banner" style={{ marginTop: 16 }}>
        <strong>Datenschutz by Design:</strong> Das Snippet speichert und sendet nichts, bevor{' '}
        <code>ShopPulse.consent(true)</code> aufgerufen wurde. Es erzeugt nur eine zufällige, pseudonyme Besucher-ID – keine
        IP-Adressen, keine Cookies von Drittanbietern, keine personenbezogenen Daten. Nudges erscheinen ausschließlich mit
        echten Daten (echte Kaufzahlen, echter Bestand, gültiger Referenzpreis). Die Klick-Analyse speichert keine Texteingaben;
        Bereiche wie das Kundenkonto nehmen Sie mit <code>data-sp-private</code> komplett aus.
      </div>
    </div>
  );
}
