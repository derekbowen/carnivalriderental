/**
 * Shared Sharetribe HTTP client for the import scripts (server-side, operator-run only).
 * Spaces calls to the Test environment's per-IP limits, retries 429 with backoff, and retries
 * 5xx/timeouts only for idempotent calls: a create that timed out may have succeeded, so the
 * caller's lookup-before-create decides instead of a blind retry. Tokens never leave this module.
 */
export const AUTH = "https://flex-api.sharetribe.com/v1/auth/token";
export const MKT = "https://flex-api.sharetribe.com/v1/api";
export const INTEG = "https://flex-integ-api.sharetribe.com/v1/integration_api";
export const TEST_MARKETPLACE = "CarnivalRental Test";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export type Kind = "query" | "command";

export function createClient(target: "test" | "live") {
  /** Spacing between calls of one kind (Test: queries 1/s, commands 1/2s per IP). Live is not rate limited; stay polite. */
  const spacing = target === "test" ? { query: 1050, command: 2100 } : { query: 200, command: 400 };
  const nextSlot = { query: 0, command: 0 };
  async function slot(kind: Kind) {
    const now = Date.now();
    const at = Math.max(now, nextSlot[kind]);
    nextSlot[kind] = at + spacing[kind];
    if (at > now) await sleep(at - now);
  }

  async function call<T>(kind: Kind, url: string, init: RequestInit, idempotent: boolean): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      await slot(kind);
      let res: Response;
      try {
        res = await fetch(url, { ...init, signal: AbortSignal.timeout(20000) });
      } catch (e) {
        if (idempotent && attempt < 3) {
          await sleep(1000 * 2 ** attempt);
          continue;
        }
        throw new Error(`network error on ${new URL(url).pathname}: ${(e as Error).message}`);
      }
      if (res.status === 429 && attempt < 8) {
        await sleep(Math.min(60000, 2000 * 2 ** attempt) + Math.random() * 1000);
        continue;
      }
      if (res.status >= 500 && idempotent && attempt < 3) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const codes = (body?.errors ?? []).map((e: { code?: string; title?: string }) => e.code ?? e.title).join(",");
        throw new HttpError(res.status, `${init.method ?? "GET"} ${new URL(url).pathname} → HTTP ${res.status}${codes ? ` (${codes})` : ""}`);
      }
      return body as T;
    }
  }

  const tokens: Record<string, { value: string; exp: number }> = {};
  async function token(kind: "integ" | "anon"): Promise<string> {
    const t = tokens[kind];
    if (t && t.exp > Date.now() + 60000) return t.value;
    const id = kind === "integ" ? process.env.SHARETRIBE_INTEGRATION_CLIENT_ID : process.env.SHARETRIBE_CLIENT_ID;
    const secret = kind === "integ" ? process.env.SHARETRIBE_INTEGRATION_CLIENT_SECRET : undefined;
    if (!id || (kind === "integ" && !secret)) throw new Error(`Sharetribe ${kind === "integ" ? "Integration" : "Marketplace"} API client is not configured`);
    const body = new URLSearchParams({ client_id: id, grant_type: "client_credentials", scope: kind === "integ" ? "integ" : "public-read", ...(secret ? { client_secret: secret } : {}) });
    const res = await fetch(AUTH, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body, signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`${kind} auth failed (HTTP ${res.status})`);
    const j = (await res.json()) as { access_token: string; expires_in?: number };
    tokens[kind] = { value: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 };
    return j.access_token;
  }

  const headers = async (kind: "integ" | "anon", json = false) => ({
    Authorization: `Bearer ${await token(kind)}`,
    Accept: "application/json",
    ...(json ? { "Content-Type": "application/json" } : {}),
  });

  /** Both API clients must point at the same marketplace. */
  async function marketplaceNames(): Promise<{ integ: string; mkt: string }> {
    const integ = await call<{ data: { attributes: { name: string } } }>("query", `${INTEG}/marketplace/show`, { headers: await headers("integ") }, true);
    const mkt = await call<{ data: { attributes: { name: string } } }>("query", `${MKT}/marketplace/show`, { headers: await headers("anon") }, true);
    return { integ: integ.data.attributes.name, mkt: mkt.data.attributes.name };
  }

  return { call, headers, marketplaceNames };
}
