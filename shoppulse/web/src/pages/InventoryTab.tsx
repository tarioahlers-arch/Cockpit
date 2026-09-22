import { useEffect, useMemo, useState } from 'react';
import {
  api,
  fmt,
  type Availability,
  type IngestResult,
  type InventoryOverview,
  type InventorySource,
  type Shop,
  type SourceTypeDef,
} from '../api';

const STATUS_COLOR: Record<string, string> = { ok: 'var(--good)', error: 'var(--bad)', blocked: 'var(--warn)' };
const STATUS_TEXT: Record<string, string> = { ok: 'OK', error: 'Fehler', blocked: 'Sicherheitsstopp' };
const KIND_LABEL = { warehouse: 'Lager', store: 'Filiale', supplier: 'Lieferant' };
const origin = typeof window !== 'undefined' ? window.location.origin : '';

const ts = (v: string | null) =>
  v ? new Date(v.replace(' ', 'T') + 'Z').toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : '–';

function AvailabilityPreview({ a }: { a?: Availability }) {
  if (!a || a.status === 'unknown' || !a.label) return <span className="muted small">wird nicht angezeigt</span>;
  const color = a.status === 'in_stock' ? 'var(--good)' : a.status === 'low_stock' ? 'var(--warn)' : 'var(--bad)';
  return (
    <span style={{ color, fontSize: 12, fontWeight: 600 }}>
      <span className="status-dot" style={{ background: color }} />
      {a.label}
    </span>
  );
}

function PushDetails({
  source,
  onDone,
  onNewToken,
}: {
  source: InventorySource;
  onDone: (r: IngestResult) => void;
  onNewToken: (token: string) => void;
}) {
  const [csv, setCsv] = useState('');
  const [mode, setMode] = useState<'snapshot' | 'upsert'>('upsert');
  const [busy, setBusy] = useState(false);
  const token = '<IHR_PUSH_TOKEN>';
  const curl = `curl -X POST ${origin.replace(':5174', ':4100')}/api/inventory/push \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{"mode":"upsert","levels":[{"sku":"NL-JACKE-01","quantity":4,"location":"FIL-HH"}]}'

# oder direkt eine CSV-Datei aus dem ERP/Kassensystem senden:
curl -X POST "${origin.replace(':5174', ':4100')}/api/inventory/push?mode=snapshot" \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: text/csv" --data-binary @bestand.csv`;

  async function upload(force = false) {
    setBusy(true);
    try {
      const r = await api.uploadCsv(source.id, csv, mode, force);
      onDone(r);
      if (r.status === 'ok') setCsv('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <details style={{ marginTop: 10 }}>
      <summary>Push-API & CSV-Upload</summary>
      <p className="muted small">
        Diese Quelle wird nicht abgerufen, sondern beliefert: Ihr System sendet Bestände per API, oder Sie laden eine CSV hoch
        (Spalten z. B. <code>Artikelnummer;Bestand;Lager;EAN</code>). <strong>upsert</strong> aktualisiert nur die gesendeten
        Artikel, <strong>snapshot</strong> ersetzt den kompletten Bestand dieser Quelle.
      </p>
      <div className="small" style={{ margin: '8px 0', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span>
          Push-Token: <code>inv_…{source.push_token_hint ?? '????'}</code>{' '}
          <span className="muted">(wird aus Sicherheitsgründen nur beim Erzeugen angezeigt)</span>
        </span>
        <button
          className="btn secondary small"
          onClick={async () => {
            if (!confirm('Neuen Token erzeugen? Der bisherige Token wird sofort ungültig – angebundene Systeme müssen umgestellt werden.')) return;
            const r = await api.regenerateToken(source.id);
            onNewToken(r.pushToken);
          }}
        >
          Token neu erzeugen
        </button>
      </div>
      <pre className="code-block">{curl}</pre>
      <div className="form-field" style={{ marginTop: 10 }}>
        <label>CSV hochladen</label>
        <input
          type="file"
          accept=".csv,text/csv,text/plain"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) setCsv(await f.text());
          }}
        />
        <textarea rows={5} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={'Artikelnummer;Bestand;Lager\nNL-JACKE-01;4;FIL-HH'} />
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={mode} onChange={(e) => setMode(e.target.value as 'snapshot' | 'upsert')} className="btn secondary small">
          <option value="upsert">upsert (nur gesendete Artikel)</option>
          <option value="snapshot">snapshot (kompletter Bestand)</option>
        </select>
        <button className="btn small" disabled={!csv.trim() || busy} onClick={() => upload()}>
          Hochladen
        </button>
        {source.last_status === 'blocked' && (
          <button className="btn danger small" disabled={!csv.trim() || busy} onClick={() => upload(true)}>
            Trotzdem übernehmen
          </button>
        )}
      </div>
    </details>
  );
}

function NewSourceForm({ types, onCreate }: { types: SourceTypeDef[]; onCreate: (d: Record<string, unknown>) => Promise<void> }) {
  const [type, setType] = useState<SourceTypeDef['type']>('csv_url');
  const [name, setName] = useState('');
  const [interval, setInterval_] = useState('15');
  const [config, setConfig] = useState<Record<string, string>>({});
  const def = types.find((t) => t.type === type);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        await onCreate({ type, name, config, syncIntervalMin: Number(interval) });
        setConfig({});
        setName('');
      }}
    >
      <div className="form-grid">
        <div className="form-field">
          <label>Tool / Quellentyp</label>
          <select value={type} onChange={(e) => { setType(e.target.value as SourceTypeDef['type']); setConfig({}); }}>
            {types.map((t) => (
              <option key={t.type} value={t.type}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={def?.label ?? ''} />
        </div>
        {type !== 'push' && (
          <div className="form-field">
            <label>Abgleich alle … Minuten</label>
            <input type="number" min={5} max={1440} value={interval} onChange={(e) => setInterval_(e.target.value)} />
          </div>
        )}
        {def?.fields.map((f) => (
          <div className="form-field" key={f.key}>
            <label>{f.label}</label>
            <input
              type={f.secret ? 'password' : 'text'}
              required={!f.optional}
              placeholder={f.placeholder}
              value={config[f.key] ?? ''}
              onChange={(e) => setConfig({ ...config, [f.key]: e.target.value })}
              autoComplete="off"
            />
          </div>
        ))}
      </div>
      {def && <p className="muted small" style={{ marginTop: 0 }}>{def.description}</p>}
      <button className="btn">Quelle hinzufügen</button>
    </form>
  );
}

export default function InventoryTab({ shop }: { shop: Shop }) {
  const [data, setData] = useState<InventoryOverview | null>(null);
  const [types, setTypes] = useState<SourceTypeDef[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<IngestResult | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [settings, setSettings] = useState({ lowStockThreshold: '5', maxAgeHours: '24', showStoreAvailability: true });
  const [newToken, setNewToken] = useState<{ name: string; token: string } | null>(null);

  const load = () =>
    api
      .inventory(shop.id)
      .then((d) => {
        setData(d);
        setSettings({
          lowStockThreshold: String(d.settings.low_stock_threshold),
          maxAgeHours: String(d.settings.max_age_hours),
          showStoreAvailability: !!d.settings.show_store_availability,
        });
      })
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
    api.sourceTypes().then(setTypes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop.id]);

  async function act(fn: () => Promise<unknown>) {
    setError(null);
    try {
      const r = await fn();
      if (r && typeof r === 'object' && 'status' in r && 'message' in r) setNotice(r as IngestResult);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const columns = useMemo(() => data?.locations ?? [], [data]);
  if (!data) return error ? <div className="error-banner">{error}</div> : <div className="empty-state">Lade Lagerbestände …</div>;
  const threshold = data.settings.low_stock_threshold;
  const sampleSku = data.items.find((i) => i.matched)?.sku ?? 'SKU';

  return (
    <div>
      {error && <div className="error-banner">{error}</div>}
      {notice && (
        <div className={notice.status === 'ok' ? 'info-banner' : 'error-banner'} onClick={() => setNotice(null)} style={{ cursor: 'pointer' }}>
          <strong>{notice.status === 'ok' ? 'Abgleich erfolgreich: ' : notice.status === 'blocked' ? 'Sicherheitsstopp: ' : 'Fehler: '}</strong>
          {notice.message}
          {notice.parseErrors?.length ? ` · ${notice.parseErrors.length} Zeilen übersprungen (z. B. ${notice.parseErrors[0]})` : ''}
        </div>
      )}

      {newToken && (
        <div className="info-banner" style={{ borderColor: 'var(--warn)' }}>
          <strong>Push-Token für „{newToken.name}“ – jetzt kopieren, er wird nicht noch einmal angezeigt:</strong>
          <pre className="code-block" style={{ margin: '8px 0', userSelect: 'all' }}>{newToken.token}</pre>
          <button className="btn small" onClick={() => navigator.clipboard?.writeText(newToken.token)}>
            Kopieren
          </button>{' '}
          <button className="btn secondary small" onClick={() => setNewToken(null)}>
            Gespeichert, ausblenden
          </button>
        </div>
      )}

      <div className="info-banner">
        Jedes Tool, das Bestände führt (Shopsystem, ERP, Lagerverwaltung, Kassensystem der Filialen), wird als eigene{' '}
        <strong>Quelle</strong> angebunden und besitzt eigene Lagerorte – so überschreiben sich die Systeme nie gegenseitig.
        Der online bestellbare Bestand ist die Summe aller Lagerorte mit „zählt online“. Kund:innen sehen nur aktuelle Daten
        (jünger als {data.settings.max_age_hours} h).
      </div>

      <div className="panel">
        <div className="panel-head">
          <p className="section-title">Quellen ({data.sources.length})</p>
        </div>
        {data.sources.length === 0 && <div className="empty-state">Noch keine Quelle angebunden.</div>}
        {data.sources.map((s) => {
          const typeLabel = types.find((t) => t.type === s.type)?.label ?? s.type;
          return (
            <div className="source-card" key={s.id} style={{ opacity: s.active ? 1 : 0.6 }}>
              <div className="head">
                <div>
                  <strong>{s.name}</strong> <span className="tag">{typeLabel}</span>{' '}
                  {!s.active && <span className="tag warn">deaktiviert</span>}
                  <div className="muted small" style={{ marginTop: 4 }}>
                    <span className="status-dot" style={{ background: s.last_status ? STATUS_COLOR[s.last_status] : 'var(--muted)' }} />
                    {s.last_status ? STATUS_TEXT[s.last_status] : 'noch nicht abgeglichen'} · zuletzt {ts(s.last_sync_at)}
                    {s.type !== 'push' && ` · alle ${s.sync_interval_min} min`}
                  </div>
                  {s.last_message && <div className="small" style={{ marginTop: 4, color: '#c3cbd9' }}>{s.last_message}</div>}
                  {s.type !== 'push' && Object.keys(s.config).length > 0 && (
                    <div className="muted small" style={{ marginTop: 4 }}>
                      {Object.entries(s.config)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(' · ')}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {s.type !== 'push' && (
                    <button className="btn small" disabled={busy === s.id} onClick={async () => { setBusy(s.id); await act(() => api.syncSource(s.id)); setBusy(null); }}>
                      {busy === s.id ? 'Gleiche ab …' : 'Jetzt abgleichen'}
                    </button>
                  )}
                  {s.type !== 'push' && s.last_status === 'blocked' && (
                    <button className="btn danger small" onClick={() => confirm('Bestände trotz Sicherheitsstopp überschreiben?') && act(() => api.syncSource(s.id, true))}>
                      Erzwingen
                    </button>
                  )}
                  <button className="btn secondary small" onClick={() => act(() => api.updateSource(s.id, { active: !s.active }))}>
                    {s.active ? 'Deaktivieren' : 'Aktivieren'}
                  </button>
                  <button className="btn danger small" onClick={() => confirm(`Quelle "${s.name}" inkl. ihrer Lagerorte und Bestände entfernen?`) && act(() => api.deleteSource(s.id))}>
                    Entfernen
                  </button>
                </div>
              </div>
              {s.type === 'push' && (
                <PushDetails
                  source={s}
                  onDone={(r) => { setNotice(r); load(); }}
                  onNewToken={(t) => { setNewToken({ name: s.name, token: t }); load(); }}
                />
              )}
            </div>
          );
        })}
        <p className="section-title" style={{ margin: '20px 0 12px' }}>
          Neue Quelle anbinden
        </p>
        <NewSourceForm
          types={types}
          onCreate={(d) =>
            act(async () => {
              const created = await api.createSource(shop.id, d);
              if (created.pushToken) setNewToken({ name: created.name, token: created.pushToken });
            })
          }
        />
      </div>

      <div className="panel">
        <div className="panel-head">
          <p className="section-title">Bestände je Lagerort</p>
          <span className="muted small">
            <span className="qty-low">gelb</span> = höchstens {threshold} Stück · <span className="qty-zero">rot</span> = 0
          </span>
        </div>
        {data.items.length === 0 ? (
          <div className="empty-state">Noch keine Bestände – Quelle anbinden und abgleichen.</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Artikel</th>
                  {columns.map((c) => (
                    <th key={c.id} className="num" title={`${c.source_name} · ${KIND_LABEL[c.kind]}`}>
                      {c.name}
                      <div className="muted small" style={{ fontWeight: 400 }}>
                        {KIND_LABEL[c.kind]}
                        {c.counts_for_online ? ' · online' : ''}
                      </div>
                    </th>
                  ))}
                  <th className="num">Online</th>
                  <th>Anzeige für Kund:innen</th>
                  <th>Stand</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((i) => {
                  const online = columns.filter((c) => c.counts_for_online).reduce((s, c) => s + (i.perLocation[c.id] ?? 0), 0);
                  const cls = (q: number) => (q <= 0 ? 'qty-zero' : q <= threshold ? 'qty-low' : '');
                  return (
                    <tr key={i.sku}>
                      <td>
                        <strong>{i.name ?? i.sku}</strong>
                        <div className="muted small">
                          {i.sku} {!i.matched && <span className="tag warn">nicht in ShopPulse angelegt</span>}
                        </div>
                      </td>
                      {columns.map((c) => (
                        <td key={c.id} className={`num ${i.perLocation[c.id] !== undefined ? cls(i.perLocation[c.id]) : 'muted'}`}>
                          {i.perLocation[c.id] ?? '–'}
                        </td>
                      ))}
                      <td className={`num ${cls(online)}`}>{fmt.num(online)}</td>
                      <td>
                        <AvailabilityPreview a={i.availability} />
                      </td>
                      <td className="muted small">{ts(i.updatedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {data.productsWithoutStock.length > 0 && (
          <p className="muted small" style={{ marginBottom: 0 }}>
            Ohne integrierten Bestand (Kund:innen sehen keine Verfügbarkeit):{' '}
            {data.productsWithoutStock.map((p) => `${p.name} (${p.sku})`).join(', ')}
          </p>
        )}
      </div>

      <div className="grid-2">
        <div className="panel">
          <p className="section-title" style={{ marginBottom: 12 }}>
            Lagerorte
          </p>
          {data.locations.length === 0 ? (
            <div className="empty-state">Lagerorte entstehen automatisch beim ersten Abgleich.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ort</th>
                  <th>Art</th>
                  <th>Einstellungen</th>
                </tr>
              </thead>
              <tbody>
                {data.locations.map((l) => (
                  <tr key={l.id}>
                    <td>
                      {l.name}
                      <div className="muted small">{l.source_name}</div>
                    </td>
                    <td>
                      <select
                        value={l.kind}
                        onChange={(e) => act(() => api.updateLocation(l.id, { kind: e.target.value }))}
                        style={{ background: 'var(--panel-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, padding: 4 }}
                      >
                        {Object.entries(KIND_LABEL).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <label className="toggle">
                        <input type="checkbox" checked={!!l.counts_for_online} onChange={(e) => act(() => api.updateLocation(l.id, { countsForOnline: e.target.checked }))} />
                        zählt zum Onlinebestand
                      </label>
                      <br />
                      <label className="toggle">
                        <input type="checkbox" checked={!!l.customer_visible} onChange={(e) => act(() => api.updateLocation(l.id, { customerVisible: e.target.checked }))} />
                        für Kund:innen sichtbar (z. B. Abholung)
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel">
          <p className="section-title" style={{ marginBottom: 12 }}>
            Anzeige für Kund:innen
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              act(() => api.saveInventorySettings(shop.id, { ...settings, lowStockThreshold: Number(settings.lowStockThreshold), maxAgeHours: Number(settings.maxAgeHours) }));
            }}
          >
            <div className="form-grid">
              <div className="form-field">
                <label>„Nur noch X Stück“ ab</label>
                <input type="number" min={0} value={settings.lowStockThreshold} onChange={(e) => setSettings({ ...settings, lowStockThreshold: e.target.value })} />
                <span className="help">darüber: „Auf Lager“ ohne Mengenangabe</span>
              </div>
              <div className="form-field">
                <label>Daten höchstens … Stunden alt</label>
                <input type="number" min={1} value={settings.maxAgeHours} onChange={(e) => setSettings({ ...settings, maxAgeHours: e.target.value })} />
                <span className="help">ältere Bestände werden nicht angezeigt</span>
              </div>
            </div>
            <label className="toggle" style={{ marginBottom: 12 }}>
              <input type="checkbox" checked={settings.showStoreAvailability} onChange={(e) => setSettings({ ...settings, showStoreAvailability: e.target.checked })} />
              Filialbestände anzeigen
            </label>
            <br />
            <button className="btn secondary small">Speichern</button>
          </form>

          <p className="section-title" style={{ margin: '20px 0 8px' }}>
            Einbau im Shop
          </p>
          <pre className="code-block">{`<!-- Produktseite: SKU aus data-sp-sku der Seite -->
<div data-sp-availability></div>

<!-- Kategorie-Listing / Warenkorb -->
<div data-sp-availability-sku="${sampleSku}" data-sp-show-stores="false"></div>

<!-- nach Variantenwechsel per JS: -->
ShopPulse.refreshAvailability();`}</pre>
          <p className="muted small">
            Die Anzeige braucht keine Einwilligung: Es werden weder IDs erzeugt noch Daten gespeichert. Beispiel:{' '}
            <a href={`/demo-shop/${shop.id}`} target="_blank" rel="noreferrer">
              Test-Shop ↗
            </a>
          </p>
        </div>
      </div>

      <div className="panel">
        <p className="section-title" style={{ marginBottom: 12 }}>
          Protokoll
        </p>
        {data.runs.length === 0 ? (
          <div className="empty-state">Noch keine Abgleiche.</div>
        ) : (
          <table className="data-table">
            <tbody>
              {data.runs.map((r) => (
                <tr key={r.id}>
                  <td className="muted small" style={{ whiteSpace: 'nowrap' }}>{ts(r.started_at)}</td>
                  <td>{r.source_name}</td>
                  <td>
                    <span className="status-dot" style={{ background: STATUS_COLOR[r.status] ?? 'var(--muted)' }} />
                    {STATUS_TEXT[r.status] ?? r.status}
                  </td>
                  <td className="small">{r.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
