/**
 * Optional AI step for lifecycle email, through Vercel AI Gateway (founder decision 2026-10-14):
 * the model picks one of the templates the rules already made due and may write ONE intro line.
 * It never writes the email, never sees the customer's email address, and nothing it returns is used
 * unless it passes validIntro(): no numbers that aren't in the facts, no prices, availability,
 * booking, guarantee or urgency claims, no links or contact details. Any failure → default copy.
 *
 * Enabled by LIFECYCLE_AI_MODEL (e.g. "anthropic/claude-haiku-5.5"). On Vercel the gateway
 * authenticates with the deployment's OIDC token; AI_GATEWAY_API_KEY works elsewhere.
 */
import { generateText, Output } from "ai";
import { z } from "zod";
import type { Personalizer } from "./engine";
import { defaultIntro, longDate, type LifecycleTemplate, type LifecycleVars } from "./templates";

const PURPOSE: Record<LifecycleTemplate, string> = {
  saved_search: "the customer asked us to email the results they were looking at",
  search_abandonment_1h: "the customer searched about an hour ago and left without starting checkout",
  search_abandonment_24h: "the customer searched yesterday and hasn't come back; a gentle next-day note, different from an earlier reminder",
  checkout_abandonment_1h: "the customer started Event Access checkout and didn't finish",
  purchased_no_unlock_2h: "the customer bought Event Access but hasn't opened any operator contact yet; customer service, not a sales pitch",
};

/** Facts the model may use, and the only numbers its line may contain. */
export function factsFor(v: LifecycleVars) {
  return {
    city: v.city,
    state: v.state,
    eventDate: longDate(v.eventDate),
    eventType: v.eventType,
    ride: v.ride,
    ridePlural: v.ridePlural,
    alternativeTo: v.alternativeTo,
    operators: v.operators,
    nearestMiles: v.nearestMiles,
  };
}

const BANNED = /\$|https?:|www\.|@|\b(guarantee[ds]?|available|availability|book(ed|ing)?|reserve[ds]?|hurry|last chance|act now|limited|discount|deal|sale|free|price[ds]?|cheap|expir\w*|only \d|spots?|sell(ing)? out)\b/i;

/** A model line is used only if it is short, plain and adds no facts of its own. */
export function validIntro(line: unknown, v: LifecycleVars): line is string {
  if (typeof line !== "string") return false;
  const s = line.trim();
  if (s.length < 20 || s.length > 220 || /[\n\r]/.test(s) || BANNED.test(s)) return false;
  const facts = factsFor(v);
  const allowed = new Set([String(facts.operators), String(facts.nearestMiles ?? ""), ...(facts.eventDate.match(/\d+/g) ?? [])].filter(Boolean));
  return (s.match(/\d+/g) ?? []).every((n) => allowed.has(n));
}

export function gatewayPersonalizer(env: Record<string, string | undefined> = process.env): Personalizer | null {
  const model = env.LIFECYCLE_AI_MODEL;
  if (!model) return null;
  return async ({ options }) => {
    const templates = options.map((o) => o.template) as [LifecycleTemplate, ...LifecycleTemplate[]];
    const facts = factsFor(options[0].vars);
    const { output } = await generateText({
      model,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(6000),
      output: Output.object({ schema: z.object({ template: z.enum(templates), intro: z.string() }) }),
      system:
        "You help a carnival ride rental directory follow up with a customer by email. The email body is a fixed, approved template; you only choose which of the offered templates fits best and write its first sentence. " +
        "Write one warm, plain sentence (under 200 characters) in US English. Use only the facts given. Do not add numbers, prices, availability, booking, guarantees, urgency, discounts, links or contact details. Operators are independent companies; we only provide their contact details.",
      prompt: JSON.stringify({
        facts,
        options: options.map((o) => ({ template: o.template, purpose: PURPOSE[o.template], defaultFirstSentence: defaultIntro(o.template, o.vars) })),
      }),
    });
    const pick = options.find((o) => o.template === output.template) ?? options[0];
    return { template: pick.template, intro: validIntro(output.intro, pick.vars) ? output.intro.trim() : null };
  };
}
