import { TASK_STATUS_LABELS } from "@/lib/format";
import type { TaskStatus } from "@/lib/types";

export function Spinner({ label = "Lädt…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-muted py-8 justify-center text-sm">
      <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      {label}
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
      {message}
    </div>
  );
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="text-center py-12 px-4 text-muted">
      <p className="font-medium text-foreground">{title}</p>
      {subtitle && <p className="text-sm mt-1">{subtitle}</p>}
    </div>
  );
}

const STATUS_COLORS: Record<TaskStatus, string> = {
  POSTED: "bg-blue-100 text-blue-700",
  ASSIGNED: "bg-amber-100 text-amber-700",
  IN_PROGRESS: "bg-purple-100 text-purple-700",
  COMPLETED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span className={`badge ${STATUS_COLORS[status]}`}>{TASK_STATUS_LABELS[status]}</span>
  );
}
