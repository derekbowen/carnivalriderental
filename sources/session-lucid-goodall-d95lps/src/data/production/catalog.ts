// PRODUCTION CATALOG — records intended for the live site.
//
// Empty on purpose. Add a record only with real, sourced content:
//   * owned or licensed images (credit recorded),
//   * specifications marked verified only with a named source,
//   * no invented prices, inventory, reviews or partner claims.
// A record stays a draft until a person reviews it and sets
// publication: { status: "published", reviewedBy, reviewedAt }.
import type { CityRidePage, RideCategory, RideType, ServiceCity } from "@/lib/catalog/types";

export const productionCategories: RideCategory[] = [];
export const productionRides: RideType[] = [];
export const productionCities: ServiceCity[] = [];
export const productionCityRidePages: CityRidePage[] = [];
