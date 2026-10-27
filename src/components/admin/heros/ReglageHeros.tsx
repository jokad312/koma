import { getTranslations } from "next-intl/server";
import type { HerosAdmin } from "@/modules/accueil/heros-queries";
import { RepliHeros } from "./RepliHeros";
import { VedetteHeros } from "./VedetteHeros";
import { VideoHerosAdmin } from "./VideoHerosAdmin";

// Réglage « Héros de l'accueil » : Cosplay vedette, vidéo (Bunny publique) et photo de repli.
export async function ReglageHeros({ heros }: { heros: HerosAdmin }) {
  const t = await getTranslations("Admin.reglages.heros");
  const { etat } = heros;
  return (
    <section aria-labelledby="reglage-heros" className="flex flex-col gap-6 rounded-lg border border-border bg-surface p-5">
      <div className="flex flex-col gap-2">
        <h2 id="reglage-heros" className="t-h2">
          {t("titre")}
        </h2>
        <p className="t-small text-text-secondary">{t("intro")}</p>
      </div>
      <VedetteHeros cosplays={heros.cosplays} courant={heros.vedetteTitre ? etat.produitId : null} />
      <VideoHerosAdmin videoId={etat.videoId} prete={etat.videoFichier !== null} bunnyConfigure={heros.bunnyConfigure} />
      <RepliHeros url={heros.repliUrl} altFr={etat.repliAltFr} altEn={etat.repliAltEn} />
    </section>
  );
}
