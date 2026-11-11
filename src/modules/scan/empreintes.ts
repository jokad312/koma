// Empreintes du Scan hors ligne (story 7.8), calculées dans le navigateur avec Web Crypto. Fichier sans dépendance serveur.
// - Jeton du Code QR : SHA-256 du jeton (48 hexadécimaux, minuscules), en hexadécimal. Comme la base : digest(jeton, 'sha256').
// - Code court : HMAC-SHA-256 du code (8 caractères, majuscules) avec la clé du Verrou, en hexadécimal. La clé est importée en CryptoKey NON extractible :
//   l'appareil peut calculer des empreintes mais ne peut plus relire les octets de la clé.

const encodeur = new TextEncoder();

function sous(): SubtleCrypto {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error("Web Crypto indisponible");
  return s;
}

export function versHex(octets: ArrayBuffer | Uint8Array): string {
  const vue = octets instanceof Uint8Array ? octets : new Uint8Array(octets);
  return Array.from(vue, (o) => o.toString(16).padStart(2, "0")).join("");
}

export function depuisHex(hex: string): Uint8Array<ArrayBuffer> {
  if (hex.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(hex)) throw new Error("Hexadécimal invalide");
  const sortie = new Uint8Array(new ArrayBuffer(hex.length / 2));
  for (let i = 0; i < sortie.length; i++) sortie[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return sortie;
}

export async function empreinteJeton(jeton: string): Promise<string> {
  return versHex(await sous().digest("SHA-256", encodeur.encode(jeton.toLowerCase())));
}

export async function importerCleCodeCourt(cleHex: string): Promise<CryptoKey> {
  return sous().importKey("raw", depuisHex(cleHex), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

export async function empreinteCodeCourt(code: string, cle: CryptoKey): Promise<string> {
  return versHex(await sous().sign("HMAC", cle, encodeur.encode(code.toUpperCase())));
}

// Identifiant d'appareil : 128 bits aléatoires, 32 hexadécimaux (même format que la base).
export function nouvelIdentifiantAppareil(): string {
  const octets = new Uint8Array(16);
  globalThis.crypto.getRandomValues(octets);
  return versHex(octets);
}

export function nouvelIdScan(): string {
  return globalThis.crypto.randomUUID();
}
