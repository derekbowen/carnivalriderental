/**
 * Reviewed, reusable copy per canonical ride type for the ride type + city template. One entry per
 * taxonomy id: a display label (plural, sentence case, for "{label} rentals"), a noun for counts
 * ("12 Ferris wheels") and a one-line customer hook. No specs, capacities, heights, safety or
 * inclusion claims: those depend on the listing. Status: draft until the founder approves copy
 * (PSEO_INVENTORY.copyApproved).
 */
export interface RideTypeCopy {
  /** "Ferris wheel" → used as "Ferris wheel rentals", "Ferris wheel listings". */
  label: string;
  /** Count noun: 1 → singular, n → plural ("1 Ferris wheel", "14 Ferris wheels"). */
  one: string;
  many: string;
  hook: string;
}

const C = (label: string, one: string, many: string, hook: string): RideTypeCopy => ({ label, one, many, hook });

export const RIDE_TYPE_COPY: Record<string, RideTypeCopy> = {
  "ferris-wheel": C("Ferris wheel", "Ferris wheel", "Ferris wheels", "Give your guests a new view of the celebration."),
  "giant-ferris-wheel": C("Giant Ferris wheel", "giant Ferris wheel", "giant Ferris wheels", "Make a landmark centerpiece for a festival or large event."),
  "mini-ferris-wheel": C("Mini Ferris wheel", "mini Ferris wheel", "mini Ferris wheels", "Give younger guests a Ferris wheel of their own."),
  carousel: C("Carousel", "carousel", "carousels", "Add a classic carnival favorite to your celebration."),
  "double-decker-carousel": C("Double-decker carousel", "double-decker carousel", "double-decker carousels", "Add a two-level classic to a festival or fair."),
  "kiddie-carousel": C("Kiddie carousel", "kiddie carousel", "kiddie carousels", "A small-scale carousel for your youngest guests."),
  "wave-swinger": C("Wave swinger", "wave swinger", "wave swingers", "Send guests sailing in a wide circle of swings."),
  "chair-swing-ride": C("Chair swing ride", "chair swing ride", "chair swing rides", "A carnival swing ride guests line up for again."),
  "kiddie-swing-ride": C("Kiddie swing ride", "kiddie swing ride", "kiddie swing rides", "A gentle swing ride sized for children."),
  "tower-swing-ride": C("Tower swing ride", "tower swing ride", "tower swing rides", "Lift guests high above the event on swinging seats."),
  "trackless-train": C("Trackless train", "trackless train", "trackless trains", "Carry guests around your event grounds."),
  "kiddie-train": C("Kiddie train", "kiddie train", "kiddie trains", "A classic train ride for young children."),
  "family-coaster": C("Family roller coaster", "family roller coaster", "family roller coasters", "Bring roller-coaster thrills that families can ride together."),
  "kiddie-coaster": C("Kiddie coaster", "kiddie coaster", "kiddie coasters", "A first roller coaster for younger riders."),
  "spinning-teacups": C("Spinning teacups", "teacup ride", "teacup rides", "A spinning favorite for kids and families."),
  "tilt-ride": C("Tilting spin ride", "tilting spin ride", "tilting spin rides", "A spinning, tilting classic of the carnival midway."),
  scrambler: C("Scrambler", "Scrambler", "Scramblers", "A classic spinning ride for teens and adults."),
  "bumper-cars": C("Bumper cars", "bumper car ride", "bumper car rides", "Let guests bump, steer and laugh."),
  "kiddie-bumper-cars": C("Kiddie bumper cars", "kiddie bumper car ride", "kiddie bumper car rides", "Bumper cars sized for younger drivers."),
  "bumper-boats": C("Bumper boats", "bumper boat ride", "bumper boat rides", "Bumper fun on the water."),
  "giant-slide": C("Giant slide", "giant slide", "giant slides", "A tall carnival slide that suits nearly every age."),
  "fun-house": C("Fun house", "fun house", "fun houses", "A walk-through attraction full of surprises."),
  "mirror-maze": C("Mirror maze", "mirror maze", "mirror mazes", "Challenge guests to find their way through."),
  "haunted-house": C("Walk-through haunted house", "haunted house", "haunted houses", "Add some spooky fun for Halloween and fall events."),
  "swinging-pirate-ship": C("Swinging pirate ship", "pirate ship ride", "pirate ship rides", "A big swinging ride that draws a crowd."),
  "kiddie-pirate-ship": C("Kiddie pirate ship", "kiddie pirate ship", "kiddie pirate ships", "A gentle swinging ship for younger riders."),
  "music-express": C("Music express", "music express ride", "music express rides", "A fast, musical ride that teens love."),
  "sizzler-style-ride": C("Spinning sizzler-style ride", "sizzler-style ride", "sizzler-style rides", "A spinning thrill ride for older kids and adults."),
  paratrooper: C("Paratrooper ride", "paratrooper ride", "paratrooper rides", "A carnival classic that lifts and spins riders."),
  "helicopter-ride": C("Kiddie helicopter ride", "kiddie helicopter ride", "kiddie helicopter rides", "Let young pilots take flight."),
  "kiddie-jets": C("Kiddie jets", "kiddie jet ride", "kiddie jet rides", "Let young pilots take flight."),
  "kiddie-boats": C("Kiddie boats", "kiddie boat ride", "kiddie boat rides", "A gentle boat ride for little ones."),
  "kiddie-cars": C("Kiddie car ride", "kiddie car ride", "kiddie car rides", "Let little drivers take the wheel."),
  "kiddie-motorcycles": C("Kiddie motorcycles", "kiddie motorcycle ride", "kiddie motorcycle rides", "Let little riders hit the road."),
  "kiddie-drop-tower": C("Kiddie drop tower", "kiddie drop tower", "kiddie drop towers", "A small bounce-and-drop ride for children."),
  "kiddie-whip": C("Kiddie whip ride", "kiddie whip ride", "kiddie whip rides", "A whipping classic sized for kids."),
  "pony-cart-ride": C("Kiddie pony cart ride", "pony cart ride", "pony cart rides", "A classic ride for the youngest guests."),
  "zipper-style-ride": C("Zipper-style ride", "Zipper-style ride", "Zipper-style rides", "A flipping thrill ride for older riders."),
  gravitron: C("Spinning centrifuge ride", "centrifuge ride", "centrifuge rides", "A spinning favorite for teens and adults."),
  "drop-tower": C("Drop tower", "drop tower", "drop towers", "A tall drop ride for thrill seekers."),
  "pendulum-ride": C("Pendulum ride", "pendulum ride", "pendulum rides", "Big swings for thrill seekers."),
  "ring-of-fire": C("Looping coaster ring", "looping ring ride", "looping ring rides", "A looping showpiece that draws a crowd."),
  kamikaze: C("Kamikaze ride", "kamikaze ride", "kamikaze rides", "A looping thrill ride for older riders."),
  orbiter: C("Orbiter ride", "orbiter ride", "orbiter rides", "A spinning thrill ride for older riders."),
  "round-up": C("Round up ride", "round up ride", "round up rides", "A spinning carnival classic."),
  inverter: C("Inverter ride", "inverter ride", "inverter rides", "A flipping thrill ride for older riders."),
  "freak-out": C("Freak out ride", "freak out ride", "freak out rides", "A swinging thrill ride for older riders."),
  "tornado-ride": C("Tornado spin ride", "tornado spin ride", "tornado spin rides", "A spinning ride for teens and adults."),
  "go-karts": C("Portable go-kart track", "go-kart track", "go-kart tracks", "Let guests race around your event."),
  "dark-ride": C("Portable dark ride", "dark ride", "dark rides", "An indoor-style ride with a story."),
};

export function rideTypeCopy(id: string, fallbackName: string): RideTypeCopy {
  return RIDE_TYPE_COPY[id] ?? C(fallbackName, fallbackName.toLowerCase(), `${fallbackName.toLowerCase()} rides`, "Add a carnival ride to your celebration.");
}

export const countNoun = (n: number, c: RideTypeCopy) => `${n.toLocaleString("en-US")} ${n === 1 ? c.one : c.many}`;
/** "Ferris wheel" → "Ferris Wheel" for SEO titles; leaves already-capitalised words alone. */
export const titleCase = (s: string) => s.replace(/(^|[\s-])([a-z])/g, (_m, p: string, ch: string) => p + ch.toUpperCase());
