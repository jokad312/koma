import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { estAdminConnecte } from "@/lib/auth/est-admin";

// Entrée « Administration » de la Navigation du compte, visible seulement pour le rôle Admin. Lit la session : à rendre sous <Suspense>
// (la mise en page du compte reste statique). Sans droit ou en cas d'erreur de lecture : rien.
export async function LienAdminCompte() {
  if (!(await estAdminConnecte())) return null;
  const t = await getTranslations("Admin.nav");
  return (
    <li>
      <Link href="/admin" className="t-small text-text-secondary underline underline-offset-4">
        {t("libelle")}
      </Link>
    </li>
  );
}
