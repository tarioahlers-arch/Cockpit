"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RequireAuth } from "@/components/RequireAuth";
import { api } from "@/lib/api";
import { useNotifications } from "@/lib/hooks";
import { formatDateTime } from "@/lib/format";
import type { Notification } from "@/lib/types";
import { EmptyState, ErrorBox, Spinner } from "@/components/Ui";

const TYPE_ICONS: Record<string, string> = {
  NEW_APPLICATION: "📩",
  APPLICATION_ACCEPTED: "✅",
  TASK_INVITATION: "✉️",
  INVITATION_ACCEPTED: "🤝",
  TASK_COMPLETED: "🏁",
  PAYMENT_RECEIVED: "💶",
  NEW_REVIEW: "⭐",
  TASKER_ONBOARDED: "🛠️",
};

function NotificationsContent() {
  const { data, isLoading, isError, error } = useNotifications();
  const queryClient = useQueryClient();

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/notifications/${id}/read`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAll = useMutation({
    mutationFn: async () => {
      await api.post("/notifications/read-all");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return (
    <div className="container-page py-8 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Benachrichtigungen</h1>
        {data && data.unreadCount > 0 && (
          <button className="btn-ghost text-sm border border-border" onClick={() => markAll.mutate()}>
            Alle als gelesen markieren
          </button>
        )}
      </div>

      {isLoading && <Spinner />}
      {isError && <ErrorBox message={(error as Error)?.message || "Fehler beim Laden."} />}
      {!isLoading && data && data.notifications.length === 0 && (
        <EmptyState title="Keine Benachrichtigungen" subtitle="Hier siehst du zukünftige Updates." />
      )}

      <div className="space-y-2">
        {data?.notifications.map((n: Notification) => (
          <button
            key={n.id}
            onClick={() => !n.isRead && markRead.mutate(n.id)}
            className={`card p-4 flex items-start gap-3 text-left w-full ${
              !n.isRead ? "border-primary/40 bg-primary-light/40" : ""
            }`}
          >
            <span className="text-xl">{TYPE_ICONS[n.type] || "🔔"}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-sm">{n.title}</p>
                {!n.isRead && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
              </div>
              <p className="text-sm text-muted mt-0.5">{n.body}</p>
              <p className="text-xs text-muted mt-1">{formatDateTime(n.createdAt)}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <RequireAuth>
      <NotificationsContent />
    </RequireAuth>
  );
}
