"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RequireAuth } from "@/components/RequireAuth";
import { useCategories } from "@/lib/hooks";
import { api, apiErrorMessage } from "@/lib/api";
import { eurosToCents } from "@/lib/format";
import { GERMAN_CITIES } from "@/lib/types";
import { ErrorBox } from "@/components/Ui";

function NewTaskForm() {
  const router = useRouter();
  const { data: categories } = useCategories();
  const [form, setForm] = useState({
    title: "",
    description: "",
    categoryId: "",
    city: "",
    address: "",
    budget: "",
    scheduledAt: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.post("/tasks", {
        title: form.title,
        description: form.description,
        categoryId: form.categoryId,
        city: form.city,
        address: form.address || undefined,
        budgetCents: eurosToCents(form.budget),
        scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined,
      });
      router.push(`/tasks/${res.data.task.id}`);
    } catch (err) {
      setError(apiErrorMessage(err, "Aufgabe konnte nicht erstellt werden."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container-page py-10 max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">Neue Aufgabe erstellen</h1>
      <p className="text-muted text-sm mb-6">
        Beschreibe deine Aufgabe möglichst genau, damit Helfer gut einschätzen können, was zu
        tun ist.
      </p>
      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        {error && <ErrorBox message={error} />}
        <div>
          <label className="label" htmlFor="title">Titel</label>
          <input
            id="title"
            className="input"
            required
            placeholder="z.B. IKEA-Regal aufbauen"
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="description">Beschreibung</label>
          <textarea
            id="description"
            className="input"
            required
            rows={5}
            placeholder="Was genau soll erledigt werden?"
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="categoryId">Kategorie</label>
            <select
              id="categoryId"
              className="input"
              required
              value={form.categoryId}
              onChange={(e) => update("categoryId", e.target.value)}
            >
              <option value="">Bitte wählen</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="city">Stadt</label>
            <select
              id="city"
              className="input"
              required
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
        </div>
        <div>
          <label className="label" htmlFor="address">Adresse (optional)</label>
          <input
            id="address"
            className="input"
            placeholder="Straße, Hausnummer"
            value={form.address}
            onChange={(e) => update("address", e.target.value)}
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="budget">Budget (€)</label>
            <input
              id="budget"
              type="number"
              min={1}
              step="0.01"
              className="input"
              required
              placeholder="z.B. 60"
              value={form.budget}
              onChange={(e) => update("budget", e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="scheduledAt">Wunschtermin (optional)</label>
            <input
              id="scheduledAt"
              type="datetime-local"
              className="input"
              value={form.scheduledAt}
              onChange={(e) => update("scheduledAt", e.target.value)}
            />
          </div>
        </div>
        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? "Wird erstellt…" : "Aufgabe veröffentlichen"}
        </button>
      </form>
    </div>
  );
}

export default function NewTaskPage() {
  return (
    <RequireAuth>
      <NewTaskForm />
    </RequireAuth>
  );
}
