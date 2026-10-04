import HomeClient from "../HomeClient";

// Dedicated stable path for Notion's Embed block.
export default async function Embed({ searchParams }) {
  const params = await searchParams;
  const token = params?.token;
  if (!process.env.TOKEN_PWD || token !== process.env.TOKEN_PWD) {
    return (
      <main>
        <section className="surface">
          <div className="eyebrow">Philosophie</div>
          <h1>Accès restreint</h1>
          <p className="intro">Cette page nécessite un lien d’accès valide.</p>
          <div className="notice error">! <span>Lien invalide ou expiré.</span></div>
        </section>
      </main>
    );
  }
  return <HomeClient token={token} />;
}
