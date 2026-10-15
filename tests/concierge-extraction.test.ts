/**
 * Live finding 2026-10-15: "I need a Ferris wheel in Columbus, Ohio on June 15 2030" saved the date and
 * place but no ride (the model did not write the ride type in the exact form expected), so the search
 * showed the nearest rides of any kind and the reply called one an available Ferris wheel. Ride types
 * are now resolved however they are written, the customer's own words are the safety net, and no reply
 * can assert availability.
 */
import { describe, expect, it, vi } from "vitest";

let modelReply = "{}";
vi.mock("ai", () => ({ generateText: vi.fn(async () => ({ text: modelReply })) }));

import { emptyLead } from "@/lib/concierge/defaults";
import { extractLead, mergeLead, resolveRideType, rideTypesMentioned } from "@/lib/concierge/extract";
import { AVAILABILITY_NOTE, withAvailabilityGuard } from "@/lib/concierge/help";

describe("ride types however the model writes them", () => {
  it("resolves ids, names, spaces, underscores and case; unknown stays unknown", () => {
    expect(resolveRideType("ferris-wheel")).toBe("ferris-wheel");
    expect(resolveRideType("Ferris wheel")).toBe("ferris-wheel");
    expect(resolveRideType("FERRIS_WHEEL")).toBe("ferris-wheel");
    expect(resolveRideType("Giant Ferris wheel")).toBe("giant-ferris-wheel");
    expect(resolveRideType("kiddie train")).toBe("kiddie-train");
    expect(resolveRideType("rollercoaster of doom")).toBeNull();
    expect(resolveRideType(42)).toBeNull();
  });

  it("merges every shape the model uses and drops only what it cannot place", () => {
    const lead = mergeLead(emptyLead, { requestedRides: [{ rideType: "Ferris wheel", quantity: "2" }, "carousel", { type: "kiddie train", qty: 1 }, { rideType: "ferris-wheel" }, { rideType: "hovercraft" }] });
    expect(lead.requestedRides).toEqual([{ rideType: "ferris-wheel", quantity: 2 }, { rideType: "carousel", quantity: null }, { rideType: "kiddie-train", quantity: 1 }]);
  });

  it("finds ride types in the customer's own words, longest name first", () => {
    expect(rideTypesMentioned("I need a Ferris wheel in Columbus, Ohio on June 15 2030")).toEqual(["ferris-wheel"]);
    expect(rideTypesMentioned("a giant ferris wheel and two carousels")).toEqual(["giant-ferris-wheel", "carousel"]);
    expect(rideTypesMentioned("hello")).toEqual([]);
    expect(rideTypesMentioned("do my credits expire")).toEqual([]);
  });

  it("extractLead falls back to the words when the model returns no usable ride", async () => {
    modelReply = '{"eventDate":"2030-06-15","city":"Columbus","state":"OH","requestedRides":[{"rideType":"Ferris Wheel Ride"}]}';
    const lead = await extractLead("I need a Ferris wheel in Columbus, Ohio on June 15 2030", emptyLead);
    expect(lead).toMatchObject({ eventDate: "2030-06-15", city: "Columbus", state: "OH", requestedRides: [{ rideType: "ferris-wheel", quantity: null }] });
    // A ride already on the lead is kept rather than guessed over.
    modelReply = "{}";
    const kept = await extractLead("and a Ferris wheel too", { ...emptyLead, requestedRides: [{ rideType: "carousel", quantity: 1 }] });
    expect(kept.requestedRides).toEqual([{ rideType: "carousel", quantity: 1 }]);
  });
});

describe("no reply confirms availability", () => {
  it("appends the note to an assertion and leaves hedged replies alone", () => {
    expect(withAvailabilityGuard("The Ferris Wheel is available in Columbus, OH for your event date. Shall I request it?")).toContain(AVAILABILITY_NOTE);
    expect(withAvailabilityGuard("We have a Ferris wheel available about 49 miles from Columbus.")).toContain(AVAILABILITY_NOTE);
    expect(withAvailabilityGuard("I can't confirm availability for your date; press Request Availability.")).not.toContain(AVAILABILITY_NOTE);
    expect(withAvailabilityGuard("Availability for June 15 has not been confirmed yet.")).not.toContain(AVAILABILITY_NOTE);
    expect(withAvailabilityGuard("There are 10 Ferris wheels listed in Ohio.")).not.toContain(AVAILABILITY_NOTE);
  });
});
