import { ListChecksIcon, PhoneCallIcon, ShieldCheckIcon } from "lucide-react";
import { OperatorApplicationForm } from "@/components/operators/OperatorApplicationForm";
import { Breadcrumbs, FaqSection, JsonLd } from "@/components/pseo";
import { BRAND } from "@/lib/config";
import { OPERATOR_PROGRAM } from "@/lib/operators/program";
import { seoMetadata } from "@/lib/seo/metadata";
import { operatorPageGate } from "@/lib/seo/publication";
import { paths } from "@/lib/seo/routes";
import { pageGraph } from "@/lib/seo/structured-data";
import { US_STATES } from "@/lib/taxonomy";

/**
 * Operator program landing page. Under the discovery-and-access model (2026-10-06) the offer is
 * simple: list free, customers who buy Event Access contact you directly, you keep the whole rental.
 * No Stripe Connect, no payouts, no commission, no booking workflow. Numbers come from
 * OPERATOR_PROGRAM; the page is early access and only collects applications.
 */
const title = "List your carnival rides free. Customers contact you directly.";
const free = OPERATOR_PROGRAM.listingFeeUsd === 0 && OPERATOR_PROGRAM.rentalCommissionPct === 0;

export const metadata = seoMetadata({
  path: paths.operators(),
  title: "List your carnival rides free on Carnival Ride Rental",
  description: `List your carnival rides on ${BRAND.name} for free. Customers who buy Event Access get your direct contact details and deal with you directly. No commission, no payouts, no booking workflow. Early access.`,
  gate: operatorPageGate(),
});

const STEPS = [
  { t: "Claim or create your company", b: "If we already list your rides, claim the account with an email at your company's website domain. Otherwise create one. Takes minutes." },
  { t: "Add or fix your rides", b: "Title, class, photos, the facts you can stand behind, the states you serve and where you're based. Edit or remove anything, any time." },
  { t: "Keep your contact details current", b: "Phone, email, website and who to ask for. They stay private on the site and are revealed only to customers who buy Event Access." },
  { t: "Customers call you", b: "A customer who buys Event Access for their event sees your details and contacts you directly. You quote, you agree terms, you get paid by them. We're not in the middle." },
];

const FAQ = [
  { q: "What does it cost me?", a: free ? "Nothing. Listing is free and we take no commission or fee on your rentals. Customers pay us for access to operator contact details; that fee never comes out of your rental." : "See the current terms before listing." },
  { q: "Do I need Stripe, a bank connection or a booking calendar?", a: "No. There are no payouts and no on-platform bookings. You handle pricing, availability, contracts and payment with the customer exactly as you do today." },
  { q: "Who sees my phone number and email?", a: "Only customers who have bought Event Access for a specific event, one operator at a time, with every reveal logged. Search engines and anonymous visitors never see them. Your public listing shows the ride, not your company." },
  { q: "Can I remove my company or a ride?", a: `Yes. Edit or remove rides yourself once you've claimed your account, or email claims@${BRAND.domain} and we'll remove anything you ask.` },
  { q: "Where did my rides come from?", a: "From your own public website or catalogue, with the source recorded for every ride and photo. Claiming your account lets you correct anything and replace photos with your own." },
];

export default function OperatorsPage() {
  const crumbs = [{ name: "Home", path: paths.home() }, { name: "For ride operators", path: paths.operators() }];
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <JsonLd nodes={pageGraph({ path: paths.operators(), name: title, description: "Operator program: list your rides free; customers who buy Event Access contact you directly.", type: "WebPage", crumbs, faq: FAQ })} />
      <Breadcrumbs items={crumbs} />

      <div data-testid="early-access" className="mt-6 rounded-xl border border-demo/30 bg-demo-wash px-4 py-3 text-sm text-demo">
        <strong>Early access.</strong> Operator self-service isn&rsquo;t live yet. Apply below and we&rsquo;ll contact you before launch; terms are confirmed in writing before you list anything.
      </div>

      <p className="eyebrow mt-8">For carnival ride operators</p>
      <h1 className="mt-2 max-w-4xl text-4xl sm:text-5xl">{title}</h1>
      <p className="mt-4 max-w-3xl text-lg text-ink-soft">
        {BRAND.name} indexes carnival ride inventory nationwide so event planners can find the right ride and the company that owns it. Your listing is free. Customers who buy Event Access get your direct contact details and deal with you on your terms.
      </p>
      <a href="#apply" className="btn-primary mt-6 inline-flex">Apply for early access</a>

      <ul className="mt-10 grid gap-4 sm:grid-cols-3">
        {[
          { icon: ListChecksIcon, t: free ? "Free listing, no fees" : "Listing terms", b: "We never touch your rental money." },
          { icon: PhoneCallIcon, t: "Customers contact you", b: "Directly, through Event Access. No new inbox or workflow to learn." },
          { icon: ShieldCheckIcon, t: "You stay in control", b: "Edit rides, photos, service area and contact details; remove anything on request." },
        ].map((x) => (
          <li key={x.t} className="card flex items-start gap-3 p-5">
            <x.icon className="mt-0.5 h-6 w-6 shrink-0 text-accent-strong" aria-hidden="true" />
            <div><p className="font-semibold">{x.t}</p><p className="text-sm text-ink-soft">{x.b}</p></div>
          </li>
        ))}
      </ul>

      <section className="mt-14">
        <h2 className="text-3xl">How it works</h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.t} className="card p-5">
              <p className="text-xs font-semibold text-muted">Step {i + 1}</p>
              <p className="mt-1 font-semibold">{s.t}</p>
              <p className="mt-1 text-sm text-ink-soft">{s.b}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="fees" className="mt-14 max-w-3xl">
        <h2 className="text-3xl">How we make money</h2>
        <p className="mt-3 text-ink-soft">
          Event planners pay {BRAND.name} a one-time fee for Event Access: direct contact details for the operators that match their event. That fee is ours; your rental is yours.{" "}
          <span data-testid="fee-pending">{free ? "Operators pay nothing to list and nothing on rentals." : "Operator terms will be confirmed in writing before you list."}</span>
        </p>
      </section>

      <FaqSection faq={FAQ} />

      <section id="apply" className="mt-14 scroll-mt-24">
        <h2 className="text-3xl">Apply for early access</h2>
        <p className="mt-2 max-w-2xl text-ink-soft">Tell us about your company and your rides. We review every application by hand and will contact you before self-service opens.</p>
        <div className="mt-6">
          <OperatorApplicationForm states={US_STATES.map((s) => ({ code: s.code, name: s.name }))} brandName={BRAND.name} />
        </div>
      </section>
    </div>
  );
}
