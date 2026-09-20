import { useState } from 'react';
import { CATEGORY_LABELS, ManualCriterion, SOURCE_LABELS } from '../api';

interface Props {
  criteria: ManualCriterion[];
  onSubmit: (results: { criterionId: number; score: number; notes?: string }[]) => Promise<void>;
  submitting: boolean;
}

export default function ManualChecklistForm({ criteria, onSubmit, submitting }: Props) {
  const [scores, setScores] = useState<Record<number, number>>(() =>
    Object.fromEntries(criteria.map((c) => [c.id, 70])),
  );
  const [notes, setNotes] = useState<Record<number, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(
      criteria.map((c) => ({
        criterionId: c.id,
        score: scores[c.id] ?? 70,
        notes: notes[c.id],
      })),
    );
  };

  return (
    <form onSubmit={handleSubmit}>
      <p className="legend-note" style={{ marginBottom: 16 }}>
        Digitaler Testkauf: Bewerten Sie diese Punkte wie ein Mystery Shopper — 0 = sehr schlecht, 100 = vorbildlich.
      </p>
      {criteria.map((c) => (
        <div className="checklist-item" key={c.id}>
          <div className="rec-head">
            <h4>{c.label}</h4>
            <span className={`tag ${c.source}`}>{SOURCE_LABELS[c.source] ?? c.source}</span>
          </div>
          <div className="desc">
            {CATEGORY_LABELS[c.category] ?? c.category} — {c.description}
          </div>
          <div className="slider-row">
            <input
              type="range"
              min={0}
              max={100}
              value={scores[c.id] ?? 70}
              onChange={(e) => setScores((s) => ({ ...s, [c.id]: Number(e.target.value) }))}
            />
            <span className="slider-value">{scores[c.id] ?? 70}</span>
          </div>
          <div className="form-field" style={{ marginTop: 10, marginBottom: 0 }}>
            <input
              type="text"
              placeholder="Notiz (optional)"
              value={notes[c.id] ?? ''}
              onChange={(e) => setNotes((n) => ({ ...n, [c.id]: e.target.value }))}
            />
          </div>
        </div>
      ))}
      <button className="btn" type="submit" disabled={submitting}>
        {submitting ? 'Speichere…' : 'Testkauf abschließen'}
      </button>
    </form>
  );
}
