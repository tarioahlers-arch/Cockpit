"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { RequireAuth } from "@/components/RequireAuth";
import { api, apiErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatDateTime } from "@/lib/format";
import type { Conversation } from "@/lib/types";
import { Avatar } from "@/components/Avatar";
import { EmptyState, ErrorBox, Spinner } from "@/components/Ui";

function MessagesContent() {
  const { user } = useAuth();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const res = await api.get<{ conversations: Conversation[] }>("/conversations");
      return res.data.conversations;
    },
    refetchInterval: 15_000,
  });

  return (
    <div className="container-page py-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Nachrichten</h1>
      {isLoading && <Spinner />}
      {isError && <ErrorBox message={apiErrorMessage(error, "Fehler beim Laden.")} />}
      {!isLoading && data && data.length === 0 && (
        <EmptyState
          title="Keine Unterhaltungen"
          subtitle="Sobald du eine Bewerbung annimmst oder eine annimmst, entsteht hier ein Chat."
        />
      )}
      <div className="space-y-2">
        {data?.map((conv) => {
          const other = conv.customer?.id === user?.id ? conv.tasker : conv.customer;
          const lastMessage = conv.messages?.[0];
          return (
            <Link
              key={conv.id}
              href={`/messages/${conv.id}`}
              className="card p-4 flex items-center gap-3 hover:border-primary/40 transition-all"
            >
              <Avatar
                name={`${other?.firstName ?? ""} ${other?.lastName ?? ""}`}
                avatarUrl={other?.avatarUrl}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-sm truncate">
                    {other?.firstName} {other?.lastName}
                  </p>
                  {lastMessage && (
                    <span className="text-xs text-muted whitespace-nowrap">
                      {formatDateTime(lastMessage.createdAt)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted truncate">{conv.task?.title}</p>
                <p className="text-sm text-muted truncate mt-0.5">
                  {lastMessage?.text || (lastMessage?.attachmentUrl ? "📎 Anhang" : "Noch keine Nachrichten")}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <RequireAuth>
      <MessagesContent />
    </RequireAuth>
  );
}
