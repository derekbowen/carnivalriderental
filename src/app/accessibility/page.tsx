import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, JsonLd } from "@/components/pseo";
import { BRAND } from "@/lib/config";
import { sitePageRobots } from "@/lib/seo/pseo";
import { canonicalUrl, paths } from "@/lib/seo/routes";
import { pageGraph } from "@/lib/seo/structured-data";

export const metadata: Metadata = { title: `Accessibility | ${BRAND.name}`, alternates: { canonical: canonicalUrl(paths.accessibility()) }, robots: sitePageRobots(paths.accessibility()) };

/** What we aim for, where we know we fall short, and how to reach us. Kept honest: no conformance claim we have not tested. */
export default function AccessibilityPage() {
  const crumbs = [{ name: "Home", path: paths.home() }, { name: "Accessibility", path: paths.accessibility() }];
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <JsonLd nodes={pageGraph({ path: paths.accessibility(), name: "Accessibility statement", description: `How ${BRAND.name} approaches accessibility and how to report a problem.`, type: "WebPage", crumbs })} />
      <Breadcrumbs items={crumbs} />
      <h1 className="mt-6 text-4xl">Accessibility statement</h1>
      <p className="mt-3 text-ink-soft">Last updated 2026-10-15. {BRAND.name} is operated by {BRAND.legalEntity}.</p>

      <h2 className="mt-10 text-2xl">What we aim for</h2>
      <p className="mt-2 text-ink-soft">We want everyone to be able to find a ride and reach an operator here, whatever device or assistive technology they use. We aim to meet the Web Content Accessibility Guidelines (WCAG) 2.1 at level AA.</p>

      <h2 className="mt-8 text-2xl">Where we are</h2>
      <ul className="mt-2 list-disc space-y-2 pl-5 text-ink-soft">
        <li>Pages use headings, landmarks and labelled form fields, work with a keyboard, and keep text readable against its background. We check these with automated tools and keyboard testing; a full audit by an accessibility specialist has not been done yet.</li>
        <li>Ride photos come from operators and some carry only the ride name as their description.</li>
        <li>The chat assistant writes its replies with AI. The same help is available through the event form on the <Link className="underline" href={paths.concierge()}>concierge page</Link> and by email.</li>
        <li>Videos carry captions and a text transcript.</li>
      </ul>

      <h2 className="mt-8 text-2xl">Tell us what isn&rsquo;t working</h2>
      <p className="mt-2 text-ink-soft">If any part of this site is hard to use, email <a className="underline" href={`mailto:support@${BRAND.domain}`}>support@{BRAND.domain}</a> with the page address and what happened. We will reply, and where we can we will fix it.</p>

      <p className="mt-8 text-sm text-muted">See also the <Link className="underline" href={paths.privacy()}>privacy policy</Link> and <Link className="underline" href={paths.contact()}>contact page</Link>.</p>
    </div>
  );
}
