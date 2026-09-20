"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useCategories } from "@/lib/hooks";
import { GERMAN_CITIES, type Task } from "@/lib/types";
import { TaskCard } from "@/components/TaskCard";
import { EmptyState, ErrorBox, Spinner } from "@/components/Ui";

const PAGE_SIZE = 12;

function TasksBrowse() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: categories } = useCategories();

  const [q, setQ] = useState(searchParams.get("q") || "");
  const [categoryId, setCategoryId] = useState(searchParams.get("categoryId") || "");
  const [city, setCity] = useState(searchParams.get("city") || "");
  const [minBudget, setMinBudget] = useState("");
  const [maxBudget, setMaxBudget] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["tasks", "browse", q, categoryId, city, minBudget, maxBudget, page],
    queryFn: async () => {
      const params: Record<string, string | number> = {
        page,
        pageSize: PAGE_SIZE,
        status: "POSTED",
      };
      if (q) params.q = q;
      if (categoryId) params.categoryId = categoryId;
      if (city) params.city = city;
      if (minBudget) params.minBudget = String(Math.round(parseFloat(minBudget) * 100));
      if (maxBudget) params.maxBudget = String(Math.round(parseFloat(maxBudget) * 100));
      const res = await api.get<{ tasks: Task[]; total: number; page: number; pageSize: number }>(
        "/tasks",
        { params }
      );
      return res.data;
    },
  });

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (categoryId) params.set("categoryId", categoryId);
    if (city) params.set("city", city);
    router.replace(`/tasks?${params.toString()}`);
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="container-page py-8">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">Aufgaben durchsuchen</h1>
        <Link href="/tasks/new" className="btn-primary text-sm">
          + Aufgabe erstellen
        </Link>
      </div>

      <form onSubmit={applyFilters} className="card p-4 mb-6 grid sm:grid-cols-5 gap-3">
        <input
          className="input sm:col-span-2"
          placeholder="Suche…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="input"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">Alle Kategorien</option>
          {categories?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select className="input" value={city} onChange={(e) => setCity(e.target.value)}>
          <option value="">Alle Städte</option>
          {GERMAN_CITIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-primary">
          Filtern
        </button>
        <input
          className="input"
          placeholder="Budget von (€)"
          type="number"
          min={0}
          value={minBudget}
          onChange={(e) => setMinBudget(e.target.value)}
        />
        <input
          className="input"
          placeholder="Budget bis (€)"
          type="number"
          min={0}
          value={maxBudget}
          onChange={(e) => setMaxBudget(e.target.value)}
        />
      </form>

      {isLoading && <Spinner />}
      {isError && <ErrorBox message={(error as Error)?.message || "Fehler beim Laden."} />}
      {!isLoading && data && data.tasks.length === 0 && (
        <EmptyState
          title="Keine Aufgaben gefunden"
          subtitle="Passe deine Filter an oder erstelle selbst eine Aufgabe."
        />
      )}

      {!isLoading && data && data.tasks.length > 0 && (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.tasks.map((t) => (
              <TaskCard key={t.id} task={t} />
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-8">
              <button
                className="btn-secondary text-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Zurück
              </button>
              <span className="text-sm text-muted">
                Seite {page} von {totalPages}
              </span>
              <button
                className="btn-secondary text-sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Weiter
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function TasksPage() {
  return (
    <Suspense>
      <TasksBrowse />
    </Suspense>
  );
}
