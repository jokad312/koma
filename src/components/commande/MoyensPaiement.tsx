import type { Locale } from "@/i18n/routing";
import type { OptionsPaiement } from "@/modules/paiement/service";
import { ChoixPaiement } from "./ChoixPaiement";

// Moyens de paiement d'une Commande à payer : seulement ce que le serveur autorise, en texte et sans logo (UX-DR34). Aucun repli caché :
// sans Prestataire carte autorisé, le message le dit (UX-DR36). Le formulaire de choix (pays, opérateur, numéro, bouton) est interactif.
// Tant qu'aucun adaptateur n'est branché, aucun Prestataire n'est actif : aucun bouton de paiement n'apparaît (rien n'est simulé).
export function MoyensPaiement({ numero, options }: { locale?: Locale; numero: string; options: OptionsPaiement }) {
  return <ChoixPaiement numero={numero} options={options} />;
}
