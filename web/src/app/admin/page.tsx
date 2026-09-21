"use client";

import { useQuery } from "@tanstack/react-query";
import { RequireAuth } from "@/components/RequireAuth";
import { AdminNav } from "@/components/AdminNav";
import { api, apiErrorMessage } from "@/lib/api";
import { ErrorBox, Spinner } from "@/components/Ui";

interface Stats {
  totalJobs: number;
  completedTasks: number;
  tasksInProgress: number;
  totalUsers: number;
  openTickets: number;
}

const CARDS: { key: keyof Stats; label: string; icon: string }[] = [
  { key: "totalJobs", label: "Aufgaben gesamt", icon: "📋" },
  { key: "completedTasks", label: "Abgeschlossen", icon: "✅" },
  { key: "tasksInProgress", label: "In Bearbeitung", icon: "⚙️" },
  { key: "totalUsers", label: "Nutzer", icon: "👥" },
  { key: "openTickets", label: "Offene Tickets", icon: "🎫" },
];

function AdminDashboard() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: async () => {
      const res = await api.get<Stats>("/admin/stats");
      return res.data;
    },
  });

  return (
    <div className="container-page py-8">
      <h1 className="text-2xl font-bold mb-6">Admin-Übersicht</h1>
      <AdminNav />
      {isLoading && <Spinner />}
      {isError && <ErrorBox message={apiErrorMessage(error, "Fehler beim Laden.")} />}
      {data && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {CARDS.map((c) => (
            <div key={c.key} className="card p-5">
              <div className="text-2xl mb-1">{c.icon}</div>
              <p className="text-2xl font-bold">{data[c.key]}</p>
              <p className="text-sm text-muted">{c.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  return (
    <RequireAuth adminOnly>
      <AdminDashboard />
    </RequireAuth>
  );
}
