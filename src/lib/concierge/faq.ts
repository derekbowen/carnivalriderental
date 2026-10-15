/**
 * Customer-service answers that need no AI: the common pass and policy questions, answered from the
 * product rows and the published Event Access policy (/access-policy). The chat uses them when the
 * AI step is unavailable, so a customer is never left without an answer.
 */
import { formatPrice, type AccessProducts } from "../access/config";
import { bothTiersSentence } from "../access/copy";
import { BRAND } from "../config";
import { paths } from "../seo/routes";
import { listOf } from "./state";

const SUPPORT = `support@${BRAND.domain}`;
const site = (path: string) => `${BRAND.domain}${path}`;

/** Shown when no answer applies and the AI step is unavailable. */
export const NO_AI_REPLY = `I can't answer that automatically right now. To find rides for your event, use the event form at ${site(paths.concierge())}. For anything else, email ${SUPPORT}.`;

const DEAD_CONTACT = /\b(disconnected|wrong number|not in service|out of service|bounced?|bouncing|undeliverable|(number|email|phone|contact|website|site|link) (is )?(dead|down|gone|(does ?n'?t|doesnt|did ?n'?t|didnt|is ?n'?t|is not) work(ing)?))\b/;
const NO_REPLY = /\b((did ?n'?t|didnt|did not|does ?n'?t|doesnt|won'?t|wont|not|never|nobody|no one)\b[^.?!]{0,30}\b(answer(ing)?|respond(ing)?|repl(y|ying|ied)|pick(ing|ed)? up|call(ed)? (me )?back|get back to me)|no (answer|reply|response)|voice ?mail|unanswered)\b/;
const normalise = (message: string) => message.toLowerCase().replace(/[’‘]/g, "'");

/** A report that an unlocked operator didn't reply or a contact didn't work: support, not a request to reveal contacts. */
export const isContactProblem = (message: string) => DEAD_CONTACT.test(normalise(message)) || NO_REPLY.test(normalise(message));

const DIDNT_WORK = `open your full pass and press "This contact didn't work" next to that operator. We check it and give the unlock back when we confirm the contact was dead, and where most of your unlocks were dead we refund.`;

/** Questions in the order they are checked: the first match answers. */
const FAQ: { test: RegExp; answer: (p: AccessProducts) => string }[] = [
  {
    // A contact that doesn't work at all (before "no answer": "doesn't work" is not a missed call).
    test: DEAD_CONTACT,
    answer: () => `Sorry about that. If a contact doesn't work (number disconnected, email bounces, website gone), ${DIDNT_WORK}`,
  },
  {
    test: NO_REPLY,
    answer: () =>
      `Operators are independent businesses and don't always pick up right away. Leave a voicemail with your event date and location, then try their email or website from your pass. If the contact itself doesn't work (number disconnected, email bounces, website gone), ${DIDNT_WORK} We can't refund because an operator is busy or doesn't reply, since that's their decision.`,
  },
  {
    test: /\b(expire[sd]?|expiry|expiration|run out|how long (do|does|is|will|can)|valid (for|until))\b/,
    answer: (p) => {
      const std = p.standard ?? p.ferris;
      if (!std) return `Each pass is valid for a set number of days from purchase, shown on your receipt. Contacts you've already unlocked stay on your pass after that.`;
      return `Each Event Access pass is valid for ${std.validityDays} days from purchase and covers up to ${std.unlockLimit} operator unlocks. After that you can't unlock new operators, but the contacts you've already unlocked stay on your pass.`;
    },
  },
  {
    test: /\b(refund|money back|charge ?back|dispute)\b/,
    answer: (p) =>
      `If you haven't unlocked any operator yet, email ${SUPPORT} within 14 days of purchase for a full refund of what you paid${p.standard ? ` (${formatPrice(p.standard.priceCents, p.standard.currency)}${p.ferris ? ` or ${formatPrice(p.ferris.priceCents, p.ferris.currency)}` : ""}, as on your receipt)` : ""}. If an unlocked contact doesn't work, ${DIDNT_WORK} We don't refund because an operator was busy, quoted more than you hoped, or didn't reply.`,
  },
  {
    test: /\b(lost (my )?(pass|link|access)|can'?t find (my )?(pass|link)|cannot find (my )?(pass|link)|recover|new link|log ?in|sign ?in)\b/,
    answer: () => `Go to ${site(paths.passRecover())} and enter the email you paid with. We'll send you a fresh link to your pass.`,
  },
  {
    test: /\b(how much|price|pricing|cost|costs|fee|what is event access|what do i get)\b/,
    answer: (p) => {
      const std = p.standard ?? p.ferris;
      return `${bothTiersSentence(p)}${std ? ` Each purchase covers one event and one ride requirement, with direct contact details for up to ${std.unlockLimit} matching independent operators over ${std.validityDays} days.` : ""} You see how many operators match before you pay. The rental itself (price, dates, delivery and payment) is arranged directly with the operator.`;
    },
  },
  {
    test: /\b(book|booking|reserve|reservation|availability|available on)\b/,
    answer: () =>
      `We don't book rides or confirm dates. Event Access gives you direct contact details for matching operators, and you arrange availability, price and payment with them. You can also press "Request Availability" on a ride and our team will look into it; nothing is sent to operators automatically.`,
  },
  {
    test: /\b(human|real person|talk to (someone|a person|you)|speak (to|with)|customer service|contact (you|support)|support)\b/,
    answer: () => `You can reach our team at ${SUPPORT}.`,
  },
];

/** "Did you send me the email?", "I never got the email", "where's my email". */
const EMAIL_STATUS = /\b(did|have|has|was|were|is)\b[^.?!]{0,40}\b(send|sent|email(ed)?|mail(ed)?)\b|\b(where'?s|where is|wheres)\b[^.?!]{0,20}\bemail\b|\b(didn'?t|did not|haven'?t|have not|never) (get|got|receive[d]?|see|saw)\b[^.?!]{0,20}\bemail\b|\bno email\b/;

export interface EmailStatus { emailOnFile: boolean; savedSearchEmailSent: boolean; missingForEmail: string[] }

/** Whether the options email went out, from the application's own record (never a guess). */
export function emailStatusAnswer(message: string, state: EmailStatus): string | null {
  if (!EMAIL_STATUS.test(normalise(message))) return null;
  if (state.savedSearchEmailSent) return "Yes. Your ride options were emailed to the address you gave; check your spam folder if you don't see them. Tell me if you'd like them sent again or to a different address.";
  if (state.missingForEmail.length) return `Not yet. I still need your ${listOf(state.missingForEmail)} before I can match operators and email the options. Tell me in the chat and I'll send them.`;
  if (!state.emailOnFile) return `Not yet. Press "Email me these options" under the ride results and enter your email, and I'll send them right away.`;
  return `Not yet. Press "Email me these options" under the ride results and I'll send them to the address you gave.`;
}

/** A policy answer for a customer-service question, or null when none applies. */
export function faqAnswer(message: string, products: AccessProducts, state?: EmailStatus): string | null {
  const fromState = state ? emailStatusAnswer(message, state) : null;
  if (fromState) return fromState;
  const text = normalise(message);
  return FAQ.find((f) => f.test.test(text))?.answer(products) ?? null;
}
