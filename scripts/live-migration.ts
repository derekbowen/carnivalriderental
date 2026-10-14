/**
 * Test → Live migration helpers (2026-10-14). Sharetribe has no Console "copy data to Live"; we
 * recreate the production-intended Test inventory in Live with the existing importers
 * (import:companies, import:listings, import:photos, all --target live) and use this script for
 * the parts the importers do not cover:
 *
 *   npm run migrate:live -- snapshot-test   # Test public catalog (anonymous Marketplace API) → imports/migration/test-public.json
 *   npm run migrate:live -- reconcile       # workbook rows vs current Test public state → imports/migration/reconcile.json
 *   npm run migrate:live -- verify          # Live read-back: counts, relationships, privacy of public fields
 *   npm run migrate:live -- redirects       # Test listing id → Live listing id (public ids only) → src/lib/inventory/test-to-live.json
 *   npm run migrate:live -- wave [--size N] # indexing wave 2: N indexable URLs from fully gated pages → src/lib/inventory/indexing-wave-2.json
 *   npm run migrate:live -- cohort          # indexed-set manifest + expansion map → reports/indexing-cohort.json, reports/indexing-expansion.json
 *
 * Every phase asserts the marketplace it reads by name before using the data. Nothing here writes to
 * Test. Private outputs live in imports/migration/ (gitignored): they map public ids to company slugs.
 */
import fs from "node:fs";
import { writeJsonAtomic } from "./lib/files";
import { AUTH, INTEG, MKT, TEST_MARKETPLACE } from "./lib/sharetribe-client";

const DIR = "imports/migration";
const LIVE_MARKETPLACE = "CarnivalRental";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const phase = process.argv[2];

async function token(clientId: string, secret?: string): Promise<string> {
  const body = new URLSearchParams({ client_id: clientId, grant_type: "client_credentials", scope: secret ? "integ" : "public-read", ...(secret ? { client_secret: secret } : {}) });
  const res = await fetch(AUTH, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`auth failed (HTTP ${res.status})`);
  return ((await res.json()) as { access_token: string }).access_token;
}

async function get<T>(url: string, tok: string, spacingMs: number): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    await sleep(spacingMs);
    let res: Response;
    try {
      res = await fetch(url, { headers: { Authorization: `Bearer ${tok}`, Accept: "application/json" }, signal: AbortSignal.timeout(30000) });
    } catch (e) {
      if (attempt < 4) continue;
      throw e;
    }
    if ((res.status === 429 || res.status >= 500) && attempt < 8) {
      await sleep(Math.min(60000, 2000 * 2 ** attempt));
      continue;
    }
    if (!res.ok) throw new Error(`GET ${new URL(url).pathname} → HTTP ${res.status}`);
    return (await res.json()) as T;
  }
}

type Img = { id: string; type: string; attributes: { variants: Record<string, { url: string; width: number; height: number } | undefined> } };
type ListingDoc = {
  id: string;
  attributes: { title: string; description: string; state: string; geolocation?: { lat: number; lng: number } | null; publicData?: Record<string, unknown>; metadata?: Record<string, unknown> };
  relationships?: { images?: { data: { id: string }[] }; author?: { data?: { id: string } } };
};
export interface TestPublicListing {
  id: string;
  authorId: string | null;
  title: string;
  description: string;
  state: string;
  geolocation: { lat: number; lng: number } | null;
  publicData: Record<string, unknown>;
  metadata: Record<string, unknown>;
  images: { id: string; url: string | null; width: number | null; height: number | null }[];
}

/** Anonymous read of every operator listing in Test (published is all the public API returns). */
async function snapshotTest() {
  const clientId = process.env.SHARETRIBE_CLIENT_ID;
  if (!clientId) throw new Error("SHARETRIBE_CLIENT_ID (Test public client id) is not set");
  const tok = await token(clientId);
  const name = (await get<{ data: { attributes: { name: string } } }>(`${MKT}/marketplace/show`, tok, 0)).data.attributes.name;
  if (name !== TEST_MARKETPLACE) throw new Error(`Refusing: SHARETRIBE_CLIENT_ID points at "${name}", not "${TEST_MARKETPLACE}".`);
  const out: TestPublicListing[] = [];
  for (let page = 1; ; page++) {
    const qs = new URLSearchParams({ pub_listingType: "operator-ride-rental", perPage: "100", page: String(page), include: "images,author", "fields.user": "", "fields.image": "variants.scaled-xlarge" });
    const body = await get<{ data: ListingDoc[]; included?: Img[]; meta: { totalPages: number; totalItems: number } }>(`${MKT}/listings/query?${qs}`, tok, 1100);
    const imgs = new Map((body.included ?? []).filter((i) => i.type === "image").map((i) => [i.id, i.attributes.variants["scaled-xlarge"]]));
    for (const l of body.data) {
      const a = l.attributes;
      out.push({
        id: l.id,
        authorId: l.relationships?.author?.data?.id ?? null,
        title: a.title,
        description: a.description,
        state: a.state,
        geolocation: a.geolocation ?? null,
        publicData: a.publicData ?? {},
        metadata: a.metadata ?? {},
        images: (l.relationships?.images?.data ?? []).map((r) => {
          const v = imgs.get(r.id);
          return { id: r.id, url: v?.url ?? null, width: v?.width ?? null, height: v?.height ?? null };
        }),
      });
    }
    process.stdout.write(`\r  page ${page}/${body.meta.totalPages} (${out.length}/${body.meta.totalItems})`);
    if (page >= body.meta.totalPages) break;
  }
  console.log("");
  writeJsonAtomic(`${DIR}/test-public.json`, { capturedAt: new Date().toISOString(), marketplace: name, source: "Marketplace API, anonymous public-read (Test)", count: out.length, listings: out });
  const withImg = out.filter((l) => l.images.some((i) => i.url)).length;
  console.log(`Test public catalog: ${out.length} operator-ride-rental listings (${withImg} with an image). → ${DIR}/test-public.json`);
}

const readJson = <T>(f: string): T => JSON.parse(fs.readFileSync(f, "utf8")) as T;
const stable = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));

/**
 * Freshness check: the workbook predates any correction made in Test. For every planned row, compare
 * the anonymous payload Live would receive with the listing Test serves today (title, description,
 * public data, rounded geolocation). Also lists Test listings with no planned row (removed or QA) and
 * planned rows that Test no longer serves.
 */
async function reconcile() {
  const { planListings, buildAnonymousListingPayload, PUBLIC_LISTING_METADATA_KEYS } = await import("../src/lib/imports/operator-listings");
  const wb = readJson<Parameters<typeof planListings>[0]>("imports/company-accounts/source/workbook.json");
  const plan = planListings(wb);
  const test = readJson<{ capturedAt: string; marketplace: string; listings: TestPublicListing[] }>(`${DIR}/test-public.json`);
  if (test.marketplace !== TEST_MARKETPLACE) throw new Error("test-public.json is not a Test snapshot");
  const testMap = readJson<{ listings: Record<string, { listingId: string }> }>("imports/listings/carnivalrental-test/mapping.json").listings;
  const byId = new Map(test.listings.map((l) => [l.id, l]));
  const byExt = new Map(test.listings.filter((l) => typeof l.metadata.importExternalId === "string").map((l) => [l.metadata.importExternalId as string, l]));

  const diffs: { externalId: string; testId: string; fields: string[] }[] = [];
  const missingInTest: string[] = [];
  let identical = 0;
  let mappingDisagrees = 0;
  for (const row of plan.rows) {
    const t = byExt.get(row.externalId) ?? (testMap[row.externalId] ? byId.get(testMap[row.externalId].listingId) : undefined);
    if (!t) {
      missingInTest.push(row.externalId);
      continue;
    }
    if (testMap[row.externalId] && testMap[row.externalId].listingId !== t.id) mappingDisagrees++;
    const p = buildAnonymousListingPayload(row, plan.authors.get(row.authorExternalId)!);
    const fields: string[] = [];
    if (p.title !== t.title) fields.push("title");
    // The unclaimed notice changed with the business model (Test still shows the request-desk notice);
    // compare the notice and the operator's text separately.
    const [pNotice, ...pBody] = (p.description ?? "").split("\n\n");
    const [tNotice, ...tBody] = t.description.split("\n\n");
    if (pNotice !== tNotice) fields.push("description.notice");
    if (pBody.join("\n\n") !== tBody.join("\n\n")) fields.push("description.body");
    const tp = { ...t.publicData };
    if (stable(p.publicData) !== stable(tp)) {
      for (const k of new Set([...Object.keys(p.publicData), ...Object.keys(tp)])) if (stable(p.publicData[k]) !== stable(tp[k])) fields.push(`publicData.${k}`);
    }
    const g = t.geolocation;
    if (!g || Math.abs(g.lat - p.geolocation.lat) > 1e-9 || Math.abs(g.lng - p.geolocation.lng) > 1e-9) fields.push("geolocation");
    const pubMeta = Object.fromEntries(Object.entries(t.metadata).filter(([k]) => (PUBLIC_LISTING_METADATA_KEYS as readonly string[]).includes(k)));
    if (stable(pubMeta) !== stable(p.metadata)) fields.push("metadata(public keys)");
    if (fields.length) diffs.push({ externalId: row.externalId, testId: t.id, fields });
    else identical++;
  }
  const planned = new Set(plan.rows.map((r) => r.externalId));
  const notPlanned = test.listings.filter((l) => !(typeof l.metadata.importExternalId === "string" && planned.has(l.metadata.importExternalId as string)));
  const fieldTally: Record<string, number> = {};
  for (const d of diffs) for (const f of d.fields) fieldTally[f] = (fieldTally[f] ?? 0) + 1;
  const report = {
    generatedAt: new Date().toISOString(),
    testSnapshot: test.capturedAt,
    planned: plan.rows.length,
    heldForReview: plan.held.length,
    identicalToTest: identical,
    differing: diffs.length,
    fieldTally,
    missingInTest,
    testListingsNotPlanned: notPlanned.map((l) => ({ id: l.id, title: l.title, qa: l.metadata.qa === true, requestDesk: l.metadata.requestDesk === true, importExternalId: l.metadata.importExternalId ?? null })),
    mappingDisagrees,
    diffs,
  };
  writeJsonAtomic(`${DIR}/reconcile.json`, report);
  console.log(`Planned ${report.planned} (held ${report.heldForReview}); identical to Test ${identical}; differing ${diffs.length} ${JSON.stringify(fieldTally)}; missing in Test ${missingInTest.length}; Test listings not planned ${notPlanned.length}; mapping disagreements ${mappingDisagrees}`);
}

/** Live clients by their own names (never whichever generic credentials a shell last held). */
async function liveTokens() {
  const id = process.env.SHARETRIBE_LIVE_INTEGRATION_CLIENT_ID;
  const secret = process.env.SHARETRIBE_LIVE_INTEGRATION_CLIENT_SECRET;
  const pub = process.env.SHARETRIBE_LIVE_CLIENT_ID;
  if (!id || !secret || !pub) throw new Error("SHARETRIBE_LIVE_* credentials are not set");
  const integ = await token(id, secret);
  const anon = await token(pub);
  const a = (await get<{ data: { attributes: { name: string } } }>(`${INTEG}/marketplace/show`, integ, 0)).data.attributes.name;
  const b = (await get<{ data: { attributes: { name: string } } }>(`${MKT}/marketplace/show`, anon, 0)).data.attributes.name;
  if (a !== LIVE_MARKETPLACE || b !== LIVE_MARKETPLACE) throw new Error(`Refusing: Live clients point at "${a}" / "${b}", not "${LIVE_MARKETPLACE}".`);
  return { integ, anon };
}

async function pages<T>(base: string, params: Record<string, string>, tok: string, spacing: number, each: (body: T & { meta: { totalPages: number } }) => void) {
  for (let page = 1; ; page++) {
    const body = await get<T & { meta: { totalPages: number } }>(`${base}?${new URLSearchParams({ ...params, perPage: "100", page: String(page) })}`, tok, spacing);
    each(body);
    if (page >= (body.meta.totalPages ?? 1)) break;
  }
}

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const LINK = /https?:\/\/|www\./i;
const PHONE = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/;

/**
 * Read-back of Live through both APIs. Integration API: every account and listing, duplicates by
 * import id, author relationships (Live author = the Live account of the same company as in Test).
 * Marketplace API as an anonymous visitor: nothing identifying in any public field, authors
 * anonymous, and a sample of photo URLs actually serving images.
 */
async function verify() {
  const { planListings, authorNames, PUBLIC_LISTING_METADATA_KEYS } = await import("../src/lib/imports/operator-listings");
  const { PUBLIC_USER_METADATA_KEYS, personNames } = await import("../src/lib/imports/company-accounts");
  const { OPERATOR_PLACEHOLDER, IDENTITY_PUBLIC_KEYS, UNCLAIMED_NOTICE } = await import("../src/lib/operators/claim");
  const { integ, anon } = await liveTokens();
  const plan = planListings(readJson("imports/company-accounts/source/workbook.json"));
  const companyRows = new Map([...plan.authors.values()].map((r) => [r.metadata.companyId, r]));

  // Integration API: accounts and listings with private markers.
  type IUser = { id: string; attributes: { state: string; email: string; profile: { displayName: string; publicData?: Record<string, unknown>; protectedData?: Record<string, unknown>; privateData?: Record<string, unknown>; metadata?: Record<string, unknown> } } };
  const users: IUser[] = [];
  await pages<{ data: IUser[] }>(`${INTEG}/users/query`, {}, integ, 150, (b) => users.push(...b.data));
  type IListing = { id: string; attributes: { state: string; title: string; privateData?: Record<string, unknown>; metadata?: Record<string, unknown> }; relationships: { author: { data: { id: string } }; images?: { data: { id: string }[] } } };
  const listings: IListing[] = [];
  await pages<{ data: IListing[] }>(`${INTEG}/listings/query`, { states: "draft,pendingApproval,published,closed", include: "author,images", "fields.user": "", "fields.image": "" }, integ, 150, (b) => listings.push(...b.data));

  const imported = users.filter((u) => typeof u.attributes.profile.privateData?.importExternalId === "string");
  const userByCompany = new Map<string, IUser[]>();
  for (const u of imported) {
    const c = String(u.attributes.profile.privateData?.companyId);
    userByCompany.set(c, [...(userByCompany.get(c) ?? []), u]);
  }
  const dupUsers = [...userByCompany.entries()].filter(([, v]) => v.length > 1).map(([c]) => c);
  const byImportId = new Map<string, IListing[]>();
  for (const l of listings) {
    const k = l.attributes.privateData?.importExternalId;
    if (typeof k === "string") byImportId.set(k, [...(byImportId.get(k) ?? []), l]);
  }
  const dupListings = [...byImportId.entries()].filter(([, v]) => v.length > 1).map(([k]) => k);
  const unmarkedListings = listings.filter((l) => typeof l.attributes.privateData?.importExternalId !== "string").map((l) => l.id);

  // Relationships: each Live listing's author is the Live account of the listing's company; the Test
  // listing with the same import id was authored by that company's Test account.
  const testMapAcc = readJson<{ accounts: Record<string, { userId: string; companyId: string }> }>("imports/company-accounts/carnivalrental-test/mapping.json").accounts;
  const testUserByCompany = new Map(Object.values(testMapAcc).map((a) => [a.companyId, a.userId]));
  const test = readJson<{ listings: TestPublicListing[] }>(`${DIR}/test-public.json`).listings;
  const testByImport = new Map(test.map((l) => [l.metadata.importExternalId as string, l]));
  const relationshipDrift: string[] = [];
  const testToLive: Record<string, string> = {};
  for (const [k, ls] of byImportId) {
    const l = ls[0];
    const company = String(l.attributes.privateData?.companyId);
    const liveAuthor = userByCompany.get(company)?.[0]?.id;
    if (l.relationships.author.data.id !== liveAuthor) relationshipDrift.push(`${k}: Live author is not the company's Live account`);
    const t = testByImport.get(k);
    if (!t) relationshipDrift.push(`${k}: no Test listing`);
    else {
      if (t.authorId !== testUserByCompany.get(company)) relationshipDrift.push(`${k}: Test author is not the company's Test account`);
      testToLive[t.id] = l.id;
    }
  }

  // Marketplace API, anonymous: everything a visitor (or a scraper) can read.
  type PL = { id: string; attributes: { title: string; description: string; state: string; publicData?: Record<string, unknown>; metadata?: Record<string, unknown> }; relationships?: { author?: { data?: { id: string } }; images?: { data: { id: string }[] } } };
  type PU = { id: string; type: string; attributes: { profile?: { displayName?: string; bio?: string; publicData?: Record<string, unknown>; metadata?: Record<string, unknown> }; variants?: Record<string, { url: string }> } };
  const pub: PL[] = [];
  const included = new Map<string, PU>();
  await pages<{ data: PL[]; included?: PU[] }>(`${MKT}/listings/query`, { include: "author,images", "fields.image": "variants.landscape-crop" }, anon, 150, (b) => {
    pub.push(...b.data);
    for (const i of b.included ?? []) included.set(`${i.type}:${i.id}`, i);
  });
  const leaks: string[] = [];
  const liveById = new Map(listings.map((l) => [l.id, l]));
  for (const l of pub) {
    const a = l.attributes;
    const text = [a.title, a.description, JSON.stringify(a.publicData ?? {}), JSON.stringify(a.metadata ?? {})].join("\n");
    const extraMeta = Object.keys(a.metadata ?? {}).filter((k) => !(PUBLIC_LISTING_METADATA_KEYS as readonly string[]).includes(k) && k !== "photoSource");
    if (extraMeta.length) leaks.push(`${l.id}: public metadata ${extraMeta.join(",")}`);
    if (EMAIL.test(text)) leaks.push(`${l.id}: email in public listing text`);
    if (LINK.test(text)) leaks.push(`${l.id}: link in public listing text`);
    if (PHONE.test(text.replace(/"[a-zA-Z]+":-?\d+(\.\d+)?/g, ""))) leaks.push(`${l.id}: phone-like number in public listing text`);
    if (!a.description.startsWith(UNCLAIMED_NOTICE)) leaks.push(`${l.id}: description does not lead with the unclaimed notice`);
    const company = String(liveById.get(l.id)?.attributes.privateData?.companyId ?? "");
    const row = companyRows.get(company);
    const lower = text.toLowerCase();
    if (row) for (const n of authorNames(row)) if (n.length >= 4 && lower.includes(n.toLowerCase())) leaks.push(`${l.id}: company name in public listing text`);
    if (row) for (const n of personNames(row)) if (lower.includes(n)) leaks.push(`${l.id}: contact or owner name in public listing text`);
    if (company && lower.includes(company)) leaks.push(`${l.id}: company slug in public listing data`);
    const au = included.get(`user:${l.relationships?.author?.data?.id}`);
    const p = au?.attributes.profile;
    if (!p) leaks.push(`${l.id}: author not returned publicly (matching needs it)`);
    else {
      const authorText = JSON.stringify([p.displayName, p.bio, p.publicData ?? {}, p.metadata ?? {}]).toLowerCase();
      if (row) for (const n of [...authorNames(row), ...personNames(row)]) if (n.length >= 4 && authorText.includes(n.toLowerCase())) leaks.push(`${l.id}: author profile names the company or a contact`);
      if (EMAIL.test(authorText) || LINK.test(authorText) || PHONE.test(authorText)) leaks.push(`${l.id}: author profile carries an email, link or phone`);
      if (p.displayName !== OPERATOR_PLACEHOLDER.displayName) leaks.push(`${l.id}: author displayName not anonymous`);
      if (IDENTITY_PUBLIC_KEYS.some((k) => p.publicData?.[k] != null)) leaks.push(`${l.id}: author publicData identifies the company`);
      if (Object.keys(p.metadata ?? {}).some((k) => !(PUBLIC_USER_METADATA_KEYS as readonly string[]).includes(k))) leaks.push(`${l.id}: author public metadata ${Object.keys(p.metadata ?? {}).join(",")}`);
    }
  }
  // Photos render: every published listing with an image returns one; fetch a sample.
  const photoUrls = pub.flatMap((l) => {
    const img = included.get(`image:${l.relationships?.images?.data?.[0]?.id}`);
    return img?.attributes.variants?.["landscape-crop"]?.url ? [img.attributes.variants["landscape-crop"].url] : [];
  });
  // Every photo the public API returns must actually serve an image (HEAD, 8 at a time).
  const sample = photoUrls;
  const badPhotos: string[] = [];
  for (let i = 0; i < sample.length; i += 8) {
    await Promise.all(sample.slice(i, i + 8).map(async (u) => {
      let r = await fetch(u, { method: "HEAD", headers: { Accept: "image/jpeg,image/png,image/*" }, signal: AbortSignal.timeout(30000) }).catch(() => null);
      if (!r?.ok) r = await fetch(u, { headers: { Accept: "image/jpeg,image/png,image/*", Range: "bytes=0-1023" }, signal: AbortSignal.timeout(30000) }).catch(() => null);
      if (!r?.ok || !(r.headers.get("content-type") ?? "").startsWith("image/")) badPhotos.push(`HTTP ${r?.status} ${r?.headers.get("content-type")}`);
    }));
  }

  const states: Record<string, number> = {};
  for (const l of listings) states[l.attributes.state] = (states[l.attributes.state] ?? 0) + 1;
  const userStates: Record<string, number> = {};
  for (const u of imported) userStates[u.attributes.state] = (userStates[u.attributes.state] ?? 0) + 1;
  const withImage = listings.filter((l) => (l.relationships.images?.data.length ?? 0) > 0).length;
  const summary = {
    checkedAt: new Date().toISOString(),
    marketplace: LIVE_MARKETPLACE,
    accounts: { total: users.length, imported: imported.length, byState: userStates, duplicatesByCompany: dupUsers.length },
    listings: { total: listings.length, byState: states, withImage, duplicatesByImportId: dupListings.length, withoutImportMarker: unmarkedListings.length },
    relationships: { checked: byImportId.size, drift: relationshipDrift.length },
    publicRead: { publishedListings: pub.length, leaks: leaks.length, photosChecked: sample.length, photoFailures: badPhotos.length },
  };
  writeJsonAtomic(`${DIR}/verify-live.json`, { ...summary, dupUsers, dupListings, unmarkedListings, relationshipDrift: relationshipDrift.slice(0, 200), leaks: leaks.slice(0, 200), badPhotos });
  writeJsonAtomic(`${DIR}/test-to-live.json`, { generatedAt: summary.checkedAt, testToLive });
  console.log(JSON.stringify(summary, null, 1));
  if (dupUsers.length || dupListings.length || relationshipDrift.length || leaks.length || badPhotos.length) process.exitCode = 1;
}

/**
 * Old Test listing URLs → the same listing in Live (src/lib/inventory/test-to-live.json, committed).
 * Built from `verify` (import id ↔ Test listing ↔ Live listing) and kept only where the Live listing
 * is in the current Live snapshot. Public ids only: no company, import id or slug. Test ids without a
 * Live counterpart (QA ride, request desk) are left out, so they keep answering 404.
 */
async function redirects() {
  const pairs = readJson<{ testToLive: Record<string, string> }>(`${DIR}/test-to-live.json`).testToLive;
  const snap = readJson<{ rides: { id: string }[] }>("src/lib/inventory/rides.json");
  const live = new Set(snap.rides.map((r) => r.id));
  const test = new Set(readJson<{ listings: { id: string }[] }>(`${DIR}/test-public.json`).listings.map((l) => l.id));
  const map = Object.fromEntries(Object.entries(pairs).filter(([t, l]) => test.has(t) && live.has(l) && !live.has(t)).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync("src/lib/inventory/test-to-live.json", `${JSON.stringify({ generatedAt: new Date().toISOString(), from: TEST_MARKETPLACE, to: LIVE_MARKETPLACE, count: Object.keys(map).length, map })}\n`);
  console.log(`test-to-live.json: ${Object.keys(map).length} Test listing ids → Live (of ${Object.keys(pairs).length} pairs; ${live.size} rides in the Live snapshot)`);
}

/** Live author of every published listing and contactability of every account (booleans only). */
async function liveSupply(integ: string) {
  const { contactFromUser, isContactable, channelsOf } = await import("../src/lib/access/contacts");
  const authorOf = new Map<string, string>();
  await pages<{ data: { id: string; relationships: { author: { data: { id: string } } } }[] }>(`${INTEG}/listings/query`, { states: "published", "fields.listing": "state", include: "author", "fields.user": "" }, integ, 150, (b) => {
    for (const l of b.data) authorOf.set(l.id, l.relationships.author.data.id);
  });
  const contactable = new Map<string, boolean>();
  await pages<{ data: (Parameters<typeof contactFromUser>[0] & { id: string })[] }>(`${INTEG}/users/query`, {}, integ, 150, (b) => {
    for (const u of b.data) contactable.set(u.id, isContactable(channelsOf(contactFromUser(u))));
  });
  return (rides: { id: string }[]) => {
    const authors = new Set(rides.map((r) => authorOf.get(r.id)).filter((x): x is string => !!x));
    return { operators: authors.size, contactableOperators: [...authors].filter((a) => contactable.get(a)).length, ridesWithoutLiveAuthor: rides.filter((r) => !authorOf.has(r.id)).length };
  };
}
type Distinct = Awaited<ReturnType<typeof liveSupply>>;

/**
 * Every city and ride + city page outside `exclude` that passes every gate except template copy
 * approval (supply threshold, head of its near-duplicate group) and has at least the Event Access
 * minimum of distinct contactable Live operators; ranked by contactable operators, then rides.
 * Also tallies why the others are out. Same thresholds and radius as the gates; nothing is relaxed.
 */
async function gatedCandidates(exclude: Set<string>, distinct: Distinct) {
  const inv = await import("../src/lib/inventory");
  const { DEFAULT_PRODUCT } = await import("../src/lib/access/config");
  const tallies: Record<string, Record<string, number>> = { city: {}, "ride-city": {} };
  const candidates: { path: string; family: string; rides: number; operators: number; contactableOperators: number }[] = [];
  for (const r of inv.inventoryRoutes()) {
    if (exclude.has(r.path)) continue;
    const t = tallies[r.family];
    const thin = r.gate.reasons.find((x) => x.startsWith("only "));
    if (thin) { t.thin = (t.thin ?? 0) + 1; continue; }
    if (inv.duplicateGateReason(r.path)) { t.nearDuplicateNotHead = (t.nearDuplicateNotHead ?? 0) + 1; continue; }
    const [, st, slug, type] = r.path.split("/");
    const c = inv.cityBySlugs(st, slug)!;
    const near = inv.ridesNear(c.lat, c.lng);
    const pool = type ? near.filter((x) => x.rideType === type) : near;
    const d = distinct(pool);
    if (d.contactableOperators < DEFAULT_PRODUCT.minimumMatches) { t.fewerThan3ContactableOperators = (t.fewerThan3ContactableOperators ?? 0) + 1; continue; }
    t.candidate = (t.candidate ?? 0) + 1;
    candidates.push({ path: r.path, family: r.family, rides: pool.length, operators: d.operators, contactableOperators: d.contactableOperators });
  }
  candidates.sort((a, b) => b.contactableOperators - a.contactableOperators || b.rides - a.rides || a.path.localeCompare(b.path));
  return { candidates, tallies };
}

/**
 * First-wave indexing manifest (reports/indexing-cohort.json, committed, counts only): for every
 * cohort path, the supply gate inputs from the Live snapshot, distinct operators, its near-duplicate
 * status, and how many DISTINCT operators behind it have a usable contact channel in Live (read with
 * the Integration API through contacts.ts; only booleans leave this function). Gates are evaluated
 * with indexing switched on for this process only, exactly as production will evaluate them.
 */
async function cohort() {
  process.env.APP_ENV = "production";
  process.env.PUBLIC_INDEXING = "true";
  const { integ } = await liveTokens();
  const inv = await import("../src/lib/inventory");
  const { PSEO_PILOT } = await import("../src/lib/inventory/pilot");
  const { categoryHubGate } = await import("../src/lib/seo/pseo");
  const { categoryPageById } = await import("../src/lib/content/category-pages");
  const { DEFAULT_PRODUCT } = await import("../src/lib/access/config");
  const distinct = await liveSupply(integ);

  const rows: Record<string, unknown>[] = [];
  for (const p of PSEO_PILOT.paths) {
    const [, stateSlug, citySlug, rideType] = p.split("/");
    const c = inv.cityBySlugs(stateSlug, citySlug);
    if (!c) {
      rows.push({ path: p, eligible: false, reasons: ["no such city"] });
      continue;
    }
    const near = inv.ridesNear(c.lat, c.lng);
    const pool = rideType ? near.filter((r) => r.rideType === rideType) : near;
    const gate = rideType ? inv.inventoryRideCityGate(c, rideType) : inv.inventoryCityGate(c);
    const d = distinct(pool);
    const reasons = [...gate.reasons];
    if (d.contactableOperators < DEFAULT_PRODUCT.minimumMatches) reasons.push(`only ${d.contactableOperators} distinct contactable operators (Event Access needs ${DEFAULT_PRODUCT.minimumMatches})`);
    rows.push({ path: p, family: rideType ? "ride-city" : "city", rides: pool.length, threshold: rideType ? inv.PSEO_INVENTORY.rideCityMinRides : inv.PSEO_INVENTORY.cityMinRides, radiusMiles: inv.PSEO_INVENTORY.radiusMiles, ...d, duplicateHead: !inv.duplicateGateReason(p), eligible: reasons.length === 0, reasons });
  }
  for (const p of PSEO_PILOT.corePaths) {
    if (p.startsWith("/categories/")) {
      const page = categoryPageById(p.split("/")[2])!;
      const g = categoryHubGate(page, { records: [], rejected: [], fetchedAt: "", source: "sharetribe-marketplace-api" });
      const types = new Set(inv.rideTypesInCategory(page.id).map((t) => t.id));
      const pool = inv.RIDES.filter((r) => r.rideType && types.has(r.rideType));
      const d = distinct(pool);
      const reasons = [...g.reasons];
      if (d.contactableOperators < DEFAULT_PRODUCT.minimumMatches) reasons.push(`only ${d.contactableOperators} distinct contactable operators`);
      rows.push({ path: p, family: "category", rides: pool.length, ...d, eligible: reasons.length === 0, reasons });
    } else {
      const g = inv.coreHubGate(p);
      rows.push({ path: p, family: "core", rides: inv.RIDES.length, ...distinct(inv.RIDES), eligible: g.indexable, reasons: g.reasons });
    }
  }
  const out = { generatedAt: new Date().toISOString(), marketplace: LIVE_MARKETPLACE, inventoryGeneratedAt: inv.INVENTORY_GENERATED_AT, authorization: PSEO_PILOT.authorization, contentReview: PSEO_PILOT.contentReview, cohort: rows };
  fs.mkdirSync("reports", { recursive: true });
  fs.writeFileSync("reports/indexing-cohort.json", `${JSON.stringify(out, null, 2)}\n`);

  // Expansion map (NOT enabled): every gated page outside the indexed set, with why the others are out.
  const { candidates, tallies } = await gatedCandidates(new Set([...PSEO_PILOT.paths, ...PSEO_PILOT.corePaths]), distinct);
  fs.writeFileSync(
    "reports/indexing-expansion.json",
    `${JSON.stringify({ generatedAt: out.generatedAt, inventoryGeneratedAt: out.inventoryGeneratedAt, status: "NOT ENABLED: candidates for a later wave, each needs its own go", criteria: ["meets the supply gate (city ≥ 10 rides within 200 mi; ride + city ≥ 5 matching rides)", "head of its near-duplicate group (index-eligible.json)", `≥ ${DEFAULT_PRODUCT.minimumMatches} distinct operators with a usable contact channel in Live (Event Access minimum)`, "then: rendered-page review, and Search Console evidence from the first wave (impressions, 'Duplicate without user-selected canonical', crawl stats) before widening"], excludedByReason: tallies, nextCityCandidates: candidates.filter((x) => x.family === "city").slice(0, 25), nextRideCityCandidates: candidates.filter((x) => x.family === "ride-city").slice(0, 25) }, null, 2)}\n`,
  );
  console.log(`Expansion map: ${JSON.stringify(tallies)} → reports/indexing-expansion.json`);
  const failing = rows.filter((r) => !r.eligible);
  console.log(`Indexed set: ${rows.length - failing.length}/${rows.length} eligible (${rows.filter((r) => r.family === "city").length} city, ${rows.filter((r) => r.family === "ride-city").length} ride + city, ${rows.filter((r) => r.family === "category").length} category, ${rows.filter((r) => r.family === "core").length} core)`);
  for (const r of failing) console.log(`✗ ${String(r.path).padEnd(34)} rides ${r.rides} · operators ${r.operators} · contactable ${r.contactableOperators}  — ${(r.reasons as string[]).join("; ")}`);
}

/**
 * Second indexing wave (founder instruction 2026-10-14: "lets index 1000 pages"). Selects only pages
 * that already pass every gate unchanged: category hubs with enough supply and ≥ the Event Access
 * minimum of contactable operators, then city and ride + city pages from gatedCandidates (supply
 * threshold, near-duplicate group head, contactable operators), strongest first, until the indexed
 * set (wave 1 + wave 2) reaches --size URLs (default 1000). Writes src/lib/inventory/indexing-wave-2.json
 * (public paths only). Thresholds are untouched; the wave only stands in for template copy approval on
 * these exact paths, and every gate is evaluated again on every build.
 */
async function wave() {
  const i = process.argv.indexOf("--size");
  const size = i > 0 ? Number(process.argv[i + 1]) : 1000;
  if (!Number.isInteger(size) || size < 13) throw new Error("--size must be an integer ≥ 13");
  process.env.APP_ENV = "production";
  process.env.PUBLIC_INDEXING = "true";
  const { integ } = await liveTokens();
  const inv = await import("../src/lib/inventory");
  const { FIRST_COHORT_PATHS, FIRST_COHORT_CORE_PATHS } = await import("../src/lib/inventory/pilot");
  const { CATEGORY_PAGES } = await import("../src/lib/content/category-pages");
  const { PSEO_THRESHOLDS } = await import("../src/lib/seo/pseo");
  const { paths } = await import("../src/lib/seo/routes");
  const { DEFAULT_PRODUCT } = await import("../src/lib/access/config");
  const distinct = await liveSupply(integ);

  const categoryPaths: string[] = [];
  for (const page of CATEGORY_PAGES) {
    const p = paths.category(page.id);
    if (FIRST_COHORT_CORE_PATHS.includes(p)) continue;
    const types = new Set(inv.rideTypesInCategory(page.id).map((t) => t.id));
    const pool = inv.RIDES.filter((r) => r.rideType && types.has(r.rideType));
    const d = distinct(pool);
    const ok = inv.categoryInventoryCount(page.id) >= PSEO_THRESHOLDS.categoryMinOfferings && d.contactableOperators >= DEFAULT_PRODUCT.minimumMatches;
    console.log(`${ok ? "✓" : "✗"} ${p.padEnd(34)} rides ${pool.length} · contactable operators ${d.contactableOperators}`);
    if (ok) categoryPaths.push(p);
  }
  const fixed = FIRST_COHORT_CORE_PATHS.length + FIRST_COHORT_PATHS.length + categoryPaths.length;
  if (size < fixed) throw new Error(`--size ${size} is below the fixed set (${fixed}: wave 1 + ${categoryPaths.length} eligible category hubs); refusing to enable more URLs than asked`);
  const { candidates } = await gatedCandidates(new Set([...FIRST_COHORT_PATHS, ...FIRST_COHORT_CORE_PATHS]), distinct);
  const picked = candidates.slice(0, Math.max(0, size - fixed));
  const minOps = picked.length ? picked[picked.length - 1].contactableOperators : null;
  const out = {
    wave: 2,
    generatedAt: new Date().toISOString(),
    inventoryGeneratedAt: inv.INVENTORY_GENERATED_AT,
    authorization: 'Founder instruction, 2026-10-14: "lets index 1000 pages" (widen indexing from the 13-URL first cohort to about 1,000 URLs).',
    contentReview: "Automated rendered-page checks of every URL on the production domain after deploy (scripts/verify-release.ts: 200, index, self-canonical, no private contact data, no Offer or price). NOT reviewed page by page by the founder.",
    selection: [
      "only pages that pass every gate unchanged: supply threshold (city ≥ 10 rides within 200 mi; ride + city ≥ 5 matching rides; category ≥ 3), head of its near-duplicate group, ≥ 3 distinct Live operators with a usable contact channel",
      "ranked by distinct contactable operators, then rides, then path; the top ones fill the indexed set to the target",
      `target ${size} indexable URLs including wave 1 (13); wave 2 adds ${categoryPaths.length} category hubs and ${picked.length} city / ride + city pages (≥ ${minOps} contactable operators each)`,
    ],
    targetIndexableUrls: size,
    candidatesAvailable: candidates.length,
    categoryPaths,
    paths: picked.map((c) => c.path),
  };
  fs.writeFileSync("src/lib/inventory/indexing-wave-2.json", `${JSON.stringify(out, null, 2)}\n`);
  const fam = (f: string) => picked.filter((c) => c.family === f).length;
  console.log(`Wave 2: ${categoryPaths.length} category hubs + ${fam("city")} city + ${fam("ride-city")} ride + city (of ${candidates.length} gated candidates); indexed set ${fixed + picked.length}. → src/lib/inventory/indexing-wave-2.json`);
}

/**
 * Sanitized, committed migration report (reports/live-migration-2026-10-14.json): expected / imported /
 * held / failed per entity, the Live read-back summary, and photo gaps by public Live listing id with
 * the reason. No company names, slugs, import ids, emails or contacts.
 */
async function report() {
  const { planImport } = await import("../src/lib/imports/company-accounts");
  const { planListings } = await import("../src/lib/imports/operator-listings");
  type Wb = Parameters<typeof planImport>[0] & { listings: unknown[]; source: { file: string; sha256: string; provenance?: string } };
  const wb = readJson<Wb>("imports/company-accounts/source/workbook.json");
  const c = planImport(wb);
  const l = planListings(wb);
  const lastOutcome = (file: string, key: string) => {
    const m = new Map<string, string>();
    if (fs.existsSync(file)) for (const line of fs.readFileSync(file, "utf8").split("\n")) if (line) {
      const e = JSON.parse(line) as Record<string, string>;
      if (e[key] && e.outcome) m.set(e[key], e.outcome);
    }
    return m;
  };
  const tally = (m: Map<string, string>) => [...m.values()].reduce<Record<string, number>>((a, o) => ((a[o] = (a[o] ?? 0) + 1), a), {});
  /** Every outcome ever recorded per entity (a later idempotent rerun reports "exists" for the same row). */
  const everTally = (file: string, key: string) => {
    const m = new Map<string, Set<string>>();
    if (fs.existsSync(file)) for (const line of fs.readFileSync(file, "utf8").split("\n")) if (line) {
      const e = JSON.parse(line) as Record<string, string>;
      if (e[key] && e.outcome) m.set(e[key], (m.get(e[key]) ?? new Set()).add(e.outcome));
    }
    const out: Record<string, number> = {};
    for (const set of m.values()) for (const o of set) out[o] = (out[o] ?? 0) + 1;
    return out;
  };
  const acc = lastOutcome("imports/company-accounts/carnivalrental/ledger.jsonl", "externalId");
  const lst = lastOutcome("imports/listings/carnivalrental/ledger.jsonl", "externalId");
  const pho = lastOutcome("imports/photos/carnivalrental/ledger.jsonl", "externalId");
  const listingMap = readJson<{ listings: Record<string, { listingId: string }> }>("imports/listings/carnivalrental/mapping.json").listings;
  const gapsFile = readJson<{ ridesWithoutSourcePhoto: number; gaps: { externalId: string; listingId: string; reason: string }[] }>("imports/photos/carnivalrental/gaps.json");
  const withSource = new Set(l.rows.filter((r) => r.privateData.sourceImageUrl).map((r) => r.externalId));
  const noSource = l.rows.filter((r) => !withSource.has(r.externalId)).map((r) => ({ liveListingId: listingMap[r.externalId]?.listingId ?? null, reason: "no source photo on the operator's website (none was ever imported)" }));
  const verifyFile = readJson<Record<string, unknown>>(`${DIR}/verify-live.json`);
  const reconcileFile = readJson<{ planned: number; heldForReview: number; fieldTally: Record<string, number>; missingInTest: string[]; testListingsNotPlanned: { qa: boolean; requestDesk: boolean }[] }>(`${DIR}/reconcile.json`);
  const out = {
    generatedAt: new Date().toISOString(),
    from: TEST_MARKETPLACE,
    to: LIVE_MARKETPLACE,
    source: { kind: "native Google Sheet → XLSX export (Drive API) → scripts/company-import-extract.py", note: wb.source.provenance ?? null, exportSha256: wb.source.sha256 },
    freshness: {
      comparedWith: "Test public catalog (anonymous Marketplace API), same day",
      plannedListings: reconcileFile.planned,
      missingInTest: reconcileFile.missingInTest.length,
      differences: reconcileFile.fieldTally,
      explanation: "description.notice: Test still shows the retired request-desk notice; Live uses the current Event Access notice. description.body: company names Test left in 5 descriptions are removed in Live (stricter name set). Titles, public fields, geolocation: identical.",
      testListingsNotMigrated: { qaRide: reconcileFile.testListingsNotPlanned.filter((x) => x.qa).length, requestDesk: reconcileFile.testListingsNotPlanned.filter((x) => x.requestDesk).length },
    },
    accounts: { companiesSheet: c.tierCounts, expected: c.eligible.length, heldVerifyFirst: c.held.length, excluded: c.excludedCompanies.length, qaAccountNotMigrated: 1, lastOutcome: tally(acc), everRecorded: everTally("imports/company-accounts/carnivalrental/ledger.jsonl", "externalId") },
    listings: { rowsInSource: wb.listings.length, expected: l.rows.length, heldForReview: l.held.length, lastOutcome: tally(lst), everRecorded: everTally("imports/listings/carnivalrental/ledger.jsonl", "externalId") },
    photos: { expectedFromTest: l.rows.length - noSource.length - gapsFile.gaps.length, lastOutcome: tally(pho), everRecorded: everTally("imports/photos/carnivalrental/ledger.jsonl", "externalId"), gapsWithSourceButNoTestPhoto: gapsFile.gaps.map((g) => ({ liveListingId: g.listingId, reason: g.reason })), ridesWithoutSourcePhoto: noSource },
    liveReadBack: Object.fromEntries(Object.entries(verifyFile).filter(([k]) => ["checkedAt", "accounts", "listings", "relationships", "publicRead"].includes(k))),
  };
  fs.mkdirSync("reports", { recursive: true });
  fs.writeFileSync("reports/live-migration-2026-10-14.json", `${JSON.stringify(out, null, 2)}\n`);
  console.log(JSON.stringify({ accounts: out.accounts, listings: out.listings, photos: { ...out.photos, gapsWithSourceButNoTestPhoto: out.photos.gapsWithSourceButNoTestPhoto.length, ridesWithoutSourcePhoto: out.photos.ridesWithoutSourcePhoto.length }, liveReadBack: out.liveReadBack }, null, 1));
}

/**
 * The production matching path against Live, read-only: the app's own resolveCriteria + matchOperators
 * with the Sharetribe operator source (Live Marketplace API for authors, Live Integration API for
 * contactability), and one contact lookup per case reduced to booleans. Proves search snapshot ids,
 * matching, pricing tier and contact lookup all point at the same Live dataset. Prints no contact data.
 */
async function match() {
  process.env.APP_ENV = "production";
  process.env.SHARETRIBE_CLIENT_ID = process.env.SHARETRIBE_LIVE_CLIENT_ID;
  process.env.SHARETRIBE_INTEGRATION_CLIENT_ID = process.env.SHARETRIBE_LIVE_INTEGRATION_CLIENT_ID;
  process.env.SHARETRIBE_INTEGRATION_CLIENT_SECRET = process.env.SHARETRIBE_LIVE_INTEGRATION_CLIENT_SECRET;
  await liveTokens(); // asserts both Live clients name "CarnivalRental"
  const { matchOperators, memoryContactCache } = await import("../src/lib/access/matching");
  const { operatorSource, channelsOf } = await import("../src/lib/access/contacts");
  const { resolveCriteria } = await import("../src/lib/access/pricing");
  const inv = await import("../src/lib/inventory");
  const map = readJson<{ map: Record<string, string> }>("src/lib/inventory/test-to-live.json").map;
  const source = operatorSource();
  const cache = memoryContactCache();
  const ferrisTest = Object.entries(map).find(([, live]) => inv.RIDES.find((r) => r.id === live)?.rideType === "ferris-wheel")?.[0] ?? null;
  const cases = [
    { name: "Columbus, OH · any ride", city: ["ohio", "columbus"], input: {} },
    { name: "Columbus, OH · Ferris wheel", city: ["ohio", "columbus"], input: { rideType: "ferris-wheel" } },
    { name: "Chicago, IL · Ferris wheel", city: ["illinois", "chicago"], input: { rideType: "ferris-wheel" } },
    { name: "Austin, TX · carousel", city: ["texas", "austin"], input: { rideType: "carousel" } },
    { name: "Columbus, OH · old Test Ferris listing id, client says carousel", city: ["ohio", "columbus"], input: { listingId: ferrisTest, rideType: "carousel" } },
  ];
  const out = [];
  for (const c of cases) {
    const city = inv.cityBySlugs(c.city[0], c.city[1])!;
    const r = await matchOperators({ lat: city.lat, lng: city.lng, state: city.stateAbbr, ...c.input }, source, cache);
    const first = r.operators.find((o) => o.contactable);
    const contact = first ? await source.contact(first.operatorId) : null;
    const ch = contact ? channelsOf(contact) : null;
    const crit = resolveCriteria(c.input);
    out.push({ case: c.name, tier: r.criteria.tier, resolverTier: crit.tier, listingResolvedToLive: c.input.listingId ? crit.listingId : undefined, operators: r.operators.length, contactable: r.contactableCount, candidateListings: r.candidateListings, firstContactLookup: ch ? { hasPhone: ch.hasPhone, hasEmail: ch.hasEmail, hasWebsite: ch.hasWebsite, hasCompanyName: !!contact?.companyName } : null });
  }
  fs.mkdirSync("reports", { recursive: true });
  fs.writeFileSync("reports/live-matching-check.json", `${JSON.stringify({ checkedAt: new Date().toISOString(), marketplace: LIVE_MARKETPLACE, cases: out }, null, 2)}\n`);
  for (const o of out) console.log(JSON.stringify(o));
}

const phases: Record<string, () => Promise<void>> = { "snapshot-test": snapshotTest, reconcile, verify, redirects, cohort, wave, report, match };

(async () => {
  const run = phases[phase];
  if (!run) throw new Error(`usage: live-migration.ts ${Object.keys(phases).join("|")}`);
  await run();
})().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});

export { INTEG, LIVE_MARKETPLACE };
