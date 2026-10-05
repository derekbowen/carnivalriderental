import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";

/** The obvious route into the event request flow, on every SEO page family. */
export function RequestCta({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <section className="overflow-hidden rounded-2xl bg-ink text-white">
      <div className="awning h-2" aria-hidden="true" />
      <div className="flex flex-col items-start gap-5 p-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl text-white">{title}</h2>
          <p className="mt-2 max-w-xl text-sm text-white/75">{body}</p>
        </div>
        <Link href={href} className="btn-primary shrink-0">Start an event request <ArrowRightIcon className="h-4 w-4" aria-hidden="true" /></Link>
      </div>
    </section>
  );
}

export const HOW_IT_WORKS = [
  { title: "Find a ride near your event", body: "Search by location and ride type, nearest first. “Not sure” is fine: send a general request." },
  { title: "Send a request", body: "Date, location and site details. No payment is taken to send a request." },
  { title: "Get a quote", body: "Replies arrive in your marketplace inbox. Requests for operators who haven’t joined yet go to our request desk, and we tell you so." },
  { title: "Book through the marketplace", body: "Confirmed only when the operator accepts and payment is completed. Not before." },
];
