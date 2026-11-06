// Notion embeds run in a sandboxed iframe that blocks downloads, so the embed
// only links out to the full exporter in a new tab. It never queries Notion.
export default async function Embed({ searchParams }) {
  const params = await searchParams;
  const id = params?.id;
  const token = params?.token;
  const href = id ? `/?${new URLSearchParams({ id, ...(token ? { token } : {}) })}` : "/";

  return (
    <main className="embed">
      <div className="embed-card">
        <div className="embed-text">
          <div className="embed-title">Exporter en document</div>
          <p className="embed-desc">
            {id
              ? "PDF, Word ou HTML. L’export s’ouvre dans un nouvel onglet, Notion bloquant les téléchargements intégrés."
              : "Aucune page indiquée dans le lien d’intégration. Ajoutez ?id=… à l’URL, ou ouvrez l’outil pour en choisir une."}
          </p>
        </div>
        <a className="send" href={href} target="_blank" rel="noopener noreferrer">
          <span>Ouvrir l’export</span>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3" /></svg>
        </a>
      </div>
    </main>
  );
}
