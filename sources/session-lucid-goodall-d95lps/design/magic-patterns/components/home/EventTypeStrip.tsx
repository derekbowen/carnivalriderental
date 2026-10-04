import React from "react";
import { Link } from "react-router-dom";
import { Building2Icon, GraduationCapIcon, LandmarkIcon, PartyPopperIcon, TentIcon, BoxIcon } from "lucide-react";
import { eventTypes, EventTypeIcon } from "../../data/eventTypes";
const icons: Record<EventTypeIcon, BoxIcon> = {
  building: Building2Icon,
  landmark: LandmarkIcon,
  graduation: GraduationCapIcon,
  tent: TentIcon,
  party: PartyPopperIcon
};
export function EventTypeStrip() {
  return <section className="bg-midnight py-20 text-ivory" aria-labelledby="event-types-heading">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <h2 id="event-types-heading" className="max-w-xl font-display text-3xl leading-tight sm:text-4xl">
            Planned for organizations that run events
          </h2>
          <p className="max-w-md text-sm text-ivory/60">Choose your event type to start a request with the right questions.</p>
        </div>
        <ul className="mt-12 grid border-t border-ivory/15 sm:grid-cols-2 lg:grid-cols-5">
          {eventTypes.map(t => {
          const Icon = icons[t.icon];
          return <li key={t.value} className="border-b border-ivory/15 lg:border-b-0 lg:border-r lg:last:border-r-0">
                <Link to={`/request?eventType=${t.value}`} className="group flex h-full flex-col p-6 transition-colors hover:bg-midnight-2 focus:outline-none focus-visible:bg-midnight-2">
                  <Icon size={22} className="text-gold" aria-hidden="true" />
                  <span className="mt-6 font-display text-xl group-hover:text-gold-soft">{t.label}</span>
                  <span className="mt-2 text-sm leading-relaxed text-ivory/55">{t.description}</span>
                </Link>
              </li>;
        })}
        </ul>
      </div>
    </section>;
}