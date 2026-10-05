/**
 * End-to-end proof against the Test marketplace with controlled QA accounts only:
 *   operator (claimed QA company) logs in → sees only its own inventory → edits its ride →
 *   cannot edit another company's ride → QA customer sends an inquiry to the claimed ride →
 *   operator sees it and replies → refresh/login again shows the same thread.
 *
 *   npm run qa:journey
 *
 * The QA operator's password is set once through "forgot password" (mail received by Resend
 * inbound) and stored as QA_OPERATOR_PASSWORD in .env.local. Prints evidence (ids) as it goes.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import { AUTH, MKT } from "./lib/sharetribe-client";
import { INQUIRY_ALIAS } from "../src/lib/operators/claim";

const OP_EMAIL = "qa+operator1@carnivalriderental.us";
const QA_LISTING = "6ac349fd-c1ab-4ad7-afbb-fa15011f46e3";
const OTHER_COMPANY_LISTING = "6ac255a8-e335-44cc-93e0-5e60a95b017c"; // Alamo Attractions — Grand Carousel
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const cid = () => process.env.SHARETRIBE_CLIENT_ID!;

async function tok(creds?: { u: string; p: string }) {
  const r = await fetch(AUTH, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(creds ? { client_id: cid(), grant_type: "password", scope: "user", username: creds.u, password: creds.p } : { client_id: cid(), grant_type: "client_credentials", scope: "public-read" }) });
  if (!r.ok) throw new Error(`auth HTTP ${r.status}`);
  return (await r.json()).access_token as string;
}
async function api(t: string, path: string, body?: unknown) {
  const r = await fetch(`${MKT}${path}`, { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${t}`, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => null);
  return { status: r.status, j };
}

async function operatorPassword(): Promise<string> {
  if (process.env.QA_OPERATOR_PASSWORD) return process.env.QA_OPERATOR_PASSWORD;
  const since = Date.now();
  await api(await tok(), "/password_reset/request", { email: OP_EMAIL });
  for (let i = 0; i < 24; i++) {
    await sleep(5000);
    const list = await (await fetch("https://api.resend.com/emails/receiving?limit=20", { headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` } })).json();
    const hit = (list.data ?? []).find((m: { to: string[]; subject: string; created_at: string }) => m.to.includes(OP_EMAIL) && /password reset/i.test(m.subject) && Date.parse(m.created_at) >= since - 5000);
    if (!hit) continue;
    const full = await (await fetch(`https://api.resend.com/emails/receiving/${hit.id}`, { headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` } })).json();
    const t = decodeURIComponent((String(full.text ?? full.html).match(/[?&]t=([^&"\s]+)/) ?? [])[1] ?? "");
    const pw = crypto.randomBytes(18).toString("base64url");
    const r = await api(await tok(), "/password_reset/reset", { email: OP_EMAIL, passwordResetToken: t, newPassword: pw });
    if (r.status !== 200) throw new Error(`reset HTTP ${r.status}`);
    fs.appendFileSync(".env.local", `QA_OPERATOR_EMAIL=${OP_EMAIL}\nQA_OPERATOR_PASSWORD=${pw}\n`);
    return pw;
  }
  throw new Error("no reset email for the QA operator");
}

const ok = (cond: boolean, label: string) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) process.exitCode = 1;
};

(async () => {
  // Operator
  const op = await tok({ u: OP_EMAIL, p: await operatorPassword() });
  const me = await api(op, "/current_user/show");
  ok(me.status === 200 && me.j.data.attributes.email === OP_EMAIL, `operator logs in as ${OP_EMAIL} (user ${me.j?.data?.id})`);
  const own = await api(op, "/own_listings/query?perPage=100");
  const ids = (own.j?.data ?? []).map((l: { id: string }) => l.id);
  ok(ids.length === 1 && ids[0] === QA_LISTING, `operator sees exactly its own inventory (${ids.join(",")})`);
  const stamp = new Date().toISOString();
  const ed = await api(op, "/own_listings/update", { id: QA_LISTING, publicData: { riderRules: `QA edit ${stamp}` } });
  ok(ed.status === 200, "operator edits its own ride (own_listings/update)");
  const bad = await api(op, "/own_listings/update", { id: OTHER_COMPANY_LISTING, publicData: { riderRules: "should fail" } });
  ok(bad.status >= 400, `operator CANNOT edit another company's ride (HTTP ${bad.status})`);

  // Customer → claimed operator's ride
  const cu = await tok({ u: process.env.QA_CUSTOMER_EMAIL!, p: process.env.QA_CUSTOMER_PASSWORD! });
  const tx = await api(cu, "/transactions/initiate", { processAlias: INQUIRY_ALIAS, transition: "transition/inquire-without-payment", params: { listingId: QA_LISTING, protectedData: { source: "qa-journey", eventDate: "2027-07-04", eventCity: "Austin", eventState: "TX" } } });
  ok(tx.status === 200, `customer sends an inquiry to the claimed operator (tx ${tx.j?.data?.id})`);
  const txId = tx.j?.data?.id;
  await api(cu, "/messages/send", { transactionId: txId, content: "QA: is the ride free on 2027-07-04 in Austin?" });
  const pay = await api(cu, "/transactions/initiate", { processAlias: "default-booking/release-1", transition: "transition/request-payment", params: { listingId: QA_LISTING } });
  ok(pay.status >= 400, `a payment transaction on a non-bookable ride is refused (HTTP ${pay.status})`);

  // Operator inbox + reply; fresh login shows the same state
  const inbox = await api(op, "/transactions/query?only=sale&perPage=20");
  ok((inbox.j?.data ?? []).some((t: { id: string }) => t.id === txId), "the inquiry is in the operator's inbox");
  const rep = await api(op, "/messages/send", { transactionId: txId, content: "QA operator reply: yes, that date is open." });
  ok(rep.status === 200, "operator replies");
  const cu2 = await tok({ u: process.env.QA_CUSTOMER_EMAIL!, p: process.env.QA_CUSTOMER_PASSWORD! });
  const thread = await api(cu2, `/messages/query?transaction_id=${txId}&perPage=10`);
  ok((thread.j?.data ?? []).length >= 2, `after logging in again the customer sees the thread (${(thread.j?.data ?? []).length} messages)`);
})().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
