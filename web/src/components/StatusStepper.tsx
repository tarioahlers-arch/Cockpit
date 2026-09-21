import type { TaskStatus } from "@/lib/types";

const STEPS: { key: TaskStatus; label: string }[] = [
  { key: "POSTED", label: "Gepostet" },
  { key: "ASSIGNED", label: "Zugewiesen" },
  { key: "IN_PROGRESS", label: "In Bearbeitung" },
  { key: "COMPLETED", label: "Abgeschlossen" },
];

export function StatusStepper({ status }: { status: TaskStatus }) {
  if (status === "CANCELLED") {
    return (
      <div className="badge bg-red-100 text-red-700">Storniert</div>
    );
  }
  const currentIndex = STEPS.findIndex((s) => s.key === status);
  return (
    <div className="flex items-center w-full overflow-x-auto py-1">
      {STEPS.map((step, i) => {
        const done = i <= currentIndex;
        return (
          <div key={step.key} className="flex items-center flex-shrink-0">
            <div className="flex flex-col items-center min-w-[80px]">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  done ? "bg-primary text-white" : "bg-gray-200 text-gray-500"
                }`}
              >
                {i + 1}
              </div>
              <span
                className={`mt-1 text-[11px] text-center ${
                  done ? "text-primary-dark font-medium" : "text-muted"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`h-0.5 w-8 sm:w-14 mx-1 ${
                  i < currentIndex ? "bg-primary" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
