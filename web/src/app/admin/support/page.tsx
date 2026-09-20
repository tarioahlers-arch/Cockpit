"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RequireAuth } from "@/components/RequireAuth";
import { AdminNav } from "@/components/AdminNav";
import { api, apiErrorMessage } from "@/lib/api";
import { formatDateTime, SUPPORT_STATUS_LABELS } from "@/lib/format";
import type { SupportStatus, SupportTicket } from "@/lib/types";
import { EmptyState, ErrorBox, Spinner } from "@/components/Ui";

const STATUSES: SupportStatus[] = ["OPEN", "IN_PROGRESS", "CLOSED"];

function AdminSupport() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin", "support-tickets"],
    queryFn: async () => {
      const res = await api.get<{ tickets: SupportTicket[] }>("/admin/support-tickets");
      return res.data.tickets;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: SupportStatus }) => {
      await api.patch(`/admin/support-tickets/${id}`, { status });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "support-tickets"] }),
  });

  return (
    <div className="container-page py-8">
      <h1 className="text-2xl font-bold mb-6">Admin</h1>
      <AdminNav />
      {isLoading && <Spinner />}
      {isError && <ErrorBox message={apiErrorMessage(error, "Fehler beim Laden.")} />}
      {data && data.length === 0 && <EmptyState title="Keine Support-Tickets" />}
      <div className="space-y-3">
        {data?.map((t) => (
          <div key={t.id} className="card p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="font-medium">{t.subject}</p>
                <p className="text-sm text-muted mt-1">{t.message}</p>
                <p className="text-xs text-muted mt-2">
                  {t.user?.firstName} {t.user?.lastName} ({t.user?.email}) ·{" "}
                  {formatDateTime(t.createdAt)}
                </p>
              </div>
              <select
                className="input text-sm w-auto"
                value={t.status}
                onChange={(e) =>
                  updateMutation.mutate({ id: t.id, status: e.target.value as SupportStatus })
                }
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {SUPPORT_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminSupportPage() {
  return (
    <RequireAuth adminOnly>
      <AdminSupport />
    </RequireAuth>
  );
}
