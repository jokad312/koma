"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { CLASSES_PRINCIPAL } from "@/components/ui/classes";
import type { Plateforme } from "@/lib/navigateur-integre";

const CLE_FERME = "ks_bandeau_integre_ferme";

// Lien Android qui ouvre Chrome ; sans Chrome, Android revient à l'adresse de repli (le navigateur par défaut).
function lienChrome(adresse: string) {
  const url = new URL(adresse);
  const schema = url.protocol.replace(":", "");
  const repli = encodeURIComponent(adresse);
  return `intent://${url.host}${url.pathname}${url.search}${url.hash}#Intent;scheme=${schema};package=com.android.chrome;S.browser_fallback_url=${repli};end`;
}

// Bandeau non bloquant, dans le flux de la page (il ne recouvre jamais un élément focalisé). Fermeture mémorisée.
export function BandeauNavigateurIntegreClient({ plateforme }: { plateforme: Plateforme }) {
  const t = useTranslations("NavigateurIntegre");
  const idTitre = useId();
  const [ferme, setFerme] = useState(false);
  const [adresse, setAdresse] = useState<string | null>(null);
  const [copie, setCopie] = useState<"non" | "oui" | "echec">("non");

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- lecture de l'adresse et du stockage du navigateur (systèmes externes) */
    setAdresse(window.location.href);
    try {
      if (window.localStorage.getItem(CLE_FERME) === "1") setFerme(true);
    } catch {
      // Stockage indisponible : le bandeau reste affiché.
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  if (ferme) return null;

  function fermer() {
    setFerme(true);
    try {
      window.localStorage.setItem(CLE_FERME, "1");
    } catch {
      // Le choix n'est pas mémorisé : le bandeau reviendra à la prochaine page.
    }
  }

  async function copier() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopie("oui");
    } catch {
      setCopie("echec");
    }
  }

  const aide = plateforme === "ios" ? t("aideIos") : plateforme === "android" ? t("aideAndroid") : t("aideAutre");

  return (
    <section aria-labelledby={idTitre} className="border-b border-border bg-surface">
      <div className="mx-auto flex w-full max-w-7xl items-start gap-3 px-marge py-3">
        <div className="flex flex-1 flex-col items-start gap-3">
          <p id={idTitre} className="t-small font-semibold">
            {t("nom")}
          </p>
          <p className="t-small">{t("texte")}</p>
          <div className="flex flex-wrap items-center gap-2">
            {plateforme === "android" && adresse ? (
              <a href={lienChrome(adresse)} className={CLASSES_PRINCIPAL}>
                {t("ouvrir")}
              </a>
            ) : null}
            <Bouton variante="secondaire" onClick={copier}>
              {t("copier")}
            </Bouton>
          </div>
          <p className="t-small text-text-secondary">{aide}</p>
          <p role="status" className="t-small">
            {copie === "oui" ? t("copie") : copie === "echec" ? t("copieImpossible") : null}
          </p>
        </div>
        <button
          type="button"
          onClick={fermer}
          aria-label={t("fermer")}
          className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-full border border-border-field bg-surface text-text-primary"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </section>
  );
}
