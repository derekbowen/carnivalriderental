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
  { title: "Tell us the ride and your date", body: "Dates, location, audience and what you know about the site. “Not sure” is a fine answer." },
  { title: "We find an operator with that ride", body: "We approach the closest suitable operators. If one says no, we move to the next — you don’t start over." },
  { title: "You approve one written quote", body: "One scope and one price from us. Nothing is booked until you accept it." },
  { title: "Booking confirmed, ride shows up", body: "Confirmed once the operator commits and the agreed payment step is complete. We manage delivery." },
];
