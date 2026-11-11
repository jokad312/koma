import type { GroupePass, PassLu, StatutPass } from "./pass-types";

// Regroupe les Pass par Événement : les Événements à venir d'abord (le plus proche en premier), puis les passés (le plus récent en premier).
// Un Événement est passé quand sa fin (ou, sans fin, son début) est dépassée ; sans date, il reste « à venir » (aucune date inventée).
// Dans un groupe, l'ordre reçu est conservé (achat puis rang).
export function grouperParEvenement(pass: PassLu[], maintenant: number = Date.now()): GroupePass[] {
  const parEvenement = new Map<string, GroupePass>();
  for (const p of pass) {
    const existant = parEvenement.get(p.evenement.id);
    if (existant) {
      existant.pass.push(p);
      continue;
    }
    const fin = p.evenement.finLe ?? p.evenement.debutLe;
    const instantFin = fin ? Date.parse(fin) : Number.NaN;
    parEvenement.set(p.evenement.id, { evenement: p.evenement, avenir: Number.isNaN(instantFin) || instantFin >= maintenant, pass: [p] });
  }
  const debut = (g: GroupePass) => (g.evenement.debutLe ? Date.parse(g.evenement.debutLe) : Number.POSITIVE_INFINITY);
  const groupes = [...parEvenement.values()];
  const avenir = groupes.filter((g) => g.avenir).sort((a, b) => debut(a) - debut(b));
  const passes = groupes.filter((g) => !g.avenir).sort((a, b) => debut(b) - debut(a));
  return [...avenir, ...passes];
}

// Statut montré au client : un Pass dont la Commande n'est plus payée ni offerte (annulée, remboursée, expirée) ne vaut plus rien, même si son propre
// statut n'est posé qu'à la story 7.9. Il n'affiche alors ni Code QR ni code court : « Remboursé » si la Commande l'est, sinon « Annulé ».
export function statutAffiche(statutPass: StatutPass, statutCommande: string): StatutPass {
  if (statutCommande === "payee" || statutCommande === "offerte") return statutPass;
  if (statutPass === "annule" || statutPass === "rembourse") return statutPass;
  return statutCommande === "remboursee" ? "rembourse" : "annule";
}
