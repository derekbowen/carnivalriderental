"""
Build src/lib/geo/cities.json: US incorporated places with population >= MIN_POP, with their
internal-point coordinates, for the city pSEO pages.

Sources (US Census Bureau, public domain):
  - Vintage 2023 population estimates for incorporated places (sub-est2023.csv, SUMLEV 162)
  - 2023 Gazetteer place file (INTPTLAT / INTPTLONG)

  npm run geo:cities            # downloads both files, writes the JSON
"""
import csv, io, json, re, sys, urllib.request, zipfile

MIN_POP = int(sys.argv[1]) if len(sys.argv) > 1 else 25000
POP_URL = "https://www2.census.gov/programs-surveys/popest/datasets/2020-2023/cities/totals/sub-est2023.csv"
GAZ_URL = "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2023_Gazetteer/2023_Gaz_place_national.zip"

STATE_FIPS = {"01":"al","02":"ak","04":"az","05":"ar","06":"ca","08":"co","09":"ct","10":"de","11":"dc","12":"fl","13":"ga","15":"hi","16":"id","17":"il","18":"in","19":"ia","20":"ks","21":"ky","22":"la","23":"me","24":"md","25":"ma","26":"mi","27":"mn","28":"ms","29":"mo","30":"mt","31":"ne","32":"nv","33":"nh","34":"nj","35":"nm","36":"ny","37":"nc","38":"nd","39":"oh","40":"ok","41":"or","42":"pa","44":"ri","45":"sc","46":"sd","47":"tn","48":"tx","49":"ut","50":"vt","51":"va","53":"wa","54":"wv","55":"wi","56":"wy"}
# Census appends the legal type in lower case ("Kansas City city", "Nashville-Davidson metropolitan
# government (balance)"). Strip it exactly once and case-sensitively, so "Kansas City" and
# "Peachtree City" keep their own "City".
SUFFIX = re.compile(r"\s+(city and borough|metro township|consolidated government|metropolitan government|metro government|unified government|urban county|municipality|borough|village|town|city|CDP)$")

# Common names for consolidated governments and Census naming quirks.
OVERRIDES = {"Nashville-Davidson": "Nashville", "Louisville/Jefferson County": "Louisville", "Louisville/Jefferson County metro government": "Louisville", "Louisville": "Louisville", "Lexington-Fayette": "Lexington", "Augusta-Richmond County": "Augusta", "Athens-Clarke County": "Athens", "Macon-Bibb County": "Macon", "Urban Honolulu": "Honolulu", "San Buenaventura": "Ventura", "Columbus-Muscogee": "Columbus", "Butte-Silver Bow": "Butte", "Anaconda-Deer Lodge County": "Anaconda", "Indianapolis city": "Indianapolis"}

def clean(name):
    name = re.sub(r"^San Buenaventura \(Ventura\)", "Ventura", name)
    name = re.sub(r"\s*\(balance\)\s*$", "", name).strip()
    name = SUFFIX.sub("", name).strip()
    name = re.sub(r"\s*\(.*?\)\s*", " ", name).strip()
    return OVERRIDES.get(name, name)

def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower().replace("&", "and")).strip("-")

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "CarnivalRideRental-geo/1.0"})
    return urllib.request.urlopen(req, timeout=120).read()

pop = csv.DictReader(io.StringIO(fetch(POP_URL).decode("latin-1")))
people = {}
for r in pop:
    if r["SUMLEV"] == "162" and r["STATE"] in STATE_FIPS:
        people[r["STATE"] + r["PLACE"]] = (clean(r["NAME"]), int(r["POPESTIMATE2023"]))

z = zipfile.ZipFile(io.BytesIO(fetch(GAZ_URL)))
gaz = z.read(z.namelist()[0]).decode("utf-8").splitlines()
head = [h.strip() for h in gaz[0].split("\t")]
coords = {}
for line in gaz[1:]:
    f = dict(zip(head, [x.strip() for x in line.split("\t")]))
    coords[f["GEOID"]] = (float(f["INTPTLAT"]), float(f["INTPTLONG"]))

cities, seen = [], set()
for geoid, (name, p) in sorted(people.items(), key=lambda kv: -kv[1][1]):
    if p < MIN_POP or geoid not in coords:
        continue
    st = STATE_FIPS[geoid[:2]]
    s = slug(name)
    if (st, s) in seen:  # same name twice in a state: keep the larger place
        continue
    seen.add((st, s))
    lat, lng = coords[geoid]
    cities.append({"state": st, "name": name, "slug": s, "lat": round(lat, 4), "lng": round(lng, 4), "pop": p, "geoid": geoid})

cities.sort(key=lambda c: (c["state"], c["slug"]))
json.dump({"source": "US Census Bureau: Vintage 2023 place population estimates + 2023 Gazetteer (public domain)", "minPopulation": MIN_POP, "count": len(cities), "cities": cities}, open("src/lib/geo/cities.json", "w"))
print(f"{len(cities)} cities with population >= {MIN_POP}")
