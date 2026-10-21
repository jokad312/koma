import { serialiserJsonLd } from "./jsonld";

export function JsonLd({ donnees }: { donnees: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serialiserJsonLd(donnees) }} />;
}
