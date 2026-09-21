import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface Point {
  id: number;
  createdAt: string;
  overallScore: number | null;
}

export default function TrendChart({ history }: { history: Point[] }) {
  if (history.length < 2) {
    return (
      <div className="empty-state">
        Noch nicht genug abgeschlossene Audits für einen Trend. Nach dem zweiten wiederkehrenden Testkauf erscheint
        hier der Verlauf.
      </div>
    );
  }

  const data = history.map((h) => ({
    date: new Date(h.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
    score: h.overallScore,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
        <CartesianGrid stroke="#2a3556" strokeDasharray="3 3" />
        <XAxis dataKey="date" stroke="#93a0c4" fontSize={12} />
        <YAxis domain={[0, 100]} stroke="#93a0c4" fontSize={12} />
        <Tooltip
          contentStyle={{ background: '#16213b', border: '1px solid #2a3556', borderRadius: 8, color: '#e6ebff' }}
        />
        <Line type="monotone" dataKey="score" stroke="#5b8cff" strokeWidth={2} dot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
