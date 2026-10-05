/**
 * Minimal browser client for the Sharetribe Marketplace API (public client ID only; no secrets).
 * Same calls the Sharetribe Web Template makes from the browser. The customer's password goes
 * straight from their browser to Sharetribe and is never sent to or stored by our server.
 */
const AUTH = "https://flex-api.sharetribe.com/v1/auth/token";
const API = "https://flex-api.sharetribe.com/v1/api";

export class StError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

async function json(res: Response) {
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const e = body?.errors?.[0];
    throw new StError(res.status, e?.code ?? "unknown", e?.title ?? `HTTP ${res.status}`);
  }
  return body;
}

async function token(clientId: string, creds?: { username: string; password: string }): Promise<string> {
  const body = new URLSearchParams(
    creds
      ? { client_id: clientId, grant_type: "password", scope: "user", username: creds.username, password: creds.password }
      : { client_id: clientId, grant_type: "client_credentials", scope: "public-read" },
  );
  const res = await fetch(AUTH, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body });
  if (res.status === 401) throw new StError(401, "invalid-credentials", "Email or password is incorrect.");
  return (await json(res)).access_token as string;
}

const post = async (tok: string, path: string, body: unknown) =>
  json(await fetch(`${API}${path}`, { method: "POST", headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body) }));
const get = async (tok: string, path: string) => json(await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${tok}`, Accept: "application/json" } }));

export interface Account {
  mode: "signup" | "login";
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

/** Sign up (Sharetribe sends its own verification email) or log in. Returns a user token. */
export async function authenticate(clientId: string, a: Account): Promise<string> {
  if (a.mode === "signup") {
    const anon = await token(clientId);
    try {
      await post(anon, "/current_user/create", {
        email: a.email,
        password: a.password,
        firstName: a.firstName,
        lastName: a.lastName,
        protectedData: a.phone ? { phoneNumber: a.phone } : {},
      });
    } catch (e) {
      if (e instanceof StError && e.status === 409) throw new StError(409, "email-taken", "An account with this email already exists. Log in instead.");
      throw e;
    }
  }
  return token(clientId, { username: a.email, password: a.password });
}

/** A recent inquiry by this user with the same request key (duplicate guard), or null. */
export async function findDuplicate(userToken: string, requestKey: string): Promise<string | null> {
  const r = await get(userToken, "/transactions/query?only=order&perPage=50");
  const hit = (r.data as { id: string; attributes: { protectedData?: Record<string, unknown> } }[]).find((t) => t.attributes.protectedData?.requestKey === requestKey);
  return hit?.id ?? null;
}

/** Inquiry transaction (no payment) + first message. Returns the transaction id once BOTH are saved. */
export async function sendInquiry(userToken: string, listingId: string, processAlias: string, protectedData: Record<string, unknown>, message: string): Promise<string> {
  const tx = await post(userToken, "/transactions/initiate", {
    processAlias,
    transition: "transition/inquire-without-payment",
    params: { listingId, protectedData },
  });
  const id = tx.data.id as string;
  await post(userToken, "/messages/send", { transactionId: id, content: message });
  return id;
}

export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}
