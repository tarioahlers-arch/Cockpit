"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { RequireAuth } from "@/components/RequireAuth";
import { AdminNav } from "@/components/AdminNav";
import { api, apiErrorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { Report } from "@/lib/types";
import { EmptyState, ErrorBox, Spinner } from "@/components/Ui";

function AdminReports() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin", "reports"],
    queryFn: async () => {
      const res = await api.get<{ reports: Report[] }>("/admin/reports");
      return res.data.reports;
    },
  });

  return (
    <div className="container-page py-8">
      <h1 className="text-2xl font-bold mb-6">Admin</h1>
      <AdminNav />
      {isLoading && <Spinner />}
      {isError && <ErrorBox message={apiErrorMessage(error, "Fehler beim Laden.")} />}
      {data && data.length === 0 && <EmptyState title="Keine Meldungen" />}
      <div className="space-y-3">
        {data?.map((r) => (
          <div key={r.id} className="card p-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-sm">
                <Link href={`/profile/${r.reportedUser?.id}`} className="font-medium hover:underline">
                  {r.reportedUser?.firstName} {r.reportedUser?.lastName}
                </Link>{" "}
                wurde gemeldet von{" "}
                <Link href={`/profile/${r.reporter?.id}`} className="font-medium hover:underline">
                  {r.reporter?.firstName} {r.reporter?.lastName}
                </Link>
              </p>
              {r.reportedUser?.isBlocked && (
                <span className="badge bg-red-100 text-red-700">Blockiert</span>
              )}
            </div>
            <p className="text-sm text-muted mt-2">{r.reason}</p>
            <p className="text-xs text-muted mt-2">{formatDateTime(r.createdAt)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminReportsPage() {
  return (
    <RequireAuth adminOnly>
      <AdminReports />
    </RequireAuth>
  );
}
