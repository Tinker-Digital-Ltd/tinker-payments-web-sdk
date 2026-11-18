export type JsonObject = Record<string, unknown>;

export interface TinkerHttpResponse {
  status: number;
  text(): Promise<string>;
  headers?: { get(name: string): string | null };
}

export interface TinkerFetchInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export type TinkerFetch = (url: string, init?: TinkerFetchInit) => Promise<TinkerHttpResponse>;

export interface TinkerClientOptions {
  publicKey: string;
  getCustomerToken: () => Promise<string>;
  baseUrl?: string | null;
  fetch?: TinkerFetch;
}

export interface ApiEnvelope {
  success?: boolean;
  data?: unknown;
  error?: { message?: unknown; code?: unknown } | null;
  message?: unknown;
  meta?: unknown;
}

export interface EntitlementStatus {
  identifier: string;
  is_active: boolean;
  will_renew: boolean;
  period_type: 'NORMAL' | 'TRIAL' | 'PROMOTIONAL';
  store: string | null;
  product_identifier: string | null;
  latest_purchase_date: string | null;
  original_purchase_date: string | null;
  expiration_date: string | null;
  grace_period_expiration_date: string | null;
  unsubscribe_detected_at: string | null;
  billing_issue_detected_at: string | null;
  is_sandbox: boolean;
}

export interface CustomerInfo {
  external_customer_id: string;
  aliases: string[];
  first_seen: string;
  management_url: string | null;
  entitlements: {
    active: Record<string, EntitlementStatus>;
    all: Record<string, EntitlementStatus>;
  };
  active_subscriptions: string[];
  all_purchased_product_identifiers: string[];
  latest_expiration_date: string | null;
  non_subscription_transactions: {
    id: string;
    product_identifier: string;
    purchase_date: string;
    store: string | null;
  }[];
  attributes: JsonObject;
}

export interface Product {
  id: string;
  type: 'subscription' | 'one_time';
  name: string;
  price: number;
  currency: string;
  access_period: string | null;
  is_active: boolean;
  created_at: string;
}

export interface CustomerOfferings {
  current_offering_id: string | null;
  offerings: {
    identifier: string;
    display_name: string;
    metadata: JsonObject | null;
    packages: { identifier: string; billing_period: string | null; product: Product }[];
  }[];
  experiment: { id: string; variant: 'control' | 'treatment' } | null;
}

export type CustomerAttributes = Record<string, string | null>;

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function toJsonObject(value: unknown): JsonObject {
  return isJsonObject(value) ? value : {};
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
