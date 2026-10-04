import { BadgeDollarSignIcon, CalendarCheckIcon, LandmarkIcon } from "lucide-react";
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
 * Operator program landing page (founder-requested 2026-10-04). Describes the planned operator
 * flow; the program is early access, so the page says so and only collects applications.
 * Numbers come from OPERATOR_PROGRAM — never hard-code a fee here.
 */
const title = "Rent out your carnival rides. Keep 100% of your price.";
const fee = OPERATOR_PROGRAM.customerServiceFeePct;
const opPct = OPERATOR_PROGRAM.operatorCommissionPct;

export const metadata = seoMetadata({
  path: paths.operators(),
  title: "List your carnival rides — 0% operator commission",
  description: `List your carnival rides on ${BRAND.name}. You set the price and approve every booking; operators pay 0% commission. Early access — apply now.`,
  gate: operatorPageGate(),
});

const STEPS = [
  { t: "List your rides and set your price", b: "Add each ride with your price, the area you cover and what’s included — delivery, setup, crew and operating hours." },
  { t: "Customers book and pay up front", b: "The customer picks a date, tells us about the site — address, surface, power, hours — and pays at checkout. The full amount is authorized on their card before the request reaches you." },
  { t: "You get a text and an email", b: "Each request shows the date, the location, the site details and the amount being held." },
  { t: "Accept, update the price, or decline", b: "Accept, and the customer’s card is charged and the booking is confirmed. If the job needs a different price — a longer drive, extra hours, a difficult site — send an updated price; the customer approves and pays the new total before you’re committed. Decline, or don’t answer in time, and the hold is released — the customer isn’t charged." },
  { t: "Run the event, get paid", b: "After the event, your payout is sent to the bank account you connected." },
];

const FAQ = [
  { q: "Is it really 0% for operators?", a: `Yes. Operators pay ${opPct}% commission: your payout is your listed price, or the updated price the customer accepted. The marketplace is funded by a service fee the customer pays on top.` },
  { q: "When do I get paid?", a: "After the event. Payouts go to the bank account you connect when you set up payments." },
  { q: "What if my listed price doesn’t fit a job?", a: "Send an updated price before you accept. The customer either approves and pays the new total, or the request ends and the hold on their card is released." },
  { q: "What do I need to start?", a: "A bank account for payouts and the business details our payment processor, Stripe, needs to verify you. Stripe requires this before any payment can be sent to you. Apply below and we’ll walk you through it before launch." },
];

export default function OperatorsPage() {
  const crumbs = [{ name: "Home", path: paths.home() }, { name: "For ride operators", path: paths.operators() }];
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <JsonLd nodes={pageGraph({ path: paths.operators(), name: title, description: "Operator program: list your rides, set your price, approve every booking.", type: "WebPage", crumbs, faq: FAQ })} />
      <Breadcrumbs items={crumbs} />

      <div data-testid="early-access" className="mt-6 rounded-xl border border-demo/30 bg-demo-wash px-4 py-3 text-sm text-demo">
        <strong>Early access.</strong> The operator program isn’t live yet. Apply below and we’ll contact you before launch — terms will be confirmed in writing before you list anything.
      </div>

      <p className="eyebrow mt-8">For carnival ride operators</p>
      <h1 className="mt-2 max-w-4xl text-4xl sm:text-5xl">{title}</h1>
      <p className="mt-4 max-w-3xl text-lg text-ink-soft">
        {BRAND.name} is a carnival ride rental marketplace. List your rides, set your own price and approve every booking. Operators pay {opPct}% commission, and payouts go straight to your bank.
      </p>
      <a href="#apply" className="btn-primary mt-6 inline-flex">Apply for early access</a>

      <ul className="mt-10 grid gap-4 sm:grid-cols-3">
        {[
          { icon: BadgeDollarSignIcon, t: `${opPct}% operator commission`, b: "Your price is your payout." },
          { icon: CalendarCheckIcon, t: "You approve every booking", b: "Accept, update the price, or decline." },
          { icon: LandmarkIcon, t: "Paid to your bank", b: "Payout after each event." },
        ].map((x) => (
          <li key={x.t} className="card flex items-start gap-3 p-5">
            <x.icon className="mt-0.5 h-6 w-6 shrink-0 text-accent-strong" aria-hidden="true" />
            <div><p className="font-semibold">{x.t}</p><p className="text-sm text-ink-soft">{x.b}</p></div>
          </li>
        ))}
      </ul>

      <section className="mt-14">
        <h2 className="text-3xl">How it works</h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.t} className="card p-5">
              <p className="text-xs font-semibold text-muted">Step {i + 1}</p>
              <p className="mt-1 font-semibold">{s.t}</p>
              <p className="mt-1 text-sm text-ink-soft">{s.b}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="fees" className="mt-14 grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="text-3xl">How we make money</h2>
          <p className="mt-3 text-ink-soft">
            Operators pay {opPct}% commission. Customers pay a small service fee at checkout, shown to them before they pay. It covers card processing and keeps the marketplace running.{" "}
            {fee === null ? <span data-testid="fee-pending">We’ll publish the service fee rate before launch.</span> : <span>The service fee is {fee}% of the booking.</span>}
          </p>
        </div>
        <div className="card p-6" data-testid="fee-example">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Example</p>
          <p className="mt-2">You list a Ferris wheel at <strong>$20,000</strong> for the day.</p>
          <ul className="mt-3 space-y-1 text-sm text-ink-soft">
            <li>You receive <strong className="text-ink">$20,000</strong>.</li>
            <li>The customer pays $20,000 plus the service fee.</li>
            <li>We don’t take a cut of your price.</li>
          </ul>
          <p className="mt-3 text-xs text-muted">Illustrative numbers only — not a market price.</p>
        </div>
      </section>

      <FaqSection faq={FAQ} />

      <section id="apply" className="mt-14 scroll-mt-24">
        <h2 className="text-3xl">Apply for early access</h2>
        <p className="mt-2 max-w-2xl text-ink-soft">Tell us about your company and your rides. We review every application by hand and will contact you before the program opens.</p>
        <div className="mt-6">
          <OperatorApplicationForm states={US_STATES.map((s) => ({ code: s.code, name: s.name }))} brandName={BRAND.name} />
        </div>
      </section>
    </div>
  );
}
