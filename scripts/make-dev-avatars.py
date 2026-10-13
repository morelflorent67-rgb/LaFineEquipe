"""Génère les avatars FICTIFS du jeu d'essai local (public/dev-fixtures/avatar-NN.svg).

Ce ne sont pas des images FACEIT : formes et couleurs abstraites, pour tester l'affichage
d'avatars carrés colorés sans utiliser de photo réelle.
Usage : python scripts/make-dev-avatars.py
"""
import colorsys
import random
from pathlib import Path

random.seed(42)
OUT = Path(__file__).resolve().parent.parent / "public" / "dev-fixtures"
LABELS = ["AL", "BR", "CH", "DE", "EC", "FO", "GO", "HO", "QU", "PN",
          "KI", "LI", "MI", "NO", "OS", "PA", "QB", "RO", "YA", "SC"]


def color(h, s, l):
    r, g, b = colorsys.hls_to_rgb(h, l, s)
    return "#%02x%02x%02x" % (int(r * 255), int(g * 255), int(b * 255))


def shapes(kind, accent, base):
    if kind == 0:
        cx, cy, r = random.randint(60, 200), random.randint(60, 200), random.randint(70, 120)
        return f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{accent}" opacity=".55"/>'
    if kind == 1:
        return "".join(
            f'<rect x="{-40 + k * 44}" y="-20" width="20" height="320" fill="{accent}" opacity=".35" '
            f'transform="rotate(25 128 128)"/>' for k in range(9))
    if kind == 2:
        top = random.randint(40, 120)
        return (f'<polygon points="0,256 128,{top} 256,256" fill="{accent}" opacity=".5"/>'
                '<circle cx="190" cy="70" r="34" fill="#fff" opacity=".25"/>')
    out = []
    for _ in range(7):
        fill = random.choice([accent, "#ffffff", base])
        out.append(f'<circle cx="{random.randint(0, 256)}" cy="{random.randint(0, 256)}" '
                   f'r="{random.randint(12, 48)}" fill="{fill}" opacity=".35"/>')
    return "".join(out)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for i, label in enumerate(LABELS, start=1):
        h = random.random()
        h2 = (h + random.uniform(.15, .45)) % 1
        c1, c2, c3 = color(h, .75, .45), color(h2, .8, .35), color((h + .5) % 1, .85, .6)
        svg = (
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">\n'
            "<!-- Avatar FICTIF du jeu d'essai local LaFineEquipe : pas une image FACEIT. -->\n"
            f'<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{c1}"/>'
            f'<stop offset="1" stop-color="{c2}"/></linearGradient></defs>\n'
            f'<rect width="256" height="256" fill="url(#g)"/>{shapes(i % 4, c3, c1)}\n'
            f'<text x="128" y="152" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" '
            f'font-weight="900" font-size="76" fill="#ffffff" fill-opacity=".92">{label}</text>\n</svg>\n'
        )
        (OUT / f"avatar-{i:02d}.svg").write_text(svg, encoding="utf-8")
    print(f"{len(LABELS)} avatars écrits dans {OUT}")


if __name__ == "__main__":
    main()
