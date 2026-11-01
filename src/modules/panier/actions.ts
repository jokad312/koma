"use server";

import { refresh } from "next/cache";
import { dependances } from "./dependances";
import type { EntreeAjout } from "./schemas";
import * as service from "./service";

// Ajout depuis la fiche (appelé par le bouton « Ajouter au panier »).
export async function ajouterAuPanier(entree: EntreeAjout) {
  return service.ajouter(dependances(), entree);
}

// Formulaires de la page Panier (<form action>) : marchent avant l'hydratation. Le résultat n'est pas affiché ; refresh() relit la page
// (lignes, sous-total, compteur de l'en-tête) en base après l'action, y compris quand une ligne a disparu entre-temps.
export async function modifierLigneParFormulaire(formData: FormData): Promise<void> {
  await service.modifier(dependances(), { ligneId: String(formData.get("ligne") ?? ""), nombre: Number(formData.get("nombre")) });
  refresh();
}

export async function retirerLigneParFormulaire(formData: FormData): Promise<void> {
  await service.retirer(dependances(), { ligneId: String(formData.get("ligne") ?? "") });
  refresh();
}
