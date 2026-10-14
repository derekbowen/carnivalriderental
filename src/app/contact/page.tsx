import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, JsonLd } from "@/components/pseo";
import { BRAND } from "@/lib/config";
import { paths } from "@/lib/seo/routes";
import { pageGraph } from "@/lib/seo/structured-data";

export const metadata: Metadata = { title: `Contact | ${BRAND.name}`, robots: { index: false, follow: true } };

export default function ContactPage() {
  const crumbs = [{ name: "Home", path: paths.home() }, { name: "Contact", path: paths.contact() }];
  const rows = [
    { who: "Customers (Event Access, passes, refunds)", email: `support@${BRAND.domain}` },
    { who: "Operators (claims, corrections, removal)", email: `claims@${BRAND.domain}` },
    { who: "Everything else", email: `hello@${BRAND.domain}` },
  ];
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <JsonLd nodes={pageGraph({ path: paths.contact(), name: "Contact", description: `How to reach ${BRAND.name}.`, type: "WebPage", crumbs })} />
      <Breadcrumbs items={crumbs} />
      <h1 className="mt-6 text-4xl">Contact {BRAND.name}</h1>
      <p className="mt-3 text-ink-soft">We&rsquo;re the platform, not the ride operator: for a rental&rsquo;s price, availability or contract, contact the operator directly through your pass. For anything about the site, use the addresses below.</p>
      <dl className="mt-8 divide-y divide-line rounded-2xl border border-line bg-surface">
        {rows.map((r) => (
          <div key={r.email} className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <dt className="text-sm text-ink-soft">{r.who}</dt>
            <dd><a className="font-semibold text-accent-strong hover:underline" href={`mailto:${r.email}`}>{r.email}</a></dd>
          </div>
        ))}
      </dl>
      <p className="mt-6 text-sm text-muted">{BRAND.name} is owned and operated by {BRAND.legalEntity}. Lost your pass link? <Link className="underline" href={paths.passRecover()}>Request a new one</Link>.</p>
    </div>
  );
}
