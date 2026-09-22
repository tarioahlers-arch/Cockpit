import { useState } from 'react';
import { api } from '../api';

export default function Login({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ email: '', password: '', name: '', organization: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'login') await api.login(form.email, form.password);
      else await api.register(form);
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const field = (key: keyof typeof form, label: string, type = 'text', auto?: string) => (
    <div className="form-field">
      <label>{label}</label>
      <input required type={type} autoComplete={auto} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
    </div>
  );

  return (
    <div className="panel" style={{ maxWidth: 440, margin: '40px auto' }}>
      <div className="tabs" style={{ marginBottom: 16 }}>
        <button className={`tab-link ${mode === 'login' ? 'active' : ''}`} style={{ background: 'none', cursor: 'pointer' }} onClick={() => setMode('login')}>
          Anmelden
        </button>
        <button className={`tab-link ${mode === 'register' ? 'active' : ''}`} style={{ background: 'none', cursor: 'pointer' }} onClick={() => setMode('register')}>
          Konto erstellen
        </button>
      </div>
      {error && <div className="error-banner">{error}</div>}
      <form onSubmit={submit}>
        {mode === 'register' && field('organization', 'Unternehmen', 'text', 'organization')}
        {mode === 'register' && field('name', 'Ihr Name', 'text', 'name')}
        {field('email', 'E-Mail', 'email', 'username')}
        {field('password', 'Passwort', 'password', mode === 'login' ? 'current-password' : 'new-password')}
        {mode === 'register' && <p className="muted small" style={{ marginTop: -4 }}>Mindestens 10 Zeichen.</p>}
        <button className="btn" disabled={busy} style={{ width: '100%', justifyContent: 'center' }}>
          {mode === 'login' ? 'Anmelden' : 'Konto erstellen'}
        </button>
      </form>
      <p className="muted small" style={{ marginBottom: 0 }}>
        Jede Organisation sieht ausschließlich ihre eigenen Shops und Daten.
      </p>
    </div>
  );
}
