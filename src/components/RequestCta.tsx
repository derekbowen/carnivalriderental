import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { paths } from "@/lib/seo/routes";

/** The obvious route into Event Access, on every SEO page family. */
export function RequestCta({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <section className="overflow-hidden rounded-2xl bg-ink text-white">
      <div className="awning h-2" aria-hidden="true" />
      <div className="flex flex-col items-start gap-5 p-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl text-white">{title}</h2>
          <p className="mt-2 max-w-xl text-sm text-white/75">{body}</p>
          <p className="mt-3 text-xs text-white/60">
            Not sure what to ask an operator? Read <Link href={paths.guide("how-to-rent-carnival-rides")} className="font-semibold text-accent hover:underline">how to rent carnival rides</Link> first.
          </p>
        </div>
        <Link href={href} className="btn-primary shrink-0">Connect with operators <ArrowRightIcon className="h-4 w-4" aria-hidden="true" /></Link>
      </div>
    </section>
  );
}

/** The standard CTA body on inventory pages: what Event Access does, in one sentence. */
export const CTA_BODY = "Tell us your date and city. We show how many independent operators with matching equipment serve your area, then Event Access gives you their direct contact details so you can compare and book with them.";

/** The four steps, in consumer language. Shown on the homepage and every category hub. */
export const HOW_IT_WORKS = [
  { title: "Find the right rides", body: "Browse carnival rides by type and location. See photos, equipment details and the areas each operator serves." },
  { title: "Compare your options", body: "See several relevant rides and operators serving your area, instead of hunting through dozens of separate websites." },
  { title: "Get direct operator access", body: "Event Access unlocks direct contact details for the operators that match your event, so you know who to call." },
  { title: "Arrange the rental directly", body: "Discuss availability, transport, power, staffing, insurance, pricing and the contract with the carnival company itself." },
];
