import { Breadcrumbs, JsonLd } from "@/components/pseo";
import { directoryGate, inventoryMetadata } from "@/lib/inventory";
import { DirList } from "@/components/DirList";
import { DIRECTORY_EVENTS, DIRECTORY_RIDE_TYPES, directoryStates } from "@/lib/seo/directory";
import { paths } from "@/lib/seo/routes";
import { pageGraph } from "@/lib/seo/structured-data";

const TITLE = "Site directory";
const DESCRIPTION = "Every location, ride type and event page on Carnival Ride Rental.";

export function generateMetadata() {
  return inventoryMetadata({ path: paths.directory(), title: TITLE, description: DESCRIPTION, gate: directoryGate() });
}

export default function DirectoryPage() {
  const crumbs = [{ name: "Home", path: paths.home() }, { name: "Directory", path: paths.directory() }];
  const states = directoryStates();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <JsonLd nodes={pageGraph({ path: paths.directory(), name: TITLE, description: DESCRIPTION, type: "CollectionPage", crumbs })} />
      <Breadcrumbs items={crumbs} />
      <h1 className="mt-6 text-4xl">Site directory</h1>
      <p className="mt-3 max-w-3xl text-ink-soft">Every location, ride type and event page on Carnival Ride Rental. Pick a state to see its cities, ride-type pages and the ride listings from operators based there.</p>

      <section className="mt-10" aria-labelledby="dir-states">
        <h2 id="dir-states" className="text-2xl">Locations by state</h2>
        <p className="mt-1 text-sm text-muted">Number of cities with ride listings nearby.</p>
        <DirList links={states} />
      </section>

      <section className="mt-10" aria-labelledby="dir-types">
        <h2 id="dir-types" className="text-2xl">Ride types</h2>
        <DirList links={DIRECTORY_RIDE_TYPES} />
      </section>

      <section className="mt-10" aria-labelledby="dir-events">
        <h2 id="dir-events" className="text-2xl">Events</h2>
        <DirList links={[...DIRECTORY_EVENTS, { href: paths.occasions(), label: "All events" }]} />
      </section>

      <section className="mt-10" aria-labelledby="dir-company">
        <h2 id="dir-company" className="text-2xl">Carnival Ride Rental</h2>
        <DirList
          links={[
            { href: paths.home(), label: "Home" },
            { href: paths.search(), label: "Find a ride" },
            { href: "/#how-it-works", label: "How it works" },
            { href: paths.connect(), label: "Connect with operators" },
            { href: paths.operators(), label: "For ride operators" },
            { href: paths.contact(), label: "Contact" },
            { href: paths.accessPolicy(), label: "Event Access policy" },
            { href: paths.terms(), label: "Terms of Use" },
            { href: paths.privacy(), label: "Privacy policy" },
          ]}
        />
      </section>
    </div>
  );
}
