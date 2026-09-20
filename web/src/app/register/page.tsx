"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, apiErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { ErrorBox } from "@/components/Ui";
import { GERMAN_CITIES } from "@/lib/types";

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [form, setForm] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    phone: "",
    city: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devToken, setDevToken] = useState<string | null>(null);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.post("/auth/register", {
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone || undefined,
        city: form.city || undefined,
      });
      const { token, user, devVerificationToken } = res.data;
      login(token, user);
      if (devVerificationToken) {
        setDevToken(devVerificationToken);
      } else {
        router.push("/tasks");
      }
    } catch (err) {
      setError(apiErrorMessage(err, "Registrierung fehlgeschlagen."));
    } finally {
      setLoading(false);
    }
  }

  if (devToken) {
    return (
      <div className="container-page py-16 max-w-md">
        <div className="card p-6 text-center">
          <div className="text-3xl mb-2">📧</div>
          <h1 className="text-xl font-bold mb-2">Fast geschafft!</h1>
          <p className="text-sm text-muted mb-4">
            Wir haben (simuliert) eine Bestätigungs-E-Mail versendet. Da dies eine Demo ohne
            echten E-Mail-Versand ist, kannst du deine Adresse direkt hier bestätigen:
          </p>
          <Link
            href={`/verify-email?token=${devToken}`}
            className="btn-primary w-full mb-3"
          >
            E-Mail jetzt bestätigen
          </Link>
          <Link href="/tasks" className="btn-secondary w-full">
            Später bestätigen und fortfahren
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page py-12 max-w-md">
      <h1 className="text-2xl font-bold mb-1">Konto erstellen</h1>
      <p className="text-muted text-sm mb-6">
        Registriere dich kostenlos bei HalpingHand.
      </p>
      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        {error && <ErrorBox message={error} />}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="firstName">Vorname</label>
            <input
              id="firstName"
              className="input"
              required
              value={form.firstName}
              onChange={(e) => update("firstName", e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="lastName">Nachname</label>
            <input
              id="lastName"
              className="input"
              required
              value={form.lastName}
              onChange={(e) => update("lastName", e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="email">E-Mail</label>
          <input
            id="email"
            type="email"
            className="input"
            required
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="password">Passwort</label>
          <input
            id="password"
            type="password"
            className="input"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="phone">Telefon (optional)</label>
          <input
            id="phone"
            className="input"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="city">Stadt (optional)</label>
          <select
            id="city"
            className="input"
            value={form.city}
            onChange={(e) => update("city", e.target.value)}
          >
            <option value="">Bitte wählen</option>
            {GERMAN_CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? "Wird erstellt…" : "Registrieren"}
        </button>
        <p className="text-sm text-center text-muted">
          Schon ein Konto?{" "}
          <Link href="/login" className="text-primary-dark font-medium">
            Anmelden
          </Link>
        </p>
      </form>
    </div>
  );
}
