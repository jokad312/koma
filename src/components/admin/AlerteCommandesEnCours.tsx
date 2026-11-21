"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { commandesEnCoursProduit } from "@/modules/catalogue/actions";

// Point 4 de Jonathan (2026-11-21) : dans la confirmation d'archivage, alerte si le produit est dans des Commandes en cours. Lecture seule, relue
// à chaque ouverture ; l'archivage n'est jamais bloqué (les commandes ne changent pas). Lecture impossible : on le dit, jamais un faux zéro.
type Etat = { cle: string; resultat: { nombre: number } | "erreur" | "non_autorise" };

export function AlerteCommandesEnCours({ produitId, ouvert }: { produitId: string; ouvert: boolean }) {
  const t = useTranslations("Admin.produits.archivage.enCoursCommandes");
  const [etat, setEtat] = useState<Etat | null>(null);
  const [ouverture, setOuverture] = useState(0);
  // Chaque ouverture relit la base (une commande a pu être payée entre-temps).
  const [ouvertAvant, setOuvertAvant] = useState(ouvert);
  if (ouvert !== ouvertAvant) {
    setOuvertAvant(ouvert);
    if (ouvert) setOuverture((n) => n + 1);
  }
  const cle = `${produitId}-${ouverture}`;

  useEffect(() => {
    if (!ouvert) return;
    let actif = true;
    commandesEnCoursProduit({ id: produitId })
      .then((r) => actif && setEtat({ cle, resultat: r.ok ? { nombre: r.nombre } : r.erreur === "non_autorise" ? "non_autorise" : "erreur" }))
      .catch(() => actif && setEtat({ cle, resultat: "erreur" }));
    return () => {
      actif = false;
    };
  }, [ouvert, produitId, cle]);

  if (!ouvert) return null;
  const lu = etat?.cle === cle ? etat.resultat : null;
  if (lu === null) {
    return (
      <p role="status" className="t-body text-text-secondary">
        {t("verification")}
      </p>
    );
  }
  if (lu === "erreur" || lu === "non_autorise") {
    return (
      <p role="alert" className="t-body text-text-primary">
        {lu === "non_autorise" ? t("nonAutorise") : t("illisible")}
      </p>
    );
  }
  if (lu.nombre === 0) return null;
  return (
    <p role="alert" data-alerte-commandes="" className="t-body rounded-[12px] border-2 border-primary px-4 py-3 text-text-primary">
      {t("alerte", { nombre: lu.nombre })}
    </p>
  );
}
