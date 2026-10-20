// Arrête le démarrage du serveur si une variable obligatoire manque.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { lireEnvServeur } = await import("@/lib/env");
    lireEnvServeur();
  }
}
