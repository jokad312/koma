import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    return statSync(chemin).isDirectory() ? fichiers(chemin) : [chemin];
  });
}

// L'adresse du site vient de NEXT_PUBLIC_SITE_URL seulement (Q-D1).
describe("src/", () => {
  it("ne contient aucun nom de domaine écrit en dur", () => {
    // Exceptions : schema.org est un espace de noms JSON-LD, wa.me le service de lien WhatsApp (src/lib/vitrine/whatsapp.ts), www.instagram.com l'adresse du profil d'un exposant (src/components/admin/SectionCandidatures.tsx), video.bunnycdn.com l'API de Bunny Stream (src/lib/bunny/api.ts) , marchand.maishapay.online l’API de MaishaPay et api.pawapay.io (et api.sandbox.pawapay.io) l’API de PawaPay (adaptateurs) : ce ne sont pas l'adresse du site.
    const adresse = /https?:\/\/(?!localhost\b|127\.0\.0\.1\b|schema\.org\b|wa\.me\b|www\.instagram\.com\b|video\.bunnycdn\.com\b|marchand\.maishapay\.online\b|api\.pawapay\.io\b|api\.sandbox\.pawapay\.io\b)[\w-]+(\.[\w-]+)+/i;
    const fautifs = fichiers("src")
      .filter((f) => !f.endsWith(".test.ts"))
      .filter((f) => adresse.test(readFileSync(f, "utf8")));
    expect(fautifs).toEqual([]);
  });
});
