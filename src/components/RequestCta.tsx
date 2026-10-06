import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";

/** The obvious route into Event Access, on every SEO page family. */
export function RequestCta({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <section className="overflow-hidden rounded-2xl bg-ink text-white">
      <div className="awning h-2" aria-hidden="true" />
      <div className="flex flex-col items-start gap-5 p-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl text-white">{title}</h2>
          <p className="mt-2 max-w-xl text-sm text-white/75">{body}</p>
        </div>
        <Link href={href} className="btn-primary shrink-0">Connect with operators <ArrowRightIcon className="h-4 w-4" aria-hidden="true" /></Link>
      </div>
    </section>
  );
}

export const HOW_IT_WORKS = [
  { title: "Find the ride", body: "Browse real inventory by city, ride type and class, nearest first. Photos, verified facts and service areas are free." },
  { title: "See who can serve your event", body: "Give us the date and city. Before you pay, we show how many independent operators with matching equipment and a working contact channel are near you." },
  { title: "Unlock operator contacts", body: "Event Access reveals company name, phone, email and website for the operators you choose, one at a time, up to your pass’s limit." },
  { title: "Deal directly with the operator", body: "Price, availability, delivery, crew, insurance and payment are agreed with the operator. We don’t take part in the rental." },
];
