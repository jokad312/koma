// Serveur de développement seulement : hôtes du réseau local autorisés à charger les ressources de développement de Next
// (allowedDevOrigins), par exemple un téléphone sur le même Wi-Fi qui ouvre http://<adresse du PC>:3000. La liste est lue dans
// DEV_ORIGINES_AUTORISEES (.env.local, hôtes séparés par des virgules) : aucune adresse n'est écrite dans le dépôt. Sans effet en production.
export function lireOriginesDev(valeur: string | undefined): string[] {
  return (valeur ?? "")
    .split(",")
    .map((hote) => hote.trim())
    .filter((hote) => hote.length > 0);
}
