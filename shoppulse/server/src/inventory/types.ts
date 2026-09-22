export type SourceType = 'shopify' | 'shopware' | 'woocommerce' | 'csv_url' | 'push';

export interface LocationInput {
  externalId: string;
  name: string;
  kind?: 'warehouse' | 'store' | 'supplier';
}

export interface LevelInput {
  sku: string;
  ean?: string | null;
  /** externalId des Lagerorts; fehlt er, wird der Default-Lagerort der Quelle verwendet */
  location?: string | null;
  quantity: number;
}

/** Vollstaendiger Bestand einer Quelle zu einem Zeitpunkt. */
export interface InventorySnapshot {
  locations: LocationInput[];
  levels: LevelInput[];
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface Connector {
  type: SourceType;
  label: string;
  /** Pflichtfelder der Konfiguration, fuer Validierung und UI */
  fields: { key: string; label: string; secret?: boolean; placeholder?: string; optional?: boolean }[];
  fetchSnapshot(config: Record<string, string>, fetchImpl: FetchLike): Promise<InventorySnapshot>;
}

export const DEFAULT_LOCATION = 'default';
