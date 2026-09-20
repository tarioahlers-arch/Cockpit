const ICON_MAP: Record<string, string> = {
  "shopping-cart": "🛒",
  zap: "⚡",
  leaf: "🌿",
  cpu: "💻",
  wrench: "🔧",
  sparkles: "✨",
  hammer: "🔨",
  "more-horizontal": "🧩",
  truck: "🚚",
  broom: "🧹",
};

export function categoryEmoji(icon?: string | null): string {
  if (!icon) return "🔧";
  return ICON_MAP[icon] || "🔧";
}
