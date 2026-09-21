"use client";

import { useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth-context";
import { useCategories } from "@/lib/hooks";
import { api, apiErrorMessage } from "@/lib/api";
import { formatCents } from "@/lib/format";
import { GERMAN_CITIES } from "@/lib/types";
import { Avatar } from "@/components/Avatar";
import { ErrorBox } from "@/components/Ui";

function ProfileContent() {
  const { user, updateUser } = useAuth();
  const { data: categories } = useCategories();

  const [form, setForm] = useState({
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    phone: user?.phone ?? "",
    city: user?.city ?? "",
    bio: user?.bio ?? "",
    avatarUrl: user?.avatarUrl ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [onboard, setOnboard] = useState({
    hourlyRate: user?.hourlyRate ? String(user.hourlyRate / 100) : "",
    radiusKm: user?.radiusKm ? String(user.radiusKm) : "10",
    categoryIds: [] as string[],
  });
  const [onboardLoading, setOnboardLoading] = useState(false);
  const [onboardError, setOnboardError] = useState<string | null>(null);
  const [onboardSuccess, setOnboardSuccess] = useState(false);

  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeMsg, setStripeMsg] = useState<string | null>(null);

  if (!user) return null;

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaveMsg(null);
    try {
      const res = await api.patch("/users/me", {
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone || undefined,
        city: form.city || undefined,
        bio: form.bio || undefined,
        avatarUrl: form.avatarUrl || undefined,
      });
      updateUser(res.data.user);
      setSaveMsg("Profil gespeichert.");
    } catch (err) {
      setError(apiErrorMessage(err, "Speichern fehlgeschlagen."));
    } finally {
      setSaving(false);
    }
  }

  function toggleCategory(id: string) {
    setOnboard((o) => ({
      ...o,
      categoryIds: o.categoryIds.includes(id)
        ? o.categoryIds.filter((c) => c !== id)
        : [...o.categoryIds, id],
    }));
  }

  async function handleOnboard(e: React.FormEvent) {
    e.preventDefault();
    setOnboardLoading(true);
    setOnboardError(null);
    try {
      const res = await api.post("/users/me/tasker-onboarding", {
        hourlyRate: Math.round(parseFloat(onboard.hourlyRate || "0") * 100),
        radiusKm: parseInt(onboard.radiusKm || "0", 10),
        categoryIds: onboard.categoryIds,
      });
      updateUser(res.data.user);
      setOnboardSuccess(true);
    } catch (err) {
      setOnboardError(apiErrorMessage(err, "Aktivierung fehlgeschlagen."));
    } finally {
      setOnboardLoading(false);
    }
  }

  async function handleStripeConnect() {
    setStripeLoading(true);
    setStripeMsg(null);
    try {
      const res = await api.post("/users/me/stripe-connect");
      updateUser(res.data.user);
      setStripeMsg("Stripe Connect (Testmodus) erfolgreich verbunden.");
    } catch (err) {
      setStripeMsg(apiErrorMessage(err, "Verbindung fehlgeschlagen."));
    } finally {
      setStripeLoading(false);
    }
  }

  return (
    <div className="container-page py-8 max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Mein Profil</h1>

      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <Avatar name={`${user.firstName} ${user.lastName}`} avatarUrl={form.avatarUrl} size={56} />
          <div>
            <p className="font-semibold">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-sm text-muted">{user.email}</p>
          </div>
        </div>
        <form onSubmit={handleSave} className="space-y-4">
          {error && <ErrorBox message={error} />}
          {saveMsg && <p className="text-sm text-green-700">{saveMsg}</p>}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="firstName">Vorname</label>
              <input
                id="firstName"
                className="input"
                value={form.firstName}
                onChange={(e) => update("firstName", e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="lastName">Nachname</label>
              <input
                id="lastName"
                className="input"
                value={form.lastName}
                onChange={(e) => update("lastName", e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="phone">Telefon</label>
            <input id="phone" className="input" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="city">Stadt</label>
            <select id="city" className="input" value={form.city} onChange={(e) => update("city", e.target.value)}>
              <option value="">Bitte wählen</option>
              {GERMAN_CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="bio">Über mich</label>
            <textarea id="bio" className="input" rows={3} value={form.bio} onChange={(e) => update("bio", e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="avatarUrl">Avatar-URL</label>
            <input
              id="avatarUrl"
              className="input"
              placeholder="https://…"
              value={form.avatarUrl}
              onChange={(e) => update("avatarUrl", e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Speichert…" : "Speichern"}
          </button>
        </form>
      </div>

      {!user.isTaskerOnboarded ? (
        <div className="card p-6">
          <h2 className="font-semibold mb-1">Werde Helfer</h2>
          <p className="text-sm text-muted mb-4">
            Biete deine Hilfe an und verdiene Geld mit Aufgaben in deiner Nähe.
          </p>
          {onboardSuccess ? (
            <p className="text-sm text-green-700">
              🎉 Dein Helfer-Profil ist jetzt aktiv! Du kannst ab sofort Aufgaben annehmen.
            </p>
          ) : (
            <form onSubmit={handleOnboard} className="space-y-4">
              {onboardError && <ErrorBox message={onboardError} />}
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="hourlyRate">Stundensatz (€)</label>
                  <input
                    id="hourlyRate"
                    type="number"
                    min={1}
                    step="0.01"
                    className="input"
                    required
                    value={onboard.hourlyRate}
                    onChange={(e) => setOnboard((o) => ({ ...o, hourlyRate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="radiusKm">Umkreis (km)</label>
                  <input
                    id="radiusKm"
                    type="number"
                    min={1}
                    className="input"
                    required
                    value={onboard.radiusKm}
                    onChange={(e) => setOnboard((o) => ({ ...o, radiusKm: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="label">Kategorien</label>
                <div className="flex flex-wrap gap-2">
                  {categories?.map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => toggleCategory(c.id)}
                      className={`badge border text-xs ${
                        onboard.categoryIds.includes(c.id)
                          ? "bg-primary text-white border-primary"
                          : "border-border text-muted"
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="submit"
                className="btn-primary"
                disabled={onboardLoading || onboard.categoryIds.length === 0}
              >
                {onboardLoading ? "Wird aktiviert…" : "Helfer-Profil aktivieren"}
              </button>
            </form>
          )}
        </div>
      ) : (
        <div className="card p-6">
          <h2 className="font-semibold mb-1">Dein Helfer-Profil</h2>
          <p className="text-sm text-muted">
            Stundensatz: {formatCents(user.hourlyRate)} · Umkreis: {user.radiusKm} km
          </p>
        </div>
      )}

      {user.isTaskerOnboarded && (
        <div className="card p-6">
          <h2 className="font-semibold mb-1">Stripe Connect (Testmodus)</h2>
          <p className="text-sm text-muted mb-3">
            Verbinde dein Konto, um Auszahlungen für erledigte Aufgaben zu erhalten.
          </p>
          {stripeMsg && <p className="text-sm mb-2 text-green-700">{stripeMsg}</p>}
          <button className="btn-secondary" onClick={handleStripeConnect} disabled={stripeLoading}>
            {stripeLoading ? "Verbinde…" : "Stripe Connect verbinden"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  return (
    <RequireAuth>
      <ProfileContent />
    </RequireAuth>
  );
}
