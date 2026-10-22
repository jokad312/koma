export type ElementFaq = { cle: string; question: string; reponse: string };

// Accordéons indépendants (<details>/<summary> natifs : plusieurs peuvent rester ouverts, aucun JavaScript requis).
// Une colonne sur mobile, deux à partir de lg.
export function QuestionsFaq({ elements }: { elements: readonly ElementFaq[] }) {
  return (
    <div className="grid items-start gap-ecart-cartes lg:grid-cols-2">
      {elements.map(({ cle, question, reponse }) => (
        <details key={cle} className="group rounded-lg border border-border bg-surface">
          <summary className="t-label flex min-h-touch cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 text-text-primary [&::-webkit-details-marker]:hidden">
            <span>{question}</span>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="size-5 shrink-0 fill-none stroke-current stroke-2 transition-transform group-open:rotate-180 motion-reduce:transition-none"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </summary>
          <p className="t-body px-5 pb-4 text-text-secondary">{reponse}</p>
        </details>
      ))}
    </div>
  );
}
