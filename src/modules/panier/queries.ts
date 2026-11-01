import "server-only";
import { connection } from "next/server";
import { dependances } from "./dependances";
import * as service from "./service";

// Lectures du Panier du visiteur (cookie signé), faites à chaque requête : jamais mises en cache.
// connection() déclare la lecture dynamique avant tout : sans lui, le service attraperait le signal de pré-rendu de Next et la page
// figerait un état d'erreur dans sa version statique.
export async function lirePanier(langue: "fr" | "en") {
  await connection();
  return service.lire(dependances(), langue);
}

export async function compterPanier() {
  await connection();
  return service.compter(dependances());
}
