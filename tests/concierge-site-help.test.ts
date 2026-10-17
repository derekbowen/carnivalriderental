/**
 * The chat assistant after the 2026-10-17 transcript ("How much is it" → "$99 for up to 5 operators",
 * no help finding pages, never offering to email): every price says it is the one-time contact fee,
 * the assistant knows the site's pages and only those become links, and the application itself
 * offers once to email the options, sending them when the chat completes the details.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

let extraction = "{}", reply = "Happy to help.";
vi.mock("ai", () => ({
  generateText: vi.fn(async (args: { system?: string }) => ({ text: String(args.system).startsWith("Extract event planning") ? extraction : reply })),
}));

import { DEFAULT_PRODUCT, FERRIS_PRODUCT } from "@/lib/access/config";
import { faqAnswer } from "@/lib/concierge/faq";
import { OWNERSHIP_NOTE, PRICE_NOTE, withOwnershipGuard, withPriceContext } from "@/lib/concierge/help";
import { chatSegments, SITE_GUIDE } from "@/lib/concierge/site-guide";
import { emailOfferLine } from "@/lib/concierge/state";
import { paths } from "@/lib/seo/routes";
import { POST } from "@/app/api/concierge/route";

const products = { standard: { ...DEFAULT_PRODUCT, active: true }, ferris: { ...FERRIS_PRODUCT, active: true } };

describe("price answers explain what the fee buys", () => {
  it("adds the contact-fee note to a bare price, and leaves an explained one alone", () => {
    const bare = "Event Access is $99 for up to 5 operators for 30 days, and Ferris Wheel Event Access is $199.";
    expect(withPriceContext(bare)).toBe(`${bare} ${PRICE_NOTE}`);
    const explained = "Event Access is $99, a one-time fee for the operators' contact details; the rental is priced by each operator.";
    expect(withPriceContext(explained)).toBe(explained);
    expect(withPriceContext("Tell me where your event is.")).toBe("Tell me where your event is.");
  });

  it("the no-AI price answer says it is not the ride rental", () => {
    const price = faqAnswer("How much is it", products)!;
    expect(price).toContain("$99");
    expect(price).toContain("$199");
    expect(price).toContain("one-time fee for direct contact details");
    expect(price).toContain("not the ride rental");
  });
});

describe("site help", () => {
  it("explains the three steps when someone doesn't know where to start", () => {
    for (const q of ["How does this website work?", "I'm confused", "where do I start", "How does Event Access work?"]) {
      const a = faqAnswer(q, products)!;
      expect(a, q).toContain("three steps");
      expect(a, q).toContain("not the ride rental");
    }
    // Event descriptions still go to the search, policy questions to their own answers.
    expect(faqAnswer("Ferris wheel in Columbus OH on June 15", products)).toBeNull();
    expect(faqAnswer("Can I get a refund?", products)).toContain("within 14 days");
  });

  it("links only the guide's own pages, in either form", () => {
    expect(chatSegments("Start at /s or carnivalriderental.us/pass/recover.")).toEqual([
      { text: "Start at " },
      { text: "/s", href: "/s" },
      { text: " or " },
      { text: "carnivalriderental.us/pass/recover", href: "/pass/recover" },
      { text: "." },
    ]);
    const made = chatSegments("See /rides/best-deals, https://evil.example/connect, and/or 12/05 or /internal.");
    expect(made.filter((s) => s.href)).toEqual([]);
    expect(chatSegments("Visit https://www.carnivalriderental.us/ today")[1]).toEqual({ text: "https://www.carnivalriderental.us", href: "/" });
    for (const p of SITE_GUIDE) expect(chatSegments(`go to ${p.path}`)[1]?.href, p.path).toBe(p.path);
    // Private and per-customer pages are never in the guide.
    expect(SITE_GUIDE.map((p) => p.path).some((p) => /^\/(internal|pass\/(?!recover)|requests|connect\/)/.test(p))).toBe(false);
    expect(SITE_GUIDE.map((p) => p.path)).toContain(paths.guide("how-to-rent-carnival-rides"));
  });
});

describe("the application offers to email the options, once", () => {
  const SITE = "http://localhost:3000";
  let cookie = "";
  const chat = async (message: string) => {
    const r = await POST(new Request(`${SITE}/api/concierge`, { method: "POST", headers: { origin: SITE, "Content-Type": "application/json", cookie }, body: JSON.stringify({ action: "chat", message }) }));
    const set = r.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    expect(r.status).toBe(200);
    return (await r.json()) as { message: string; captureOffered?: boolean; captured?: { emailed: boolean } };
  };
  const capture = async (email: string) => {
    const r = await POST(new Request(`${SITE}/api/concierge`, { method: "POST", headers: { origin: SITE, "Content-Type": "application/json", cookie }, body: JSON.stringify({ action: "capture", email, followupConsent: false }) }));
    expect(r.status).toBe(200);
    return (await r.json()) as { message: string; captured: { emailed: boolean } };
  };
  beforeEach(() => {
    vi.unstubAllEnvs();
    for (const [k, v] of Object.entries({ CONCIERGE_ENABLED: "true", APP_ENV: "development", DATABASE_PATH: ":memory:", ACCESS_DATABASE_URL: "", ACCESS_SESSION_SECRET: "site-help-test-secret-long-enough-00", ACCESS_OPERATOR_SOURCE: "fixture", ACCESS_RATE_LIMIT: "off", EMAIL_MODE: "test" })) vi.stubEnv(k, v);
    cookie = "";
    reply = "There are matching kiddie trains near Riverside.";
  });

  it("the first results carry the offer (naming what is missing); later turns don't repeat it", async () => {
    extraction = '{"city":"Riverside","state":"CA","requestedRides":[{"rideType":"kiddie-train","quantity":1}]}';
    const first = await chat("kiddie train in Riverside CA");
    expect(first.captureOffered).toBe(true);
    expect(first.message).toBe(`${reply}\n\n${emailOfferLine(["event date"])}`);
    const second = await chat("what about bigger rides?");
    expect(second.message).toBe(reply);
  });

  it("an email given before the date is used when the chat gets the date, and only then", async () => {
    extraction = '{"city":"Riverside","state":"CA","requestedRides":[{"rideType":"kiddie-train","quantity":1}]}';
    await chat("kiddie train in Riverside CA");
    const early = await capture("planner@fastmail.com");
    expect(early.captured.emailed).toBe(false);
    expect(early.message).toContain("I still need your event date");
    extraction = '{"eventDate":"2030-06-01"}';
    const done = await chat("it's on June 1 2030");
    expect(done.message.startsWith(reply)).toBe(true);
    expect(done.captured).toBeDefined();
    expect(done.message).toMatch(/Sent to planner@fastmail\.com|We couldn't send the email just now/);
    // Nothing more on later turns, even when the details change.
    extraction = '{"city":"Fresno"}';
    expect((await chat("actually Fresno")).captured).toBeUndefined();
  });

  it("a search made in the chat records the campaign that brought the visitor", async () => {
    extraction = '{"city":"Riverside","state":"CA","eventDate":"2030-06-01","requestedRides":[{"rideType":"kiddie-train","quantity":1}]}';
    await chat("kiddie train in Riverside CA on June 1 2030");
    cookie = `${cookie}; cr_src=google|cpc|crr-search`;
    await capture("planner@fastmail.com");
    const { accessDb } = await import("@/lib/access/db");
    expect(await (await accessDb()).query(`SELECT source, medium, campaign FROM access_attribution`)).toContainEqual({ source: "google", medium: "cpc", campaign: "crr-search" });
  });

  it("an email typed into the chat, without asking for the options, sends nothing", async () => {
    extraction = '{"city":"Riverside","state":"CA","email":"planner@fastmail.com","requestedRides":[{"rideType":"kiddie-train","quantity":1}]}';
    await chat("kiddie train in Riverside CA, I'm planner@fastmail.com");
    extraction = '{"eventDate":"2030-06-01"}';
    expect((await chat("June 1 2030")).captured).toBeUndefined();
  });
});

describe("why Event Access costs money, how direct contact works, broker questions (founder brief 2026-10-17)", () => {
  const noClaims = (a: string, q: string) => {
    expect(a, q).not.toMatch(/\bsav(e|es|ing|ings)\b/i);
    expect(a, q).not.toMatch(/\b(they|operators?) (own|owns)\b/i);
    expect(a, q).not.toMatch(/\b(guarantee|insured|certified)\b/i);
  };

  it("explains the access fee: what it buys, that browsing is free, up to the limit with the real number, no commission", () => {
    for (const q of ["Why does Event Access cost money?", "Why should I pay you?", "what am I paying for", "Why isn't it free?", "is it worth $99?", "What's the catch"]) {
      const a = faqAnswer(q, products)!;
      expect(a, q).toContain("seeing how many operators match your event is free");
      expect(a, q).toContain("$99");
      expect(a, q).toContain("$199");
      expect(a, q).toContain("up to 5 matching independent operators");
      expect(a, q).toContain("all of them when fewer match");
      expect(a, q).toContain("no commission or markup on the rental");
      noClaims(a, q);
    }
  });

  it("explains how direct contact works after paying", () => {
    for (const q of ["How does contacting operators work?", "what happens after I pay?", "How do I contact the operators"]) {
      const a = faqAnswer(q, products)!;
      expect(a, q).toContain("unlock them one at a time");
      expect(a, q).toContain("contact them yourself");
      expect(a, q).toContain("all of them when fewer match");
      expect(a, q).toContain(paths.passRecover());
      noClaims(a, q);
    }
  });

  it("answers broker questions without claiming ownership, and links the owner vs broker guide", () => {
    for (const q of ["Are you a broker?", "are you guys a middleman", "Do you own the rides?", "is there a markup", "who owns the ferris wheel"]) {
      const a = faqAnswer(q, products)!;
      expect(a, q).toContain("not a broker");
      expect(a, q).toContain("no commission or markup");
      expect(a, q).toContain("don't verify who owns each ride");
      noClaims(a, q);
      const link = chatSegments(a).find((x) => x.href);
      expect(link?.href, q).toBe(paths.guide("ride-owner-vs-rental-broker"));
    }
  });

  it("leaves ordinary ride and price questions to their own answers", () => {
    const price = faqAnswer("How much is it", products)!;
    expect(price).toContain("$99");
    expect(price).toContain("exact number of contacts");
    expect(faqAnswer("Do you have ferris wheels in Ohio?", products)).toBeNull();
  });

  it("an AI reply that asserts ownership gets the caveat; a hedged one is left alone", () => {
    const claim = "These operators own their rides, so you deal with them directly.";
    expect(withOwnershipGuard(claim)).toBe(`${claim} ${OWNERSHIP_NOTE}`);
    const hedged = "Ask each operator whether they own the ride before you sign.";
    expect(withOwnershipGuard(hedged)).toBe(hedged);
    expect(withOwnershipGuard("Tell me where your event is.")).toBe("Tell me where your event is.");
  });
});
