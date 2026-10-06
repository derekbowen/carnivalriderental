import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, JsonLd } from "@/components/pseo";
import { BRAND } from "@/lib/config";
import { paths } from "@/lib/seo/routes";
import { pageGraph } from "@/lib/seo/structured-data";

export const metadata: Metadata = { title: `Terms of Use | ${BRAND.name}`, robots: { index: false, follow: true } };

/** Straightforward commercial terms. Not legal advice; counsel should review before launch (see LAUNCH_STATUS.md). */
export default function TermsPage() {
  const crumbs = [{ name: "Home", path: paths.home() }, { name: "Terms of Use", path: paths.terms() }];
  const S = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => (
    <section className="mt-8"><h2 className="text-2xl">{n}. {title}</h2><div className="mt-2 space-y-2 text-ink-soft">{children}</div></section>
  );
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <JsonLd nodes={pageGraph({ path: paths.terms(), name: "Terms of Use", description: `Terms of Use for ${BRAND.name}.`, type: "WebPage", crumbs })} />
      <Breadcrumbs items={crumbs} />
      <h1 className="mt-6 text-4xl">Terms of Use</h1>
      <p className="mt-3 text-ink-soft">Last updated 2026-10-06. {BRAND.name} is owned and operated by {BRAND.legalEntity} (&ldquo;we&rdquo;). By using {BRAND.domain} you agree to these terms.</p>
      <S n={1} title="What this site is">
        <p>{BRAND.name} is a discovery and operator-access platform. We index carnival ride inventory from independent operators and sell access to their contact details (&ldquo;Event Access&rdquo;). We do not own, rent, deliver or operate rides, and we are not a party to any rental between you and an operator.</p>
      </S>
      <S n={2} title="Operators are independent">
        <p>Every ride belongs to an independent business. Price, availability, delivery, setup, crew, insurance, permits, contract and payment for a rental are agreed directly between you and that operator. We make no promise about an operator&rsquo;s availability, pricing, response, safety record, licences or insurance. Check what matters to you with the operator before you agree anything.</p>
      </S>
      <S n={3} title="Information on the site">
        <p>Ride details, photos and service areas come from operators&rsquo; published information or from operators themselves. We show specifications only when verified, and we mark unknowns as unknown, but we cannot guarantee that every detail is current or complete. Approximate locations are the operator&rsquo;s home base, not the ride&rsquo;s current position or your event location.</p>
      </S>
      <S n={4} title="Event Access">
        <p>Event Access is a paid, non-transferable pass for one event that reveals contact details for a set number of matching operators within a set period, as stated when you buy. It is not a booking, reservation, quote or guarantee. Refunds are described in the <Link className="underline" href={paths.accessPolicy()}>Event Access policy</Link>. You may use revealed details only to arrange your own event; scraping, reselling or redistributing them is prohibited and ends your access without refund.</p>
      </S>
      <S n={5} title="Payments">
        <p>Access fees are charged by {BRAND.legalEntity} and processed by Stripe. We do not store card details. Prices are shown before payment and include no part of any rental.</p>
      </S>
      <S n={6} title="Operators listing with us">
        <p>Listing is free. We charge operators no commission or fee on rentals. Operators may claim, edit or remove their inventory and may ask us to remove their details at any time by emailing <a className="underline" href={`mailto:claims@${BRAND.domain}`}>claims@{BRAND.domain}</a>. Operators are responsible for the accuracy of what they publish.</p>
      </S>
      <S n={7} title="Acceptable use">
        <p>Don&rsquo;t misuse the site: no automated harvesting, no attempts to access another person&rsquo;s pass, no false event requests, no interference with the service.</p>
      </S>
      <S n={8} title="Liability">
        <p>To the fullest extent the law allows, our liability to you for anything arising from the site or Event Access is limited to the access fee you paid in the twelve months before the claim. We are not liable for any loss arising from a rental, from an operator&rsquo;s act or omission, or from information that turns out to be inaccurate.</p>
      </S>
      <S n={9} title="Changes and contact">
        <p>We may update these terms; the date above changes when we do. Questions: <a className="underline" href={`mailto:support@${BRAND.domain}`}>support@{BRAND.domain}</a>, or see the <Link className="underline" href={paths.contact()}>contact page</Link>.</p>
      </S>
    </div>
  );
}
