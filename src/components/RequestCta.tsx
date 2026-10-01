import Link from "next/link";

/** The obvious route into the event request flow, on every SEO page family. */
export function RequestCta({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <section className="card flex flex-col items-start gap-4 bg-ink p-8 text-white sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-2xl text-white">{title}</h2>
        <p className="mt-2 max-w-xl text-sm text-white/80">{body}</p>
      </div>
      <Link href={href} className="btn-accent shrink-0">Start an event request</Link>
    </section>
  );
}

export const HOW_IT_WORKS = [
  { title: "Tell us about your event", body: "Dates, location, audience and what you know about the site. “Not sure” is a fine answer." },
  { title: "We source a qualified operator", body: "Our team contacts operators who may be able to serve your event and checks fit." },
  { title: "You approve the final scope and price", body: "You receive a written quote. Nothing is booked until you accept it." },
  { title: "Booking confirmed under agreed terms", body: "Once the operator commits and the agreed payment step is complete, we confirm." },
];
