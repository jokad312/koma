import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { connecterCompteTest, lireEnv, restesProduit, retirerProduit, semerProduit, service, sqlBloc, type ProduitTest } from "./police-outils";

// Zone admin : un visiteur est envoyé vers la connexion avec le chemin de retour ; un Compte sans rôle voit la 404.
// Le test d'un admin connecté demande un Compte réel avec le rôle admin : il se fait à la main (README, « Premier admin »),
// aucun rôle n'est simulé ici (règle 13).
const BOITE = process.env.MAILPIT_URL?.replace(/\/+$/, "");

test.describe("accès admin", () => {
  test.describe.configure({ timeout: 90_000 });

  for (const [chemin, retour] of [
    ["/fr/admin", "%2Ffr%2Fadmin"],
    ["/fr/admin/reglages", "%2Ffr%2Fadmin%2Freglages"],
    // /en redirigé vers /fr (site en français uniquement, 2026-11-22), puis vers la connexion française.
    ["/en/admin/reglages", "%2Ffr%2Fadmin%2Freglages"],
    ["/fr/admin/messages", "%2Ffr%2Fadmin%2Fmessages"],
    // /en redirigé vers /fr (site en français uniquement, 2026-11-22), puis vers la connexion française.
    ["/en/admin/messages", "%2Ffr%2Fadmin%2Fmessages"],
    ["/fr/admin/taches", "%2Ffr%2Fadmin%2Ftaches"],
    // /en redirigé vers /fr (site en français uniquement, 2026-11-22), puis vers la connexion française.
    ["/en/admin/taches", "%2Ffr%2Fadmin%2Ftaches"],
    ["/fr/admin/produits", "%2Ffr%2Fadmin%2Fproduits"],
    // /en redirigé vers /fr (site en français uniquement, 2026-11-22), puis vers la connexion française.
    ["/en/admin/produits", "%2Ffr%2Fadmin%2Fproduits"],
    ["/fr/admin/produits/nouveau", "%2Ffr%2Fadmin%2Fproduits%2Fnouveau"],
    ["/fr/admin/produits/00000000-0000-4000-8000-000000000000", "%2Ffr%2Fadmin%2Fproduits%2F00000000-0000-4000-8000-000000000000"],
    ["/fr/admin/univers", "%2Ffr%2Fadmin%2Funivers"],
    // /en redirigé vers /fr (site en français uniquement, 2026-11-22), puis vers la connexion française.
    ["/en/admin/univers", "%2Ffr%2Fadmin%2Funivers"],
    ["/fr/admin/commandes", "%2Ffr%2Fadmin%2Fcommandes"],
  ] as const) {
    test(`visiteur sur ${chemin} : envoyé vers la connexion avec retour`, async ({ page }) => {
      await page.goto(chemin);
      await expect(page).toHaveURL(new RegExp(`/fr/connexion\\?retour=${retour}$`));
      // Aucune navigation admin n'a été montrée.
      await expect(page.getByRole("navigation", { name: "Administration" })).toHaveCount(0);
    });
  }

  test("la page admin n'est pas indexable et robots.txt l'exclut", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /fr/admin");
    expect(robots).toContain("Disallow: /en/admin");
  });
});

// React pose ses propriétés internes sur un nœud du DOM quand il l'hydrate (même repère que connexion.spec.ts et google.spec.ts).
// Les champs des formulaires admin sont contrôlés : une saisie faite avant l'hydratation n'atteint pas l'état React (compteur à 0).
async function attendreHydratation(page: Page, selecteur: string) {
  await page.waitForFunction((sel) => {
    const noeud = document.querySelector(sel);
    return noeud !== null && Object.keys(noeud).some((cle) => cle.startsWith("__reactProps"));
  }, selecteur);
}

async function boiteJoignable(request: APIRequestContext) {
  if (!BOITE) return false;
  try {
    return (await request.get(`${BOITE}/api/v1/info`)).ok();
  } catch {
    return false;
  }
}

test.describe("accès admin : Compte sans rôle", () => {
  test.describe.configure({ timeout: 120_000 });

  test("un Compte connecté sans rôle admin voit la 404, pas l'admin", async ({ page, request }) => {
    const joignable = await boiteJoignable(request);
    if (process.env.CI) expect(joignable, "MAILPIT_URL absente ou boîte de test injoignable en CI").toBe(true);
    else test.skip(!joignable, "Boîte de test locale (Mailpit) absente : un vrai Compte ne peut pas être créé sur koma-dev sans lire son code.");

    const email = `test-admin-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
    await page.goto("/fr/connexion");
    await expect(async () => {
      await page.getByLabel("Adresse email").fill(email);
      await page.getByRole("button", { name: "Recevoir un code" }).click();
      await expect(page.getByText(`Un code a été envoyé à ${email}.`)).toBeVisible({ timeout: 4_000 });
    }).toPass({ timeout: 20_000 });

    let code = "";
    await expect
      .poll(
        async () => {
          const recherche = await request.get(`${BOITE}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
          const { messages } = (await recherche.json()) as { messages?: { ID: string }[] };
          if (!messages?.length) return "";
          const message = await request.get(`${BOITE}/api/v1/message/${messages[0].ID}`);
          const { Text } = (await message.json()) as { Text?: string };
          code = /\b(\d{6})\b/.exec(Text ?? "")?.[1] ?? "";
          return code;
        },
        { timeout: 20_000, message: "le code n'est pas arrivé dans la boîte de test" },
      )
      .toMatch(/^\d{6}$/);

    await page.getByLabel("Code à 6 chiffres").fill(code);
    await page.getByRole("button", { name: "Valider le code" }).click();
    await page.getByLabel("Âge").fill("25");
    await page.getByRole("button", { name: "Continuer" }).click();
    await page.getByRole("button", { name: "Passer" }).click();

    for (const chemin of ["/fr/admin", "/en/admin/reglages", "/fr/admin/produits", "/fr/admin/produits/nouveau", "/en/admin/univers"]) {
      await page.goto(chemin);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Page introuvable|Page not found/);
      await expect(page.getByRole("navigation", { name: "Administration" })).toHaveCount(0);
    }
  });
});

// Story 9.16 c) : tableau de bord selon la maquette. Comptes TEST_ réels (API d'administration), rôle attribué par la fonction existante,
// supprimés à la fin ; aucune donnée de boutique créée, aucun paiement simulé (règle 13).
const env = lireEnv();

test.describe("tableau de bord (9.16 c)", () => {
  test.describe.configure({ timeout: 120_000 });

  test("l'Admin voit les 4 cartes, le graphique des 30 jours, Performance du jour et les deux « Voir plus »", async ({ page }) => {
    test.skip(!env, "variables Supabase absentes");
    const supprimer = await connecterCompteTest(page, env!, "test-e2e-916c-admin-", "admin");
    try {
      await page.setViewportSize({ width: 1366, height: 768 });
      await page.goto("/fr/admin");
      for (const libelle of ["Produits publiés", "Commandes au total", "Revenu total", "Paiements réussis"]) {
        await expect(page.getByText(libelle, { exact: true })).toBeVisible();
      }
      await expect(page.getByRole("heading", { name: "Performance des ventes" })).toBeVisible();
      await expect(page.locator("[data-barre]")).toHaveCount(30);
      await expect(page.getByRole("heading", { name: "Performance du jour" })).toBeVisible();
      await expect(page.getByText(/^Ventes du \d{2}\/\d{2}\/\d{4} :$/)).toBeVisible();
      await expect(page.getByRole("link", { name: "Voir plus (toutes les tâches)" })).toHaveAttribute("href", "/fr/admin/taches");
      const versIndicateurs = page.getByRole("link", { name: "Voir plus (tous les indicateurs)" });
      await expect(versIndicateurs).toHaveAttribute("href", "#indicateurs");
      await versIndicateurs.click();
      await expect(page.getByRole("heading", { level: 2, name: "Tous les indicateurs" })).toBeInViewport();
      // Rien de l'existant n'a disparu : sélecteur de période, toutes les tâches.
      await expect(page.getByRole("group", { name: "Période des graphiques et des commandes payées" })).toBeAttached();
      await expect(page.getByRole("heading", { level: 2, name: "Toutes les tâches" })).toBeAttached();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    } finally {
      await supprimer();
    }
  });

  test("un Assistant voit toujours la 404 sur le tableau de bord", async ({ page }) => {
    test.skip(!env, "variables Supabase absentes");
    const supprimer = await connecterCompteTest(page, env!, "test-e2e-916c-assistant-", "assistant");
    try {
      await page.goto("/fr/admin");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Page introuvable/);
      await expect(page.getByText("Produits publiés", { exact: true })).toHaveCount(0);
    } finally {
      await supprimer();
    }
  });
});

// Story 9.16 d) : liste des Commandes selon la maquette. Comptes TEST_ réels, supprimés à la fin ; aucune Commande créée (la recherche et la
// pagination sur des Commandes sont prouvées par supabase/tests/commandes_admin_liste.test.sql et les tests unitaires).
test.describe("liste des commandes (9.16 d)", () => {
  test.describe.configure({ timeout: 120_000 });
  const CARTES = ["Revenu payé", "Commandes au total", "Paiements aboutis", "En attente"];

  test("l'Admin voit les 4 cartes, la recherche, les pastilles ; la recherche passe dans l'adresse ; rien ne déborde à 390 px", async ({ page }) => {
    test.skip(!env, "variables Supabase absentes");
    const supprimer = await connecterCompteTest(page, env!, "test-e2e-916d-admin-", "admin");
    try {
      await page.setViewportSize({ width: 1366, height: 768 });
      await page.goto("/fr/admin/commandes");
      await expect(page.getByRole("heading", { level: 1, name: "Commandes" })).toBeVisible();
      const chiffres = page.getByRole("region", { name: "Chiffres des commandes, depuis le début" });
      for (const libelle of CARTES) await expect(chiffres.getByText(libelle, { exact: true })).toBeVisible();
      // La carte du revenu montre un montant, jamais « Illisible ».
      await expect(chiffres.getByRole("listitem").filter({ hasText: "Revenu payé" })).toContainText("$US");
      const groupe = page.getByRole("list", { name: "Filtrer par statut" });
      const pastilles = groupe.getByRole("link");
      await expect(pastilles).toHaveText(["Toutes", "Payées", "Échouées", "En attente", "Remboursées"]);
      await expect(groupe.getByRole("link", { name: "Toutes", exact: true })).toHaveAttribute("aria-current", "true");
      await groupe.getByRole("link", { name: "Payées", exact: true }).click();
      await expect(page).toHaveURL(/\/fr\/admin\/commandes\?statut=payee$/);
      await expect(groupe.getByRole("link", { name: "Payées", exact: true })).toHaveAttribute("aria-current", "true");
      const recherche = page.getByRole("searchbox", { name: "Rechercher par numéro ou client" });
      await recherche.fill("TEST_aucune_commande_916d");
      await recherche.press("Enter");
      await expect(page).toHaveURL(/[?&]q=TEST_aucune_commande_916d/);
      await expect(page).toHaveURL(/[?&]statut=payee/);
      await expect(page.getByText("Aucune commande ne correspond à ces filtres ou à cette recherche.")).toBeVisible();
      // La page lit q et page dans l'adresse : recherche pré-remplie ; page au-delà de la dernière ramenée (aucune « Page 2 »).
      await page.goto("/fr/admin/commandes?q=KS-TEST&page=2");
      await expect(recherche).toHaveValue("KS-TEST");
      await expect(page.getByText("Aucune commande ne correspond à ces filtres ou à cette recherche.")).toBeVisible();
      await expect(page.getByText(/^Page 2 \//)).toHaveCount(0);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/fr/admin/commandes");
      await expect(chiffres.getByText("En attente", { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    } finally {
      await supprimer();
    }
  });

  test("un Assistant voit la même liste et 3 cartes, sans le revenu", async ({ page }) => {
    test.skip(!env, "variables Supabase absentes");
    const supprimer = await connecterCompteTest(page, env!, "test-e2e-916d-assistant-", "assistant");
    try {
      await page.goto("/fr/admin/commandes");
      const chiffres = page.getByRole("region", { name: "Chiffres des commandes, depuis le début" });
      for (const libelle of CARTES.slice(1)) await expect(chiffres.getByText(libelle, { exact: true })).toBeVisible();
      await expect(page.getByText("Revenu payé", { exact: true })).toHaveCount(0);
      await expect(page.getByRole("searchbox", { name: "Rechercher par numéro ou client" })).toBeVisible();
    } finally {
      await supprimer();
    }
  });
});

// Story 9.16 e) : liste des produits selon la maquette, corbeille = archivage (Q22). Produit TEST_ publié (Vêtement, photo dessinée par le test) et
// Compte TEST_ admin réels ; archiver puis restaurer par l'écran ; TOUT est supprimé à la fin puis compté (0 attendu). Aucun paiement simulé.
test.describe("liste des produits et archivage (9.16 e)", () => {
  test.describe.configure({ timeout: 180_000 });
  const PRODUIT: ProduitTest = {
    id: "00000000-0000-4000-8916-0000000000e1",
    slug: "test-e2e-916e-polo",
    titre: "TEST_ Polo archivage 916e",
    titreEn: "TEST_ Polo archive 916e",
    fichier: "test-e2e-916e/polo.jpg",
  };
  const COMMANDE_EN_COURS = { id: "00000000-0000-4000-8916-0000000000e9", numero: "KS-2026-916009" };
  const retirerCommandeEnCours = () =>
    sqlBloc(`delete from public.ligne_commande where commande_id = '${COMMANDE_EN_COURS.id}';
delete from public.commande where id = '${COMMANDE_EN_COURS.id}' or numero = '${COMMANDE_EN_COURS.numero}';`);

  test("l'Admin archive un produit publié (confirmation), le retrouve sous « Archivés », puis le restaure en brouillon", async ({ page }) => {
    test.skip(!env, "variables Supabase absentes");
    retirerCommandeEnCours();
    await retirerProduit(env!, PRODUIT);
    await semerProduit(env!, PRODUIT);
    const supprimer = await connecterCompteTest(page, env!, "test-e2e-916e-admin-", "admin");
    try {
      const base = service(env!);
      const lignesJournal = async () => {
        const { count, error } = await base.from("journal_audit").select("id", { count: "exact", head: true }).eq("cible_table", "produit").eq("cible_id", PRODUIT.id);
        if (error || count === null) throw new Error(`journal : ${error?.message}`);
        return count;
      };
      // Publié : visible dans la boutique.
      await page.goto("/fr/vetements", { waitUntil: "networkidle" });
      await expect(page.getByRole("heading", { level: 3, name: PRODUIT.titre })).toBeVisible();

      await page.setViewportSize({ width: 1366, height: 768 });
      await page.goto("/fr/admin/produits");
      await expect(page.getByRole("heading", { level: 1, name: "Produits" })).toBeVisible();
      await expect(page.locator("#contenu-admin").getByRole("link", { name: "Univers", exact: true })).toHaveAttribute("href", "/fr/admin/univers");
      await expect(page.getByRole("link", { name: "+ Nouveau produit" })).toHaveAttribute("href", "/fr/admin/produits/nouveau");
      const carte = page.getByRole("listitem").filter({ has: page.getByRole("heading", { level: 2, name: PRODUIT.titre }) });
      await expect(carte.getByText("Vendus : 0")).toBeVisible();
      await expect(carte.getByText("Vêtement", { exact: true })).toBeVisible();
      await expect(carte.getByText("Publié", { exact: true })).toBeVisible();
      await expect(carte.getByRole("link", { name: `Modifier ${PRODUIT.titre}` })).toHaveAttribute("href", `/fr/admin/produits/${PRODUIT.id}`);

      // Point 4 (2026-11-21) : une Commande TEST_ payée (données de test, jamais un vrai paiement) contient le produit. La confirmation lit le
      // nombre de commandes en cours sur la vraie base : la requête (jointure ligne_commande, filtres) doit être acceptée et compter 1.
      const { data: comptes } = await base.auth.admin.listUsers({ perPage: 1000 });
      const compteAdmin = comptes.users.find((u) => (u.email ?? "").startsWith("test-e2e-916e-admin-"))?.id;
      expect(compteAdmin, "Compte Admin TEST_ introuvable").toBeTruthy();
      sqlBloc(`insert into public.commande (id, numero, compte_id, type, statut, sous_total_cents, total_cents, forfait_cents, paye_le)
  values ('${COMMANDE_EN_COURS.id}', '${COMMANDE_EN_COURS.numero}', '${compteAdmin}', 'produits', 'payee', 2500, 2500, 0, now());
insert into public.ligne_commande (commande_id, produit_id, variante_id, origine, nombre, prix_cents)
  select '${COMMANDE_EN_COURS.id}', '${PRODUIT.id}', v.id, 'stock', 1, 2500 from public.variante v where v.produit_id = '${PRODUIT.id}';`);

      // Archiver : confirmation d'abord, avec l'alerte des commandes en cours.
      const avant = await lignesJournal();
      await carte.getByRole("button", { name: `Archiver ${PRODUIT.titre}` }).click();
      const dialogue = page.getByRole("dialog", { name: `Archiver « ${PRODUIT.titre} » ?` });
      await expect(dialogue).toBeVisible();
      await expect(dialogue.getByText("Ce produit est dans 1 commande en cours. Il sera retiré de la boutique, les commandes ne changent pas.")).toBeVisible();
      await expect(dialogue.getByText(/n'ont pas pu être vérifiées/)).toHaveCount(0);
      await dialogue.getByRole("button", { name: "Archiver", exact: true }).click();
      // Point 4 : la lecture des commandes en cours (action serveur) passe avant l'archivage ; 20 s en suite complète.
      await expect(page.getByRole("heading", { level: 2, name: PRODUIT.titre })).toHaveCount(0, { timeout: 20_000 });
      const { data: lu, error } = await base.from("produit").select("publie_le, archive_le").eq("id", PRODUIT.id).single();
      expect(error).toBeNull();
      expect(lu?.publie_le).toBeNull();
      expect(lu?.archive_le).not.toBeNull();
      expect(await lignesJournal()).toBe(avant + 1);

      // Sous « Archivés » : statut Archivé, Restaurer, aucun Publier.
      await page.getByRole("button", { name: "Archivés", exact: true }).click();
      const archivee = page.getByRole("listitem").filter({ has: page.getByRole("heading", { level: 2, name: PRODUIT.titre }) });
      await expect(archivee.getByText("Archivé", { exact: true })).toBeVisible();
      await expect(archivee.getByRole("button", { name: /Publier/ })).toHaveCount(0);

      // Retiré de la boutique.
      const boutique = await page.context().newPage();
      await boutique.goto("/fr/vetements", { waitUntil: "networkidle" });
      await expect(boutique.getByRole("heading", { level: 3, name: PRODUIT.titre })).toHaveCount(0);
      await boutique.close();

      // Restaurer : retour en brouillon, dans la liste par défaut.
      await archivee.getByRole("button", { name: `Restaurer ${PRODUIT.titre}` }).click();
      await expect(page.getByRole("heading", { level: 2, name: PRODUIT.titre })).toHaveCount(0);
      await page.getByRole("button", { name: "Tous", exact: true }).click();
      const restauree = page.getByRole("listitem").filter({ has: page.getByRole("heading", { level: 2, name: PRODUIT.titre }) });
      await expect(restauree.getByText("Brouillon", { exact: true })).toBeVisible();
      const { data: relu } = await base.from("produit").select("publie_le, archive_le").eq("id", PRODUIT.id).single();
      expect(relu).toEqual({ publie_le: null, archive_le: null });

      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/fr/admin/produits");
      await expect(page.getByRole("heading", { level: 2, name: PRODUIT.titre })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    } finally {
      // La Commande TEST_ d'abord : elle référence le Compte et le produit (suppression refusée sinon).
      retirerCommandeEnCours();
      try {
        await supprimer();
      } finally {
        await retirerProduit(env!, PRODUIT);
        expect(await restesProduit(env!, PRODUIT)).toEqual({ produits: 0, variantes: 0, photos: 0, fichiers: 0 });
        const { count } = await service(env!).from("commande").select("id", { count: "exact", head: true }).eq("id", COMMANDE_EN_COURS.id);
        expect(count).toBe(0);
      }
    }
  });
});

// Story 9.16 g) : liste du blog selon la maquette, corbeille = archivage (Q22). Article TEST_ publié (sans image) et Comptes TEST_ réels :
// l'Admin archive puis restaure par l'écran ; l'Assistant (droit blog.gerer) voit la liste sans Publier, Dépublier, Archiver ni Restaurer
// (réservés à l'Admin en base, comme la publication) ; TOUT est supprimé à la fin puis compté (0 attendu). Aucun paiement simulé.
test.describe("liste du blog et archivage (9.16 g)", () => {
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  const ARTICLE = { id: "00000000-0000-4000-8916-0000000000f1", slug: "test-e2e-916g-article", titre: "TEST_ Article archivage 916g" };
  const retirer = () => sqlBloc(`delete from public.article where id = '${ARTICLE.id}' or slug = '${ARTICLE.slug}';`);
  const restes = async () => {
    const { count } = await service(env!).from("article").select("id", { count: "exact", head: true }).or(`id.eq.${ARTICLE.id},slug.eq.${ARTICLE.slug}`);
    return count;
  };
  const semer = () =>
    sqlBloc(`insert into public.article (id, auteur_id, titre_fr, texte_fr, slug, images, publie_le) values
  ('${ARTICLE.id}', '00000000-0000-4000-8916-0000000000a0', '${ARTICLE.titre}', '# Titre

**TEST_** texte de démonstration du blog, ' || repeat('otaku ', 60), '${ARTICLE.slug}', '[]'::jsonb, now() - interval '1 hour');`);

  test("l'Assistant voit la liste en lecture seule (lien « Lire »), sans Écrire, Publier, Dépublier, Archiver ni Restaurer ; la fiche est sans formulaire", async ({ page }) => {
    test.skip(!env, "variables Supabase absentes");
    retirer();
    semer();
    const supprimer = await connecterCompteTest(page, env!, "test-e2e-916g-assistant-", "assistant");
    try {
      await page.goto("/fr/admin/blog");
      const carte = page.getByRole("listitem").filter({ has: page.getByRole("heading", { level: 2, name: ARTICLE.titre }) });
      await expect(carte.getByRole("link", { name: `Lire l'article ${ARTICLE.titre}` })).toBeVisible();
      await expect(carte.getByRole("button")).toHaveCount(0);
      await expect(page.getByRole("link", { name: /écrire un article/i })).toHaveCount(0);
      // Point 3 (2026-11-21) : fiche en lecture seule, aucun champ, aucun « Enregistrer ».
      await carte.getByRole("link", { name: `Lire l'article ${ARTICLE.titre}` }).click();
      const fenetre = page.locator("[data-fenetre-formulaire]");
      // Première ouverture de la fiche : compilation de la route en mode dev (jusqu'à 20 s en suite complète).
      await expect(fenetre.locator("[data-article-lecture-seule]")).toBeVisible({ timeout: 30_000 });
      await expect(fenetre.locator("input, textarea, select")).toHaveCount(0);
      await expect(fenetre.getByRole("button", { name: "Enregistrer" })).toHaveCount(0);
      // Adresse de création ouverte directement : message de refus, aucun champ.
      await page.goto("/fr/admin/blog/nouveau");
      const creation = page.locator("[data-fenetre-formulaire]");
      await expect(creation.getByText("La rédaction du blog est réservée à l'administrateur.")).toBeVisible({ timeout: 30_000 });
      await expect(creation.locator("input, textarea, select")).toHaveCount(0);
    } finally {
      try {
        await supprimer();
      } finally {
        retirer();
        expect(await restes()).toBe(0);
      }
    }
  });

  test("l'Admin archive un article publié (confirmation), le retrouve sous « Archivés », puis le restaure", async ({ page }) => {
    test.skip(!env, "variables Supabase absentes");
    retirer();
    semer();
    const supprimer = await connecterCompteTest(page, env!, "test-e2e-916g-admin-", "admin");
    try {
      const base = service(env!);
      const lignesJournal = async () => {
        const { count, error } = await base.from("journal_audit").select("id", { count: "exact", head: true }).eq("cible_table", "article").eq("cible_id", ARTICLE.id);
        if (error || count === null) throw new Error(`journal : ${error?.message}`);
        return count;
      };
      await page.goto("/fr/blog", { waitUntil: "networkidle" });
      await expect(page.getByText(ARTICLE.titre)).toBeVisible();

      await page.setViewportSize({ width: 1366, height: 768 });
      await page.goto("/fr/admin/blog");
      await expect(page.getByRole("heading", { level: 1, name: "Blog" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Écrire un article" })).toHaveAttribute("href", "/fr/admin/blog/nouveau");
      await expect(page.getByRole("button", { name: "Tous", exact: true })).toHaveAttribute("aria-pressed", "true");
      const carte = page.getByRole("listitem").filter({ has: page.getByRole("heading", { level: 2, name: ARTICLE.titre }) });
      await expect(carte.getByText("Publié", { exact: true })).toBeVisible();
      await expect(carte.getByText(/^Titre TEST texte de démonstration du blog, otaku/)).toBeVisible();
      await expect(carte.getByText("Pas d'image")).toBeVisible();
      await expect(carte.getByRole("link", { name: `Modifier ${ARTICLE.titre}` })).toHaveAttribute("href", `/fr/admin/blog/${ARTICLE.id}`);
      await expect(carte.getByRole("button", { name: `Dépublier ${ARTICLE.titre}` })).toBeVisible();

      // Archiver : confirmation d'abord.
      const avant = await lignesJournal();
      await carte.getByRole("button", { name: `Archiver ${ARTICLE.titre}` }).click();
      const dialogue = page.getByRole("dialog", { name: `Archiver « ${ARTICLE.titre} » ?` });
      await expect(dialogue).toBeVisible();
      await dialogue.getByRole("button", { name: "Archiver", exact: true }).click();
      await expect(page.getByText("Article archivé.")).toBeVisible();
      await expect(page.getByRole("heading", { level: 2, name: ARTICLE.titre })).toHaveCount(0);
      const { data: lu, error } = await base.from("article").select("publie_le, archive_le").eq("id", ARTICLE.id).single();
      expect(error).toBeNull();
      expect(lu?.publie_le).toBeNull();
      expect(lu?.archive_le).not.toBeNull();
      expect(await lignesJournal()).toBe(avant + 1);

      // Sous « Archivés » (filtre dans l'adresse) : statut Archivé, Restaurer, aucun Publier.
      await page.getByRole("button", { name: "Archivés", exact: true }).click();
      await expect(page).toHaveURL(/\?filtre=archives$/);
      const archivee = page.getByRole("listitem").filter({ has: page.getByRole("heading", { level: 2, name: ARTICLE.titre }) });
      await expect(archivee.getByText("Archivé", { exact: true })).toBeVisible();
      await expect(archivee.getByRole("button", { name: /Publier/ })).toHaveCount(0);

      // Retiré du blog public.
      const blog = await page.context().newPage();
      await blog.goto("/fr/blog", { waitUntil: "networkidle" });
      await expect(blog.getByText(ARTICLE.titre)).toHaveCount(0);
      await blog.close();

      // Restaurer : retour en brouillon, sous « Brouillons ».
      await archivee.getByRole("button", { name: `Restaurer ${ARTICLE.titre}` }).click();
      await expect(page.getByText("Article restauré : il est revenu en brouillon.")).toBeVisible();
      await page.getByRole("button", { name: "Brouillons", exact: true }).click();
      const restauree = page.getByRole("listitem").filter({ has: page.getByRole("heading", { level: 2, name: ARTICLE.titre }) });
      await expect(restauree.getByText("Brouillon", { exact: true })).toBeVisible();
      const { data: relu } = await base.from("article").select("publie_le, archive_le").eq("id", ARTICLE.id).single();
      expect(relu).toEqual({ publie_le: null, archive_le: null });

      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/fr/admin/blog?filtre=brouillons");
      await expect(page.getByRole("button", { name: "Brouillons", exact: true })).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByRole("heading", { level: 2, name: ARTICLE.titre })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    } finally {
      try {
        await supprimer();
      } finally {
        retirer();
        expect(await restes()).toBe(0);
      }
    }
  });
});

// Story 9.16 h) : fenêtre de l'article et extrait (Q28). Article TEST_ publié et Compte Admin TEST_ réels : un extrait de 301 caractères est refusé
// par le serveur (erreur reliée au champ) ; un extrait valide est enregistré puis affiché sur la carte admin et sur la carte du blog public.
// TOUT est supprimé à la fin puis compté (0 attendu). Aucun paiement simulé.
test.describe("fenêtre de l'article et extrait (9.16 h)", () => {
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  const ARTICLE = { id: "00000000-0000-4000-8916-0000000000f2", slug: "test-e2e-916h-article", titre: "TEST_ Article extrait 916h" };
  const EXTRAIT = "TEST_ Résumé court saisi pour la carte 916h.";
  const retirer = () => sqlBloc(`delete from public.article where id = '${ARTICLE.id}' or slug = '${ARTICLE.slug}';`);
  const restes = async () => {
    const { count } = await service(env!).from("article").select("id", { count: "exact", head: true }).or(`id.eq.${ARTICLE.id},slug.eq.${ARTICLE.slug}`);
    return count;
  };

  test("extrait de 301 caractères refusé par le serveur ; extrait valide affiché sur la carte admin et sur le blog public", async ({ page }) => {
    test.skip(!env, "variables Supabase absentes");
    retirer();
    sqlBloc(`insert into public.article (id, auteur_id, titre_fr, texte_fr, slug, images, publie_le) values
  ('${ARTICLE.id}', '00000000-0000-4000-8916-0000000000a0', '${ARTICLE.titre}', 'TEST_ texte de démonstration du blog.', '${ARTICLE.slug}', '[]'::jsonb, now() - interval '1 hour');`);
    const supprimer = await connecterCompteTest(page, env!, "test-e2e-916h-admin-", "admin");
    try {
      await page.setViewportSize({ width: 1366, height: 768 });
      await page.goto(`/fr/admin/blog/${ARTICLE.id}`);
      const fenetre = page.locator("[data-fenetre-formulaire]");
      await expect(fenetre.getByRole("heading", { level: 1, name: "Modifier l'article" })).toBeVisible();
      await expect(fenetre.getByRole("button", { name: "Statut : Publié" })).toBeVisible();

      const champ = fenetre.getByLabel("Extrait (résumé court)", { exact: true });
      // Échec en CI (mobile, run 44057184223) : le champ était rempli avant l'hydratation, le compteur restait à « 0 sur 300 ».
      await attendreHydratation(page, "[data-fenetre-formulaire] [name=extrait_fr]");
      await champ.fill("a".repeat(301));
      await expect(fenetre.getByText("301 sur 300 caractères : trop long, raccourcis l'extrait.")).toBeVisible();
      await fenetre.getByRole("button", { name: "Enregistrer" }).first().click();
      const erreur = fenetre.getByText("L'extrait ne doit pas dépasser 300 caractères.");
      await expect(erreur).toBeVisible();
      await expect(champ).toHaveAttribute("aria-invalid", "true");
      const { data: avant } = await service(env!).from("article").select("extrait_fr").eq("id", ARTICLE.id).single();
      expect(avant?.extrait_fr).toBeNull();

      await champ.fill(EXTRAIT);
      await fenetre.getByRole("button", { name: "Enregistrer" }).first().click();
      await expect(fenetre.getByText("Article enregistré.")).toBeVisible();
      const { data: apres } = await service(env!).from("article").select("extrait_fr").eq("id", ARTICLE.id).single();
      expect(apres?.extrait_fr).toBe(EXTRAIT);

      // Carte admin : l'extrait saisi, tel quel.
      await page.goto("/fr/admin/blog");
      const carte = page.getByRole("listitem").filter({ has: page.getByRole("heading", { level: 2, name: ARTICLE.titre }) });
      await expect(carte.getByText(EXTRAIT, { exact: true })).toBeVisible();

      // Carte du blog public.
      await page.goto("/fr/blog", { waitUntil: "networkidle" });
      const publique = page.locator("article").filter({ has: page.getByRole("link", { name: ARTICLE.titre }) });
      await expect(publique.getByText(EXTRAIT, { exact: true })).toBeVisible();

      // À 390 px : la fenêtre occupe la largeur, sans défilement horizontal.
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`/fr/admin/blog/${ARTICLE.id}`);
      await expect(page.locator("[data-fenetre-formulaire]").getByLabel("Extrait (résumé court)", { exact: true })).toHaveValue(EXTRAIT);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    } finally {
      try {
        await supprimer();
      } finally {
        retirer();
        expect(await restes()).toBe(0);
      }
    }
  });
});

// Story 9.16 i) : codes promo. Code TEST_ réel et Compte Admin TEST_ réel : la page lit filtre et fenêtre dans l'adresse (route réelle), la corbeille
// demande une confirmation puis désactive le code ; l'état est relu en base et le code reste listé sous INACTIFS. Tout est supprimé et compté à la fin.
test.describe("codes promo (9.16 i)", () => {
  test.describe.configure({ timeout: 120_000 });
  const CODE = { id: "00000000-0000-4000-8916-0000000000c1", code: "TEST_E2E916I", affilie: "TEST_ Affilié e2e" };
  const retirer = () => sqlBloc(`delete from public.code_promo where id = '${CODE.id}' or code = '${CODE.code}';`);
  const restes = async () => {
    const { count } = await service(env!).from("code_promo").select("id", { count: "exact", head: true }).or(`id.eq.${CODE.id},code.eq.${CODE.code}`);
    return count;
  };

  test("fenêtre « nouveau » depuis l'adresse ; corbeille confirmée : Inactif relu en base, listé sous INACTIFS", async ({ page }) => {
    test.skip(!env, "variables Supabase absentes");
    retirer();
    sqlBloc(`insert into public.code_promo (id, code, affilie, reduction_pct, commission_pct, plafond, actif) values
  ('${CODE.id}', '${CODE.code}', '${CODE.affilie}', 10, 5, 50, true);`);
    const supprimer = await connecterCompteTest(page, env!, "test-e2e-916i-admin-", "admin");
    try {
      await page.setViewportSize({ width: 1366, height: 768 });
      await page.goto("/fr/admin/codes-promo?nouveau=1");
      const fenetre = page.locator("[data-fenetre-formulaire]");
      await expect(fenetre.getByRole("heading", { level: 1, name: "Créer un Code promo" })).toBeVisible();
      await expect(fenetre.getByLabel("Code", { exact: true })).toBeVisible();

      await page.goto(`/fr/admin/codes-promo?filtre=actifs&q=${CODE.code}`);
      await expect(page.getByRole("link", { name: "Actifs", exact: true })).toHaveAttribute("aria-current", "true");
      const ligne = page.locator(`tbody[data-code-promo="${CODE.code}"]`);
      await expect(ligne).toBeVisible();
      await attendreHydratation(page, `tbody[data-code-promo="${CODE.code}"] button`);
      await ligne.getByRole("button", { name: `Désactiver le code ${CODE.code}` }).click();
      const dialogue = page.getByRole("dialog", { name: `Désactiver le code ${CODE.code} ?` });
      await dialogue.getByRole("button", { name: "Désactiver" }).click();
      // Sous ACTIFS, la ligne quitte la liste relue ; l'annonce reste dans la zone de la page.
      await expect(page.getByText(`Code ${CODE.code} désactivé.`)).toBeVisible();
      await expect(ligne).toHaveCount(0);
      const { data } = await service(env!).from("code_promo").select("actif, affilie, reduction_pct").eq("id", CODE.id).single();
      expect(data).toMatchObject({ actif: false, affilie: CODE.affilie });

      await page.goto(`/fr/admin/codes-promo?filtre=inactifs&q=${CODE.code}`);
      const inactive = page.locator(`tbody[data-code-promo="${CODE.code}"]`);
      await expect(inactive.locator("[data-etat]")).toHaveText("Inactif");
      await expect(inactive.getByRole("button", { name: `Réactiver le code ${CODE.code}` })).toBeVisible();

      // À 390 px : cartes, sans défilement horizontal.
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/fr/admin/codes-promo");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    } finally {
      try {
        await supprimer();
      } finally {
        retirer();
        expect(await restes()).toBe(0);
      }
    }
  });
});

// Point 5 (2026-11-21) : avant l'hydratation, les champs des formulaires admin sont désactivés (aucune saisie perdue) ; ils s'activent ensuite.
test.describe("garde d'hydratation de l'admin", () => {
  test.describe.configure({ timeout: 120_000 });
  test("JavaScript retenu : champ désactivé ; JavaScript libéré : champ actif", async ({ page }) => {
    test.skip(!env, "variables Supabase absentes");
    // Libéré aussi en cas d'échec (sinon les fichiers JavaScript retenus bloquent la fin du test jusqu'au délai).
    let liberer: () => void = () => {};
    const supprimer = await connecterCompteTest(page, env!, "test-e2e-916-garde-", "admin");
    try {
      const pret = new Promise<void>((resolve) => (liberer = resolve));
      await page.route(/\/_next\/static\/[^?]*\.js/, async (route) => {
        await pret;
        await route.continue();
      });
      await page.goto("/fr/admin/codes-promo?nouveau=1", { waitUntil: "domcontentloaded" });
      const champ = page.locator("[data-fenetre-formulaire]").getByLabel("Code", { exact: true });
      await expect(champ).toBeDisabled();
      liberer();
      await expect(champ).toBeEnabled({ timeout: 60_000 });
      await champ.fill("TEST_GARDE");
      await expect(champ).toHaveValue("TEST_GARDE");
    } finally {
      liberer();
      await supprimer();
    }
  });
});
