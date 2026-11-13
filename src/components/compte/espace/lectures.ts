import "server-only";
import { cache } from "react";
import { listerMesPass } from "@/modules/evenements/pass-queries";

// Pass du Compte, lus une seule fois par requête pour les blocs « Mes Pass » et « Mes événements » (cache() vaut pour la requête seulement :
// aucun cache partagé entre personnes). Une erreur est relancée : chaque bloc affiche alors son propre message.
export const lirePassEspace = cache((compteId: string, locale: "fr" | "en") => listerMesPass(compteId, locale));
