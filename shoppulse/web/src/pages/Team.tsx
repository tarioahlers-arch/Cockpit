import { useEffect, useState } from 'react';
import { api, ROLE_LABEL, type Me, type TeamData } from '../api';

const ROLE_HELP: Record<Me['role'], string> = {
  owner: 'alles, inkl. Team verwalten und Shops löschen',
  editor: 'Shops, Tests, Preise und Lager bearbeiten',
  viewer: 'alles ansehen, nichts ändern',
};

export default function Team({ me }: { me: Me }) {
  const [data, setData] = useState<TeamData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [form, setForm] = useState<{ email: string; role: Me['role'] }>({ email: '', role: 'editor' });
  const [pw, setPw] = useState({ current: '', next: '' });
  const isOwner = me.role === 'owner';

  const load = () => api.team().then(setData).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  async function run(fn: () => Promise<unknown>, success: string) {
    setError(null);
    setInfo(null);
    try {
      await fn();
      setInfo(success);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div>
      {error && <div className="error-banner">{error}</div>}
      {info && <div className="info-banner">{info}</div>}

      <div className="panel">
        <div className="panel-head">
          <p className="section-title">Team von {me.orgName}</p>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>E-Mail</th>
                <th>Rolle</th>
                {isOwner && <th />}
              </tr>
            </thead>
            <tbody>
              {data?.members.map((m) => (
                <tr key={m.id}>
                  <td>
                    {m.name} {m.id === data.me && <span className="tag">Sie</span>}
                  </td>
                  <td>{m.email}</td>
                  <td>
                    {isOwner ? (
                      <select
                        value={m.role}
                        onChange={(e) => run(() => api.setRole(m.id, e.target.value as Me['role']), 'Rolle geändert.')}
                        style={{ background: 'var(--panel-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, padding: 4 }}
                      >
                        {Object.entries(ROLE_LABEL).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    ) : (
                      ROLE_LABEL[m.role]
                    )}
                  </td>
                  {isOwner && (
                    <td className="num">
                      {m.id !== data.me && (
                        <button
                          className="btn danger small"
                          onClick={() => confirm(`${m.name} aus dem Team entfernen? Der Zugriff endet sofort.`) && run(() => api.removeMember(m.id), 'Mitglied entfernt.')}
                        >
                          Entfernen
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="reasons" style={{ marginTop: 12 }}>
          {(Object.keys(ROLE_LABEL) as Me['role'][]).map((r) => (
            <li key={r}>
              <strong>{ROLE_LABEL[r]}:</strong> {ROLE_HELP[r]}
            </li>
          ))}
        </ul>
      </div>

      {isOwner && (
        <div className="panel">
          <p className="section-title" style={{ marginBottom: 12 }}>
            Mitglied einladen
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                await api.invite(form.email, form.role);
                setForm({ ...form, email: '' });
              }, `Einladung an ${form.email} versendet (7 Tage gültig).`);
            }}
          >
            <div className="form-grid">
              <div className="form-field">
                <label>E-Mail</label>
                <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="form-field">
                <label>Rolle</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Me['role'] })}>
                  {Object.entries(ROLE_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button className="btn">Einladung senden</button>
          </form>
          {data && data.invitations.length > 0 && (
            <>
              <p className="section-title" style={{ margin: '20px 0 8px' }}>
                Offene Einladungen
              </p>
              <table className="data-table">
                <tbody>
                  {data.invitations.map((i) => (
                    <tr key={i.id}>
                      <td>{i.email}</td>
                      <td>{ROLE_LABEL[i.role]}</td>
                      <td className="muted small">gültig bis {new Date(i.expires_at.replace(' ', 'T') + 'Z').toLocaleDateString('de-DE')}</td>
                      <td className="num">
                        <button className="btn secondary small" onClick={() => run(() => api.revokeInvitation(i.id), 'Einladung zurückgezogen.')}>
                          Zurückziehen
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      <div className="panel" style={{ maxWidth: 520 }}>
        <p className="section-title" style={{ marginBottom: 12 }}>
          Eigenes Passwort ändern
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await api.changePassword(pw.current, pw.next);
              setPw({ current: '', next: '' });
            }, 'Passwort geändert. Alle anderen Sitzungen wurden abgemeldet.');
          }}
        >
          <div className="form-field">
            <label>Aktuelles Passwort</label>
            <input type="password" required autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
          </div>
          <div className="form-field">
            <label>Neues Passwort (mind. 10 Zeichen)</label>
            <input type="password" required autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
          </div>
          <button className="btn secondary">Passwort ändern</button>
        </form>
      </div>
    </div>
  );
}
