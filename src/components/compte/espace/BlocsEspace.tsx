import { getTranslations } from "next-intl/server";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { AgrandirCodeQr } from "@/components/compte/AgrandirCodeQr";
import { CodeQrPass } from "@/components/compte/CodeQrPass";
import { BoutonDeconnexion } from "@/components/layout/BoutonDeconnexion";
import { cheminPublic } from "@/i18n/adresses";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { accesScanValideMaintenant } from "@/lib/auth/arrivee-serveur";
import { formaterUsd } from "@/lib/argent";
import { formaterDateBoutique } from "@/lib/dates";
import { lireBibliotheque, lireProgressions, type KitBibliotheque, type ProgressionKit } from "@/modules/bibliotheque/queries";
import { indexChapitre } from "@/modules/bibliotheque/video";
import { listerCommandes, type CommandeResume } from "@/modules/commande/queries";
import { grouperParEvenement } from "@/modules/evenements/pass-groupes";
import { calculerCodeQr, chargeQr } from "@/modules/evenements/pass-qr";
import type { PassLu } from "@/modules/evenements/pass-types";
import { BlocEspace, CLASSES_CARTE, CLASSES_GRILLE, CLASSES_LIEN, VideEspace } from "./BlocEspace";
import { lirePassEspace } from "./lectures";

// Blocs b à f de l'espace personnel (story 9.12). Chaque bloc lit ses données côté serveur, pour le seul Compte de la session (identifiant
// passé par la page après vérification), à chaque requête. Une lecture en erreur n'affiche que le message de son bloc ; les autres restent.
// Rien n'est inventé : un bloc sans donnée affiche un message simple et un lien utile.

const NB_COMMANDES = 6;
const NB_KITS = 6;
const NB_PASS = 6;
const CHEMIN_BIBLIOTHEQUE = "/compte/bibliotheque";

type PropsBloc = { compteId: string; locale: Locale };

// b. Mes commandes : numéro (lien vers le suivi), date, montant, statut.
export async function BlocCommandesEspace({ compteId, locale }: PropsBloc) {
  const t = await getTranslations({ locale, namespace: "Espace.commandes" });
  const tc = await getTranslations({ locale, namespace: "Commande" });
  let lue: { commandes: CommandeResume[]; reste: boolean };
  try {
    lue = await listerCommandes(compteId, NB_COMMANDES);
  } catch {
    console.error("[espace] lecture des commandes impossible");
    return (
      <BlocEspace id="espace-commandes" titre={t("titre")}>
        <MessageEtat type="erreur">{t("erreur")}</MessageEtat>
      </BlocEspace>
    );
  }
  return (
    <BlocEspace id="espace-commandes" titre={t("titre")} suite={lue.reste ? { href: "/compte/commandes", libelle: t("toutes") } : null}>
      {lue.commandes.length === 0 ? (
        <VideEspace message={t("vide")} lien={{ href: cheminPublic(locale, "/cosplays"), libelle: t("lienVide") }} />
      ) : (
        <ul role="list" className={CLASSES_GRILLE}>
          {lue.commandes.map((c) => (
            <li key={c.numero} className={CLASSES_CARTE}>
              {/* Lien sur le numéro, étendu à toute la carte. */}
              <Link href={`${cheminPublic(locale, "/commande")}/${c.numero}`} className="t-label text-text-primary underline underline-offset-4 after:absolute after:inset-0">
                {tc("liste.commande", { numero: c.numero })}
              </Link>
              <p className="t-small text-text-secondary">{formaterDateBoutique(c.creeLe, locale)}</p>
              <p className="t-body text-text-primary">{c.offerte ? tc("liste.offert") : formaterUsd(c.totalCents, locale)}</p>
              <p className="t-small text-text-primary">{tc("detail.statut", { statut: tc(`detail.statuts.${c.statut}`) })}</p>
            </li>
          ))}
        </ul>
      )}
    </BlocEspace>
  );
}

// c. Mes kits : image, titre, « Reprendre au chapitre N » (progression vidéo enregistrée) et « Télécharger les fichiers ».
export async function BlocKitsEspace({ compteId, locale }: PropsBloc) {
  const t = await getTranslations({ locale, namespace: "Espace.kits" });
  let kits: KitBibliotheque[];
  let progressions: ProgressionKit[];
  try {
    [kits, progressions] = await Promise.all([lireBibliotheque(compteId), lireProgressions(compteId)]);
  } catch {
    console.error("[espace] lecture de la bibliothèque impossible");
    return (
      <BlocEspace id="espace-kits" titre={t("titre")}>
        <MessageEtat type="erreur">{t("erreur")}</MessageEtat>
      </BlocEspace>
    );
  }
  return (
    <BlocEspace id="espace-kits" titre={t("titre")} suite={kits.length > NB_KITS ? { href: CHEMIN_BIBLIOTHEQUE, libelle: t("tous") } : null}>
      {kits.length === 0 ? (
        <VideEspace message={t("vide")} lien={{ href: cheminPublic(locale, "/kits"), libelle: t("lienVide") }} />
      ) : (
        <ul role="list" className={CLASSES_GRILLE}>
          {kits.slice(0, NB_KITS).map((k) => {
            const titre = (locale === "en" ? k.titre.en : null) ?? k.titre.fr;
            // Titre français affiché sur /en faute de titre anglais : marqué comme tel pour les lecteurs d'écran.
            const langueTitre = locale === "en" && !k.titre.en ? "fr" : undefined;
            const p = progressions.find((g) => g.produitId === k.produitId);
            // Lecture commencée et non terminée, avec des chapitres : reprise au chapitre de la dernière position (le lecteur y reprend seul).
            const enCours = p && !p.terminee && p.debuts.length > 0 && (p.positionSecondes > 0 || p.maxPositionSecondes > 0);
            const numero = p ? indexChapitre(p.debuts, p.positionSecondes) + 1 : 1;
            const adresse = `${CHEMIN_BIBLIOTHEQUE}/${k.slug}`;
            return (
              <li key={k.produitId} className={`${CLASSES_CARTE} flex-row items-start gap-4`}>
                {k.vignette ? (
                  // eslint-disable-next-line @next/next/no-img-element -- vignette d'un bucket public, dimensions fixes (comme Ma bibliothèque)
                  <img src={k.vignette.url} alt={locale === "en" ? k.vignette.alt.en : k.vignette.alt.fr} width={72} height={72} className="size-18 shrink-0 rounded-sm object-cover" />
                ) : (
                  <span aria-hidden="true" className="size-18 shrink-0 rounded-sm bg-border" />
                )}
                <div className="flex min-w-0 flex-col gap-1">
                  <h3 lang={langueTitre} className="t-h3 break-words">
                    {titre}
                  </h3>
                  <Link href={`${adresse}#video-titre`} aria-label={enCours ? t("reprendreNomme", { titre, numero }) : t("ouvrirNomme", { titre })} className={CLASSES_LIEN}>
                    {enCours ? t("reprendre", { numero }) : t("ouvrir")}
                  </Link>
                  <Link href={`${adresse}#fichiers-titre`} aria-label={t("telechargerNomme", { titre })} className={CLASSES_LIEN}>
                    {t("telecharger")}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </BlocEspace>
  );
}

// Libellés calculés par le bloc (traductions côté serveur) : la carte reste un composant simple.
type LibellesPass = { type: string | null; statut: string; alt: string };

function CartePassEspace({ pass, locale, libelles }: { pass: PassLu; locale: Locale; libelles: LibellesPass }) {
  const date = formaterDateBoutique(pass.evenement.debutLe, locale);
  // Seul un Pass valide montre son Code QR (même règle que Mes Pass).
  const qr = pass.statut === "valide" ? calculerCodeQr(chargeQr(pass.jeton)) : null;
  return (
    <li className={CLASSES_CARTE}>
      <h3 className="t-h3">{pass.evenement.titre}</h3>
      {libelles.type ? <p className="t-label text-text-primary">{libelles.type}</p> : null}
      <p className="t-small text-text-secondary">{pass.nomTitulaire}</p>
      {date ? (
        <p className="t-small text-text-secondary">
          <time dateTime={pass.evenement.debutLe ?? undefined}>{date}</time>
        </p>
      ) : null}
      <p className="t-label text-text-primary">{libelles.statut}</p>
      {qr ? (
        <div className="flex flex-col items-start gap-2">
          <div className="rounded-md bg-qr-background">
            <CodeQrPass qr={qr} alt={libelles.alt} className="h-36 w-36" />
          </div>
          <AgrandirCodeQr qr={qr} alt={libelles.alt} nom={pass.nomTitulaire} codeCourt={pass.codeCourt} />
        </div>
      ) : null}
    </li>
  );
}

// d. Mes Pass : événement, type, date, Code QR et statut ; les Événements à venir d'abord.
export async function BlocPassEspace({ compteId, locale }: PropsBloc) {
  const t = await getTranslations({ locale, namespace: "Espace.pass" });
  const tp = await getTranslations({ locale, namespace: "Pass.carte" });
  let pass: PassLu[];
  try {
    pass = await lirePassEspace(compteId, locale);
  } catch {
    console.error("[espace] lecture des Pass impossible");
    return (
      <BlocEspace id="espace-pass" titre={t("titre")}>
        <MessageEtat type="erreur">{t("erreur")}</MessageEtat>
      </BlocEspace>
    );
  }
  const ordonnes = grouperParEvenement(pass).flatMap((g) => g.pass);
  return (
    <BlocEspace id="espace-pass" titre={t("titre")} suite={ordonnes.length > NB_PASS ? { href: "/compte/pass", libelle: t("tous") } : null}>
      {ordonnes.length === 0 ? (
        <VideEspace message={t("vide")} lien={{ href: "/festival", libelle: t("lienVide") }} />
      ) : (
        <ul role="list" className={CLASSES_GRILLE}>
          {ordonnes.slice(0, NB_PASS).map((p) => (
            <CartePassEspace
              key={p.id}
              pass={p}
              locale={locale}
              libelles={{
                type: p.typeNom ? tp("type", { type: p.typeNom }) : null,
                statut: tp(`statuts.${p.statut}`),
                alt: tp("qrAlt", { type: p.typeNom, nom: p.nomTitulaire, evenement: p.evenement.titre }),
              }}
            />
          ))}
        </ul>
      )}
    </BlocEspace>
  );
}

// e. Mes événements : à venir puis passés (ceux des Pass du Compte), avec le lien de la galerie quand elle existe.
export async function BlocEvenementsEspace({ compteId, locale }: PropsBloc) {
  const t = await getTranslations({ locale, namespace: "Espace.evenements" });
  let pass: PassLu[];
  try {
    pass = await lirePassEspace(compteId, locale);
  } catch {
    console.error("[espace] lecture des événements impossible");
    return (
      <BlocEspace id="espace-evenements" titre={t("titre")}>
        <MessageEtat type="erreur">{t("erreur")}</MessageEtat>
      </BlocEspace>
    );
  }
  const groupes = grouperParEvenement(pass);
  const listes = [
    { cle: "avenir", titre: t("avenir"), groupes: groupes.filter((g) => g.avenir) },
    { cle: "passes", titre: t("passes"), groupes: groupes.filter((g) => !g.avenir) },
  ].filter((l) => l.groupes.length > 0);
  return (
    <BlocEspace id="espace-evenements" titre={t("titre")}>
      {listes.length === 0 ? (
        <VideEspace message={t("vide")} lien={{ href: "/festival", libelle: t("lienVide") }} />
      ) : (
        listes.map((l) => (
          <div key={l.cle} className="flex flex-col gap-3">
            <h3 className="t-h3">{l.titre}</h3>
            <ul role="list" className={CLASSES_GRILLE}>
              {l.groupes.map((g) => {
                const date = formaterDateBoutique(g.evenement.debutLe, locale);
                return (
                  <li key={g.evenement.id} className={CLASSES_CARTE}>
                    <Link href={`/festival/${g.evenement.slug}`} className="t-label text-text-primary underline underline-offset-4">
                      {g.evenement.titre}
                    </Link>
                    {date ? (
                      <p className="t-small text-text-secondary">
                        <time dateTime={g.evenement.debutLe ?? undefined}>{date}</time>
                      </p>
                    ) : null}
                    {g.evenement.lieu ? <p className="t-small text-text-secondary">{g.evenement.lieu}</p> : null}
                    {!g.avenir && g.evenement.galerieUrl ? (
                      <a href={g.evenement.galerieUrl} target="_blank" rel="noopener noreferrer" aria-label={t("galerieNommee", { evenement: g.evenement.titre })} className={CLASSES_LIEN}>
                        {t("galerie")}
                      </a>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}
    </BlocEspace>
  );
}

// f. Accès rapides : Envoyer une photo, Préférences, Se déconnecter ; « Scanner les Pass » tant qu'un accès bénévole est valide (base).
export async function AccesRapidesEspace({ compteId, locale }: PropsBloc) {
  const t = await getTranslations({ locale, namespace: "Espace.acces" });
  // Lecture en erreur : le bloc reste, sans la carte « Scanner les Pass » (les autres blocs isolent aussi leurs erreurs).
  let scan = false;
  try {
    scan = await accesScanValideMaintenant(compteId);
  } catch {
    console.error("[espace] lecture de l'accès bénévole impossible");
  }
  const liens = [
    ...(scan ? [{ href: "/scan", libelle: t("scan") }] : []),
    { href: "/compte/photos", libelle: t("photo") },
    { href: "/compte/preferences", libelle: t("preferences") },
  ];
  return (
    <BlocEspace id="espace-acces" titre={t("titre")}>
      <ul role="list" className={CLASSES_GRILLE}>
        {liens.map((l) => (
          <li key={l.href} className={CLASSES_CARTE}>
            <Link href={l.href} className="t-label inline-flex min-h-touch items-center text-text-primary underline underline-offset-4 after:absolute after:inset-0">
              {l.libelle}
            </Link>
          </li>
        ))}
        <li className={CLASSES_CARTE}>
          <BoutonDeconnexion />
        </li>
      </ul>
    </BlocEspace>
  );
}
