import { useTranslations } from "next-intl";
import { CircleCheck, Clock, DollarSign, ShoppingCart } from "lucide-react";
import { AvatarInitiale } from "@/components/admin/ui/AvatarInitiale";
import { CarteChiffre } from "@/components/admin/ui/CarteChiffre";
import { ChampRecherche } from "@/components/admin/ui/ChampRecherche";
import { CLASSES_TABLEAU_ADMIN, EnTeteTableau } from "@/components/admin/ui/EnTeteTableau";
import { Pagination } from "@/components/admin/ui/Pagination";
import { Panneau } from "@/components/admin/ui/Panneau";
import { Pastille } from "@/components/admin/ui/Pastille";
import { PastilleFiltre } from "@/components/admin/ui/PastilleFiltre";
import { Link } from "@/i18n/navigation";
import { formaterUsd } from "@/lib/argent";
import { formaterDateHeureBoutique } from "@/lib/dates";
import {
  FAMILLES_FILTRE,
  LONGUEUR_RECHERCHE_MAX,
  PRESTATAIRES_FILTRE,
  STATUTS_FILTRE,
  STATUTS_PASTILLES,
  ZONES_FILTRE,
  type CommandeAdminResume,
  type FiltresCommandes,
  type PageCommandesAdmin,
} from "@/modules/commande/admin-queries";
import { Nombre, nb } from "@/components/ui/Nombre";

const ID_FORMULAIRE = "filtres-commandes";
const CHAMP = "t-body min-h-touch rounded-full border border-border-field bg-admin-entete px-4 text-text-primary";

// Adresse de la liste avec ces filtres (page 1 omise) : sert aux pastilles et à la pagination. Seules des valeurs déjà contrôlées y entrent.
export function adresseCommandes(filtres: FiltresCommandes, page = 1): string {
  const p = new URLSearchParams();
  for (const cle of ["q", "statut", "famille", "prestataire", "zone"] as const) {
    const v = filtres[cle];
    if (v) p.set(cle, v);
  }
  if (page > 1) p.set("page", String(page));
  const texte = p.toString();
  return texte ? `/admin/commandes?${texte}` : "/admin/commandes";
}

function Choix({ nom, libelle, valeur, options, tout }: { nom: string; libelle: string; valeur: string | undefined; options: readonly { cle: string; texte: string }[]; tout: string }) {
  return (
    <label className="flex flex-col gap-1 t-small text-text-primary">
      {libelle}
      <select name={nom} defaultValue={valeur ?? ""} className={CHAMP}>
        <option value="">{tout}</option>
        {options.map((o) => (
          <option key={o.cle} value={o.cle}>
            {o.texte}
          </option>
        ))}
      </select>
    </label>
  );
}

function Client({ client, absent }: { client: CommandeAdminResume["client"]; absent: string }) {
  if (client.nom) {
    return (
      <span className="flex min-w-0 items-center gap-3">
        <AvatarInitiale nom={client.nom} />
        <span className="min-w-0 break-words">{client.nom}</span>
      </span>
    );
  }
  return <span className="min-w-0 break-all">{client.emailMasque ?? absent}</span>;
}

// Montant du revenu toujours écrit en t-h3 : « 0,00 $US » en t-h2 dépasse la carte de 255 px à 1366 px (capture 9.16 d), l'espace de « $US » étant insécable.
// Liste des Commandes de l'admin selon la maquette 02-commandes (9.16 d, B1 à B11) : cartes de chiffres (REVENU PAYÉ seulement pour qui a le droit
// chiffre_affaires.voir : revenu absent = carte absente), recherche, pastilles de statut, autres filtres en listes déroulantes, tableau à partir de
// 1024 px (cartes en dessous), pagination ‹ › par 20. Recherche et filtres en formulaire GET (fonctionne sans JavaScript) ; les pastilles sont des liens
// qui gardent la recherche et les autres filtres.
export function ListeCommandesAdmin({
  liste,
  filtres,
  revenu,
  locale,
}: {
  liste: PageCommandesAdmin;
  filtres: FiltresCommandes;
  // undefined : pas le droit de voir le revenu (carte absente) ; null : lecture impossible (la carte le dit).
  revenu: number | null | undefined;
  locale: "fr" | "en";
}) {
  const t = useTranslations("Admin.commandes");
  const ts = useTranslations("Commande.detail.statuts");
  const { commandes, total, page, pages, chiffres } = liste;
  const nombre = new Intl.NumberFormat(locale);
  const avecFiltre = Boolean(filtres.statut || filtres.famille || filtres.prestataire || filtres.zone || filtres.q);
  const remise = (c: CommandeAdminResume) =>
    c.zone ? `${t(`zones.${c.zone === "bukavu" ? "bukavu" : "goma"}`)} · ${t(`modes.${c.modeRemise === "retrait" ? "retrait" : "livraison"}`)}` : t("sansRemise");
  const paiement = (c: CommandeAdminResume) =>
    c.offerte
      ? t("offerte")
      : c.prestataire && (PRESTATAIRES_FILTRE as readonly string[]).includes(c.prestataire)
        ? t(`prestataires.${c.prestataire as (typeof PRESTATAIRES_FILTRE)[number]}`)
        : (c.prestataire ?? t("aucun"));
  const cartes = [
    ...(revenu === undefined
      ? []
      : [
          {
            cle: "revenuPaye",
            icone: DollarSign,
            chiffre: revenu === null ? t("chiffres.illisible") : formaterUsd(revenu, locale),
            texte: true,
            nombre: revenu !== null,
          },
        ]),
    {
      cle: "commandesTotal",
      icone: ShoppingCart,
      chiffre: nombre.format(chiffres.commandesPayees),
      texte: false,
    },
    {
      cle: "paiementsAboutis",
      icone: CircleCheck,
      chiffre: nombre.format(chiffres.tentativesReussies),
      texte: false,
    },
    {
      cle: "enAttente",
      icone: Clock,
      chiffre: nombre.format(chiffres.enAttente),
      texte: false,
    },
  ] as const;
  const colonnes = [
    { cle: "numero", libelle: t("colonnes.numero") },
    { cle: "client", libelle: t("colonnes.client") },
    { cle: "date", libelle: t("colonnes.date") },
    { cle: "paiement", libelle: t("colonnes.paiement") },
    { cle: "montant", libelle: t("colonnes.montant"), className: "text-right" },
    { cle: "statut", libelle: t("colonnes.statut") },
    { cle: "remise", libelle: t("colonnes.remise") },
  ];
  const sansStatut = { ...filtres, statut: undefined };
  // Champs non contrôlés (formulaire GET) : après une navigation côté client (pastille, pagination), React garderait les anciennes valeurs par défaut.
  // La clé change avec les filtres : champs recréés avec les valeurs de l'adresse.
  const cle = adresseCommandes(filtres);

  return (
    <div className="flex flex-col gap-6">
      <section aria-label={t("chiffres.libelle")}>
        <ul className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${cartes.length === 4 ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}>
          {cartes.map((c) => (
            <li key={c.cle} className="grid">
              <CarteChiffre icone={c.icone} chiffre={c.chiffre} texte={c.texte} {...("nombre" in c ? { nombre: c.nombre } : {})} libelle={t(`chiffres.${c.cle}`)} />
            </li>
          ))}
        </ul>
      </section>

      <Panneau>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 xl:flex-nowrap">
            {/* À partir de 1280 px, recherche et 5 pastilles sur une ligne (maquette) : la recherche rétrécit, les pastilles gardent leur largeur. */}
            <div className="w-full min-w-0 max-w-[360px] xl:flex-1">
              <ChampRecherche
                key={cle}
                libelle={t("recherche.libelle")}
                placeholder={t("recherche.indication")}
                name="q"
                form={ID_FORMULAIRE}
                defaultValue={filtres.q ?? ""}
                maxLength={LONGUEUR_RECHERCHE_MAX}
                enterKeyHint="search"
              />
            </div>
            <ul aria-label={t("pastilles.libelle")} className="flex flex-wrap gap-2 xl:shrink-0">
              <li>
                <PastilleFiltre actif={!filtres.statut} href={adresseCommandes(sansStatut)}>
                  {t("pastilles.toutes")}
                </PastilleFiltre>
              </li>
              {STATUTS_PASTILLES.map((s) => (
                <li key={s}>
                  <PastilleFiltre actif={filtres.statut === s} href={adresseCommandes({ ...filtres, statut: s })}>
                    {t(`pastilles.${s}`)}
                  </PastilleFiltre>
                </li>
              ))}
            </ul>
          </div>

          <form key={cle} id={ID_FORMULAIRE} method="get" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label={t("filtres")}>
            <Choix nom="statut" libelle={t("statut")} valeur={filtres.statut} tout={t("tous")} options={STATUTS_FILTRE.map((s) => ({ cle: s, texte: ts(s) }))} />
            <Choix
              nom="famille"
              libelle={t("famille")}
              valeur={filtres.famille}
              tout={t("toutes")}
              options={FAMILLES_FILTRE.map((f) => ({
                cle: f,
                texte: t(`familles.${f}`),
              }))}
            />
            <Choix
              nom="prestataire"
              libelle={t("prestataire")}
              valeur={filtres.prestataire}
              tout={t("tous")}
              options={PRESTATAIRES_FILTRE.map((p) => ({
                cle: p,
                texte: t(`prestataires.${p}`),
              }))}
            />
            <Choix
              nom="zone"
              libelle={t("zone")}
              valeur={filtres.zone}
              tout={t("toutes")}
              options={ZONES_FILTRE.map((z) => ({
                cle: z,
                texte: t(`zones.${z}`),
              }))}
            />
            <div className="flex flex-wrap items-center gap-4 sm:col-span-2 lg:col-span-4">
              <button type="submit" className="t-label inline-flex min-h-touch items-center rounded-full border border-border-field px-5 text-text-primary">
                {t("appliquer")}
              </button>
              {avecFiltre ? (
                <Link href="/admin/commandes" className="t-body inline-flex min-h-touch items-center text-text-primary underline">
                  {t("effacer")}
                </Link>
              ) : null}
            </div>
          </form>

          <p role="status" className="t-label text-text-primary">
            {t.rich("resultats", { nombre: total, nb })}
          </p>

          {commandes.length === 0 ? (
            <p className="t-body text-text-secondary">{t("vide")}</p>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className={`${CLASSES_TABLEAU_ADMIN} text-left`}>
                  <caption className="sr-only">{t("titre")}</caption>
                  <EnTeteTableau colonnes={colonnes} />
                  <tbody>
                    {commandes.map((c) => (
                      <tr key={c.numero}>
                        <th scope="row" className="border-b border-admin-bord px-4 py-3 text-left font-normal">
                          <Link href={`/admin/commandes/${c.numero}`} className="t-label inline-flex min-h-touch items-center text-text-primary underline">
                            <Nombre>{c.numero}</Nombre>
                          </Link>
                        </th>
                        <td className="t-body border-b border-admin-bord px-4 py-3">
                          <Client client={c.client} absent={t("clientAbsent")} />
                        </td>
                        <td className="t-small border-b border-admin-bord px-4 py-3">{formaterDateHeureBoutique(c.creeLe, locale)}</td>
                        <td className="t-body border-b border-admin-bord px-4 py-3">{paiement(c)}</td>
                        <td className="t-body border-b border-admin-bord px-4 py-3 text-right"><Nombre>{formaterUsd(c.totalCents, locale)}</Nombre></td>
                        <td className="border-b border-admin-bord px-4 py-3">
                          <Pastille>{ts(c.statut)}</Pastille>
                        </td>
                        <td className="t-small border-b border-admin-bord px-4 py-3">{remise(c)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul aria-label={t("titre")} className="flex flex-col gap-3 lg:hidden">
                {commandes.map((c) => (
                  <li key={c.numero} className="flex min-w-0 flex-col gap-2 rounded-[16px] border border-admin-contour bg-admin-carte p-4 text-text-primary">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link href={`/admin/commandes/${c.numero}`} className="t-label inline-flex min-h-touch items-center text-text-primary underline">
                        <Nombre>{c.numero}</Nombre>
                      </Link>
                      <Pastille>{ts(c.statut)}</Pastille>
                    </div>
                    <div className="t-body">
                      <Client client={c.client} absent={t("clientAbsent")} />
                    </div>
                    <p className="t-small text-text-secondary">{formaterDateHeureBoutique(c.creeLe, locale)}</p>
                    <p className="t-body">
                      {`${paiement(c)} · `}
                      <Nombre>{formaterUsd(c.totalCents, locale)}</Nombre>
                    </p>
                    <p className="t-small text-text-secondary">{remise(c)}</p>
                  </li>
                ))}
              </ul>
            </>
          )}

          <Pagination page={page} total={pages} adresse={(n) => adresseCommandes(filtres, n)} />
        </div>
      </Panneau>
    </div>
  );
}
