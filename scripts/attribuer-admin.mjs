// Donne le rôle admin à un Compte existant : npm run admin:attribuer -- <email>
// Lit NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SECRET_KEY dans l'environnement (.env.local chargé par le script npm).
// L'adresse vient de la ligne de commande seulement : aucun email ni identifiant n'est écrit dans le dépôt ni affiché.
import { createClient } from "@supabase/supabase-js";

function echec(message) {
  console.error(message);
  process.exit(1);
}

const email = (process.argv[2] ?? "").trim().toLowerCase();
if (!email) echec("Usage : npm run admin:attribuer -- <email>");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const cle = process.env.SUPABASE_SECRET_KEY;
if (!url) echec("Variable d'environnement manquante : NEXT_PUBLIC_SUPABASE_URL.");
if (!cle) echec("Variable d'environnement manquante : SUPABASE_SECRET_KEY.");

const client = createClient(url, cle, { auth: { persistSession: false, autoRefreshToken: false } });

// L'API admin n'a pas de recherche par email : on parcourt les pages de Comptes.
async function trouverCompte(adresse) {
  const parPage = 200;
  for (let page = 1; ; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: parPage });
    if (error) echec("Lecture des Comptes impossible : vérifie l'adresse du projet et la clé secrète.");
    const trouve = data.users.find((u) => (u.email ?? "").toLowerCase() === adresse);
    if (trouve) return trouve.id;
    if (data.users.length < parPage) return null;
  }
}

const compteId = await trouverCompte(email);
if (!compteId) echec("Aucun Compte ne correspond à cette adresse. Le Compte doit d'abord se connecter une fois sur le site.");

const { error } = await client.rpc("attribuer_role", {
  p_auteur: { type: "systeme", nom: "admin:attribuer" },
  p_compte: compteId,
  p_role: "admin",
});
if (error) echec(`Attribution impossible : ${/KS_[A-Z_]+/.exec(error.message)?.[0] ?? "erreur de la base"}.`);

console.log("Rôle admin attribué (ou déjà présent).");
