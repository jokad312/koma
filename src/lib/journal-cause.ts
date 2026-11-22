// Assainisseur unique des messages d'erreur avant journal (bugs A1 et A2, 2026-11-22) : une seule règle de non-fuite pour tout le site.
// Une ligne, 200 caractères au plus. Masqués : adresses http(s)://…, adresses email, UUID, valeur citée après « : » entre guillemets
// doubles, texte entre guillemets simples (les deux même sans guillemet fermant), formes « =(…) » (clé Postgres) et suites de 7 chiffres
// ou plus (numéro de téléphone, avec espaces, points, tirets ou + éventuels).
// Un nom entre guillemets doubles sans « : » devant (ex. record "v_source") reste lisible : c'est un nom du code, pas une valeur.
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

export function messageSur(texte: string): string {
  return texte
    .replace(/[\r\n]+/g, " ")
    .replace(/https?:\/\/\S*/gi, "…")
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "…")
    .replace(UUID, "…")
    .replace(/:\s*"[^"]*"?/g, ': "…"')
    .replace(/(^|[^\p{L}\p{N}])'[^']*'?/gu, "$1'…'")
    .replace(/=\([^)]*\)?/g, "=(…)")
    .replace(/\+?\d(?:[ .-]?\d){6,}/g, "…")
    .slice(0, 200);
}

// Erreur Supabase réduite à son code et à son message assaini, jamais details ni hint (qui peuvent citer des valeurs).
// Sert de `cause` aux erreurs relancées : en production, Next journalise lui-même l'erreur levée dans une fonction "use cache"
// (avec sa cause) avant de la sérialiser ; la cause brute y ferait apparaître details et hint.
export function causeSure(erreur: { code?: string | null; message?: string | null }): { code: string; message: string } {
  return { code: erreur.code ? messageSur(erreur.code) : "", message: messageSur(erreur.message ?? "") };
}
