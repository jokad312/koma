"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";

// Le HTML brut n'est jamais rendu (rehype-raw n'est pas installé) ; la liste blanche de rehype-sanitize retire tout reste
// dangereux. Protocoles : http(s) et liens internes seulement — jamais javascript:, data:, vbscript: ni mailto.
const SCHEMA = {
  ...defaultSchema,
  protocols: { ...defaultSchema.protocols, href: ["http", "https"], src: ["http", "https"] },
};

// Une adresse est acceptée si elle est interne au site (commence par « / ») ou en http(s).
function adresseAutorisee(url: string): string | null {
  const brut = url.trim();
  if (brut.startsWith("/") && !brut.startsWith("//")) return brut;
  try {
    const u = new URL(brut);
    return u.protocol === "http:" || u.protocol === "https:" ? brut : null;
  } catch {
    return null;
  }
}

// La page ne garde qu'un seul H1, celui du titre de l'Article : les titres saisis dans le texte sont décalés d'un cran
// (# → h2, ## → h3 … ##### → h6) et h6 reste h6. Même règle dans l'aperçu admin, qui emprunte ce rendu.
const COMPOSANTS: Components = {
  h1: ({ children }) => <h2>{children}</h2>,
  h2: ({ children }) => <h3>{children}</h3>,
  h3: ({ children }) => <h4>{children}</h4>,
  h4: ({ children }) => <h5>{children}</h5>,
  h5: ({ children }) => <h6>{children}</h6>,
  h6: ({ children }) => <h6>{children}</h6>,
  a({ node, href, children, ...reste }) {
    void node;
    const adresse = href ? adresseAutorisee(href) : null;
    if (!adresse) return <span>{children}</span>;
    const externe = !adresse.startsWith("/");
    return (
      <a href={adresse} {...(externe ? { target: "_blank", rel: "noopener noreferrer" } : {})} {...reste}>
        {children}
      </a>
    );
  },
  img({ node, src, alt, ...reste }) {
    void node;
    const adresse = typeof src === "string" ? adresseAutorisee(src) : null;
    if (!adresse) return null;
    // Texte alternatif obligatoire : sans lui, l'image n'est pas affichée.
    if (!alt || alt.trim() === "") return null;
    // Image Markdown sans dimensions connues : <img> assumé (pas d'optimisation Next possible sans taille).
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={adresse} alt={alt} {...reste} />;
  },
};

// Un seul chemin de rendu pour l'aperçu admin et les pages publiques (story 8.7) : même nettoyage dans les deux cas.
export function ContenuArticle({ texte }: { texte: string }) {
  return (
    <div className="t-body flex flex-col gap-3 text-text-primary [&_h2]:t-h3 [&_h3]:t-h3 [&_h4]:t-h3 [&_h5]:font-semibold [&_h6]:font-semibold [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mt-1">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeSanitize, SCHEMA]]} components={COMPOSANTS}>
        {texte}
      </ReactMarkdown>
    </div>
  );
}
