import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, JsonLd } from "@/components/pseo";
import { DEFAULT_PRODUCT, formatPrice } from "@/lib/access/config";
import { bothTiersSentence } from "@/lib/access/copy";
import { accessProductsForDisplay } from "@/lib/access/runtime";
import { BRAND } from "@/lib/config";
import { sitePageRobots } from "@/lib/seo/pseo";
import { canonicalUrl, paths } from "@/lib/seo/routes";
import { pageGraph } from "@/lib/seo/structured-data";

export const metadata: Metadata = { title: `Event Access policy | ${BRAND.name}`, alternates: { canonical: canonicalUrl(paths.accessPolicy()) }, robots: sitePageRobots(paths.accessPolicy()) };

/**
 * Plain commercial disclosure of what Event Access buys. Figures come from the product rows
 * (access_products; seeded defaults when the ledger is unreachable). The configuration in force when
 * you buy governs that purchase and is stated at checkout and on the receipt.
 */
export default async function AccessPolicyPage() {
  const crumbs = [{ name: "Home", path: paths.home() }, { name: "Event Access policy", path: paths.accessPolicy() }];
  const products = await accessProductsForDisplay();
  const p = products.standard ?? { ...DEFAULT_PRODUCT, active: true };
  const f = products.ferris;
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <JsonLd nodes={pageGraph({ path: paths.accessPolicy(), name: "Event Access policy", description: "What Event Access includes, what it does not, and how refunds work.", type: "WebPage", crumbs })} />
      <Breadcrumbs items={crumbs} />
      <h1 className="mt-6 text-4xl">Event Access: what you buy, and refunds</h1>
      <p className="mt-3 text-ink-soft">Last updated 2026-10-12. Plain language; the <Link className="underline" href={paths.terms()}>Terms of Use</Link> govern if anything here conflicts with them.</p>

      <h2 className="mt-10 text-2xl">What the fee is</h2>
      <p className="mt-2 text-ink-soft" data-testid="policy-prices">Event Access is a one-time fee charged by {BRAND.name} ({BRAND.legalEntity}) for operator contact access. {bothTiersSentence(products)}{f ? " Ferris Wheel Event Access applies when your request is for a Ferris wheel of any kind: standard, giant or mini." : ""}</p>
      <p className="mt-2 text-ink-soft">Each product covers one event and lets you unlock direct contact details for up to {p.unlockLimit} distinct matching independent operators within {p.validityDays} days of purchase{f && (f.unlockLimit !== p.unlockLimit || f.validityDays !== p.validityDays) ? ` (Ferris Wheel Event Access: up to ${f.unlockLimit} operators within ${f.validityDays} days)` : ""}. The exact price, limit and validity for your purchase are shown on the page where you pay and on your receipt, and they stay fixed for that purchase even if we change our products later.</p>

      <h2 className="mt-8 text-2xl">What you get</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-soft">
        <li>Before paying: the number of independent operators near your event with the requested equipment and at least one working contact channel (phone, email or website). Each company counts once, however many rides it lists. We only sell access when at least {p.minimumMatches} match. When fewer than {p.unlockLimit} match, the offer says how many and your pass covers all of them.</li>
        <li>After paying: a pass that reveals, for the operators you choose, the company name, phone, email, website and, where we have it, a contact name.</li>
        <li>Re-opening an operator you already unlocked never uses another unlock. Your pass link reopens your pass on any device.</li>
      </ul>

      <h2 className="mt-8 text-2xl">What you do not get</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-soft">
        <li>A booking, a reservation, a quote, a price, or a guarantee that any operator is available on your date or will reply.</li>
        <li>Any part of the rental itself. Operators are independent businesses. Price, availability, delivery, crew, insurance, contract and payment for the rental are agreed directly between you and the operator. {BRAND.name} is not a party to that agreement and receives no part of that payment.</li>
        <li>A promise that every detail is current. Operator details come from the operator&rsquo;s own published information or from the operator; we check them, but businesses change.</li>
      </ul>

      <h2 className="mt-8 text-2xl">Refunds</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-soft">
        <li>If you have not unlocked any operator, email <a className="underline" href={`mailto:support@${BRAND.domain}`}>support@{BRAND.domain}</a> within 14 days of purchase for a full refund of the amount you paid ({formatPrice(p.priceCents, p.currency)}{f ? ` or ${formatPrice(f.priceCents, f.currency)}` : ""}, as shown on your receipt).</li>
        <li>If a contact you unlocked does not work (number disconnected, email bounces, website gone), use &ldquo;This contact didn&rsquo;t work&rdquo; on your pass. We check it and restore the unlock when we confirm the contact was dead. Where most of your unlocks were dead we refund.</li>
        <li>We do not refund because an operator was busy on your date, quoted more than you hoped, or did not reply. Those are the operator&rsquo;s decisions, not a defect in the access you bought.</li>
        <li>A full refund or a card dispute revokes the pass. Operators you already unlocked stay visible on it. A partial refund leaves the pass active.</li>
      </ul>

      <h2 className="mt-8 text-2xl">Your data</h2>
      <p className="mt-2 text-ink-soft">We keep your email, event details, purchase and a record of which operators you unlocked and when. That record exists to support you, to prevent abuse and as evidence if a payment is disputed. See the <Link className="underline" href={paths.privacy()}>privacy policy</Link>.</p>

      <h2 className="mt-8 text-2xl">Questions</h2>
      <p className="mt-2 text-ink-soft">Email <a className="underline" href={`mailto:support@${BRAND.domain}`}>support@{BRAND.domain}</a>. See also our <Link className="underline" href={paths.contact()}>contact page</Link>.</p>
    </div>
  );
}
