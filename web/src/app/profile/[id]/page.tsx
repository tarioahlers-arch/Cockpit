"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, apiErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatCents, formatDate } from "@/lib/format";
import type { Review, User } from "@/lib/types";
import { Avatar } from "@/components/Avatar";
import { StarDisplay } from "@/components/StarRating";
import { EmptyState, ErrorBox, Spinner } from "@/components/Ui";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

export default function PublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user: viewer } = useAuth();
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportMsg, setReportMsg] = useState<string | null>(null);

  const {
    data: profile,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["profile", id],
    queryFn: async () => {
      const res = await api.get<{ user: User }>(`/users/${id}`);
      return res.data.user;
    },
  });

  const { data: reviews } = useQuery({
    queryKey: ["reviews", id],
    queryFn: async () => {
      const res = await api.get<{ reviews: Review[] }>(`/users/${id}/reviews`);
      return res.data.reviews;
    },
  });

  const reportMutation = useMutation({
    mutationFn: async () => {
      await api.post("/reports", { reportedUserId: id, reason: reportReason });
    },
    onSuccess: () => {
      setReportMsg("Meldung wurde gesendet. Danke für deine Rückmeldung.");
      setReportReason("");
    },
    onError: (err) => setReportMsg(apiErrorMessage(err, "Meldung fehlgeschlagen.")),
  });

  if (isLoading) {
    return (
      <div className="container-page py-16">
        <Spinner />
      </div>
    );
  }
  if (isError || !profile) {
    return (
      <div className="container-page py-16">
        <ErrorBox message={apiErrorMessage(error, "Profil konnte nicht geladen werden.")} />
      </div>
    );
  }

  return (
    <div className="container-page py-8 max-w-2xl space-y-4">
      <div className="card p-6">
        <div className="flex items-start gap-4 flex-wrap">
          <Avatar name={`${profile.firstName} ${profile.lastName}`} avatarUrl={profile.avatarUrl} size={64} />
          <div className="flex-1 min-w-[180px]">
            <h1 className="text-xl font-bold">
              {profile.firstName} {profile.lastName}
            </h1>
            <div className="flex items-center gap-2 mt-1 text-sm text-muted flex-wrap">
              {profile.city && <span>📍 {profile.city}</span>}
              <StarDisplay value={profile.ratingAvg} count={profile.ratingCount} />
            </div>
            <p className="text-xs text-muted mt-1">Mitglied seit {formatDate(profile.createdAt)}</p>
            <p className="text-xs text-muted mt-1 break-all">ID: {profile.id}</p>
          </div>
        </div>
        {profile.bio && <p className="mt-4 text-sm leading-relaxed">{profile.bio}</p>}
        {profile.isTaskerOnboarded && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="badge bg-primary-light text-primary-dark">
              Helfer · {formatCents(profile.hourlyRate)}/Std.
            </span>
            {profile.skills?.map((s) => (
              <span key={s.id} className="badge bg-gray-100 text-gray-700">
                {s.name}
              </span>
            ))}
          </div>
        )}

        {viewer && viewer.id !== profile.id && (
          <div className="mt-4 pt-4 border-t border-border">
            {!reportOpen ? (
              <button className="text-xs text-red-600 hover:underline" onClick={() => setReportOpen(true)}>
                Nutzer melden
              </button>
            ) : (
              <div className="space-y-2">
                {reportMsg && <p className="text-xs text-muted">{reportMsg}</p>}
                <textarea
                  className="input text-sm"
                  rows={2}
                  placeholder="Grund der Meldung"
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                />
                <div className="flex gap-2">
                  <button
                    className="btn-primary text-xs"
                    disabled={!reportReason.trim() || reportMutation.isPending}
                    onClick={() => reportMutation.mutate()}
                  >
                    Melden
                  </button>
                  <button className="btn-ghost text-xs" onClick={() => setReportOpen(false)}>
                    Abbrechen
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card p-6">
        <h2 className="font-semibold mb-3">Bewertungen ({reviews?.length ?? 0})</h2>
        {!reviews || reviews.length === 0 ? (
          <EmptyState title="Noch keine Bewertungen" />
        ) : (
          <div className="space-y-4">
            {reviews.map((r) => (
              <div key={r.id} className="border-b border-border last:border-0 pb-3 last:pb-0">
                <div className="flex items-center justify-between">
                  <StarInputReadOnly rating={r.rating} />
                  <span className="text-xs text-muted">{formatDate(r.createdAt)}</span>
                </div>
                {r.comment && <p className="text-sm mt-1">{r.comment}</p>}
                <p className="text-xs text-muted mt-1">
                  {r.reviewer ? `${r.reviewer.firstName} ${r.reviewer.lastName}` : "Anonym"} ·{" "}
                  {r.task?.title}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StarInputReadOnly({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5 text-amber-500 text-sm">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i}>{i < rating ? "★" : "☆"}</span>
      ))}
    </div>
  );
}
