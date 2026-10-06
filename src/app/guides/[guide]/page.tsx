import type { Metadata } from "next";
import { ArrowRightIcon, CheckIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs, FaqSection, JsonLd, LinkGrid } from "@/components/pseo";
import { BRAND } from "@/lib/config";
import { GUIDES, guideById } from "@/lib/content/guides";
import { FOOTER_EVENTS, FOOTER_RIDE_TYPES } from "@/lib/seo/footer-links";
import { canonicalUrl, paths } from "@/lib/seo/routes";
import { pageGraph } from "@/lib/seo/structured-data";

/**
 * Buyer education: free, public, substantial. Indexability follows the site default (layout.tsx):
 * noindex until PUBLIC_INDEXING opens; nothing here is in the pSEO allowlist or sitemap.
 */
export const dynamicParams = false;

type P = { guide: string };

export function generateStaticParams(): P[] {
  return GUIDES.map((g) => ({ guide: g.id }));
}

export async function generateMetadata({ params }: { params: Promise<P> }): Promise<Metadata> {
  const g = guideById((await params).guide);
  if (!g) return {};
  return { title: `${g.metaTitle} | ${BRAND.name}`, description: g.metaDescription, alternates: { canonical: canonicalUrl(paths.guide(g.id)) } };
}

export default async function GuidePage({ params }: { params: Promise<P> }) {
  const g = guideById((await params).guide);
  if (!g) notFound();
  const path = paths.guide(g.id);
  const crumbs = [{ name: "Home", path: paths.home() }, { name: g.title, path }];
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <JsonLd nodes={pageGraph({ path, name: g.title, description: g.metaDescription, type: "WebPage", crumbs, faq: g.faq })} />
      <Breadcrumbs items={crumbs} />
      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_320px]">
        <article>
          <p className="eyebrow">Buyer guide</p>
          <h1 className="mt-2 text-4xl sm:text-5xl">{g.title}</h1>
          <p className="mt-5 max-w-3xl text-lg leading-relaxed text-ink-soft">{g.intro}</p>

          <nav aria-label="In this guide" className="mt-8 rounded-2xl border border-line bg-surface p-5">
            <p className="text-sm font-semibold">In this guide</p>
            <ol className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
              {g.sections.map((s, i) => <li key={s.id}><a href={`#${s.id}`} className="text-ink-soft hover:text-ink hover:underline">{i + 1}. {s.heading}</a></li>)}
              <li><a href="#checklist" className="text-ink-soft hover:text-ink hover:underline">{g.sections.length + 1}. Quote comparison checklist</a></li>
            </ol>
          </nav>

          {g.sections.map((s) => (
            <section key={s.id} id={s.id} className="mt-12 scroll-mt-24" aria-labelledby={`${s.id}-heading`}>
              <h2 id={`${s.id}-heading`} className="text-3xl">{s.heading}</h2>
              <p className="mt-3 max-w-3xl leading-relaxed text-ink-soft">{s.intro}</p>
              <ul className="mt-5 space-y-2.5">
                {s.items.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[15px] leading-relaxed"><CheckIcon className="mt-1 h-4 w-4 shrink-0 text-accent-strong" aria-hidden="true" />{item}</li>
                ))}
              </ul>
              {s.note && <p className="mt-4 rounded-xl bg-accent-wash p-4 text-sm text-ink-soft">{s.note}</p>}
            </section>
          ))}

          <section id="checklist" className="mt-12 scroll-mt-24" aria-labelledby="checklist-heading">
            <h2 id="checklist-heading" className="text-3xl">Quote comparison checklist</h2>
            <p className="mt-3 max-w-3xl leading-relaxed text-ink-soft">Ask every operator the same questions and write the answers side by side. The cheapest headline price is rarely the cheapest quote once transport, crew, power and hours are included.</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {g.checklist.map((c) => (
                <div key={c.group} className="rounded-2xl border border-line bg-surface p-5">
                  <h3 className="font-sans text-lg font-bold tracking-normal">{c.group}</h3>
                  <ol className="mt-3 space-y-2 text-sm text-ink-soft">
                    {c.questions.map((q, i) => <li key={q} className="flex gap-2"><span className="font-semibold text-ink">{i + 1}.</span>{q}</li>)}
                  </ol>
                </div>
              ))}
            </div>
          </section>

          <FaqSection faq={g.faq} />
        </article>

        <aside className="space-y-4 lg:pt-14" aria-label="Next steps">
          <div className="card p-5">
            <h2 className="text-lg">Ready to find rides?</h2>
            <p className="mt-2 text-sm text-ink-soft">Browse carnival rides from operators near your event, then use Event Access to reach the companies that own them.</p>
            <Link href={paths.search()} className="btn-primary mt-4 w-full">Find carnival rides <ArrowRightIcon className="h-4 w-4" aria-hidden="true" /></Link>
            <Link href={paths.connect()} className="btn-ghost mt-2 w-full">Connect with operators</Link>
          </div>
          <div className="card p-5 text-sm">
            <h2 className="text-lg">Rides by type</h2>
            <ul className="mt-3 space-y-2 text-ink-soft">
              {FOOTER_RIDE_TYPES.map((l) => <li key={l.href}><Link href={l.href} className="hover:text-ink hover:underline">{l.label}</Link></li>)}
            </ul>
          </div>
        </aside>
      </div>
      <LinkGrid title="Rides for your kind of event" links={FOOTER_EVENTS} />
    </div>
  );
}
