import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { lireSessionVerifiee } from "@/lib/auth/compte";
import { lireRole } from "@/lib/auth/droits";
import { lireNomSite } from "@/lib/reglages";
import { creerClientService } from "@/lib/supabase/service";
import { compterMessagesNouveaux } from "@/modules/admin/queries";
import { BandeauAdmin, type UtilisateurBandeau } from "./BandeauAdmin";
import { NavigationAdmin } from "./NavigationAdmin";

// Initiales : deux premières lettres des deux premiers mots (ou les deux premières lettres du seul mot).
export function initialesDe(texte: string): string {
  const mots = texte.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  const brut = mots.length >= 2 ? `${mots[0][0]}${mots[1][0]}` : (mots[0] ?? "").slice(0, 2);
  return brut.toLocaleUpperCase();
}

// Email partiellement masqué : « ab***@domaine » (jamais l'adresse entière dans le bandeau).
export function masquerEmail(email: string): string {
  const arobase = email.indexOf("@");
  if (arobase < 1) return "";
  return `${email.slice(0, Math.min(2, arobase))}***${email.slice(arobase)}`;
}

// Compte connecté tel que le bandeau l'affiche : nom des métadonnées de connexion, sinon email masqué ; rôle lu en base. Toute lecture impossible : null (pas de nom inventé).
async function lireUtilisateurBandeau(): Promise<UtilisateurBandeau | null> {
  try {
    const session = await lireSessionVerifiee();
    if (!session) return null;
    const [role, utilisateur] = await Promise.all([lireRole(session.compteId), creerClientService().auth.admin.getUserById(session.compteId)]);
    const meta = utilisateur.data.user?.user_metadata as { full_name?: unknown; name?: unknown } | undefined;
    const nom = [meta?.full_name, meta?.name].find((n): n is string => typeof n === "string" && n.trim().length > 0)?.trim();
    const affichage = nom ?? masquerEmail(utilisateur.data.user?.email ?? "");
    if (!affichage) return null;
    return { affichage, initiales: initialesDe(nom ?? affichage) || "?", role };
  } catch {
    console.error("[admin] Compte du bandeau illisible");
    return null;
  }
}

// Coquille de l'admin (story 9.10) : disposition en « L » sur ordinateur (barre latérale fixe à gauche et bandeau en haut du contenu), barre du bas sur mobile.
// Ni Sakura Town ni motif manga. Rendue par chaque page seulement après la vérification du droit (le visiteur ou le Compte sans droit ne voit jamais la navigation).
// L'en-tête et le pied du site sont masqués par le CSS tant que « data-coque-admin » est présent (globals.css). Le compteur de messages à traiter est lu par le client
// service ; en cas d'erreur, pas de compteur (jamais un faux zéro).
export async function CoqueAdmin({ children }: { children: ReactNode }) {
  const [compteurMessages, nomSite, utilisateur] = await Promise.all([compterMessagesNouveaux(), lireNomSite(), lireUtilisateurBandeau()]);
  const estAdmin = utilisateur?.role === "admin";
  const t = await getTranslations("Admin.nav");
  return (
    <div data-coque-admin="">
      {/* Second lien d'évitement : celui du site mène au début du contenu, avant la barre latérale ; celui-ci saute la navigation et le bandeau. */}
      <a
        href="#contenu-admin"
        className="t-button sr-only rounded-full bg-text-primary px-5 py-3 text-background focus:not-sr-only focus:fixed focus:left-3 focus:top-16 focus:z-[60]"
      >
        {t("evitement")}
      </a>
      <NavigationAdmin compteurMessages={compteurMessages} nomSite={nomSite} estAdmin={estAdmin} />
      <div className="min-w-0 md:pl-64">
        <BandeauAdmin utilisateur={utilisateur} estAdmin={estAdmin} />
        <div id="contenu-admin" tabIndex={-1} className="px-marge py-6 pb-24 outline-none md:pb-10">
          {children}
        </div>
      </div>
    </div>
  );
}
