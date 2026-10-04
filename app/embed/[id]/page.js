import HomeClient from "../../HomeClient";

// Vue embarquée par table : /embed/<lesson_id>?token=xxx
// Même contrôle d'accès que / et /embed, mais restreinte à une leçon.
export default async function EmbedLesson({ params, searchParams }) {
  const [resolvedParams, resolvedSearch] = await Promise.all([params, searchParams]);
  const token = resolvedSearch?.token;
  const lessonId = resolvedParams?.id;
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
  if (!lessonId) {
    return (
      <main>
        <section className="surface">
          <div className="eyebrow">Philosophie</div>
          <h1>Leçon introuvable</h1>
          <div className="notice error">! <span>Identifiant de table manquant dans l’URL.</span></div>
        </section>
      </main>
    );
  }
  return <HomeClient token={token} initialLessonId={lessonId} />;
}
