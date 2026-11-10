import { getLocale, getTranslations } from "next-intl/server";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { commandesParFamille, echecsParPrestataire, formaterUsd, pourcentage, sommeMontants, sommeVue, totalPar, type LigneEchec, type LignePaiement } from "@/modules/tableau-de-bord/calculs";
import { joursFenetre } from "@/modules/tableau-de-bord/periode";
import type { DelaiMesures, DonneesTableau, Zone } from "@/modules/tableau-de-bord/queries";

const PRESTATAIRES = ["pawapay", "maishapay", "polar"] as const;
const FAMILLES = ["cosplay", "accessoire", "kit", "pass", "livraison"] as const;

// Une valeur affichée : du texte, « aucune donnée » (zone lue mais vide) ou « illisible » (lecture en échec).
type Valeur = { texte: string } | { aucune: true } | { illisible: true };
type Ligne = { cle: string; titre: string; valeurs?: [Valeur, Valeur]; cumul?: Valeur; raison?: string; note?: string };

// Indicateurs SM-1 à SM-10 et SM-C1 à SM-C7 (PRD §7) sur 7 et 30 jours. Un indicateur sans source est écrit « Pas encore mesuré »
// avec sa raison, jamais remplacé par un zéro (règle 13). Aucune donnée personnelle : que des agrégats.
export async function Indicateurs({ donnees, maintenant }: { donnees: DonneesTableau; maintenant: Date }) {
  const t = await getTranslations("Admin.tableau.indicateurs");
  const te = await getTranslations("Admin.tableau");
  const locale = await getLocale();
  const fenetres = { 7: new Set(joursFenetre(7, maintenant)), 30: new Set(joursFenetre(30, maintenant)) } as const;
  const usd = (c: number) => formaterUsd(c, locale);
  const nomPrestataire = (p: string) => ((PRESTATAIRES as readonly string[]).includes(p) ? te(`prestataires.${p as (typeof PRESTATAIRES)[number]}`) : p);
  const nomFamille = (f: string) => ((FAMILLES as readonly string[]).includes(f) ? te(`familles.${f as (typeof FAMILLES)[number]}`) : f);
  // Listes écrites par la langue de l'écran (séparateurs compris), jamais par des caractères en dur.
  const liste = (elements: string[]) => new Intl.ListFormat(locale, { style: "short", type: "unit" }).format(elements);
  const deux = (f: (n: 7 | 30) => Valeur): [Valeur, Valeur] => [f(7), f(30)];
  const ILLISIBLE: Valeur = { illisible: true };
  const AUCUNE: Valeur = { aucune: true };

  const sm1 = (paiements: Zone<LignePaiement[]>) =>
    deux((n) => {
      if (!paiements) return ILLISIBLE;
      const jours = fenetres[n];
      const total = sommeMontants(paiements, jours);
      if (total === 0 && !paiements.some((l) => jours.has(l.jour))) return AUCUNE;
      const parFamille = totalPar(paiements, "famille", jours);
      const nb = commandesParFamille(paiements, jours);
      const detail = liste(parFamille.map((f) => t("detailFamille", { famille: nomFamille(f.cle), montant: usd(f.montantCents), commandes: nb[f.cle] ?? 0 })));
      return { texte: t("valeurSm1", { montant: usd(total), detail }) };
    });

  const visites = donnees.visites;
  const compterAction = (action: string, n: 7 | 30) => (visites ? sommeVue(visites, (l) => l.evenements, fenetres[n], (l) => l.action === action) : 0);
  // Sessions distinctes par jour : un visiteur compte au plus une fois par jour, donc la part ne dépasse pas 100 %.
  const sessionsAction = (action: string, n: 7 | 30) => (visites ? sommeVue(visites, (l) => l.sessions, fenetres[n], (l) => l.action === action) : 0);
  const sm2 = deux((n) => {
    if (!visites) return ILLISIBLE;
    const chargements = sessionsAction("chargement_heros", n);
    const clics = sessionsAction("clic_heros", n);
    const part = pourcentage(clics, chargements);
    if (part !== null) return { texte: t("valeurSm2", { part, clics, chargements }) };
    return clics > 0 ? { texte: t("valeurSm2SansPart", { clics }) } : AUCUNE;
  });
  const nombreAction = (action: string) =>
    deux((n) => {
      if (!visites) return ILLISIBLE;
      // Aucune ligne de mesure sur 30 jours : la mesure n'a rien reçu, ce n'est pas un zéro constaté.
      if (visites.length === 0) return AUCUNE;
      return { texte: t("valeurNombre", { nombre: compterAction(action, n) }) };
    });

  const origines = donnees.origines;
  const sm7origine = deux((n) => {
    if (!origines) return ILLISIBLE;
    const jours = fenetres[n];
    const par = new Map<string, { commandes: number; montant: number }>();
    for (const l of origines) {
      if (!l.jour || !jours.has(l.jour)) continue;
      const cle = l.origine ?? "";
      const a = par.get(cle) ?? { commandes: 0, montant: 0 };
      a.commandes += l.commandes_payees ?? 0;
      a.montant += Number(l.montant_paye_cents ?? 0);
      par.set(cle, a);
    }
    if (par.size === 0) return AUCUNE;
    const texte = liste(
      [...par.entries()]
        .sort((a, b) => b[1].montant - a[1].montant)
        .map(([o, a]) => t("valeurSm7", { libelle: o === "" ? t("acces") : o, montant: usd(a.montant), commandes: a.commandes })),
    );
    return { texte };
  });

  const codes = donnees.ventesCodes;
  const valeurCodes: Valeur = !codes
    ? ILLISIBLE
    : codes.filter((c) => c.commandesPayees > 0).length === 0
      ? AUCUNE
      : {
          texte: liste(
            codes
              .filter((c) => c.commandesPayees > 0)
              .map((c) => t("valeurCode", { code: c.code, montant: usd(c.montantPayeCents), reduction: usd(c.reductionCents), commandes: c.commandesPayees })),
          ),
        };

  const d2 = donnees.deuxiemesAchats;
  const valeurSm9: Valeur = !d2
    ? ILLISIBLE
    : (() => {
        const part = pourcentage(d2.clientsDeuxAchats, d2.clientsPayants);
        return part === null ? AUCUNE : { texte: t("valeurSm9", { part, deux: d2.clientsDeuxAchats, payants: d2.clientsPayants }) };
      })();

  const entonnoir = donnees.entonnoir;
  const sm10 = deux((n) => {
    if (!entonnoir) return ILLISIBLE;
    const jours = fenetres[n];
    const somme = (etape: string, col: "sessions" | "commandes") => sommeVue(entonnoir, (l) => l[col], jours, (l) => l.etape === etape);
    const v = { fiche: somme("fiche", "sessions"), panier: somme("panier", "sessions"), commande: somme("commande", "commandes"), payee: somme("payee", "commandes"), livree: somme("livree", "commandes") };
    return Object.values(v).every((x) => x === 0) ? AUCUNE : { texte: t("valeurSm10", v) };
  });

  const echecs = (zone: Zone<LigneEchec[]>): Valeur => {
    if (!zone) return ILLISIBLE;
    const lignes = echecsParPrestataire(zone).filter((e) => e.taux !== null);
    if (lignes.length === 0) return AUCUNE;
    return { texte: liste(lignes.map((e) => t("valeurSmc2", { prestataire: nomPrestataire(e.prestataire), taux: e.taux ?? 0, echouees: e.echouees, terminees: e.terminees }))) };
  };

  const delai = (zone: Zone<DelaiMesures>): Valeur => {
    if (!zone) return ILLISIBLE;
    if (zone.lignesRecues === 0 && zone.lignesEnAttente === 0) return AUCUNE;
    if (zone.delaiMoyenHeures === null) return { texte: t("valeurSmc3Aucune", { attente: zone.lignesEnAttente }) };
    return { texte: t("valeurSmc3", { heures: zone.delaiMoyenHeures, recues: zone.lignesRecues, attente: zone.lignesEnAttente }) };
  };

  const desinscriptions = donnees.desinscriptions;
  const smc5 = deux((n) => (desinscriptions ? { texte: t("valeurNombre", { nombre: sommeVue(desinscriptions, (l) => l.desinscriptions, fenetres[n]) }) } : ILLISIBLE));

  const lignes: Ligne[] = [
    { cle: "sm1", titre: t("sm1"), valeurs: sm1(donnees.paiements) },
    { cle: "sm2", titre: t("sm2"), valeurs: sm2 },
    { cle: "sm3", titre: t("sm3"), valeurs: nombreAction("partage_fiche") },
    { cle: "sm4", titre: t("sm4"), raison: t("raisonSm4") },
    { cle: "sm5", titre: t("sm5"), raison: t("raisonSm5") },
    { cle: "sm6", titre: t("sm6"), valeurs: nombreAction("kit_gratuit_recupere"), note: t("raisonSm6Passage") },
    { cle: "sm7origine", titre: t("sm7origine"), valeurs: sm7origine },
    { cle: "sm7code", titre: t("sm7code"), cumul: valeurCodes },
    { cle: "sm8", titre: t("sm8"), raison: t("raisonSm8") },
    { cle: "sm9", titre: t("sm9"), cumul: valeurSm9 },
    { cle: "sm10", titre: t("sm10"), valeurs: sm10, note: t("valeurSm10Sessions") },
    { cle: "smc1", titre: t("smc1"), raison: t("raisonSmc1") },
    { cle: "smc2", titre: t("smc2"), valeurs: [echecs(donnees.echecs7), echecs(donnees.echecs30)] },
    { cle: "smc3", titre: t("smc3"), valeurs: [delai(donnees.delai7), delai(donnees.delai30)] },
    { cle: "smc4", titre: t("smc4"), raison: t("raisonSmc4") },
    { cle: "smc5", titre: t("smc5"), valeurs: smc5 },
    { cle: "smc6", titre: t("smc6"), raison: t("raisonSmc6") },
    { cle: "smc7", titre: t("smc7"), raison: t("raisonSmc7") },
  ];

  const afficher = (v: Valeur) => ("texte" in v ? v.texte : "aucune" in v ? t("aucuneDonnee") : te("erreurLecture"));
  return (
    <section aria-labelledby="tableau-indicateurs" className="flex flex-col gap-3">
      <h2 id="tableau-indicateurs" className="t-h2">
        {t("titre")}
      </h2>
      <p className="t-small text-text-secondary">{t("aide")}</p>
      <ul className="flex flex-col gap-ecart-cartes">
        {lignes.map((l) => (
          <li key={l.cle} className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4">
            <h3 className="t-label text-text-primary">{l.titre}</h3>
            {l.valeurs ? (
              <dl className="flex flex-col gap-1">
                {([7, 30] as const).map((n, i) => {
                  const v = (l.valeurs as [Valeur, Valeur])[i];
                  return (
                    <div key={n} className="flex flex-col sm:flex-row sm:gap-3">
                      <dt className="t-small shrink-0 text-text-secondary sm:w-20">{n === 7 ? t("sept") : t("trente")}</dt>
                      <dd className="t-body min-w-0 break-words text-text-primary">{"illisible" in v ? <MessageEtat type="erreur">{afficher(v)}</MessageEtat> : afficher(v)}</dd>
                    </div>
                  );
                })}
              </dl>
            ) : l.cumul ? (
              <dl className="flex flex-col sm:flex-row sm:gap-3">
                <dt className="t-small shrink-0 text-text-secondary sm:w-20">{t("cumul")}</dt>
                <dd className="t-body min-w-0 break-words text-text-primary">{"illisible" in l.cumul ? <MessageEtat type="erreur">{afficher(l.cumul)}</MessageEtat> : afficher(l.cumul)}</dd>
              </dl>
            ) : (
              <p className="t-body text-text-secondary">
                {t("nonMesureRaison", { raison: l.raison ?? "" })}
              </p>
            )}
            {l.note ? <p className="t-small text-text-secondary">{l.note}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
