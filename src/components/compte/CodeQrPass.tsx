import type { CodeQr } from "@/modules/evenements/pass-qr";

// Code QR dessiné en SVG (story 7.5, UX-DR40) : modules noirs sur fond blanc pur, identique dans les deux thèmes, zone de silence de 4 modules
// comprise dans le dessin. Alt : « Code QR du Pass {Type} de {Nom}, {Événement} ». Utilisable côté serveur et côté client.
export function CodeQrPass({ qr, alt, className }: { qr: CodeQr; alt: string; className?: string }) {
  return (
    <svg role="img" aria-label={alt} viewBox={`0 0 ${qr.taille} ${qr.taille}`} shapeRendering="crispEdges" className={className ?? "h-52 w-52"}>
      <rect width={qr.taille} height={qr.taille} className="fill-qr-background" />
      <path d={qr.chemin} fill="#000000" />
    </svg>
  );
}
