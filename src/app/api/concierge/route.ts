import { consentToFollowup } from "@/lib/concierge/followup";
import { isBotRequest } from "@/lib/access/bot";
import { accessDb } from "@/lib/access/db";
import { AccessError, priceLabel } from "@/lib/access/service";
import { accessRuntime, clientIp, parseCookie, passCookieName, passIdsFromCookie, rateLimited } from "@/lib/access/runtime";
import { ipHash, sessionSecret } from "@/lib/access/session";
import { emptyLead } from "@/lib/concierge/defaults";
import { actionSchema } from "@/lib/concierge/schema";
import { conversation, createEventRequest, getPassStatus, getRequestStatus, getUnlockedOperators, requestAvailability, saveLead, searchRides, SESSION_COOKIE, unlockOperator } from "@/lib/concierge/service";
import { customerHelp } from "@/lib/concierge/help";
import { extractLead } from "@/lib/concierge/extract";
import { track } from "@/lib/concierge/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const response = (data: unknown, status = 200, token?: string) => Response.json(data, { status, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow", ...(token ? { "Set-Cookie": `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${process.env.APP_ENV !== "development" ? "; Secure" : ""}` } : {}) } });
export async function POST(req: Request) {
  if (await isBotRequest()) return response({ error: "Request blocked" }, 403);
  // All cookie-authenticated mutations require a same-origin JSON request.
  if (req.headers.get("origin") !== new URL(req.url).origin) return response({ error: "Forbidden" }, 403);
  if (!req.headers.get("content-type")?.startsWith("application/json")) return response({ error: "JSON required" }, 415);
  if (rateLimited(`concierge:${clientIp(req) ?? "anon"}`, 40, 10 * 60e3)) return response({ error: "Too many requests. Please try again later." }, 429);
  let token: string | undefined;
  try {
    const text = await req.text();
    if (text.length > 16000) return response({ error: "Request too large" }, 413);
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { return response({ error: "Invalid JSON" }, 400); }
    const parsed = actionSchema.safeParse(raw);
    if (!parsed.success) return response({ error: "Check the event fields and try again." }, 400);
    const a = parsed.data;
    let db;
    try { db = await accessDb(); } catch {
      // Informational support may run without a ledger. Never pretend a lead/request was saved.
      if (a.action !== "chat") return response({ error: "Event saving and pass services are not configured in this preview. You can still ask customer-service questions." }, 503);
      const publicDetails = await extractLead(a.message, emptyLead);
      const search = searchRides(publicDetails, publicDetails.requestedRides[0]?.rideType ?? null);
      const message = await customerHelp(a.message, a.history ?? [], { total: search.total, cards: search.cards.map(c => ({ title: c.title, region: c.homeState, miles: c.miles })), availability: search.availability });
      return response({ message: `${message}\n\nPreview note: event details have not been saved; checkout and pass services are unavailable here.`, details: publicDetails, search, selectedRideType: publicDetails.requestedRides[0]?.rideType ?? null });
    }
    const c = await conversation(db, parseCookie(req.headers.get("cookie"), SESSION_COOKIE));
    token = c.token;
    const s = c.session;
    // Missing access-session config should not disable anonymous search/lead capture.
    const ids = parseCookie(req.headers.get("cookie"), passCookieName) ? passIdsFromCookie(parseCookie(req.headers.get("cookie"), passCookieName)) : [];
    let result: Record<string, unknown> = {};
    if (a.action === "followup") {
      await consentToFollowup(db, s.id, a.email);
      result.message = "Your search is saved and follow-up consent recorded. Reminders are not enabled yet. You can unsubscribe at any time from a reminder.";
    } else if (a.action === "chat") {
      // Contact questions never cause a privileged read, even if prompted to ignore the paywall.
      if (/\b(phone|email|address|contact|number)\b/i.test(a.message) && /\b(operator|supplier|company)\b/i.test(a.message)) {
        result.message = "Operator contacts require Event Access and an eligible unlock. Use your verified pass below; I cannot bypass the paywall.";
      } else {
        try {
          await saveLead(db, s, await extractLead(a.message, s.details));
          const selected = s.details.requestedRides[0]?.rideType ?? null;
          const search = searchRides(s.details, selected);
          await db.query(`UPDATE concierge_sessions SET searched = 1, search_type = ? WHERE id = ?`, [selected, s.id]);
          await track(db, "inventory_search", { sessionId: s.id });
          if (search.total === 0) await track(db, "zero_result_search", { sessionId: s.id });
          result.search = search;
          result.selectedRideType = selected;
          result.message = await customerHelp(a.message, a.history ?? [], { total: search.total, cards: search.cards.map(c => ({ title: c.title, category: c.rideClassLabel, region: c.homeState, miles: c.miles })), availability: search.availability });
        } catch {
          result.message = "Automatic interpretation is unavailable right now. You can still enter your event details below and search without AI.";
        }
      }
    } else if (a.action === "save") {
      await saveLead(db, s, a.details);
      result.message = "Event details saved.";
    } else if (a.action === "search") {
      result.search = searchRides(s.details, a.rideType);
      await db.query(`UPDATE concierge_sessions SET searched = 1, search_type = ? WHERE id = ?`, [a.rideType, s.id]);
      await track(db, "inventory_search", { sessionId: s.id });
      if ((result.search as { total: number }).total === 0) await track(db, "zero_result_search", { sessionId: s.id });
    } else if (a.action === "checkout") {
      const rt = await accessRuntime();
      const { event, product, sellable } = await createEventRequest(rt, s, a.rideType);
      await db.query(`UPDATE concierge_sessions SET searched = 1, search_type = ? WHERE id = ?`, [a.rideType, s.id]);
      result.offer = { eventId: event.id, operators: event.matchedOperators, productName: product.name, price: priceLabel(product), unlockLimit: product.unlockLimit, validityDays: product.validityDays, sellable };
      // Show the authoritative quote first; checkout submission stays on the existing server route.
    } else if (a.action === "availability") {
      result.request = await requestAvailability(db, s, a.listingId);
    } else if (a.action === "unlock") {
      const rt = await accessRuntime();
      const unlocked = await unlockOperator(rt, ids, a.passId, a.operatorId, { ipHash: ipHash(clientIp(req), sessionSecret()), userAgent: req.headers.get("user-agent") });
      result.contact = unlocked.unlock;
    }
    if (a.action === "status" || a.action === "unlock") {
      if (s.searched) {
        result.search = searchRides(s.details, s.searchType);
        result.selectedRideType = s.searchType;
      }
      const passes = [];
      for (const id of ids) {
        try {
          const status = await getPassStatus(db, ids, id);
          const unlocks = await getUnlockedOperators(db, ids, id);
          if (unlocks.length) await track(db, "contact_viewed", { sessionId: s.id, passId: id });
          passes.push({ ...status, unlocks });
        } catch (e) { if (!(e instanceof AccessError)) throw e; }
      }
      result.passes = passes;
      result.requests = await getRequestStatus(db, s);
    }
    return response({ ...result, details: s.details }, 200, token);
  } catch (e) {
    if (e instanceof AccessError) return response({ error: e.code === "invalid" ? "Add a valid future event date, city, state and email, then try again." : e.message }, e.code === "forbidden" ? 403 : 400, token);
    // Never serialize SDK, SQL or network errors (may carry credentials or protected fields).
    return response({ error: "Concierge is temporarily unavailable. Please use Find a ride or try again later." }, 503, token);
  }
}
