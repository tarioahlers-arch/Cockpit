"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RequireAuth } from "@/components/RequireAuth";
import { AdminNav } from "@/components/AdminNav";
import { api, apiErrorMessage } from "@/lib/api";
import type { User } from "@/lib/types";
import { ErrorBox, Spinner } from "@/components/Ui";

function AdminUsers() {
  const [q, setQ] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin", "users", q],
    queryFn: async () => {
      const res = await api.get<{ users: User[] }>("/admin/users", { params: q ? { q } : {} });
      return res.data.users;
    },
  });

  const blockMutation = useMutation({
    mutationFn: async ({ id, isBlocked }: { id: string; isBlocked: boolean }) => {
      await api.patch(`/admin/users/${id}/block`, { isBlocked });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
  });

  return (
    <div className="container-page py-8">
      <h1 className="text-2xl font-bold mb-6">Admin</h1>
      <AdminNav />
      <input
        className="input max-w-sm mb-4"
        placeholder="Suche nach Name oder E-Mail…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {isLoading && <Spinner />}
      {isError && <ErrorBox message={apiErrorMessage(error, "Fehler beim Laden.")} />}
      {data && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-primary-light/60 text-left">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">E-Mail</th>
                <th className="p-3">Stadt</th>
                <th className="p-3">Rollen</th>
                <th className="p-3">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {data.map((u) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="p-3 whitespace-nowrap">
                    {u.firstName} {u.lastName}
                  </td>
                  <td className="p-3">{u.email}</td>
                  <td className="p-3">{u.city || "–"}</td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      {u.isAdmin && <span className="badge bg-purple-100 text-purple-700">Admin</span>}
                      {u.isTaskerOnboarded && (
                        <span className="badge bg-blue-100 text-blue-700">Helfer</span>
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    {u.isBlocked ? (
                      <span className="badge bg-red-100 text-red-700">Blockiert</span>
                    ) : (
                      <span className="badge bg-green-100 text-green-700">Aktiv</span>
                    )}
                  </td>
                  <td className="p-3">
                    <button
                      className="btn-ghost text-xs border border-border"
                      disabled={blockMutation.isPending}
                      onClick={() => blockMutation.mutate({ id: u.id, isBlocked: !u.isBlocked })}
                    >
                      {u.isBlocked ? "Entsperren" : "Sperren"}
                    </button>
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

export default function AdminUsersPage() {
  return (
    <RequireAuth adminOnly>
      <AdminUsers />
    </RequireAuth>
  );
}
