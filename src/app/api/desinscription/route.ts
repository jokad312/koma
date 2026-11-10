import { NextResponse } from "next/server";
import { dependancesPreferences } from "@/modules/preferences/dependances";
import { desinscrireParLien } from "@/modules/preferences/service";

// Désinscription « en un clic » des messageries (RFC 8058, en-têtes List-Unsubscribe et List-Unsubscribe-Post des Emails commerciaux).
// POST seulement, avec le corps « List-Unsubscribe=One-Click » : un GET (antivirus, aperçu) n'existe pas ici (405) et ne désinscrit
// jamais (décision de Jonathan du 2026-11-10). La signature HMAC du lien (c, s) est vérifiée avant tout appel à la base.
const SANS_CACHE = { "Cache-Control": "no-store" };

export async function POST(requete: Request) {
  const corps = await requete.text().catch(() => "");
  if (new URLSearchParams(corps).get("List-Unsubscribe") !== "One-Click") return NextResponse.json({ ok: false }, { status: 400, headers: SANS_CACHE });
  const url = new URL(requete.url);
  try {
    const resultat = await desinscrireParLien(dependancesPreferences(), { c: url.searchParams.get("c") ?? undefined, s: url.searchParams.get("s") ?? undefined });
    if (resultat === "desinscrit") return NextResponse.json({ ok: true }, { status: 200, headers: SANS_CACHE });
    if (resultat === "lien_invalide") return NextResponse.json({ ok: false }, { status: 400, headers: SANS_CACHE });
  } catch {
    console.error("[preferences] désinscription en un clic : échec");
  }
  return NextResponse.json({ ok: false }, { status: 500, headers: SANS_CACHE });
}
