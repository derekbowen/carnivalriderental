import Link from "next/link";
import type { DirLink } from "@/lib/seo/directory";

/** Plain link list for the site directory. */
export function DirList({ links, cols = "sm:grid-cols-2 lg:grid-cols-4" }: { links: DirLink[]; cols?: string }) {
  return (
    <ul className={`mt-4 grid gap-x-8 gap-y-2 text-sm ${cols}`}>
      {links.map((l) => (
        <li key={l.href}>
          <Link href={l.href} className="text-accent-strong hover:underline">{l.label}</Link>
          {l.count !== undefined && <span className="ml-1 text-muted">({l.count.toLocaleString("en-US")})</span>}
        </li>
      ))}
    </ul>
  );
}
