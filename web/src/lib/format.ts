export function formatCents(cents: number | null | undefined): string {
  if (cents == null) return "–";
  const euros = cents / 100;
  return (
    euros.toLocaleString("de-DE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " €"
  );
}

export function eurosToCents(euros: string | number): number {
  const n = typeof euros === "string" ? parseFloat(euros.replace(",", ".")) : euros;
  if (Number.isNaN(n)) return 0;
  return Math.round(n * 100);
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return "–";
  return new Date(date).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(date: string | null | undefined): string {
  if (!date) return "–";
  return new Date(date).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(date: string | null | undefined): string {
  if (!date) return "";
  return new Date(date).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const TASK_STATUS_LABELS: Record<string, string> = {
  POSTED: "Gepostet",
  ASSIGNED: "Zugewiesen",
  IN_PROGRESS: "In Bearbeitung",
  COMPLETED: "Abgeschlossen",
  CANCELLED: "Storniert",
};

export const APPLICATION_STATUS_LABELS: Record<string, string> = {
  PENDING: "Ausstehend",
  ACCEPTED: "Angenommen",
  DECLINED: "Abgelehnt",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Ausstehend",
  PAID: "Bezahlt",
  RELEASED: "Ausgezahlt",
  REFUNDED: "Erstattet",
};

export const SUPPORT_STATUS_LABELS: Record<string, string> = {
  OPEN: "Offen",
  IN_PROGRESS: "In Bearbeitung",
  CLOSED: "Geschlossen",
};
