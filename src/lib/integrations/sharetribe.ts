/**
 * Server-only Sharetribe Integration API access (read-only in this build).
 * Credentials come from SHARETRIBE_INTEGRATION_CLIENT_ID / _SECRET in .env.local and
 * are never sent to the browser or logged. Results are cached so pages never fan out
 * live Sharetribe calls per view.
 */
const AUTH_URL = "https://flex-api.sharetribe.com/v1/auth/token";
const INTEG_URL = "https://flex-integ-api.sharetribe.com/v1/integration_api";
const CACHE_MS = 10 * 60 * 1000;

export interface SharetribeConnection {
  state: "connected-readonly" | "not-configured" | "error";
  marketplaceName: string | null;
  /** Marketplace API (customer-facing) client: verified with an anonymous public read. */
  marketplaceApi: "verified" | "not-configured" | "error";
  detail: string;
  checkedAt: string;
}

let cache: { at: number; value: SharetribeConnection } | null = null;

async function integrationToken(): Promise<string> {
  const clientId = process.env.SHARETRIBE_INTEGRATION_CLIENT_ID;
  const clientSecret = process.env.SHARETRIBE_INTEGRATION_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("not-configured");
  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "client_credentials", scope: "integ" }),
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`auth failed (HTTP ${res.status})`);
  return (await res.json()).access_token as string;
}

/** GET an Integration API path. Read-only helper; no write endpoints are exposed here. */
export async function integrationGet<T = unknown>(path: string, query: Record<string, string> = {}): Promise<T> {
  const token = await integrationToken();
  const url = `${INTEG_URL}${path}${Object.keys(query).length ? `?${new URLSearchParams(query)}` : ""}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, signal: AbortSignal.timeout(8000), cache: "no-store" });
  if (!res.ok) throw new Error(`GET ${path} failed (HTTP ${res.status})`);
  return res.json() as Promise<T>;
}

async function checkMarketplaceApi(): Promise<SharetribeConnection["marketplaceApi"]> {
  const clientId = process.env.SHARETRIBE_CLIENT_ID;
  if (!clientId) return "not-configured";
  try {
    const res = await fetch(AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({ client_id: clientId, grant_type: "client_credentials", scope: "public-read" }),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    return res.ok ? "verified" : "error";
  } catch {
    return "error";
  }
}

/** POST to an Integration API command. Used only by explicitly approved write scripts. */
export async function integrationPost<T = unknown>(path: string, body: Record<string, unknown>, query: Record<string, string> = {}): Promise<T> {
  const token = await integrationToken();
  const url = `${INTEG_URL}${path}${Object.keys(query).length ? `?${new URLSearchParams(query)}` : ""}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`POST ${path} failed (HTTP ${res.status}): ${JSON.stringify(json?.errors?.map((e: { title?: string; code?: string }) => e.code ?? e.title) ?? [])}`);
  return json as T;
}

export async function sharetribeConnection(force = false): Promise<SharetribeConnection> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const marketplaceApi = await checkMarketplaceApi();
  let value: SharetribeConnection;
  try {
    const body = await integrationGet<{ data: { attributes: { name: string } } }>("/marketplace/show");
    value = {
      state: "connected-readonly",
      marketplaceName: body.data.attributes.name,
      marketplaceApi,
      detail: "Integration API credentials verified with a read-only call. Requests and transactions still use the local development store.",
      checkedAt: new Date().toISOString(),
    };
  } catch (e) {
    const msg = (e as Error).message;
    value =
      msg === "not-configured"
        ? { state: "not-configured", marketplaceName: null, marketplaceApi, detail: "No Integration API credentials configured.", checkedAt: new Date().toISOString() }
        : { state: "error", marketplaceName: null, marketplaceApi, detail: `Check failed: ${msg}`, checkedAt: new Date().toISOString() };
  }
  cache = { at: Date.now(), value };
  return value;
}
