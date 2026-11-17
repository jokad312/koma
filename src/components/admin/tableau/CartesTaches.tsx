import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { CarteTache, CleTache } from "@/modules/tableau-de-bord/queries";

// Cartes de la maquette du tableau de bord (E9, E10 ; décision 3 du 2026-11-17) : en haut, sous « À faire ».
const APERCU: readonly CleTache[] = ["mesures", "annulations"];

type Textes = { titre: string; ouvrir: string; ouvrirTache: string; illisible: string };
type Traduire = Awaited<ReturnType<typeof getTranslations<"Admin.tableau.taches">>>;

function textes(t: Traduire, c: CarteTache): Textes {
  return { titre: t(c.cle), ouvrir: t("ouvrir"), ouvrirTache: t("ouvrirTache", { tache: t(c.cle) }), illisible: t("illisible") };
}

// Une carte de tâche : compteur réel et lien vers la page qui traite la tâche. Une carte à zéro reste affichée, en ton atténué.
// Compteur illisible : la carte le dit (« Lecture impossible »), jamais un faux zéro. Aucune donnée personnelle.
function Carte({ c, t }: { c: CarteTache; t: Textes }) {
  const zero = c.nombre === 0;
  return (
    <li className={`flex flex-col gap-1 rounded-[20px] border border-admin-contour bg-admin-carte p-4 text-text-primary ${zero ? "opacity-70" : ""}`}>
      <h3 className="t-label">{t.titre}</h3>
      <p className="t-h2">{c.nombre === null ? <span className="t-body text-text-secondary">{t.illisible}</span> : c.nombre}</p>
      <Link href={c.href} className="t-label inline-flex min-h-touch items-center text-text-primary underline">
        <span aria-hidden="true">{t.ouvrir}</span>
        <span className="sr-only">{t.ouvrirTache}</span>
      </Link>
    </li>
  );
}

// « À faire » de la maquette (E8 à E11) : Mesures à recevoir et Demandes d'annulation, puis « Voir plus » vers la page des tâches (Q12).
export async function ApercuTaches({ cartes }: { cartes: readonly CarteTache[] }) {
  const t = await getTranslations("Admin.tableau.taches");
  const ta = await getTranslations("Admin.tableau.apercu");
  const choisies = APERCU.flatMap((cle) => cartes.filter((c) => c.cle === cle));
  return (
    <section aria-labelledby="tableau-a-faire" className="flex flex-col gap-3">
      <h2 id="tableau-a-faire" className="t-label text-[24px] leading-8">
        {t("titre")}
      </h2>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {choisies.map((c) => (
          <Carte key={c.cle} c={c} t={textes(t, c)} />
        ))}
      </ul>
      <VoirPlus href="/admin/taches" texte={ta("voirPlus")} precision={ta("voirPlusTaches")} />
    </section>
  );
}

// Lien « Voir plus → » de la maquette (E11, E15) : le texte visible est dans le nom accessible, précisé pour les lecteurs d'écran.
// Une ancre (« #… ») reste sur la page telle quelle (période choisie comprise) ; un chemin passe par le lien de la langue courante.
export function VoirPlus({ href, texte, precision }: { href: string; texte: string; precision: string }) {
  const classes = "t-label inline-flex min-h-touch items-center gap-2 self-end text-text-primary underline";
  const contenu = (
    <>
      <span>
        {texte} <span className="sr-only">{precision}</span>
      </span>
      <ArrowRight aria-hidden="true" className="size-6 shrink-0" strokeWidth={2} />
    </>
  );
  return href.startsWith("#") ? (
    <a href={href} className={classes} data-voir-plus="">
      {contenu}
    </a>
  ) : (
    <Link href={href} className={classes} data-voir-plus="">
      {contenu}
    </Link>
  );
}

// Toutes les tâches (UX-DR43) : les 11 cartes, plus bas sur la page.
export async function CartesTaches({ cartes }: { cartes: readonly CarteTache[] }) {
  const t = await getTranslations("Admin.tableau.taches");
  const aucune = cartes.every((c) => c.nombre === 0);
  return (
    <section id="toutes-les-taches" aria-labelledby="tableau-taches" className="flex flex-col gap-3">
      <h2 id="tableau-taches" className="t-label text-[24px] leading-8">
        {t("toutes")}
      </h2>
      {aucune ? <p className="t-body text-text-secondary">{t("vide")}</p> : null}
      <ul className="grid grid-cols-1 gap-ecart-cartes sm:grid-cols-2 lg:grid-cols-3">
        {cartes.map((c) => (
          <Carte key={c.cle} c={c} t={textes(t, c)} />
        ))}
      </ul>
    </section>
  );
}
