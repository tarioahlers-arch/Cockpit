"use client";

import { useState } from "react";

export function StarDisplay({ value, count }: { value?: number | null; count?: number | null }) {
  const v = value ?? 0;
  return (
    <span className="inline-flex items-center gap-1 text-sm text-muted">
      <span className="text-amber-500">★</span>
      <span className="font-semibold text-foreground">{v > 0 ? v.toFixed(1) : "Neu"}</span>
      {count != null && count > 0 && <span>({count})</span>}
    </span>
  );
}

export function StarInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          className="text-2xl leading-none"
          aria-label={`${n} Sterne`}
        >
          <span className={(hover || value) >= n ? "text-amber-500" : "text-gray-300"}>★</span>
        </button>
      ))}
    </div>
  );
}
