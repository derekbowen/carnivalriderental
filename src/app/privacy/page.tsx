import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, JsonLd } from "@/components/pseo";
import { BRAND } from "@/lib/config";
import { paths } from "@/lib/seo/routes";
import { pageGraph } from "@/lib/seo/structured-data";

export const metadata: Metadata = { title: `Privacy policy | ${BRAND.name}`, robots: { index: false, follow: true } };

/** Plain disclosure of what we collect and why. Not legal advice; counsel should review before launch. */
export default function PrivacyPage() {
  const crumbs = [{ name: "Home", path: paths.home() }, { name: "Privacy policy", path: paths.privacy() }];
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <JsonLd nodes={pageGraph({ path: paths.privacy(), name: "Privacy policy", description: `How ${BRAND.name} handles personal data.`, type: "WebPage", crumbs })} />
      <Breadcrumbs items={crumbs} />
      <h1 className="mt-6 text-4xl">Privacy policy</h1>
      <p className="mt-3 text-ink-soft">Last updated 2026-10-14. Controller: {BRAND.legalEntity}, operating {BRAND.domain}. Contact: <a className="underline" href={`mailto:support@${BRAND.domain}`}>support@{BRAND.domain}</a>.</p>

      <h2 className="mt-10 text-2xl">What we collect, and why</h2>
      <ul className="mt-2 list-disc space-y-2 pl-5 text-ink-soft">
        <li><strong>Event Access customers:</strong> your email, event date, city, state, ZIP (if given), event type, ride type, attendance and budget (if given), your purchase (amount, Stripe identifiers, status) and a record of which operators you unlocked and when, with a hashed IP address and browser type. Used to deliver your pass, support you, prevent abuse, and as evidence if a payment is disputed. Kept for seven years for accounting.</li>
        <li><strong>Concierge visitors:</strong> event details, ride quantities, setup constraints and contact information you provide are saved in our private ledger even if you do not purchase. Event requests are saved for review, not automatically sent to operators. When you use automatic interpretation, your message and prior event details are processed through Vercel AI Gateway and the configured model provider. Operator contact records and credentials are never sent to the model. You can use the structured form without AI. If you separately opt in to saved-search follow-ups, we keep your consent and schedule up to three reminders. These stop after a purchase or unsubscribe. Saved-search links expire for access after 30 days and never grant operator contact access.</li>
        <li><strong>Operators:</strong> company and contact details you publish or give us, and details collected from your public website when we indexed your rides (with the source recorded). Used to list your inventory and, with Event Access, to put customers in touch with you. You can correct or remove them at any time: <a className="underline" href={`mailto:claims@${BRAND.domain}`}>claims@{BRAND.domain}</a>.</li>
        <li><strong>Visitors:</strong> standard server logs (IP address, user agent, pages requested) kept briefly for security and to run the site. No advertising trackers.</li>
      </ul>

      <h2 className="mt-8 text-2xl">Who sees what</h2>
      <ul className="mt-2 list-disc space-y-2 pl-5 text-ink-soft">
        <li>Operator contact details are shown only to customers with a valid, paid pass, one operator at a time, and never to search engines or anonymous visitors.</li>
        <li>Customer details are never shown to operators by us; you choose what to tell an operator when you contact them.</li>
        <li>Processors we use: Stripe (payments), Sharetribe (operator accounts and listings), Supabase (our access ledger), Vercel (hosting), and our email provider (pass emails). Each receives only what its job needs.</li>
        <li>We don&rsquo;t sell personal data and we don&rsquo;t share it for advertising.</li>
      </ul>

      <h2 className="mt-8 text-2xl">Cookies</h2>
      <p className="mt-2 text-ink-soft">A pass cookie, set only when you open a pass, proves to our server that your browser may see that pass. It holds no personal data beyond pass identifiers and expires after 30 days. The concierge also uses a 30-day opaque session cookie to resume your saved event after checkout. Funnel events record actions and record identifiers, not message text or contact fields. Chat messages are kept in browser-tab session storage to continue your conversation and are sent to the model when you ask a follow-up question. There are no advertising cookies.</p>

      <h2 className="mt-8 text-2xl">Your rights</h2>
      <p className="mt-2 text-ink-soft">Ask us to access, correct or delete your data at <a className="underline" href={`mailto:support@${BRAND.domain}`}>support@{BRAND.domain}</a>. We keep purchase records we must keep by law. Residents of states with privacy statutes (California and others) have the rights those laws give them; we honour them regardless of where you live.</p>

      <p className="mt-8 text-sm text-muted">See also the <Link className="underline" href={paths.terms()}>Terms of Use</Link> and the <Link className="underline" href={paths.accessPolicy()}>Event Access policy</Link>.</p>
    </div>
  );
}
