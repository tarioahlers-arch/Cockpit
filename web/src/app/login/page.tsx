"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { api, apiErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { ErrorBox } from "@/components/Ui";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.post("/auth/login", { email, password });
      login(res.data.token, res.data.user);
      const redirect = searchParams.get("redirect");
      router.push(redirect || "/tasks");
    } catch (err) {
      setError(apiErrorMessage(err, "Anmeldung fehlgeschlagen."));
    } finally {
      setLoading(false);
    }
  }

  function fillDemo(role: "admin" | "kunde" | "helfer1" | "helfer2") {
    setEmail(`${role}@halpinghand.de`);
    setPassword("Passwort123!");
  }

  return (
    <div className="container-page py-12 max-w-md">
      <h1 className="text-2xl font-bold mb-1">Anmelden</h1>
      <p className="text-muted text-sm mb-6">Willkommen zurück bei HalpingHand.</p>
      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        {error && <ErrorBox message={error} />}
        <div>
          <label className="label" htmlFor="email">E-Mail</label>
          <input
            id="email"
            type="email"
            className="input"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="password">Passwort</label>
          <input
            id="password"
            type="password"
            className="input"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? "Anmelden…" : "Anmelden"}
        </button>
        <p className="text-sm text-center text-muted">
          Noch kein Konto?{" "}
          <Link href="/register" className="text-primary-dark font-medium">
            Registrieren
          </Link>
        </p>
      </form>

      <div className="card p-4 mt-4">
        <p className="text-xs font-semibold text-muted mb-2">Demo-Zugänge (Passwort: Passwort123!)</p>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost text-xs border border-border" onClick={() => fillDemo("admin")}>
            Admin
          </button>
          <button className="btn-ghost text-xs border border-border" onClick={() => fillDemo("kunde")}>
            Kunde
          </button>
          <button className="btn-ghost text-xs border border-border" onClick={() => fillDemo("helfer1")}>
            Helfer 1
          </button>
          <button className="btn-ghost text-xs border border-border" onClick={() => fillDemo("helfer2")}>
            Helfer 2
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
