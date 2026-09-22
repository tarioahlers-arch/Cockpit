import { useEffect, useState } from 'react';
import { api, fmt, type CompetitorOffer, type ProductPricing } from '../api';

const ACTION_TAG: Record<ProductPricing['recommendation']['action'], [string, string]> = {
  raise: ['good', 'Erhöhen'],
  lower: ['warn', 'Senken'],
  hold: ['', 'Halten'],
  test: ['blue', 'Preistest'],
};

const CSV_EXAMPLE = `competitor;title;ean;price;url
Outdoor-Profi.de;Merino Shirt Basic Herren;;47,90;https://…
Bergsport24;Regenjacke Damen Nordlicht;4006381333931;124,00;`;

function parseCsv(text: string) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const sep = lines[0].includes(';') ? ';' : ',';
  const head = lines[0].split(sep).map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((l) => {
    const cells = l.split(sep);
    return Object.fromEntries(head.map((h, i) => [h, (cells[i] ?? '').trim()]));
  });
}

export default function PricingTab({ shopId }: { shopId: number }) {
  const [data, setData] = useState<{ products: ProductPricing[]; unmatchedOffers: CompetitorOffer[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [product, setProduct] = useState({ sku: '', name: '', ean: '', price: '', unitCost: '', stock: '' });
  const [history, setHistory] = useState({ productId: '', price: '', unitsSold: '', periodDays: '7', periodStart: '' });
  const [csv, setCsv] = useState('');

  const load = () => api.pricing(shopId).then(setData).catch((e) => setError(e.message));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId]);

  async function run(fn: () => Promise<unknown>, success?: string) {
    setError(null);
    setInfo(null);
    try {
      await fn();
      if (success) setInfo(success);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!data) return error ? <div className="error-banner">{error}</div> : <div className="empty-state">Lade …</div>;
  const products = data.products;

  return (
    <div>
      {error && <div className="error-banner">{error}</div>}
      {info && <div className="info-banner">{info}</div>}

      <div className="panel">
        <div className="panel-head">
          <p className="section-title">Preisempfehlungen</p>
          <span className="muted small">Log-Log-Elastizität aus eigener Preis-/Absatzhistorie · Schritte max. ±10 %</span>
        </div>
        {products.length === 0 ? (
          <div className="empty-state">Noch keine Produkte erfasst – unten anlegen oder den Demo-Shop laden.</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Produkt</th>
                  <th className="num">Preis</th>
                  <th className="num">Wettbewerb (Median)</th>
                  <th className="num">Elastizität</th>
                  <th>Empfehlung</th>
                  <th className="num">Δ Deckungsbeitrag / Monat</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const r = p.recommendation;
                  const [cls, label] = ACTION_TAG[r.action];
                  return (
                    <tr key={p.product.id}>
                      <td>
                        <strong>{p.product.name}</strong>
                        <div className="muted small">
                          {p.product.sku}
                          {p.product.ean ? ` · EAN ${p.product.ean}` : ''}
                        </div>
                        <details style={{ marginTop: 6 }}>
                          <summary>Warum?</summary>
                          <ul className="reasons">
                            {r.reasons.map((x) => (
                              <li key={x}>{x}</li>
                            ))}
                          </ul>
                          {p.offers.length > 0 && (
                            <ul className="reasons">
                              {p.offers.map((o) => (
                                <li key={o.id}>
                                  {o.competitor}: {fmt.eur(o.price, 2)}{' '}
                                  <span className="muted">
                                    (Match {o.match_method}
                                    {o.match_confidence != null && o.match_method === 'title' ? `, ${Math.round(o.match_confidence * 100)} %` : ''})
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </details>
                      </td>
                      <td className="num">{fmt.eur(p.product.price, 2)}</td>
                      <td className="num">
                        {p.competitors.median != null ? fmt.eur(p.competitors.median, 2) : '–'}
                        {p.competitors.positionVsMedian != null && (
                          <div className="muted small">{fmt.signedPct(p.competitors.positionVsMedian, 0)} ggü. Median</div>
                        )}
                      </td>
                      <td className="num">
                        {p.elasticity.elasticity != null ? p.elasticity.elasticity.toFixed(2).replace('.', ',') : '–'}
                        <div className="muted small">{p.elasticity.reliable ? `R² ${p.elasticity.r2?.toFixed(2).replace('.', ',')}` : 'unsicher'}</div>
                      </td>
                      <td>
                        <span className={`tag ${cls}`}>{label}</span>
                        {r.action !== 'test' && r.action !== 'hold' && (
                          <div style={{ marginTop: 4 }}>
                            <strong>{fmt.eur(r.recommendedPrice, 2)}</strong>{' '}
                            <span className="muted small">({fmt.signedPct(r.changePct, 0)})</span>
                          </div>
                        )}
                        <div className="muted small">
                          Absatz {fmt.num(r.expectedUnitsPerMonthNow)} → {fmt.num(r.expectedUnitsPerMonthNew)} / Monat
                        </div>
                      </td>
                      <td className="num" style={{ color: r.expectedProfitDeltaPerMonth > 0 ? 'var(--good)' : undefined, fontWeight: 700 }}>
                        {r.expectedProfitDeltaPerMonth > 0 ? `+${fmt.eur(r.expectedProfitDeltaPerMonth)}` : '–'}
                        <div className="muted small" style={{ fontWeight: 400 }}>
                          {r.basis === 'profit' ? 'Deckungsbeitrag' : 'Umsatz'}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {data.unmatchedOffers.length > 0 && (
        <div className="panel">
          <p className="section-title" style={{ marginBottom: 12 }}>
            Nicht zugeordnete Wettbewerbsangebote ({data.unmatchedOffers.length})
          </p>
          <table className="data-table">
            <tbody>
              {data.unmatchedOffers.map((o) => (
                <tr key={o.id}>
                  <td>
                    {o.title}
                    <div className="muted small">{o.competitor}</div>
                  </td>
                  <td className="num">{fmt.eur(o.price, 2)}</td>
                  <td>
                    <select
                      defaultValue=""
                      onChange={(e) => e.target.value && run(() => api.matchOffer(o.id, Number(e.target.value)), 'Angebot zugeordnet.')}
                      style={{ background: 'var(--panel-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, padding: 4 }}
                    >
                      <option value="">Manuell zuordnen …</option>
                      {products.map((p) => (
                        <option key={p.product.id} value={p.product.id}>
                          {p.product.name}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid-2">
        <div className="panel">
          <p className="section-title" style={{ marginBottom: 12 }}>
            Produkt anlegen / aktualisieren
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(() => api.upsertProduct(shopId, product), 'Produkt gespeichert.');
            }}
          >
            <div className="form-grid">
              {(
                [
                  ['sku', 'SKU *'],
                  ['name', 'Name *'],
                  ['ean', 'EAN/GTIN'],
                  ['price', 'Preis (€) *'],
                  ['unitCost', 'Stückkosten (€)'],
                  ['stock', 'Lagerbestand'],
                ] as const
              ).map(([k, label]) => (
                <div className="form-field" key={k}>
                  <label>{label}</label>
                  <input value={product[k]} onChange={(e) => setProduct({ ...product, [k]: e.target.value })} />
                </div>
              ))}
            </div>
            <button className="btn">Speichern</button>
          </form>

          <p className="section-title" style={{ margin: '24px 0 12px' }}>
            Preis-/Absatzperiode erfassen
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(() => api.addHistory(Number(history.productId), history), 'Periode erfasst – Elastizität neu geschätzt.');
            }}
          >
            <div className="form-grid">
              <div className="form-field">
                <label>Produkt</label>
                <select required value={history.productId} onChange={(e) => setHistory({ ...history, productId: e.target.value })}>
                  <option value="">wählen …</option>
                  {products.map((p) => (
                    <option key={p.product.id} value={p.product.id}>
                      {p.product.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>Preis in der Periode (€)</label>
                <input required value={history.price} onChange={(e) => setHistory({ ...history, price: e.target.value })} />
              </div>
              <div className="form-field">
                <label>Verkaufte Stück</label>
                <input required value={history.unitsSold} onChange={(e) => setHistory({ ...history, unitsSold: e.target.value })} />
              </div>
              <div className="form-field">
                <label>Tage</label>
                <input value={history.periodDays} onChange={(e) => setHistory({ ...history, periodDays: e.target.value })} />
              </div>
            </div>
            <button className="btn secondary">Erfassen</button>
          </form>
        </div>

        <div className="panel">
          <p className="section-title" style={{ marginBottom: 12 }}>
            Wettbewerbspreise importieren
          </p>
          <p className="muted small" style={{ marginTop: 0 }}>
            CSV aus Ihrem Preisdaten-Anbieter oder eigenem Monitoring. Zuordnung automatisch per EAN, sonst per
            Titelähnlichkeit (≥ 50 %). Automatisiertes Scraping ist bewusst nicht eingebaut – Nutzungsbedingungen und
            Wettbewerbsrecht vorher prüfen.
          </p>
          <div className="form-field">
            <textarea rows={8} value={csv} placeholder={CSV_EXAMPLE} onChange={(e) => setCsv(e.target.value)} />
          </div>
          <button
            className="btn"
            disabled={!csv.trim()}
            onClick={() =>
              run(async () => {
                const rows = parseCsv(csv);
                if (!rows.length) throw new Error('CSV braucht eine Kopfzeile und mindestens eine Datenzeile.');
                const r = await api.importOffers(shopId, rows);
                setCsv('');
                setInfo(`${r.imported} importiert · ${r.matched} zugeordnet · ${r.unmatched} offen · ${r.skipped} übersprungen`);
              })
            }
          >
            Importieren
          </button>
        </div>
      </div>
    </div>
  );
}
