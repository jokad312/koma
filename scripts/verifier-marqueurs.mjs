// Contrôle de build (prebuild) : aucun marqueur « [Texte à fournir] » ne doit rester dans une page publique en production.
// Actif seulement si KOMA_VERIFIER_TEXTES=true (variable posée uniquement sur Hostinger ; absente de la CI, du dev et du build local).
// Usage : node scripts/verifier-marqueurs.mjs [dossier des messages, « messages » par défaut]
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ESPACES_PUBLICS, MARQUEUR_TEXTE, trouverMarqueurs } from "../src/lib/vitrine/marqueur.ts";

// « true » ou « 1 », sans tenir compte de la casse. Toute autre valeur non vide (hors « false » et « 0 ») est signalée.
const valeur = (process.env.KOMA_VERIFIER_TEXTES ?? "").trim().toLowerCase();
if (valeur !== "true" && valeur !== "1") {
  if (valeur !== "" && valeur !== "false" && valeur !== "0") {
    console.error("Attention : KOMA_VERIFIER_TEXTES a une valeur inconnue ; seules « true » et « 1 » activent le contrôle. Contrôle ignoré.");
  }
  console.log("Contrôle des textes à fournir : ignoré (KOMA_VERIFIER_TEXTES n'est pas activée).");
  process.exit(0);
}

const dossier = process.argv[2] ?? "messages";
const restants = [];
for (const langue of ["fr", "en"]) {
  const messages = JSON.parse(readFileSync(join(dossier, `${langue}.json`), "utf8"));
  for (const cle of trouverMarqueurs(messages, ESPACES_PUBLICS)) restants.push(`${langue}.json : ${cle}`);
}

if (restants.length > 0) {
  console.error(`Build refusé : « ${MARQUEUR_TEXTE} » reste dans des pages publiques (${restants.length} texte(s)) :`);
  for (const ligne of restants) console.error(`  - ${ligne}`);
  console.error("Fais fournir ces textes par Jonathan avant de déployer en production.");
  process.exit(1);
}
console.log("Contrôle des textes à fournir : aucun marqueur dans les pages publiques.");
