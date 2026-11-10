"use client";

import { useEffect } from "react";
import { mesurer } from "@/modules/mesure/client";

// Vue de fiche (story 9.7) : montée par les fiches Produit et Kit, elle n'envoie qu'une fois par onglet et par page.
// La garde d'exclusion et le chemin viennent du module de mesure ; aucune donnée de la fiche n'est transmise.
export function MesureVueFiche() {
  useEffect(() => {
    mesurer("vue_fiche");
  }, []);
  return null;
}
