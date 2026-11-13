// Pseudo affiché dans « Bonjour [pseudo] » de l'espace personnel (story 9.12, décision de Jonathan du 2026-11-13) : le nom donné par Google
// (métadonnées full_name, sinon name) s'il existe, sinon la partie de l'email avant « @ ». Un futur champ « pseudo » du profil est noté dans
// deferred-work.md. Rien n'est inventé : sans nom ni email, null.
const LONGUEUR_MAX = 60;

function texte(valeur: unknown): string | null {
  if (typeof valeur !== "string") return null;
  const propre = valeur.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return propre === "" ? null : propre.slice(0, LONGUEUR_MAX);
}

export function pseudoDepuisClaims(claims: unknown): string | null {
  if (typeof claims !== "object" || claims === null) return null;
  const c = claims as Record<string, unknown>;
  const meta = typeof c.user_metadata === "object" && c.user_metadata !== null ? (c.user_metadata as Record<string, unknown>) : {};
  const nom = texte(meta.full_name) ?? texte(meta.name);
  if (nom) return nom;
  const email = texte(c.email);
  if (!email || !email.includes("@")) return null;
  return texte(email.slice(0, email.indexOf("@")));
}

// Deux initiales au plus (premières lettres des deux premiers mots ; points, tirets et soulignés séparent les mots), en majuscules.
export function initiales(pseudo: string | null): string {
  if (!pseudo) return "";
  const mots = pseudo.split(/[\s._\-+]+/u).filter((m) => m.length > 0);
  return mots
    .slice(0, 2)
    .map((m) => Array.from(m)[0] ?? "")
    .join("")
    .toLocaleUpperCase();
}
