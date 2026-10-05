/**
 * Map an operator's ride (title + ride class) to one of the 50 taxonomy ride types, so real
 * inventory shows up on /rides/{ride}, /{state}/{ride} and /rides/{ride}/{occasion}.
 * First matching rule wins; order goes from specific to general. Unmatched rides still get their
 * own listing page, they just don't appear under a ride-type page.
 */
type Rule = { id: string; test: (t: string, kiddie: boolean, cls: string) => boolean };

const has = (re: RegExp) => (t: string) => re.test(t);

const RULES: Rule[] = [
  { id: "giant-ferris-wheel", test: (t, k) => !k && /\b(giant|century|grand|skyline|big)\s+wheel\b/.test(t) },
  { id: "mini-ferris-wheel", test: (t, k) => k && /\b(ferris|wheel|eli)\b/.test(t) },
  // Any non-kiddie ride whose name contains the word "wheel" ("Astro Wheel", "#16 Wheel", "America 250 Wheel").
  { id: "ferris-wheel", test: (t) => /\bferris\b|\bwheel\b(?!\s*barrow)/.test(t) },
  { id: "double-decker-carousel", test: has(/double[- ]?deck/) },
  { id: "kiddie-carousel", test: (t, k) => k && /carousel|merry[- ]?go[- ]?round/.test(t) },
  { id: "carousel", test: has(/carousel|merry[- ]?go[- ]?round/) },
  { id: "tower-swing-ride", test: has(/star ?flyer|sky ?flyer|tower swing|vertigo swing/) },
  { id: "kiddie-swing-ride", test: (t, k) => k && /swing/.test(t) },
  { id: "wave-swinger", test: has(/wave swing|\bswinger\b|yo[- ]?yo/) },
  { id: "chair-swing-ride", test: has(/\bswings?\b|chair ?o ?plane/) },
  { id: "kiddie-coaster", test: (t, k) => /dragon wagon|wacky worm|kiddie coaster/.test(t) || (k && /coaster/.test(t)) },
  { id: "family-coaster", test: (t, _k, c) => c === "coaster" || /coaster/.test(t) },
  { id: "trackless-train", test: has(/trackless/) },
  { id: "kiddie-train", test: (t, k) => k && /train|choo/.test(t) },
  { id: "spinning-teacups", test: has(/tea ?cups?|\bcups\b/) },
  { id: "tilt-ride", test: has(/tilt[- ]?a[- ]?whirl/) },
  { id: "scrambler", test: has(/scrambler/) },
  { id: "kiddie-bumper-cars", test: (t, k) => k && /bumper|dodg/.test(t) },
  { id: "bumper-boats", test: has(/bumper boat/) },
  { id: "bumper-cars", test: has(/bumper car|dodg[e']?m|dodge ?car/) },
  { id: "giant-slide", test: has(/\bslide\b|fun ?slide/) },
  { id: "mirror-maze", test: has(/mirror|maze/) },
  { id: "haunted-house", test: has(/haunt|ghost|spook|terror|horror/) },
  { id: "fun-house", test: (t, _k, c) => c === "funhouse" || /fun ?house/.test(t) },
  { id: "kiddie-pirate-ship", test: (t, k) => k && /pirate|ship/.test(t) },
  { id: "swinging-pirate-ship", test: has(/pirate|viking|sea dragon|\bship\b/) },
  { id: "music-express", test: has(/music express|himalaya|matterhorn|avalanche|musik/) },
  { id: "sizzler-style-ride", test: has(/sizzler|twister/) },
  { id: "paratrooper", test: has(/paratrooper|umbrella/) },
  { id: "helicopter-ride", test: has(/helicopter|chopper/) },
  { id: "kiddie-jets", test: (t, k) => k && /\bjets?\b|plane|airplane|flyer|rocket/.test(t) },
  { id: "kiddie-boats", test: (t, k) => k && /\bboats?\b/.test(t) },
  { id: "kiddie-motorcycles", test: (t, k) => k && /motorcycle|motor ?bike|harley/.test(t) },
  { id: "kiddie-drop-tower", test: (t, k) => k && /drop|frog ?hopper|tower|bouncer/.test(t) },
  { id: "kiddie-whip", test: (t, k) => k && /whip/.test(t) },
  { id: "kiddie-cars", test: (t, k) => k && /\bcars?\b|truck|fire engine|race|speedway|jeep|tank/.test(t) },
  { id: "pony-cart-ride", test: has(/pony/) },
  { id: "zipper-style-ride", test: has(/zipper/) },
  { id: "gravitron", test: has(/gravitron|starship|gravity/) },
  { id: "freak-out", test: has(/freak ?out/) },
  { id: "ring-of-fire", test: has(/ring of fire/) },
  { id: "drop-tower", test: has(/drop tower|free ?fall|drop zone|power tower/) },
  { id: "pendulum-ride", test: has(/pendulum|fireball|claw|power surge/) },
  { id: "kamikaze", test: has(/kamikaze|hurricane/) },
  { id: "orbiter", test: has(/orbiter/) },
  { id: "round-up", test: has(/round ?up/) },
  { id: "inverter", test: has(/inverter/) },
  { id: "tornado-ride", test: has(/tornado/) },
  { id: "go-karts", test: has(/go[- ]?karts?/) },
  { id: "dark-ride", test: (t, _k, c) => c === "dark-ride" || /dark ride/.test(t) },
];

export function rideTypeFor(title: string, rideClass: string): string | null {
  const t = title.toLowerCase();
  const kiddie = rideClass === "kiddie" || /\b(kiddie|kiddy|kid|kids|baby|little|mini|junior|jr)\b/.test(t);
  for (const r of RULES) if (r.test(t, kiddie, rideClass)) return r.id;
  return null;
}

export const MATCHED_RIDE_TYPES = RULES.map((r) => r.id);

/** Every rule that matches (first one wins in rideTypeFor); used to report ambiguous titles. */
export function matchingRideTypes(title: string, rideClass: string): string[] {
  const t = title.toLowerCase();
  const kiddie = rideClass === "kiddie" || /\b(kiddie|kiddy|kid|kids|baby|little|mini|junior|jr)\b/.test(t);
  return RULES.filter((r) => r.test(t, kiddie, rideClass)).map((r) => r.id);
}
