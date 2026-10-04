import { US_STATE_CODES } from "../contract";

/** 50 states + DC. `code` matches the contract's lowercase requestableStates option IDs. */
export interface UsState {
  code: string;
  /** Uppercase USPS code for display. */
  abbr: string;
  slug: string;
  name: string;
}

const NAMES: Record<string, string> = {
  al: "Alabama", ak: "Alaska", az: "Arizona", ar: "Arkansas", ca: "California", co: "Colorado",
  ct: "Connecticut", de: "Delaware", dc: "District of Columbia", fl: "Florida", ga: "Georgia",
  hi: "Hawaii", id: "Idaho", il: "Illinois", in: "Indiana", ia: "Iowa", ks: "Kansas",
  ky: "Kentucky", la: "Louisiana", me: "Maine", md: "Maryland", ma: "Massachusetts",
  mi: "Michigan", mn: "Minnesota", ms: "Mississippi", mo: "Missouri", mt: "Montana",
  ne: "Nebraska", nv: "Nevada", nh: "New Hampshire", nj: "New Jersey", nm: "New Mexico",
  ny: "New York", nc: "North Carolina", nd: "North Dakota", oh: "Ohio", ok: "Oklahoma",
  or: "Oregon", pa: "Pennsylvania", ri: "Rhode Island", sc: "South Carolina", sd: "South Dakota",
  tn: "Tennessee", tx: "Texas", ut: "Utah", vt: "Vermont", va: "Virginia", wa: "Washington",
  wv: "West Virginia", wi: "Wisconsin", wy: "Wyoming",
};

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export const US_STATES: UsState[] = US_STATE_CODES.map((code) => {
  const name = NAMES[code];
  if (!name) throw new Error(`No state name for contract code "${code}"`);
  return { code, abbr: code.toUpperCase(), slug: slugify(name), name };
}).sort((a, b) => a.name.localeCompare(b.name));

export const stateBySlug = (slug: string) => US_STATES.find((s) => s.slug === slug);
export const stateByCode = (code: string) => US_STATES.find((s) => s.code === code.toLowerCase());
