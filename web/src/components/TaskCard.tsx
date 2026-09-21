import Link from "next/link";
import { formatCents, formatDate } from "@/lib/format";
import type { Task } from "@/lib/types";
import { TaskStatusBadge } from "./Ui";

export function TaskCard({ task }: { task: Task }) {
  return (
    <Link
      href={`/tasks/${task.id}`}
      className="card block p-4 hover:shadow-md hover:border-primary/40 transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-foreground line-clamp-2">{task.title}</h3>
        <TaskStatusBadge status={task.status} />
      </div>
      <p className="text-sm text-muted mt-1 line-clamp-2">{task.description}</p>
      <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-3 text-sm">
        {task.category && (
          <span className="text-primary-dark bg-primary-light px-2 py-0.5 rounded-full text-xs font-medium">
            {task.category.name}
          </span>
        )}
        <span className="text-muted">📍 {task.city}</span>
        {task.scheduledAt && <span className="text-muted">📅 {formatDate(task.scheduledAt)}</span>}
      </div>
      <div className="flex items-center justify-between mt-3">
        <span className="font-bold text-primary-dark">{formatCents(task.budgetCents)}</span>
        {task.poster && (
          <span className="text-xs text-muted">
            von {task.poster.firstName} {task.poster.lastName?.[0]}.
          </span>
        )}
      </div>
    </Link>
  );
}
