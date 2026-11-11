import { connection, NextResponse } from "next/server";
import { dependancesExportAlertes } from "@/modules/alertes/dependances";
import { exporterNumerosWhatsapp } from "@/modules/alertes/service";

// Export CSV des numéros WhatsApp des inscrits « Me prévenir » d'un événement (story 7.3, FR-32). GET réservé au droit « evenements.gerer »
// (vérifié sur le serveur, jamais lu depuis le navigateur). L'export est journalisé par la base. Le fichier n'est jamais écrit sur
// disque ni mis en cache : il est renvoyé tel quel. Le site n'envoie aucun message WhatsApp.
const SANS_CACHE = { "Cache-Control": "no-store" };
const STATUTS = { evenement_invalide: 400, non_connecte: 401, non_autorise: 403, introuvable: 404, generique: 500 } as const;

export async function GET(_requete: Request, contexte: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await contexte.params;
  const resultat = await exporterNumerosWhatsapp(dependancesExportAlertes(), id);
  if (!resultat.ok) return NextResponse.json({ ok: false }, { status: STATUTS[resultat.erreur], headers: SANS_CACHE });
  return new NextResponse(resultat.csv, {
    status: 200,
    headers: {
      ...SANS_CACHE,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="alertes-whatsapp-${id.toLowerCase()}.csv"`,
    },
  });
}
