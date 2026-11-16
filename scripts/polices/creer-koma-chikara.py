"""Crée « KOMA Chikara », version dérivée de 851 Chikara Dzuyoku (kanaA), pour le français.

Usage (depuis la racine du projet) :
  uv run --no-project --with fonttools --with brotli python -I scripts/polices/creer-koma-chikara.py \
      docs/references/polices/851CHIKARA-DZUYOKU_kanaA_004.ttf public/fonts/koma-chikara

La police d'origine déclare les lettres accentuées mais leurs dessins sont vides. Ce script :
  - garde un sous-ensemble latin (ASCII, ponctuation utile) ;
  - compose chaque lettre accentuée à partir de la lettre de base ET des propres signes de la police (` ´ ^ ¨ , ~ < > - .),
    réduits et placés par des composants TrueType (aucun tracé dessiné à la main, aucune autre police) ;
  - fabrique « ı » (i sans point) en retirant le point du « i » de la police, pour î et ï ;
  - compose œ Œ æ Æ, « », – —, … (points sur la ligne de base) et les espaces insécables des prix ;
  - compose les signes de l'interface • ‹ › → − ⋯ à partir des signes de la police (· < > - +) ;
  - renomme la famille « KOMA Chikara » (licence : voir LICENCE.txt).
Sortie : koma-chikara.woff2 et couverture.txt (site ; planche d'essai : docs/design/admin/essais/planche-koma-chikara.html).
"""
import sys
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.subset import Subsetter, Options
from fontTools.ttLib.tables._g_l_y_f import Glyph, GlyphComponent, GlyphCoordinates

source, sortie = Path(sys.argv[1]), Path(sys.argv[2])
sortie.mkdir(parents=True, exist_ok=True)

# Signes et lettres de base gardés de la police d'origine.
BASE = "".join(chr(c) for c in range(0x20, 0x7F)) + "´¨’‘“”°×·€£¥©®"
f = TTFont(source)
opts = Options()
opts.layout_features = []
opts.name_IDs = ["*"]
opts.notdef_outline = True
opts.glyph_names = True
sub = Subsetter(opts)
sub.populate(unicodes=[ord(c) for c in BASE])
sub.subset(f)
# Tables japonaises inutiles pour du texte latin horizontal (métriques verticales, ancienne table « mort »).
for table in ("vmtx", "vhea", "mort"):
    if table in f:
        del f[table]

glyf, hmtx, cmap_tables = f["glyf"], f["hmtx"], [t for t in f["cmap"].tables if t.isUnicode()]
cmap = f.getBestCmap()
nom = lambda ch: cmap[ord(ch)]


def boite(g):
    gl = glyf[g]
    gl.recalcBounds(glyf)
    return gl.xMin, gl.yMin, gl.xMax, gl.yMax


def ajouter(nom_glyphe, composants, avance, unicode_=None):
    """Glyphe composé : composants = [(glyphe, dx, dy, sx, sy)]."""
    g = Glyph()
    # Sans composant (espaces) : glyphe vide, jamais un composite vide.
    g.numberOfContours = -1 if composants else 0
    if composants:
        g.components = []
    for (base, dx, dy, sx, sy) in composants:
        c = GlyphComponent()
        c.glyphName = base
        c.x, c.y = round(dx), round(dy)
        c.flags = 0x4  # ROUND_XY_TO_GRID
        if sx != 1 or sy != 1:
            c.transform = [[sx, 0], [0, sy]]
        g.components.append(c)
    glyf.glyphs[nom_glyphe] = g
    if nom_glyphe not in f.getGlyphOrder():
        f.setGlyphOrder(f.getGlyphOrder() + [nom_glyphe])
    glyf.glyphOrder = f.getGlyphOrder()
    hmtx.metrics[nom_glyphe] = (round(avance), 0)
    if composants:
        g.recalcBounds(glyf)
        hmtx.metrics[nom_glyphe] = (round(avance), g.xMin)
    if unicode_:
        for t in cmap_tables:
            t.cmap[ord(unicode_)] = nom_glyphe


# --- i sans point : le contour le plus haut (le point) du « i » est retiré ---
gi = glyf[nom("i")]
coords, fins = gi.coordinates, gi.endPtsOfContours
contours, debut = [], 0
for fin in fins:
    contours.append((debut, fin))
    debut = fin + 1
point = max(contours, key=lambda c: min(y for _, y in coords[c[0] : c[1] + 1]))
garde = [c for c in contours if c != point]
g = Glyph()
g.numberOfContours = len(garde)
pts, flags, nouvelles_fins = [], [], []
for (d, fn) in garde:
    pts.extend(coords[d : fn + 1])
    flags.extend(gi.flags[d : fn + 1])
    nouvelles_fins.append(len(pts) - 1)
g.coordinates, g.flags, g.endPtsOfContours, g.program = GlyphCoordinates(pts), bytearray(flags), nouvelles_fins, gi.program
glyf.glyphs["dotlessi"] = g
f.setGlyphOrder(f.getGlyphOrder() + ["dotlessi"])
glyf.glyphOrder = f.getGlyphOrder()
hmtx.metrics["dotlessi"] = hmtx.metrics[nom("i")]
for t in cmap_tables:
    t.cmap[0x131] = "dotlessi"

# --- Accents ---
# Signe source, échelle (x, y) minuscule puis majuscule, miroir horizontal. L'aigu de la police (´) est presque horizontal et se lit
# comme un grave en petit : l'aigu est donc le grave de la police en miroir, deux traits symétriques bien inclinés (décision du 2026-11-15).
# Le ^ de la police est très grand : réduit davantage en hauteur qu'en largeur, pour un « chapeau » large.
ACCENTS = {
    "grave": ("`", (1.1, 1.1), (0.92, 0.92), False),
    "aigu": ("`", (1.1, 1.1), (0.92, 0.92), True),
    "circ": ("^", (0.56, 0.4), (0.5, 0.34), False),
    "trema": ("¨", (1.05, 1.05), (0.9, 0.9), False),
    "tilde": ("~", (0.68, 0.6), (0.58, 0.5), False),
}
ECART_MIN, ECART_MAJ = 55, 95  # espace entre le haut de la lettre et le bas de l'accent (unités, 1 024 par cadratin)


def accentuer(car, base, accent):
    gb = nom(base) if base != "ı" else "dotlessi"
    bx0, by0, bx1, by1 = boite(gb)
    signe, ech_min, ech_maj, miroir = ACCENTS[accent]
    ga = nom(signe)
    ax0, ay0, ax1, ay1 = boite(ga)
    sx, sy = ech_maj if base.isupper() else ech_min
    # Haut de référence : x-height des minuscules (sauf ı), hauteur réelle pour les majuscules.
    haut = by1 if base.isupper() else max(by1, 520) if base != "ı" else 545
    centre = (bx0 + bx1) / 2
    # Composant en miroir : x' = -sx * x + dx, donc le centre de l'accent est dx - sx * (ax0 + ax1) / 2.
    dx = centre + sx * (ax0 + ax1) / 2 if miroir else centre - sx * (ax0 + ax1) / 2
    dy = haut + (ECART_MAJ if base.isupper() else ECART_MIN) - sy * ay0
    ajouter(f"uni{ord(car):04X}", [(gb, 0, 0, 1, 1), (ga, dx, dy, -sx if miroir else sx, sy)], hmtx[gb][0], car)


LETTRES = {
    "grave": "àèìòùÀÈÌÒÙ",
    "aigu": "áéíóúýÁÉÍÓÚÝ",
    "circ": "âêîôûÂÊÎÔÛ",
    "trema": "äëïöüÿÄËÏÖÜŸ",
    "tilde": "ãñõÃÑÕ",
}
import unicodedata

for accent, lettres in LETTRES.items():
    for car in lettres:
        base = unicodedata.normalize("NFD", car)[0]
        if base == "i":
            base = "ı"
        accentuer(car, base, accent)

# --- Cédille : la virgule de la police, réduite, sous la lettre ---
for car, base in (("ç", "c"), ("Ç", "C")):
    gb, gv = nom(base), nom(",")
    bx0, by0, bx1, _ = boite(gb)
    vx0, vy0, vx1, vy1 = boite(gv)
    # Cédille : virgule de la police agrandie, centrée sous la lettre.
    s = 1.12
    dx = (bx0 + bx1) / 2 - s * (vx0 + vx1) / 2
    dy = min(by0, 0) - 10 - s * vy1
    ajouter(f"uni{ord(car):04X}", [(gb, 0, 0, 1, 1), (gv, dx, dy, s, s)], hmtx[gb][0], car)

# --- Ligatures œ Œ æ Æ : les deux lettres de la police, rapprochées ---
for car, a, b, chevauchement in (("œ", "o", "e", 0.34), ("Œ", "O", "E", 0.3), ("æ", "a", "e", 0.32), ("Æ", "A", "E", 0.3)):
    ga, gbn = nom(a), nom(b)
    av = hmtx[ga][0]
    dx = av * (1 - chevauchement)
    ajouter(f"uni{ord(car):04X}", [(ga, 0, 0, 1, 1), (gbn, dx, 0, 1, 1)], dx + hmtx[gbn][0], car)

# --- Guillemets « » : deux chevrons de la police, réduits, à mi-hauteur ---
for car, signe in (("«", "<"), ("»", ">")):
    gs = nom(signe)
    x0, y0, x1, y1 = boite(gs)
    s = 0.58
    dy = 300 - s * (y0 + y1) / 2
    pas = s * (x1 - x0) * 0.72
    debut = 40 - s * x0
    ajouter(f"uni{ord(car):04X}", [(gs, debut, dy, s, s), (gs, debut + pas, dy, s, s)], 40 + pas + s * (x1 - x0) + 40, car)

# --- Tirets – — : le trait d'union de la police, allongé ---
gh = nom("-")
hx0, _, hx1, _ = boite(gh)
for car, largeur in (("–", 512), ("—", 1024)):
    sx = (largeur - 60) / (hx1 - hx0)
    ajouter(f"uni{ord(car):04X}", [(gh, 30 - sx * hx0, 0, sx, 1)], largeur, car)

# --- Points de suspension sur la ligne de base (celui de la police est centré, à la japonaise) ---
gp = nom(".")
px0, _, px1, _ = boite(gp)
pas = (px1 - px0) + 70
ajouter("uni2026", [(gp, -px0 + 40 + i * pas, 0, 1, 1) for i in range(3)], 40 + 3 * pas, "…")

# --- Signes de l'interface (story 9.16 a) : composés à partir des signes de la police, comme les accents ---
# Point médian · : le « · » de la police d'origine est vide (comme ses accents) ; il est composé du point « . » remonté à mi-hauteur
# des minuscules (« Taille : M · Noir »). Il sert ensuite de base à la puce et aux points médians.
gpt = nom(".")
tx0, ty0, tx1, ty1 = boite(gpt)
ajouter("middot.koma", [(gpt, 60 - tx0, 300 - (ty0 + ty1) / 2, 1, 1)], 120 + (tx1 - tx0), "·")
gm = "middot.koma"
mx0, my0, mx1, my1 = boite(gm)

# Puce • : le point médian, agrandi, centré à mi-hauteur des minuscules.
s = 1.7
ajouter("uni2022", [(gpt, 60 - s * tx0, 300 - s * (ty0 + ty1) / 2, s, s)], 120 + s * (tx1 - tx0), "•")

# Chevrons simples ‹ › : un chevron de la police, à la taille de ceux des guillemets « ».
for car, signe in (("‹", "<"), ("›", ">")):
    gs = nom(signe)
    x0, y0, x1, y1 = boite(gs)
    s = 0.58
    ajouter(f"uni{ord(car):04X}", [(gs, 40 - s * x0, 300 - s * (y0 + y1) / 2, s, s)], 80 + s * (x1 - x0), car)

# Moins − : le trait d'union allongé à la largeur du « + », centré sur sa barre.
gplus = nom("+")
qx0, qy0, qx1, qy1 = boite(gplus)
hx0, hy0, hx1, hy1 = boite(gh)
sx = (qx1 - qx0) / (hx1 - hx0)
ajouter("uni2212", [(gh, qx0 - sx * hx0, (qy0 + qy1) / 2 - (hy0 + hy1) / 2, sx, 1)], hmtx[gplus][0], "−")

# Flèche → : un trait d'union allongé et le chevron « > » de la police, centrés sur la même ligne.
gsup = nom(">")
cx0, cy0, cx1, cy1 = boite(gsup)
s = 0.85
milieu = 330
longueur = 760
pointe_x0 = 40 + longueur - s * (cx1 - cx0)
sx = (pointe_x0 + s * (cx1 - cx0) * 0.5 - 40) / (hx1 - hx0)
ajouter(
    "uni2192",
    [(gh, 40 - sx * hx0, milieu - (hy0 + hy1) / 2, sx, 1), (gsup, pointe_x0 - s * cx0, milieu - s * (cy0 + cy1) / 2, s, s)],
    40 + longueur + 40,
    "→",
)

# Points de suspension médians ⋯ : trois points médians composés ci-dessus.
pas_m = (mx1 - mx0) + 70
ajouter("uni22EF", [(gm, -mx0 + 40 + i * pas_m, 0, 1, 1) for i in range(3)], 40 + 3 * pas_m, "⋯")

# --- Espaces insécables des prix (Intl : U+00A0 et U+202F) ---
gsp = nom(" ")
ajouter("uni00A0", [], hmtx[gsp][0], " ")
ajouter("uni202F", [], round(hmtx[gsp][0] * 0.6), " ")

# --- Glyphes vides : la police d'origine déclare des signes sans dessin (¥ © ® après les accents et ·). Un caractère déclaré mais vide
# serait invisible : il est retiré de la table des caractères, et le navigateur le dessine avec la police système de repli.
for t in cmap_tables:
    for code in [c for c, g in t.cmap.items() if glyf[g].numberOfContours == 0 and not chr(c).isspace()]:
        del t.cmap[code]

# --- Hauteur : la ligne garde ses mesures ; Windows ne doit pas rogner les accents des majuscules ---
plus_haut = max(getattr(glyf[g], "yMax", 0) for g in f.getGlyphOrder() if glyf[g].numberOfContours)
f["OS/2"].usWinAscent = max(f["OS/2"].usWinAscent, plus_haut + 20)
f["head"].yMax = max(f["head"].yMax, plus_haut)
# USE_TYPO_METRICS (fsSelection, bit 7) : Windows mesure la ligne avec sTypo (= hhea), comme Android, Linux et macOS, au lieu de
# usWinAscent (relevé ci-dessus pour les anciens logiciels). Mêmes mesures partout, donc le repli aux métriques ajustées de Next
# (calculé sur hhea) place la ligne de base au même endroit : aucun décalage quand la police arrive (CLS, 9.16 a).
os2 = f["OS/2"]
os2.fsSelection |= 1 << 7
if os2.version < 4:
    # Le drapeau n'existe qu'à partir de la version 4 de la table : champs ajoutés mesurés sur les glyphes de la police.
    if os2.version < 1:
        os2.ulCodePageRange1, os2.ulCodePageRange2 = 1, 0
    os2.sxHeight = boite(nom("x"))[3]
    os2.sCapHeight = boite(nom("H"))[3]
    os2.usDefaultChar, os2.usBreakChar, os2.usMaxContext = 0, 0x20, 0
    os2.version = 4

# --- Noms : version dérivée ---
for r in f["name"].names:
    if r.nameID in (1, 3, 4, 16):
        r.string = "KOMA Chikara"
    elif r.nameID == 6:
        r.string = "KOMAChikara-Regular"
    elif r.nameID == 5:
        r.string = "Version 0.04-koma1 (dérivée de 851 Chikara Dzuyoku kanaA 0.04)"
f["name"].setName("Dérivée de 851 Chikara Dzuyoku (auteur : 851, https://pm85122.onamae.jp/851fontTerm.html). Lettres accentuées et signes français composés à partir des glyphes de la police.", 10, 3, 1, 0x409)

f["maxp"].recalc(f)
f.flavor = "woff2"
f.save(sortie / "koma-chikara.woff2")
# Liste des caractères couverts (un par ligne, point de code en hexadécimal), relue par tests/unit/police-unique.test.ts : le test
# vérifie la couverture des traductions sans décoder le woff2.
couverts = sorted({c for t in cmap_tables for c in t.cmap})
(sortie / "couverture.txt").write_text("".join(f"{c:04X}\n" for c in couverts), encoding="utf-8")
print("glyphes :", len(f.getGlyphOrder()), "|", (sortie / "koma-chikara.woff2").stat().st_size // 1024, "Ko (woff2)")
