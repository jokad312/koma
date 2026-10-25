// Serveur seulement par nature (sharp) : importé uniquement par le service.
import sharp from "sharp";

export type PhotoNettoyee =
  | { ok: true; octets: Buffer; ext: "jpg" | "png" | "webp"; contentType: "image/jpeg" | "image/png" | "image/webp" }
  | { ok: false };

const FORMATS = {
  jpeg: { ext: "jpg", contentType: "image/jpeg" },
  png: { ext: "png", contentType: "image/png" },
  webp: { ext: "webp", contentType: "image/webp" },
} as const;

// Le contenu réel décide du format (le type annoncé par le navigateur ne suffit pas). L'image est tournée selon son orientation EXIF,
// puis ré-encodée sans AUCUNE métadonnée (EXIF, GPS, profil, vignette) : sharp n'en garde aucune sans demande explicite.
// Plafond de pixels de l'image décodée (protection contre les images piégées) : au-delà, la photo est refusée comme un format invalide.
export const LIMITE_PIXELS = 100_000_000;

export async function nettoyerPhoto(octets: Uint8Array, limitePixels: number = LIMITE_PIXELS): Promise<PhotoNettoyee> {
  try {
    const entree = Buffer.from(octets);
    const options = { limitInputPixels: limitePixels };
    const meta = await sharp(entree, options).metadata();
    if ((meta.width ?? 0) * (meta.height ?? 0) > limitePixels) return { ok: false };
    const format = meta.format;
    if (format !== "jpeg" && format !== "png" && format !== "webp") return { ok: false };
    const { ext, contentType } = FORMATS[format];
    const image = sharp(entree, options).rotate();
    const sortie = format === "jpeg" ? image.jpeg({ quality: 90 }) : format === "png" ? image.png() : image.webp({ quality: 90 });
    return { ok: true, octets: await sortie.toBuffer(), ext, contentType };
  } catch {
    // Contenu illisible ou corrompu : refusé comme un format invalide.
    return { ok: false };
  }
}
