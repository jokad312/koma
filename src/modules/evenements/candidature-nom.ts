import { NOM_TITULAIRE_MAX, NOM_TITULAIRE_MIN } from "./achat-types";

// Nom propre : même règle que la base (qui revérifie tout) — 2 à 80 caractères, ni chevrons ni caractère de contrôle. Sans dépendance serveur :
// utilisable par les composants client.
export function nomValable(nom: string): boolean {
  const propre = nom.replace(/\s+/g, " ").trim();
  return propre.length >= NOM_TITULAIRE_MIN && propre.length <= NOM_TITULAIRE_MAX && !/[<>\u0000-\u001f\u007f]/.test(propre);
}
