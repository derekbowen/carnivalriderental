"""Generate the original category illustrations in public/illustrations/categories/.

Run: python3 scripts/make-category-illustrations.py
Flat, lightweight SVG artwork (no photos, no third-party assets). They depict a ride TYPE in a
generic scene and are always labelled "Illustration" on the page: never a specific available unit.
"""
import math
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "public/illustrations/categories"
W, H = 800, 600
NAVY, MARIGOLD, RED, CREAM = "#0B1B3F", "#FFC629", "#E5352B", "#F8EFDD"


def svg(title, body, bg):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" role="img" aria-labelledby="t">'
        f"<title id=\"t\">{title}</title>{bg}{body}</svg>\n"
    )


def pol(cx, cy, r, deg):
    a = math.radians(deg)
    return cx + r * math.cos(a), cy + r * math.sin(a)


def ferris():
    cx, cy, r = 400, 268, 190
    bg = (
        '<defs><linearGradient id="dusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#121F4D"/>'
        '<stop offset="1" stop-color="#3B2C5E"/></linearGradient></defs>'
        f'<rect width="{W}" height="{H}" fill="url(#dusk)"/>'
        '<rect y="470" width="800" height="90" fill="#F2A65A" opacity=".18"/>'
    )
    stars = "".join(f'<circle cx="{x}" cy="{y}" r="1.6" fill="#fff" opacity=".7"/>' for x, y in [(60, 60), (150, 110), (690, 70), (740, 150), (610, 40), (90, 190), (720, 230)])
    sky = ""
    for i, (x, w, h) in enumerate([(0, 70, 120), (70, 50, 170), (120, 80, 95), (560, 60, 150), (620, 90, 110), (710, 90, 185), (200, 40, 70), (520, 45, 80)]):
        sky += f'<rect x="{x}" y="{560 - h}" width="{w}" height="{h}" fill="{NAVY}"/>'
        for wy in range(560 - h + 14, 548, 22):
            for wx in range(x + 8, x + w - 8, 16):
                if (wx + wy + i) % 3:
                    sky += f'<rect x="{wx}" y="{wy}" width="5" height="7" fill="{MARIGOLD}" opacity=".55"/>'
    legs = f'<path d="M{cx} {cy} L300 560 M{cx} {cy} L500 560" stroke="#D9D4F0" stroke-width="9" stroke-linecap="round"/>'
    spokes = "".join(f'<line x1="{cx}" y1="{cy}" x2="{pol(cx, cy, r, d)[0]:.1f}" y2="{pol(cx, cy, r, d)[1]:.1f}" stroke="#E9E4FF" stroke-width="2" opacity=".75"/>' for d in range(0, 360, 22))
    rim = f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="#E9E4FF" stroke-width="6"/><circle cx="{cx}" cy="{cy}" r="{r - 16}" fill="none" stroke="#E9E4FF" stroke-width="2" opacity=".6"/>'
    lights = "".join(f'<circle cx="{pol(cx, cy, r, d)[0]:.1f}" cy="{pol(cx, cy, r, d)[1]:.1f}" r="4" fill="{MARIGOLD}"/>' for d in range(0, 360, 11))
    cars = ""
    for i, d in enumerate(range(0, 360, 30)):
        x, y = pol(cx, cy, r, d)
        cars += f'<rect x="{x - 13:.1f}" y="{y + 4:.1f}" width="26" height="20" rx="6" fill="{RED if i % 2 else MARIGOLD}"/>'
    hub = f'<circle cx="{cx}" cy="{cy}" r="16" fill="{MARIGOLD}"/>'
    ground = f'<rect y="556" width="{W}" height="44" fill="#08132E"/>'
    return svg("Illustration of a Ferris wheel lit up against an evening city skyline", stars + sky + legs + spokes + rim + lights + cars + hub + ground, bg)


def horse(x, y, color, pole):
    """Side-view carousel horse, prancing, on its pole."""
    return (
        f'<g transform="translate({x} {y})">'
        f'<path d="M-34 -2 Q-48 2 -44 18" fill="none" stroke="{color}" stroke-width="6" stroke-linecap="round"/>'
        f'<ellipse cx="0" cy="0" rx="32" ry="14" fill="{color}"/>'
        f'<path d="M18 -8 L30 -34 L40 -32 L32 -4 Z" fill="{color}"/>'
        f'<path d="M28 -36 L52 -30 L50 -22 L30 -26 Z" fill="{color}"/>'
        f'<path d="M30 -38 L34 -46 L37 -37 Z" fill="{color}"/>'
        f'<path d="M20 8 L36 16 L34 28 M10 10 L22 22 L20 32" fill="none" stroke="{color}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>'
        f'<path d="M-18 9 L-22 34 M-26 6 L-34 30" fill="none" stroke="{color}" stroke-width="5" stroke-linecap="round"/>'
        f'<rect x="-10" y="-8" width="16" height="7" rx="3" fill="{pole}"/></g>'
    )


def carousel():
    burgundy, brass = "#7A2335", "#B08D3C"
    bg = f'<rect width="{W}" height="{H}" fill="{CREAM}"/>'
    roof = f'<path d="M400 70 L640 205 L160 205 Z" fill="{burgundy}"/>'
    stripes = "".join(f'<path d="M400 70 L{160 + i * 60} 205 L{190 + i * 60} 205 Z" fill="{brass}" opacity=".85"/>' for i in range(0, 8, 2))
    finial = f'<circle cx="400" cy="64" r="10" fill="{brass}"/>'
    scallops = "".join(f'<path d="M{160 + i * 40} 205 a20 20 0 0 0 40 0 Z" fill="{burgundy if i % 2 else brass}"/>' for i in range(12))
    column = f'<rect x="386" y="225" width="28" height="240" fill="{brass}"/>'
    poles = "".join(f'<line x1="{x}" y1="225" x2="{x}" y2="470" stroke="{brass}" stroke-width="5"/>' for x in (215, 300, 500, 585))
    horses = horse(215, 360, burgundy, brass) + horse(300, 330, NAVY, brass) + horse(500, 345, burgundy, brass) + horse(585, 320, NAVY, brass)
    base = f'<ellipse cx="400" cy="490" rx="270" ry="44" fill="{burgundy}"/><ellipse cx="400" cy="478" rx="270" ry="40" fill="#EBDDC0" stroke="{brass}" stroke-width="4"/>'
    ground = f'<rect y="540" width="{W}" height="60" fill="#E9DCC2"/>'
    return svg("Illustration of a classic carousel with a scalloped canopy and carved horses", ground + base + column + poles + horses + roof + stripes + scallops + finial, bg)


def swing():
    blue = "#2F7FC1"
    bg = f'<rect width="{W}" height="{H}" fill="#DFF0FB"/>'
    clouds = "".join(f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{rx * 0.38:.0f}" fill="#fff" opacity=".9"/>' for x, y, rx in [(130, 110, 70), (180, 95, 50), (660, 80, 80), (610, 100, 45)])
    arcs = "".join(f'<path d="M{400 - rr} 360 A{rr} {rr * 0.32:.0f} 0 0 0 {400 + rr} 360" fill="none" stroke="{blue}" stroke-width="3" opacity=".28"/>' for rr in (300, 340))
    grass = '<path d="M0 520 Q200 490 400 515 T800 505 V600 H0 Z" fill="#CFE8C9"/>'
    tower = f'<rect x="388" y="190" width="24" height="335" fill="{NAVY}"/>'
    chains, seats = "", ""
    for i, d in enumerate(range(0, 360, 30)):
        top = pol(400, 196, 160, d)
        top = (top[0], 196 + (top[1] - 196) * 0.18)
        seat = pol(400, 345, 290, d)
        seat = (seat[0], 345 + (seat[1] - 345) * 0.22)
        chains += f'<line x1="{top[0]:.1f}" y1="{top[1]:.1f}" x2="{seat[0]:.1f}" y2="{seat[1]:.1f}" stroke="{NAVY}" stroke-width="2" opacity=".7"/>'
        seats += f'<rect x="{seat[0] - 11:.1f}" y="{seat[1] - 4:.1f}" width="22" height="14" rx="4" fill="{RED if i % 2 else MARIGOLD}"/>'
    canopy = f'<ellipse cx="400" cy="190" rx="170" ry="30" fill="{blue}"/><ellipse cx="400" cy="182" rx="120" ry="18" fill="#fff" opacity=".35"/><circle cx="400" cy="150" r="12" fill="{MARIGOLD}"/><path d="M400 162 V172" stroke="{NAVY}" stroke-width="4"/>'
    return svg("Illustration of a swing ride with chairs flying outward under an open sky", clouds + arcs + grass + tower + chains + seats + canopy, bg)


def thrill():
    bg = f'<rect width="{W}" height="{H}" fill="#140F24"/>'
    bands = f'<path d="M-40 600 L520 -20 L600 -20 L40 600 Z" fill="{RED}" opacity=".85"/><path d="M80 600 L640 -20 L668 -20 L108 600 Z" fill="{MARIGOLD}" opacity=".9"/>'
    trail = f'<path d="M210 440 A250 250 0 0 0 590 440" fill="none" stroke="{MARIGOLD}" stroke-width="4" stroke-dasharray="10 12" opacity=".7"/>'
    frame = '<path d="M400 120 L285 545 M400 120 L515 545" stroke="#CFC8E6" stroke-width="12" stroke-linecap="round"/>'
    end = (596, 392)
    arm = f'<line x1="400" y1="120" x2="{end[0]}" y2="{end[1]}" stroke="#fff" stroke-width="12" stroke-linecap="round"/>'
    disc = f'<circle cx="{end[0]}" cy="{end[1]}" r="62" fill="{RED}" stroke="{MARIGOLD}" stroke-width="6"/>'
    seats = "".join(f'<circle cx="{pol(end[0], end[1], 42, d)[0]:.1f}" cy="{pol(end[0], end[1], 42, d)[1]:.1f}" r="7" fill="#fff"/>' for d in range(0, 360, 45))
    pivot = f'<circle cx="400" cy="120" r="16" fill="{MARIGOLD}"/>'
    ground = '<rect y="545" width="800" height="55" fill="#0B0818"/>'
    return svg("Illustration of a pendulum thrill ride swinging high against a dark sky", bands + trail + frame + arm + disc + seats + pivot + ground, bg)


def kiddie():
    teal = "#1F9D8B"
    bg = f'<rect width="{W}" height="{H}" fill="#FFF4C7"/>'
    sun = f'<circle cx="680" cy="110" r="52" fill="{MARIGOLD}"/>'
    clouds = "".join(f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{rx * 0.4:.0f}" fill="#fff"/>' for x, y, rx in [(150, 150, 60), (200, 138, 42), (470, 110, 50)])
    line = '<path d="M0 60 Q400 120 800 60" fill="none" stroke="#0B1B3F" stroke-width="2"/>'
    flags = ""
    for i, x in enumerate(range(30, 800, 60)):
        y = 60 + 60 * math.sin(math.pi * x / 800) * 0.95
        flags += f'<path d="M{x - 16} {y:.1f} L{x + 16} {y:.1f} L{x} {y + 30:.1f} Z" fill="{[RED, teal, "#2F7FC1", MARIGOLD][i % 4]}"/>'
    hills = '<path d="M0 470 Q160 410 330 460 T800 450 V600 H0 Z" fill="#BFE3B4"/>'
    track = '<rect x="60" y="505" width="680" height="8" rx="4" fill="#0B1B3F"/>'
    engine = f'<rect x="470" y="400" width="170" height="90" rx="18" fill="{RED}"/><rect x="560" y="350" width="80" height="70" rx="12" fill="{RED}"/><rect x="574" y="364" width="52" height="34" rx="8" fill="#fff"/><rect x="490" y="368" width="30" height="40" rx="6" fill="{NAVY}"/>'
    cars = f'<rect x="300" y="420" width="150" height="70" rx="16" fill="{teal}"/><rect x="130" y="420" width="150" height="70" rx="16" fill="#2F7FC1"/>'
    wheels = "".join(f'<circle cx="{x}" cy="497" r="20" fill="{NAVY}"/><circle cx="{x}" cy="497" r="7" fill="{MARIGOLD}"/>' for x in (170, 245, 340, 415, 505, 600))
    return svg("Illustration of a small kiddie train under bunting flags on a sunny day", sun + clouds + line + flags + hills + track + cars + engine + wheels, bg)


OUT.mkdir(parents=True, exist_ok=True)
for name, fn in {"ferris-wheels": ferris, "carousels": carousel, "swing-rides": swing, "thrill-rides": thrill, "kiddie-rides": kiddie}.items():
    (OUT / f"{name}.svg").write_text(fn())
    print("wrote", name)
