/**
 * Katalog der Nudge-Typen. Leitprinzip "Ehrlichkeit als Designprinzip": jeder Nudge zeigt
 * ausschliesslich echte Daten (echte Kaufzahlen, echter Lagerbestand, tatsaechlich gueltiger
 * Referenzpreis). Fehlen diese Daten, wird der Nudge nicht ausgespielt.
 */
export type NudgeType = 'anchoring' | 'social_proof' | 'scarcity' | 'decoy';

export interface NudgeDefinition {
  type: NudgeType;
  label: string;
  principle: string;
  mechanism: string;
  honestyRule: string;
  /** Darf das Snippet den Nudge selbst rendern? Decoy erfordert Sortimentsgestaltung im Shop. */
  renderedBySnippet: boolean;
  defaultConfig: Record<string, unknown>;
}

export const NUDGES: Record<NudgeType, NudgeDefinition> = {
  anchoring: {
    type: 'anchoring',
    label: 'Anchoring (Referenzpreis)',
    principle: 'Ankereffekt (Tversky & Kahneman, 1974)',
    mechanism:
      'Ein zuerst gesehener Referenzwert prägt die Bewertung des tatsächlichen Preises. Ein sichtbarer, echter Vergleichspreis lässt den aktuellen Preis als fair erscheinen und reduziert Zögern bei preissensiblen Besucher:innen.',
    honestyRule:
      'Nur echte Referenzpreise (z. B. zuletzt verlangter Preis gem. PAngV § 11 oder UVP mit Kennzeichnung). Das Snippet zeigt den Anker nur, wenn der Shop data-sp-reference-price setzt und dieser über dem aktuellen Preis liegt.',
    renderedBySnippet: true,
    defaultConfig: { template: 'Statt {reference} € – Sie sparen {savingPct} %' },
  },
  social_proof: {
    type: 'social_proof',
    label: 'Social Proof (Kaufzahlen)',
    principle: 'Soziale Bewährtheit (Cialdini, 1984)',
    mechanism:
      'In unsicheren Entscheidungen orientieren sich Menschen am Verhalten anderer. Ein wahrheitsgemäßer Hinweis auf echte Käufe reduziert wahrgenommenes Risiko – besonders bei zögernden und stöbernden Besucher:innen.',
    honestyRule:
      'Zahlen werden serverseitig aus tatsächlich getrackten Käufen berechnet. Unterhalb von minCount wird nichts angezeigt, es wird nie aufgerundet oder erfunden.',
    renderedBySnippet: true,
    defaultConfig: { windowHours: 48, minCount: 3, template: '{count}× in den letzten {hours} Stunden gekauft' },
  },
  scarcity: {
    type: 'scarcity',
    label: 'Scarcity (echter Lagerbestand)',
    principle: 'Knappheitsprinzip / Verlustaversion (Kahneman & Tversky, 1979)',
    mechanism:
      'Knappe Güter werden höher bewertet, drohender Verlust wiegt schwerer als gleich hoher Gewinn. Ein ehrlicher Bestandshinweis hilft entschlossenen Käufer:innen, nicht zu lange zu warten.',
    honestyRule:
      'Nur echter Lagerbestand aus data-sp-stock bzw. der Produkttabelle, nur unterhalb von maxStock. Keine künstlichen Countdown-Timer, keine erfundene Verknappung.',
    renderedBySnippet: true,
    defaultConfig: { maxStock: 10, template: 'Nur noch {stock} Stück auf Lager' },
  },
  decoy: {
    type: 'decoy',
    label: 'Decoy-Effekt (Variantengestaltung)',
    principle: 'Asymmetrische Dominanz (Huber, Payne & Puto, 1982; Ariely: "The Economist"-Beispiel)',
    mechanism:
      'Eine zusätzliche, klar unterlegene Option lässt eine Zielvariante attraktiver erscheinen. Wirkt bei Paketen, Größen und Abo-Stufen.',
    honestyRule:
      'Alle Optionen müssen real kaufbar und korrekt ausgepreist sein. ShopPulse schlägt die Gestaltung vor und misst sie – die Varianten selbst legt der Shop an; das Snippet markiert die Zielvariante nur mit einem "Beliebteste Wahl"-Hinweis, wenn sie tatsächlich am häufigsten gekauft wird.',
    renderedBySnippet: true,
    defaultConfig: { targetSku: '', badge: 'Beliebteste Wahl' },
  },
};

export function isNudgeType(value: unknown): value is NudgeType {
  return typeof value === 'string' && value in NUDGES;
}
