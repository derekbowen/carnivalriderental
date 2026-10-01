// Human labels for the brief's choice fields (shared by form, review, status, internal).
export const LABELS: Record<string, Record<string, string>> = {
  rideFlexibility: {
    this_ride_only: "Only this ride",
    similar_rides_ok: "Similar rides are fine",
    open_to_suggestions: "Open to suggestions",
  },
  dateFlexibility: { fixed: "Fixed date", flexible_few_days: "Flexible by a few days", flexible_weeks: "Flexible by weeks" },
  eventType: {
    corporate: "Corporate event",
    municipal: "Municipal / civic",
    school_college: "School or college",
    festival: "Festival or fair",
    private: "Private event",
    other: "Other",
  },
  expectedAttendance: { under_500: "Under 500", "500_2000": "500–2,000", "2000_10000": "2,000–10,000", over_10000: "Over 10,000", not_sure: "Not sure" },
  budget: { under_10k: "Under $10,000", "10k_25k": "$10,000–$25,000", "25k_50k": "$25,000–$50,000", over_50k: "Over $50,000", not_sure: "Not sure yet" },
  siteAccess: { paved_truck_access: "Paved, truck access", grass_or_dirt: "Grass or dirt", restricted: "Restricted / tight access", not_sure: "Not sure" },
  availableSpace: { under_2500_sqft: "Under 2,500 sq ft", "2500_10000_sqft": "2,500–10,000 sq ft", over_10000_sqft: "Over 10,000 sq ft", not_sure: "Not sure" },
  power: { onsite_power_available: "On-site power available", generator_needed: "Generator needed", not_sure: "Not sure" },
};

export function label(field: string, value: string | null | undefined): string {
  if (!value) return "—";
  return LABELS[field]?.[value] ?? value;
}
