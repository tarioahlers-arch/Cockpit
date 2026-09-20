"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { RequireAuth } from "@/components/RequireAuth";
import { AdminNav } from "@/components/AdminNav";
import { api, apiErrorMessage } from "@/lib/api";
import { formatCents } from "@/lib/format";
import type { Task, TaskStatus } from "@/lib/types";
import { EmptyState, ErrorBox, Spinner, TaskStatusBadge } from "@/components/Ui";

const STATUSES: TaskStatus[] = ["POSTED", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

function AdminTasks() {
  const [status, setStatus] = useState<string>("");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin", "tasks", status],
    queryFn: async () => {
      const res = await api.get<{ tasks: Task[] }>("/admin/tasks", {
        params: status ? { status } : {},
      });
      return res.data.tasks;
    },
  });

  return (
    <div className="container-page py-8">
      <h1 className="text-2xl font-bold mb-6">Admin</h1>
      <AdminNav />
      <select className="input max-w-xs mb-4" value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="">Alle Status</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      {isLoading && <Spinner />}
      {isError && <ErrorBox message={apiErrorMessage(error, "Fehler beim Laden.")} />}
      {data && data.length === 0 && <EmptyState title="Keine Aufgaben gefunden" />}
      {data && data.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-primary-light/60 text-left">
              <tr>
                <th className="p-3">Titel</th>
                <th className="p-3">Kategorie</th>
                <th className="p-3">Ersteller</th>
                <th className="p-3">Budget</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map((t) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="p-3">
                    <Link href={`/tasks/${t.id}`} className="hover:underline font-medium">
                      {t.title}
                    </Link>
                  </td>
                  <td className="p-3">{t.category?.name}</td>
                  <td className="p-3">
                    {t.poster?.firstName} {t.poster?.lastName}
                  </td>
                  <td className="p-3">{formatCents(t.budgetCents)}</td>
                  <td className="p-3">
                    <TaskStatusBadge status={t.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AdminTasksPage() {
  return (
    <RequireAuth adminOnly>
      <AdminTasks />
    </RequireAuth>
  );
}
