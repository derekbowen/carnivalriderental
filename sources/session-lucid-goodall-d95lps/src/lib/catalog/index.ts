// Read access to the structured catalog. All public pages use these
// functions; none of them read the dataset files directly.
import {
  fixtureCategories,
  fixtureCities,
  fixtureCityRidePages,
  fixtureRides,
} from "@/data/fixtures/catalog";
import {
  productionCategories,
  productionCities,
  productionCityRidePages,
  productionRides,
} from "@/data/production/catalog";
import { isRenderable } from "./publication";
import type { CityRidePage, RideCategory, RideType, ServiceCity } from "./types";

const all = {
  categories: (): RideCategory[] => [...productionCategories, ...fixtureCategories],
  rides: (): RideType[] => [...productionRides, ...fixtureRides],
  cities: (): ServiceCity[] => [...productionCities, ...fixtureCities],
  cityRides: (): CityRidePage[] => [...productionCityRidePages, ...fixtureCityRidePages],
};

export const catalog = {
  categories: () => all.categories().filter(isRenderable),
  rides: () => all.rides().filter(isRenderable),
  cities: () => all.cities().filter(isRenderable),

  category: (slug: string) => all.categories().find((c) => c.slug === slug && isRenderable(c)),
  ride: (slug: string) => all.rides().find((r) => r.slug === slug && isRenderable(r)),
  city: (state: string, slug: string) =>
    all.cities().find((c) => c.state === state && c.slug === slug && isRenderable(c)),

  ridesInCategory: (category: string) =>
    all.rides().filter((r) => r.category === category && isRenderable(r)),

  /**
   * A ride + city page exists only when the pair is explicitly listed AND the
   * page record, the ride and the city are all renderable.
   */
  cityRide: (state: string, city: string, ride: string) => {
    const page = all
      .cityRides()
      .find((p) => p.state === state && p.city === city && p.ride === ride && isRenderable(p));
    if (!page) return undefined;
    const rideRec = catalog.ride(ride);
    const cityRec = catalog.city(state, city);
    if (!rideRec || !cityRec) return undefined;
    return { page, ride: rideRec, city: cityRec };
  },
  cityRidesFor: (state: string, city: string) =>
    all
      .cityRides()
      .filter((p) => p.state === state && p.city === city && isRenderable(p))
      .filter((p) => catalog.ride(p.ride)),

  /** Unfiltered access for the sitemap builder and tests. */
  raw: all,
};
