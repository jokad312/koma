import localFont from "next/font/local";

// Police unique du site et de l'admin (story 9.16 a) : KOMA Chikara, dérivée de 851 Chikara Dzuyoku (licence vérifiée,
// docs/licences/polices.md ; fichier et LICENCE.txt dans src/fonts/koma-chikara/). Un seul poids : la hiérarchie vient de la taille,
// de la couleur et des majuscules (font-synthesis: none dans globals.css).
// Chargement (décision du 2026-11-16) : woff2 préchargé (<link rel="preload">, posé par Next), font-display: swap. Repli : nos propres
// @font-face de globals.css, « KOMA Repli Arial » (ordinateurs, iPhone) puis « KOMA Repli Roboto » (Android, sans Arial), aux largeurs
// et hauteurs réglées sur KOMA Chikara pour limiter le décalage à l'arrivée de la police (CLS mesuré : docs/design/admin/INVENTAIRE.md
// § 6). Le repli automatique de Next (Arial seul, réglé sur les minuscules) est désactivé : il laissait Android sans réglage.
// Les titres en majuscules ont leur propre pile (--font-capitales, globals.css).
// Repli système pour les caractères absents (japonais d'un nom de produit, accent rare d'un pseudo, emoji) : system-ui puis sans-serif.
export const komaChikara = localFont({
  src: [{ path: "../fonts/koma-chikara/koma-chikara.woff2", weight: "400", style: "normal" }],
  // Nom de famille CSS : Next le tire du nom de cette constante (« komaChikara », repris tel quel par --font-capitales dans globals.css).
  // Un nom choisi par `declarations` n'est pas repris par Turbopack dans la variable --font-koma-chikara (essai du 2026-11-16).
  variable: "--font-koma-chikara",
  display: "swap",
  preload: true,
  adjustFontFallback: false,
  fallback: ["KOMA Repli Arial", "KOMA Repli Roboto", "system-ui", "sans-serif"],
});
