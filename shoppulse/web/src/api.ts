export interface Shop {
  id: number;
  name: string;
  domain: string;
  platform: 'shopify' | 'shopware' | 'woocommerce' | 'custom';
  niche: string;
  public_key: string;
  is_demo: number;
  created_at: string;
  sessions30d?: number;
  conversionRate?: number;
  monthlyRevenue?: number;
  runningExperiments?: number;
}

export interface Funnel {
  visitors: number;
  sessions: number;
  productViewSessions: number;
  cartSessions: number;
  checkoutSessions: number;
  purchaseSessions: number;
  orders: number;
  revenue: number;
  conversionRate: number;
  averageOrderValue: number;
  cartAbandonmentRate: number;
  checkoutAbandonmentRate: number;
  hesitationRate: number;
  averageScrollDepth: number;
  coveredDays: number;
}

export interface Segment {
  key: string;
  label: string;
  description: string;
  visitors: number;
  share: number;
  conversionRate: number;
  topSignals: string[];
  nudgeFit: string[];
}

export interface Recommendation {
  id: string;
  title: string;
  why: string;
  action: string;
  nudgeType: NudgeType | null;
  potentialPerMonth: number;
  assumption: string;
  confidence: 'hoch' | 'mittel' | 'niedrig';
  effort: 'gering' | 'mittel' | 'hoch';
  quickWin: boolean;
}

export interface Overview {
  shop: Shop;
  days: number;
  funnel: Funnel;
  monthlyRevenue: number;
  segments: Segment[];
  recommendations: Recommendation[];
  totalPotential: number;
  timeline: { date: string; sessions: number; conversionRate: number; revenue: number }[];
}

export type NudgeType = 'anchoring' | 'social_proof' | 'scarcity' | 'decoy';

export interface NudgeDefinition {
  type: NudgeType;
  label: string;
  principle: string;
  mechanism: string;
  honestyRule: string;
  defaultConfig: Record<string, unknown>;
}

interface VariantStats {
  visitors: number;
  conversions: number;
  revenue: number;
  revenuePerVisitor: number;
}

export interface Experiment {
  id: number;
  shop_id: number;
  name: string;
  nudge_type: NudgeType;
  page_type: string;
  config: Record<string, unknown>;
  status: 'draft' | 'running' | 'stopped';
  traffic_split: number;
  created_at: string;
  started_at: string | null;
  stopped_at: string | null;
  analysis: {
    control: VariantStats;
    treatment: VariantStats;
    test: {
      controlRate: number;
      treatmentRate: number;
      relativeUplift: number | null;
      absoluteDiff: number;
      ci95: [number, number];
      pValue: number;
      significant: boolean;
    };
    requiredPerVariant: number;
    progress: number;
    verdict: 'winner' | 'loser' | 'inconclusive' | 'collecting';
    headline: string;
    explanation: string[];
    segmentEffects: { segment: string; label: string; control: VariantStats; treatment: VariantStats; absoluteDiff: number }[];
  };
}

export interface Product {
  id: number;
  sku: string;
  ean: string | null;
  name: string;
  price: number;
  unit_cost: number | null;
  stock: number | null;
}

export interface CompetitorOffer {
  id: number;
  competitor: string;
  title: string;
  ean: string | null;
  price: number;
  url: string | null;
  matched_product_id: number | null;
  match_method: string | null;
  match_confidence: number | null;
  observed_at: string;
}

export interface ProductPricing {
  product: Product;
  history: { price: number; units_sold: number; period_days: number; period_start: string }[];
  offers: CompetitorOffer[];
  elasticity: { elasticity: number | null; r2: number | null; observations: number; reliable: boolean; note: string };
  competitors: { count: number; min: number | null; median: number | null; positionVsMedian: number | null };
  recommendation: {
    currentPrice: number;
    recommendedPrice: number;
    changePct: number;
    expectedUnitsPerMonthNow: number;
    expectedUnitsPerMonthNew: number;
    expectedProfitDeltaPerMonth: number;
    basis: 'profit' | 'revenue';
    action: 'raise' | 'lower' | 'hold' | 'test';
    reasons: string[];
  };
}

export interface SourceTypeDef {
  type: 'shopify' | 'shopware' | 'woocommerce' | 'csv_url' | 'push';
  label: string;
  description: string;
  fields: { key: string; label: string; secret?: boolean; placeholder?: string; optional?: boolean }[];
}

export interface InventorySource {
  id: number;
  name: string;
  type: SourceTypeDef['type'];
  config: Record<string, string>;
  push_token: string | null;
  sync_interval_min: number;
  active: number;
  last_sync_at: string | null;
  last_status: 'ok' | 'error' | 'blocked' | null;
  last_message: string | null;
}

export interface InventoryLocation {
  id: number;
  source_id: number;
  source_name: string;
  external_id: string;
  name: string;
  kind: 'warehouse' | 'store' | 'supplier';
  counts_for_online: number;
  customer_visible: number;
}

export interface Availability {
  sku: string;
  status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'unknown';
  label: string | null;
  quantity: number | null;
  stores: { name: string; status: 'available' | 'low' | 'none'; label: string }[];
  updatedAt: string | null;
}

export interface InventoryOverview {
  settings: { low_stock_threshold: number; max_age_hours: number; show_store_availability: number };
  sources: InventorySource[];
  locations: InventoryLocation[];
  items: { sku: string; name: string | null; matched: boolean; perLocation: Record<number, number>; updatedAt: string; availability?: Availability }[];
  productsWithoutStock: { sku: string; name: string }[];
  runs: { id: number; source_name: string; started_at: string; status: string; items: number; message: string | null }[];
}

export interface IngestResult {
  status: 'ok' | 'blocked' | 'error';
  message: string;
  items?: number;
  parseErrors?: string[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Fehler ${res.status}`);
  return body as T;
}

const post = <T>(path: string, data: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(data) });
const patch = <T>(path: string, data: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(data) });

export const api = {
  listShops: () => request<Shop[]>('/shops'),
  createShop: (data: { name: string; domain: string; platform: string; niche: string }) => post<Shop>('/shops', data),
  createDemoShop: () => post<Shop>('/shops/demo', {}),
  deleteShop: (id: number) => request<void>(`/shops/${id}`, { method: 'DELETE' }),
  getShop: (id: number) => request<Shop>(`/shops/${id}`),
  overview: (id: number, days = 30) => request<Overview>(`/shops/${id}/overview?days=${days}`),

  nudges: () => request<NudgeDefinition[]>('/nudges'),
  experiments: (shopId: number) => request<Experiment[]>(`/shops/${shopId}/experiments`),
  createExperiment: (shopId: number, data: Record<string, unknown>) => post<Experiment>(`/shops/${shopId}/experiments`, data),
  setExperimentStatus: (id: number, status: 'running' | 'stopped') => patch<Experiment>(`/experiments/${id}`, { status }),
  deleteExperiment: (id: number) => request<void>(`/experiments/${id}`, { method: 'DELETE' }),

  pricing: (shopId: number) => request<{ products: ProductPricing[]; unmatchedOffers: CompetitorOffer[] }>(`/shops/${shopId}/pricing`),
  upsertProduct: (shopId: number, data: Record<string, unknown>) => post<Product>(`/shops/${shopId}/products`, data),
  addHistory: (productId: number, data: Record<string, unknown>) => post(`/products/${productId}/history`, data),
  importOffers: (shopId: number, offers: Record<string, unknown>[]) =>
    post<{ imported: number; matched: number; unmatched: number; skipped: number }>(`/shops/${shopId}/competitor-offers`, { offers }),
  matchOffer: (offerId: number, productId: number | null) => patch(`/competitor-offers/${offerId}`, { productId }),

  sourceTypes: () => request<SourceTypeDef[]>('/inventory/source-types'),
  inventory: (shopId: number) => request<InventoryOverview>(`/shops/${shopId}/inventory`),
  createSource: (shopId: number, data: Record<string, unknown>) => post<InventorySource>(`/shops/${shopId}/inventory/sources`, data),
  updateSource: (id: number, data: Record<string, unknown>) => patch<InventorySource>(`/inventory/sources/${id}`, data),
  deleteSource: (id: number) => request<void>(`/inventory/sources/${id}`, { method: 'DELETE' }),
  syncSource: (id: number, force = false) => rawPost(`/inventory/sources/${id}/sync`, { force }),
  uploadCsv: (id: number, csv: string, mode: 'snapshot' | 'upsert', force = false) =>
    rawPost(`/inventory/sources/${id}/upload`, { csv, mode, force }),
  updateLocation: (id: number, data: Record<string, unknown>) => patch(`/inventory/locations/${id}`, data),
  saveInventorySettings: (shopId: number, data: Record<string, unknown>) =>
    request(`/shops/${shopId}/inventory/settings`, { method: 'PUT', body: JSON.stringify(data) }),
};

/** Wie post, liefert aber auch bei 409/502 das Ergebnis (Sicherheitsstopp, Fehlermeldung) zurueck. */
async function rawPost(path: string, data: unknown): Promise<IngestResult> {
  const res = await fetch(`/api${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok && !body.status) return { status: 'error', message: body.error ?? `Fehler ${res.status}` };
  return body as IngestResult;
}

export const fmt = {
  eur: (v: number, digits = 0) =>
    v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: digits, minimumFractionDigits: digits }),
  pct: (v: number, digits = 1) => `${(v * 100).toLocaleString('de-DE', { maximumFractionDigits: digits, minimumFractionDigits: digits })} %`,
  num: (v: number) => v.toLocaleString('de-DE'),
  signedPct: (v: number, digits = 1) => {
    const r = Math.round(v * 100 * 10 ** digits) / 10 ** digits / 100 || 0; // -0 vermeiden
    return `${r > 0 ? '+' : r < 0 ? '' : '±'}${fmt.pct(r, digits)}`;
  },
};

export const PLATFORM_LABELS: Record<Shop['platform'], string> = {
  shopify: 'Shopify',
  shopware: 'Shopware',
  woocommerce: 'WooCommerce',
  custom: 'Eigenes System',
};
