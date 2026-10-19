import { withoutNotice } from "../operators/claim";

/**
 * Public descriptions are a separate, deliberately conservative projection of Sharetribe text.
 * Imported descriptions have already been anonymised against the actual operator identity before
 * publication. Do not treat a newly edited or claimed operator's prose as approved automatically.
 *
 * The snapshot must contain ONLY the result of this function, never the source description.
 * A rejected description is represented by null; factual, non-identifying fallback copy is built
 * from the listing's approved public fields rather than inventing ride specifications.
 */
const CONTACT_OR_CLAIM = [
  /(?:https?:\/\/|www\.)\S+/i,
  /\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/i,
  /\b[\w-]+\.(?:com|net|org|us|biz|info|co)\b/i,
  /(?:^|\s)@\w{3,}\b/,
  /\b(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}\b/,
  /\b\d{3}[-.\s]\d{4}\b/,
  /\b\d{1,5}\s+(?:[A-Za-z]+\s+){0,3}(?:Street|St\.|Road|Rd\.|Avenue|Ave\.|Boulevard|Blvd\.|Drive|Dr\.|Lane|Ln\.)\b/i,
  /\b(?:call|text|email|contact|follow|visit)\s+(?:us|me|our|the company|at)\b/i,
  /\b(?:operated|owned|provided|managed|run)\s+by\b/i,
  /\b(?:we|our company|the operator)\s+(?:own|owns|operate|operates|provide|provides|rent|rents)\b/i,
  /\b(?:LLC|L\.L\.C\.|Inc\.?|Corp\.?|Corporation|Ltd\.?)\b/i,
  /\b[A-Z][\w'-]+(?:\s+[A-Z][\w'-]+){0,3}\s+(?:Amusements|Attractions|Enterprises|Productions|Entertainment|Shows)\b/,
  /\b(?:guaranteed|certified|licensed|fully insured|always available|book now|reserve now|lowest price)\b/i,
];

/** Shared readback check for snapshot exports. It deliberately rejects all suspicious strings. */
export function publicRideTextSafe(source: unknown): source is string {
  return typeof source === "string" && source.trim().length >= 24 && source.length <= 1200 &&
    !/[<>]/.test(source) && !CONTACT_OR_CLAIM.some((pattern) => pattern.test(source));
}

/** Fail closed on identifiers and claims; do not silently show only part of a sensitive sentence. */
export function approvedRideDescription(
  source: unknown,
  metadata: Record<string, unknown> | undefined,
  maxChars = 1200,
): string | null {
  if (typeof source !== "string" || !source.trim()) return null;
  // Unclaimed imported listings carry the reviewed, anonymous version of the text. A claimed
  // operator may subsequently edit it in the Console, so claimed prose needs separate review.
  if (metadata?.claimStatus !== "unclaimed") return null;
  if (typeof metadata.importBatch !== "string") return null;
  // Import provenance alone does not prove review. Integration-managed metadata must
  // approve this exact source; subsequent operator edits automatically lose approval.
  if (metadata.publicDescriptionReviewedText !== source) return null;

  const text = withoutNotice(source).replace(/<[^>]*>/g, " ").replace(/[<>]/g, " ").replace(/\s+/g, " ").trim();
  if (text.length < 24 || text.length > 5000 || CONTACT_OR_CLAIM.some((pattern) => pattern.test(text))) return null;
  if (/^(?:kiddie|family|major|spectacular|carnival|water|dark|other)\s+(?:ride|attraction)\s+listed by an independent operator\.?$/i.test(text)) return null;

  const length = Math.max(60, Math.min(1200, Math.floor(maxChars)));
  const result = text.length <= length ? text : (
    (text.slice(0, length - 1).replace(/\s+\S*$/, "").trimEnd() || text.slice(0, length - 1)) + "…"
  );
  return publicRideTextSafe(result) ? result : null;
}

interface RideCopy {
  title: string;
  description?: string | null;
  rideClassLabel?: string | null;
  facts?: { label: string; value: string }[];
}

/** Truthful, factual fallback when no reviewed operator prose is available. */
export function rideOverview(ride: RideCopy): string {
  if (ride.description) return ride.description;
  const category = ride.rideClassLabel?.toLowerCase() || "carnival ride";
  const article = /^[aeiou]/.test(category) ? "an" : "a";
  const height = ride.facts?.find((f) => f.label === "Minimum rider height")?.value;
  const dimensions = ride.facts?.find((f) => f.label === "Space needed (operator's figure)")?.value;
  const manufacturer = ride.facts?.find((f) => f.label === "Manufacturer")?.value;
  const model = ride.facts?.find((f) => f.label === "Model")?.value;
  const rules = ride.facts?.find((f) => f.label === "Rider rules")?.value;
  const details = [
    manufacturer ? `The listed manufacturer is ${manufacturer}${model ? `, model ${model}` : ""}.` : model ? `The listed model is ${model}.` : "",
    height ? "Listed minimum rider height: " + height + "." : "",
    dimensions ? "Operator-listed space needed: " + dimensions + "." : "",
    rules ? `Listed rider restrictions: ${rules.replace(/[.!?]+$/, "")}.` : "",
  ].filter(Boolean);
  return ride.title + " is listed as " + article + " " + category + " by an independent carnival operator. " +
    (details.length ? details.join(" ") + " " : "") +
    "Confirm suitability, event availability and site requirements directly with the operator.";
}

/** Planning prompts use stated facts and ask about unknowns rather than inventing specifications. */
export function ridePlanning(ride: RideCopy): { title: string; text: string }[] {
  const fact = (label: string) => ride.facts?.find((f) => f.label === label)?.value;
  const space = fact("Space needed (operator's figure)");
  const height = fact("Minimum rider height");
  const rules = fact("Rider rules");
  const served = fact("States served");
  return [
    { title: "Check your event site", text: space ? `The listed ride footprint is ${space}. Ask about additional space for queues, fencing, access and setup before choosing a location.` : "Ask for the ride footprint, queue and fencing space, delivery access, and ground requirements before choosing a location." },
    { title: "Check who can ride", text: [height ? `The listed minimum rider height is ${height}.` : "Ask for the minimum rider height and any adult-accompaniment requirements.", rules ? `The listing also states: ${rules}` : "Confirm any other rider restrictions with the operator."].join(" ") },
    { title: "Confirm delivery and event costs", text: `${served ? `Listed service area: ${served}. ` : ""}Confirm travel to your venue, availability on your date, operating hours, staffing, power, setup and teardown, and what the rental quote includes.` },
  ];
}

/** Short card summaries reuse the same approved text as the detail page. */
export function rideExcerpt(ride: RideCopy, maxChars = 170): string {
  const text = rideOverview(ride);
  if (text.length <= maxChars) return text;
  const head = text.slice(0, maxChars - 1).replace(/\s+\S*$/, "").trimEnd();
  return (head || text.slice(0, maxChars - 1)) + "…";
}
