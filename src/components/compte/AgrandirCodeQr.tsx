"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Dialogue } from "@/components/ui/Dialogue";
import { CLASSES_SECONDAIRE } from "@/components/ui/classes";
import type { CodeQr } from "@/modules/evenements/pass-qr";
import { CodeQrPass } from "./CodeQrPass";

// Bouton « Agrandir » d'une Carte Pass (story 7.5) : le Code QR s'ouvre en grand, avec le conseil d'augmenter la luminosité de l'écran
// et le code court en texte. Le dessin du Code QR est calculé côté serveur et reçu tel quel.
export function AgrandirCodeQr({ qr, alt, nom, codeCourt }: { qr: CodeQr; alt: string; nom: string; codeCourt: string }) {
  const t = useTranslations("Pass.agrandi");
  const [ouvert, setOuvert] = useState(false);
  const bouton = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={bouton} type="button" onClick={() => setOuvert(true)} className={CLASSES_SECONDAIRE} aria-haspopup="dialog">
        {t("bouton")}
        <span className="sr-only"> {t("pour", { nom })}</span>
      </button>
      <Dialogue ouvert={ouvert} onFermer={() => setOuvert(false)} titre={t("titre", { nom })} retourFocus={bouton}>
        <div className="flex flex-col items-center gap-4">
          <CodeQrPass qr={qr} alt={alt} className="aspect-square w-full max-w-sm" />
          <p className="t-label text-text-primary">{t("code", { code: codeCourt })}</p>
          <p className="t-small text-text-secondary">{t("luminosite")}</p>
        </div>
      </Dialogue>
    </>
  );
}
