import Link from "next/link";
import type { TypeStats } from "@/lib/inventory";
import { rideTypeCopy } from "@/lib/inventory/ride-type-copy";

const fmt = (n: number) => n.toLocaleString("en-US");

/**
 * Ride types backed by real operator inventory: a representative operator photo, the number of
 * listings and of distinct operators, linking into the filtered ride search. Never a demo record.
 */
export function InventoryTypeGrid({ items, hrefFor, testId = "inventory-types" }: { items: TypeStats[]; hrefFor: (typeId: string) => string; testId?: string }) {
  if (items.length === 0) return null;
  return (
    <ul data-testid={testId} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((t) => {
        const copy = rideTypeCopy(t.type.id, t.type.name);
        return (
          <li key={t.type.id} className="card overflow-hidden" data-testid="ride-type-card">
            <Link href={hrefFor(t.type.id)} className="block">
              {t.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.photo} alt={`${copy.label} listed by an independent carnival operator`} width={640} height={480} loading="lazy" className="aspect-[4/3] w-full object-cover" />
              ) : (
                <div className="flex aspect-[4/3] w-full items-center justify-center bg-placeholder text-sm text-ink-soft">No photo yet</div>
              )}
              <div className="p-4">
                <p className="font-semibold">{copy.label}</p>
                <p className="mt-1 text-sm text-muted">{fmt(t.count)} listing{t.count === 1 ? "" : "s"} from {fmt(t.operators)} operator{t.operators === 1 ? "" : "s"}</p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
