"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatCents, formatDateTime } from "@/lib/format";
import type { Application, Task } from "@/lib/types";
import { StatusStepper } from "@/components/StatusStepper";
import { TaskStatusBadge, ErrorBox, Spinner, EmptyState } from "@/components/Ui";
import { Avatar } from "@/components/Avatar";
import { StarDisplay, StarInput } from "@/components/StarRating";

export default function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    data: task,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["task", id],
    queryFn: async () => {
      const res = await api.get<{ task: Task }>(`/tasks/${id}`);
      return res.data.task;
    },
  });

  const [applyMessage, setApplyMessage] = useState("");
  const [proposedPrice, setProposedPrice] = useState("");
  const [applyError, setApplyError] = useState<string | null>(null);
  const [inviteTaskerId, setInviteTaskerId] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [paymentClientSecret, setPaymentClientSecret] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewAnonymous, setReviewAnonymous] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [payoutInfo, setPayoutInfo] = useState<string | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["task", id] });
  }

  const applyMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/tasks/${id}/apply`, {
        message: applyMessage || undefined,
        proposedCents: proposedPrice ? Math.round(parseFloat(proposedPrice) * 100) : undefined,
      });
    },
    onSuccess: () => {
      setApplyMessage("");
      setProposedPrice("");
      setApplyError(null);
      invalidate();
    },
    onError: (err) => setApplyError(apiErrorMessage(err, "Bewerbung fehlgeschlagen.")),
  });

  const acceptMutation = useMutation({
    mutationFn: async (appId: string) => {
      await api.post(`/tasks/${id}/applications/${appId}/accept`);
    },
    onSuccess: () => {
      setActionError(null);
      invalidate();
    },
    onError: (err) => setActionError(apiErrorMessage(err, "Annehmen fehlgeschlagen.")),
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/tasks/${id}/invite`, { taskerId: inviteTaskerId.trim() });
    },
    onSuccess: () => {
      setInviteError(null);
      setInviteSuccess("Einladung wurde verschickt.");
      setInviteTaskerId("");
      invalidate();
    },
    onError: (err) => {
      setInviteSuccess(null);
      setInviteError(apiErrorMessage(err, "Einladung fehlgeschlagen."));
    },
  });

  const startMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/tasks/${id}/start`);
    },
    onSuccess: invalidate,
    onError: (err) => setActionError(apiErrorMessage(err, "Aktion fehlgeschlagen.")),
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/tasks/${id}/complete`);
    },
    onSuccess: invalidate,
    onError: (err) => setActionError(apiErrorMessage(err, "Aktion fehlgeschlagen.")),
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/tasks/${id}/cancel`);
    },
    onSuccess: invalidate,
    onError: (err) => setActionError(apiErrorMessage(err, "Aktion fehlgeschlagen.")),
  });

  const createIntentMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/payments/tasks/${id}/create-intent`);
      return res.data as { payment: { id: string }; clientSecret: string; testMode: boolean };
    },
    onSuccess: (data) => {
      setPaymentId(data.payment.id);
      setPaymentClientSecret(data.clientSecret);
      setActionError(null);
    },
    onError: (err) => setActionError(apiErrorMessage(err, "Zahlung konnte nicht gestartet werden.")),
  });

  const confirmPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!paymentId) throw new Error("Keine Zahlung gestartet");
      await api.post(`/payments/${paymentId}/confirm`);
    },
    onSuccess: () => {
      setPaymentConfirmed(true);
      setPaymentClientSecret(null);
      invalidate();
    },
    onError: (err) => setActionError(apiErrorMessage(err, "Zahlung konnte nicht bestätigt werden.")),
  });

  const reviewMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/tasks/${id}/review`, {
        rating: reviewRating,
        comment: reviewComment || undefined,
        isAnonymous: reviewAnonymous,
      });
    },
    onSuccess: () => {
      setReviewSubmitted(true);
      setActionError(null);
    },
    onError: (err) => setActionError(apiErrorMessage(err, "Bewertung fehlgeschlagen.")),
  });

  const payoutMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/payments/payout`, { taskId: id });
      return res.data as { payoutCents: number };
    },
    onSuccess: (data) => {
      setPayoutInfo(`Auszahlung von ${formatCents(data.payoutCents)} wurde angefordert.`);
      setActionError(null);
    },
    onError: (err) => setActionError(apiErrorMessage(err, "Auszahlung fehlgeschlagen.")),
  });

  async function openChat() {
    try {
      const res = await api.get("/conversations");
      const conv = res.data.conversations.find((c: { taskId: string }) => c.taskId === id);
      if (conv) {
        router.push(`/messages/${conv.id}`);
      } else {
        router.push("/messages");
      }
    } catch {
      router.push("/messages");
    }
  }

  if (isLoading) {
    return (
      <div className="container-page py-16">
        <Spinner />
      </div>
    );
  }

  if (isError || !task) {
    return (
      <div className="container-page py-16">
        <ErrorBox message={apiErrorMessage(error, "Aufgabe konnte nicht geladen werden.")} />
      </div>
    );
  }

  const isPoster = user?.id === task.posterId;
  const isAssignedTasker = user?.id === task.assignedTaskerId;
  const hasApplied = task.applications?.some((a) => a.taskerId === user?.id);
  const pendingApplications = task.applications?.filter((a) => a.status === "PENDING") ?? [];
  const otherApplications = task.applications?.filter((a) => a.status !== "PENDING") ?? [];

  return (
    <div className="container-page py-8 max-w-4xl">
      <div className="mb-4">
        <Link href="/tasks" className="text-sm text-primary-dark hover:underline">
          ← Zurück zur Übersicht
        </Link>
      </div>

      <div className="card p-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">{task.title}</h1>
            <div className="flex items-center gap-2 mt-1 text-sm text-muted flex-wrap">
              {task.category && (
                <span className="text-primary-dark bg-primary-light px-2 py-0.5 rounded-full text-xs font-medium">
                  {task.category.name}
                </span>
              )}
              <span>📍 {task.city}</span>
              {task.scheduledAt && <span>📅 {formatDateTime(task.scheduledAt)}</span>}
            </div>
          </div>
          <TaskStatusBadge status={task.status} />
        </div>

        <div className="mt-4">
          <StatusStepper status={task.status} />
        </div>

        <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{task.description}</p>
        {task.address && <p className="mt-2 text-sm text-muted">Adresse: {task.address}</p>}
        <p className="mt-3 text-xl font-bold text-primary-dark">{formatCents(task.budgetCents)}</p>

        {actionError && (
          <div className="mt-4">
            <ErrorBox message={actionError} />
          </div>
        )}
        {payoutInfo && (
          <div className="mt-4 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">
            {payoutInfo}
          </div>
        )}

        <div className="flex flex-wrap gap-2 mt-5">
          {(task.status === "ASSIGNED" || task.status === "IN_PROGRESS") &&
            (isPoster || isAssignedTasker) && (
              <button className="btn-secondary text-sm" onClick={openChat}>
                💬 Chat öffnen
              </button>
            )}
          {task.status === "ASSIGNED" && (isPoster || isAssignedTasker) && (
            <button
              className="btn-secondary text-sm"
              disabled={startMutation.isPending}
              onClick={() => startMutation.mutate()}
            >
              {startMutation.isPending ? "…" : "Aufgabe starten"}
            </button>
          )}
          {isPoster && (task.status === "ASSIGNED" || task.status === "IN_PROGRESS") && (
            <button
              className="btn-primary text-sm"
              disabled={completeMutation.isPending}
              onClick={() => completeMutation.mutate()}
            >
              {completeMutation.isPending ? "…" : "Als erledigt markieren"}
            </button>
          )}
          {isPoster && (task.status === "POSTED" || task.status === "ASSIGNED") && (
            <button
              className="btn-ghost text-sm border border-red-200 text-red-600"
              disabled={cancelMutation.isPending}
              onClick={() => {
                if (confirm("Aufgabe wirklich stornieren?")) cancelMutation.mutate();
              }}
            >
              Stornieren
            </button>
          )}
        </div>

        {isPoster && (task.status === "ASSIGNED" || task.status === "IN_PROGRESS" || task.status === "COMPLETED") && (
          <div className="mt-6 border-t border-border pt-5">
            <h2 className="font-semibold mb-2">Zahlung (Testmodus)</h2>
            {paymentConfirmed ? (
              <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                ✅ Zahlung wurde bestätigt (Testmodus). Der Betrag wird nach Abschluss an den
                Helfer ausgezahlt.
              </p>
            ) : paymentClientSecret ? (
              <div className="bg-primary-light/60 rounded-lg p-4 text-sm space-y-3">
                <p className="text-muted">
                  Testmodus – simulierte Stripe-Zahlung. Client-Secret:{" "}
                  <code className="text-xs break-all">{paymentClientSecret}</code>
                </p>
                <button
                  className="btn-primary text-sm"
                  disabled={confirmPaymentMutation.isPending}
                  onClick={() => confirmPaymentMutation.mutate()}
                >
                  {confirmPaymentMutation.isPending ? "…" : "Test-Zahlung bestätigen"}
                </button>
              </div>
            ) : (
              <button
                className="btn-primary text-sm"
                disabled={createIntentMutation.isPending}
                onClick={() => createIntentMutation.mutate()}
              >
                {createIntentMutation.isPending ? "…" : "Jetzt bezahlen"}
              </button>
            )}
          </div>
        )}

        {isAssignedTasker && task.status === "COMPLETED" && (
          <div className="mt-6 border-t border-border pt-5">
            <h2 className="font-semibold mb-2">Auszahlung</h2>
            <p className="text-sm text-muted mb-3">
              Sobald der Kunde bezahlt hat, kannst du deine Auszahlung anfordern (abzüglich
              Plattformgebühr).
            </p>
            <button
              className="btn-primary text-sm"
              disabled={payoutMutation.isPending}
              onClick={() => payoutMutation.mutate()}
            >
              {payoutMutation.isPending ? "…" : "Auszahlung anfordern"}
            </button>
          </div>
        )}
      </div>

      {task.poster && (
        <div className="card p-4 mt-4 flex items-center gap-3">
          <Avatar
            name={`${task.poster.firstName} ${task.poster.lastName}`}
            avatarUrl={task.poster.avatarUrl}
          />
          <div className="flex-1">
            <Link href={`/profile/${task.poster.id}`} className="font-medium hover:underline">
              {task.poster.firstName} {task.poster.lastName}
            </Link>
            <p className="text-xs text-muted">Auftraggeber</p>
          </div>
          <StarDisplay value={task.poster.ratingAvg} count={task.poster.ratingCount} />
        </div>
      )}

      {task.assignedTasker && (
        <div className="card p-4 mt-3 flex items-center gap-3">
          <Avatar
            name={`${task.assignedTasker.firstName} ${task.assignedTasker.lastName}`}
            avatarUrl={task.assignedTasker.avatarUrl}
          />
          <div className="flex-1">
            <Link href={`/profile/${task.assignedTasker.id}`} className="font-medium hover:underline">
              {task.assignedTasker.firstName} {task.assignedTasker.lastName}
            </Link>
            <p className="text-xs text-muted">Zugewiesener Helfer</p>
          </div>
          <StarDisplay value={task.assignedTasker.ratingAvg} count={task.assignedTasker.ratingCount} />
        </div>
      )}

      {!isPoster && task.status === "POSTED" && user && !hasApplied && (
        <div className="card p-6 mt-4">
          <h2 className="font-semibold mb-3">Auf diese Aufgabe bewerben</h2>
          {applyError && (
            <div className="mb-3">
              <ErrorBox message={applyError} />
            </div>
          )}
          <div className="space-y-3">
            <textarea
              className="input"
              rows={3}
              placeholder="Nachricht an den Auftraggeber (optional)"
              value={applyMessage}
              onChange={(e) => setApplyMessage(e.target.value)}
            />
            <input
              className="input"
              type="number"
              min={0}
              step="0.01"
              placeholder="Dein Preisvorschlag in € (optional)"
              value={proposedPrice}
              onChange={(e) => setProposedPrice(e.target.value)}
            />
            <button
              className="btn-primary"
              disabled={applyMutation.isPending}
              onClick={() => applyMutation.mutate()}
            >
              {applyMutation.isPending ? "Wird gesendet…" : "Jetzt bewerben"}
            </button>
          </div>
        </div>
      )}
      {!isPoster && task.status === "POSTED" && user && hasApplied && (
        <div className="card p-4 mt-4 text-sm text-muted">
          Du hast dich bereits auf diese Aufgabe beworben.
        </div>
      )}
      {!user && task.status === "POSTED" && (
        <div className="card p-4 mt-4 text-sm">
          <Link href={`/login?redirect=/tasks/${id}`} className="text-primary-dark font-medium">
            Melde dich an
          </Link>{" "}
          um dich auf diese Aufgabe zu bewerben.
        </div>
      )}

      {isPoster && (
        <div className="card p-6 mt-4">
          <h2 className="font-semibold mb-3">
            Bewerbungen ({task.applications?.length ?? 0})
          </h2>
          {pendingApplications.length === 0 && otherApplications.length === 0 && (
            <EmptyState title="Noch keine Bewerbungen" subtitle="Sobald sich jemand bewirbt, erscheint er hier." />
          )}
          <div className="space-y-3">
            {[...pendingApplications, ...otherApplications].map((app: Application) => (
              <div
                key={app.id}
                className="border border-border rounded-lg p-3 flex items-start gap-3"
              >
                <Avatar
                  name={`${app.tasker?.firstName ?? ""} ${app.tasker?.lastName ?? ""}`}
                  avatarUrl={app.tasker?.avatarUrl}
                  size={36}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <Link
                      href={`/profile/${app.taskerId}`}
                      className="font-medium hover:underline text-sm"
                    >
                      {app.tasker?.firstName} {app.tasker?.lastName}
                    </Link>
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
                  {app.message && <p className="text-sm text-muted mt-1">{app.message}</p>}
                  {app.proposedCents != null && (
                    <p className="text-sm font-medium mt-1">
                      Preisvorschlag: {formatCents(app.proposedCents)}
                    </p>
                  )}
                  {app.status === "PENDING" && task.status === "POSTED" && (
                    <button
                      className="btn-primary text-xs mt-2"
                      disabled={acceptMutation.isPending}
                      onClick={() => acceptMutation.mutate(app.id)}
                    >
                      Annehmen
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {task.status === "POSTED" && (
            <div className="mt-5 border-t border-border pt-4">
              <h3 className="font-medium text-sm mb-2">Helfer direkt einladen</h3>
              <p className="text-xs text-muted mb-2">
                Gib die Benutzer-ID eines Helfers ein (z.B. von dessen Profilseite kopiert), um
                ihn direkt zu dieser Aufgabe einzuladen.
              </p>
              {inviteError && (
                <div className="mb-2">
                  <ErrorBox message={inviteError} />
                </div>
              )}
              {inviteSuccess && (
                <p className="text-sm text-green-700 mb-2">{inviteSuccess}</p>
              )}
              <div className="flex gap-2">
                <input
                  className="input"
                  placeholder="Helfer-ID"
                  value={inviteTaskerId}
                  onChange={(e) => setInviteTaskerId(e.target.value)}
                />
                <button
                  className="btn-secondary text-sm whitespace-nowrap"
                  disabled={!inviteTaskerId.trim() || inviteMutation.isPending}
                  onClick={() => inviteMutation.mutate()}
                >
                  Einladen
                </button>
              </div>
              {task.invitations && task.invitations.length > 0 && (
                <ul className="mt-3 text-sm text-muted space-y-1">
                  {task.invitations.map((inv) => (
                    <li key={inv.id}>
                      Einladung an {inv.taskerId.slice(0, 8)}… – Status: {inv.status}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {task.status === "COMPLETED" && user && (isPoster || isAssignedTasker) && (
        <div className="card p-6 mt-4">
          <h2 className="font-semibold mb-3">Bewertung abgeben</h2>
          {reviewSubmitted ? (
            <p className="text-sm text-green-700">Danke für deine Bewertung!</p>
          ) : (
            <div className="space-y-3">
              <StarInput value={reviewRating} onChange={setReviewRating} />
              <textarea
                className="input"
                rows={3}
                placeholder="Dein Kommentar (optional)"
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
              />
              <label className="flex items-center gap-2 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={reviewAnonymous}
                  onChange={(e) => setReviewAnonymous(e.target.checked)}
                />
                Anonym bewerten
              </label>
              <button
                className="btn-primary"
                disabled={reviewMutation.isPending}
                onClick={() => reviewMutation.mutate()}
              >
                {reviewMutation.isPending ? "Wird gesendet…" : "Bewertung abschicken"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
