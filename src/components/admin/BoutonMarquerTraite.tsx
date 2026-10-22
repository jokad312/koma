"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { MessageEtat } from "@/components/ui/MessageEtat";
import { marquerMessageTraite, type EtatMessageTraite } from "@/modules/admin/actions";

// « Marquer comme traité » : succès affiché seulement après la réponse de la base, puis la liste est relue (le message disparaît).
export function BoutonMarquerTraite({ id }: { id: string }) {
  const t = useTranslations("Admin.messages");
  const router = useRouter();
  const [etat, action, enCours] = useActionState<EtatMessageTraite | null, FormData>(marquerMessageTraite, null);

  useEffect(() => {
    // Succès, ou message déjà traité / disparu : la liste affichée est obsolète, on la relit.
    if (etat?.statut === "succes" || (etat?.statut === "erreur" && etat.erreur === "message_introuvable")) router.refresh();
  }, [etat, router]);

  return (
    <form action={action} className="flex flex-col items-start gap-3">
      <input type="hidden" name="id" value={id} />
      <Bouton type="submit" variante="secondaire" enCours={enCours}>
        {enCours ? t("enCours") : t("marquer")}
      </Bouton>
      {etat?.statut === "succes" ? <MessageEtat type="succes">{t("succes")}</MessageEtat> : null}
      {etat?.statut === "erreur" ? (
        <MessageEtat type="erreur">{t(`erreurs.${etat.erreur === "non_autorise" || etat.erreur === "message_introuvable" ? etat.erreur : "generique"}`)}</MessageEtat>
      ) : null}
    </form>
  );
}
