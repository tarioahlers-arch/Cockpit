import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, ROLE_LABEL, type Me } from '../api';

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel" style={{ maxWidth: 440, margin: '40px auto' }}>
      <p className="section-title" style={{ marginBottom: 14 }}>
        {title}
      </p>
      {children}
    </div>
  );
}

/** /einladung?token=… – Konto in einer bestehenden Organisation anlegen */
export function AcceptInvitation({ onDone }: { onDone: () => void }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';
  const [info, setInfo] = useState<{ email: string; role: Me['role']; orgName: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', password: '' });

  useEffect(() => {
    api.invitationInfo(token).then(setInfo).catch((e) => setError(e.message));
  }, [token]);

  return (
    <Card title="Einladung annehmen">
      {error && <div className="error-banner">{error}</div>}
      {info && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api.acceptInvitation(token, form.name, form.password);
              navigate('/', { replace: true });
              onDone();
            } catch (err) {
              setError((err as Error).message);
            }
          }}
        >
          <p className="muted small" style={{ marginTop: 0 }}>
            Sie wurden zu <strong>{info.orgName}</strong> eingeladen (Rolle: {ROLE_LABEL[info.role]}). Konto für{' '}
            <strong>{info.email}</strong> anlegen:
          </p>
          <div className="form-field">
            <label>Ihr Name</label>
            <input required autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="form-field">
            <label>Passwort (mind. 10 Zeichen)</label>
            <input required type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <button className="btn" style={{ width: '100%', justifyContent: 'center' }}>
            Konto anlegen
          </button>
        </form>
      )}
    </Card>
  );
}

/** /passwort-zuruecksetzen?token=… */
export function ResetPassword({ onDone }: { onDone: () => void }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <Card title="Neues Passwort festlegen">
      {error && <div className="error-banner">{error}</div>}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await api.resetPassword(params.get('token') ?? '', password);
            navigate('/', { replace: true });
            onDone();
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      >
        <div className="form-field">
          <label>Neues Passwort (mind. 10 Zeichen)</label>
          <input required type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <p className="muted small">Aus Sicherheitsgründen werden danach alle bestehenden Sitzungen abgemeldet.</p>
        <button className="btn" style={{ width: '100%', justifyContent: 'center' }}>
          Passwort speichern
        </button>
      </form>
    </Card>
  );
}

/** Link "Passwort vergessen?" auf der Anmeldeseite */
export function ForgotPassword({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div>
      {message ? (
        <div className="info-banner">{message}</div>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await api.forgotPassword(email).catch((err) => ({ message: (err as Error).message }));
            setMessage(r.message);
          }}
        >
          <div className="form-field">
            <label>E-Mail</label>
            <input required type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <button className="btn" style={{ width: '100%', justifyContent: 'center' }}>
            Link zum Zurücksetzen senden
          </button>
        </form>
      )}
      <p className="small" style={{ marginBottom: 0 }}>
        <a href="#" onClick={(e) => { e.preventDefault(); onBack(); }}>
          Zurück zur Anmeldung
        </a>
      </p>
    </div>
  );
}
