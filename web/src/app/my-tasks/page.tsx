"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RequireAuth } from "@/components/RequireAuth";
import { api, apiErrorMessage } from "@/lib/api";
import { formatCents } from "@/lib/format";
import type { Application, Invitation, Task } from "@/lib/types";
import { TaskCard } from "@/components/TaskCard";
import { EmptyState, ErrorBox, Spinner, TaskStatusBadge } from "@/components/Ui";

type TabKey = "posted" | "in_progress" | "invites" | "applications" | "completed";

const TABS: { key: TabKey; label: string }[] = [
  { key: "posted", label: "Gepostet" },
  { key: "in_progress", label: "In Bearbeitung" },
  { key: "invites", label: "Einladungen" },
  { key: "applications", label: "Bewerbungen" },
  { key: "completed", label: "Abgeschlossen" },
];

function MyTasksContent() {
  const [tab, setTab] = useState<TabKey>("posted");
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["my-tasks", tab],
    queryFn: async () => {
      const res = await api.get(`/tasks/mine`, { params: { type: tab } });
      return res.data as { tasks?: Task[]; invitations?: Invitation[]; applications?: Application[] };
    },
  });

  const respondMutation = useMutation({
    mutationFn: async ({ taskId, invId, accept }: { taskId: string; invId: string; accept: boolean }) => {
      await api.post(`/tasks/${taskId}/invitations/${invId}/respond`, { accept });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
    },
  });

  return (
    <div className="container-page py-8">
      <h1 className="text-2xl font-bold mb-6">Meine Aufgaben</h1>

      <div className="flex gap-1 border-b border-border mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px ${
              tab === t.key
                ? "border-primary text-primary-dark"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading && <Spinner />}
      {isError && <ErrorBox message={apiErrorMessage(error, "Fehler beim Laden.")} />}

      {!isLoading && !isError && (
        <>
          {tab === "posted" && (
            <TaskGrid tasks={data?.tasks} emptyText="Du hast noch keine Aufgaben erstellt." />
          )}
          {tab === "in_progress" && (
            <TaskGrid tasks={data?.tasks} emptyText="Keine Aufgaben in Bearbeitung." />
          )}
          {tab === "completed" && (
            <TaskGrid tasks={data?.tasks} emptyText="Noch keine abgeschlossenen Aufgaben." />
          )}
          {tab === "invites" && (
            <>
              {(!data?.invitations || data.invitations.length === 0) && (
                <EmptyState title="Keine Einladungen" subtitle="Du wurdest zu keiner Aufgabe eingeladen." />
              )}
              <div className="space-y-3">
                {data?.invitations?.map((inv) => (
                  <div key={inv.id} className="card p-4 flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <Link href={`/tasks/${inv.taskId}`} className="font-medium hover:underline">
                        {inv.task?.title}
                      </Link>
                      <p className="text-sm text-muted">
                        {inv.task?.city} · {formatCents(inv.task?.budgetCents)}
                      </p>
                    </div>
                    {inv.status === "PENDING" ? (
                      <div className="flex gap-2">
                        <button
                          className="btn-primary text-xs"
                          disabled={respondMutation.isPending}
                          onClick={() =>
                            respondMutation.mutate({ taskId: inv.taskId, invId: inv.id, accept: true })
                          }
                        >
                          Annehmen
                        </button>
                        <button
                          className="btn-ghost text-xs border border-border"
                          disabled={respondMutation.isPending}
                          onClick={() =>
                            respondMutation.mutate({ taskId: inv.taskId, invId: inv.id, accept: false })
                          }
                        >
                          Ablehnen
                        </button>
                      </div>
                    ) : (
                      <span className="badge bg-gray-100 text-gray-600">{inv.status}</span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
          {tab === "applications" && (
            <>
              {(!data?.applications || data.applications.length === 0) && (
                <EmptyState title="Keine Bewerbungen" subtitle="Du hast dich noch auf keine Aufgabe beworben." />
              )}
              <div className="space-y-3">
                {data?.applications?.map((app) => (
                  <div key={app.id} className="card p-4 flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <Link href={`/tasks/${app.taskId}`} className="font-medium hover:underline">
                        {app.task?.title}
                      </Link>
                      <p className="text-sm text-muted">
                        {app.task?.city} · {formatCents(app.task?.budgetCents)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {app.task && <TaskStatusBadge status={app.task.status} />}
                      <span
                        className={`badge text-xs ${
                          app.status === "ACCEPTED"
                            ? "bg-green-100 text-green-700"
                            : app.status === "DECLINED"
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {app.status === "ACCEPTED"
                          ? "Angenommen"
                          : app.status === "DECLINED"
                          ? "Abgelehnt"
                          : "Ausstehend"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function TaskGrid({ tasks, emptyText }: { tasks?: Task[]; emptyText: string }) {
  if (!tasks || tasks.length === 0) {
    return <EmptyState title="Nichts zu sehen" subtitle={emptyText} />;
  }
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {tasks.map((t) => (
        <TaskCard key={t.id} task={t} />
      ))}
    </div>
  );
}

export default function MyTasksPage() {
  return (
    <RequireAuth>
      <MyTasksContent />
    </RequireAuth>
  );
}
