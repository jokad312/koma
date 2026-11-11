import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { formaterDateHeureBoutique } from "@/lib/dates";
import { calculerCodeQr, chargeQr } from "@/modules/evenements/pass-qr";
import type { PassLu } from "@/modules/evenements/pass-types";
import { AgrandirCodeQr } from "./AgrandirCodeQr";
import { CodeQrPass } from "./CodeQrPass";

// Carte Pass (story 7.5, UX-DR40) : nom, Type de pass en toutes lettres, Événement, date à l'heure de Goma, lieu, statut, Code QR sur blanc pur,
// code court sous le QR et « Agrandir ». Seul un Pass valide montre son Code QR : un Pass déjà scanné, annulé ou remboursé est marqué comme tel.
// Rien n'est inventé : une date ou un lieu absent n'est pas affiché.
export function CartePass({ pass }: { pass: PassLu }) {
  const t = useTranslations("Pass.carte");
  const locale = useLocale() as Locale;
  const date = formaterDateHeureBoutique(pass.evenement.debutLe, locale);
  const alt = t("qrAlt", { type: pass.typeNom, nom: pass.nomTitulaire, evenement: pass.evenement.titre });
  const qr = pass.statut === "valide" ? calculerCodeQr(chargeQr(pass.jeton)) : null;

  return (
    <article data-pass={pass.id} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <header className="flex flex-col gap-1">
        {pass.typeNom ? <p className="t-label text-text-primary">{t("type", { type: pass.typeNom })}</p> : null}
        <h4 className="t-h3">{pass.nomTitulaire}</h4>
        <p className="t-small text-text-secondary">{pass.evenement.titre}</p>
        {date ? (
          <p className="t-small text-text-secondary">
            <time dateTime={pass.evenement.debutLe ?? undefined}>{date}</time> {t("heureGoma")}
          </p>
        ) : null}
        {pass.evenement.lieu ? <p className="t-small text-text-secondary">{pass.evenement.lieu}</p> : null}
      </header>
      <p className="t-label text-text-primary">
        {t(`statuts.${pass.statut}`)}
        {pass.offert ? ` · ${t("offert")}` : ""}
      </p>
      {qr ? (
        <div className="flex flex-col items-start gap-3">
          <div className="rounded-md bg-qr-background">
            <CodeQrPass qr={qr} alt={alt} />
          </div>
          <p className="t-label text-text-primary">{t("codeCourt", { code: pass.codeCourt })}</p>
          <AgrandirCodeQr qr={qr} alt={alt} nom={pass.nomTitulaire} codeCourt={pass.codeCourt} />
        </div>
      ) : (
        <p className="t-small text-text-secondary">{t("sansCode")}</p>
      )}
    </article>
  );
}
