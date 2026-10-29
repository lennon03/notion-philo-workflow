"use client";
import { useEffect, useMemo, useState } from "react";

export default function HomeClient({ token, pageId, initialLessonId }) {
  const single = Boolean(initialLessonId);
  const [lessons, setLessons] = useState([]);
  const [selected, setSelected] = useState(initialLessonId ? [initialLessonId] : []);
  const [size, setSize] = useState("large");
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const query = new URLSearchParams({ ...(token ? { token } : {}), ...(pageId ? { id: pageId } : {}) }).toString();

  useEffect(() => {
    if (!pageId && !initialLessonId) {
      setLessons([]);
      setLoading(false);
      return;
    }
    fetch(`/api/lessons?${query}`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error);
        setLessons(body.lessons);
        if (initialLessonId) setSelected([initialLessonId]);
      })
      .catch((error) => setStatus({ kind: "error", text: error.message }))
      .finally(() => setLoading(false));
  }, [query, initialLessonId]);

  const visible = useMemo(
    () => (single ? lessons.filter((lesson) => lesson.id === initialLessonId) : lessons),
    [lessons, single, initialLessonId]
  );
  const chosen = useMemo(() => lessons.filter((lesson) => selected.includes(lesson.id)), [lessons, selected]);
  const current = single ? visible[0] : null;
  const toggle = (id) => setSelected((items) => (items.includes(id) ? items.filter((item) => item !== id) : [...items, id]));

  function Landing() {
    const [pageUrl, setPageUrl] = useState("");
    const [pageToken, setPageToken] = useState("");
    const [formError, setFormError] = useState("");

    function openPage(event) {
      event.preventDefault();
      setFormError("");
      const input = pageUrl.trim();
      if (!input) return setFormError("Collez une URL Notion ou saisissez un identifiant de page.");
      try {
        const isId = /^(?:[0-9a-f]{32}|[0-9a-f-]{36})$/i.test(input);
        const match = isId ? [input, input] : new URL(input).pathname.match(/([0-9a-f]{32}|[0-9a-f-]{36})$/i);
        if (!match) throw new Error();
        const id = match[1];
        const params = new URLSearchParams({ id, ...(pageToken.trim() ? { token: pageToken.trim() } : {}) });
        window.location.assign(`/?${params}`);
      } catch {
        setFormError("Cette URL Notion ne contient pas d’identifiant de page valide.");
      }
    }

    return (
      <main>
        <section className="surface landing">
          <h1>Exporter des tables Notion en PDF, Word et HTML</h1>
          <p className="intro">Collez l’URL d’une page contenant les tables à exporter, ou l’identifiant d’une table. Ajoutez le token d’intégration uniquement si la page est privée.</p>
          <form className="page-form" onSubmit={openPage}>
            <label htmlFor="notion-page-url">URL de la page Notion</label>
            <input id="notion-page-url" type="text" value={pageUrl} onChange={(e) => setPageUrl(e.target.value)} placeholder="https://www.notion.so/... ou page_id" required />
            <label htmlFor="notion-page-token">Token Notion (uniquement si la page est privée)</label>
            <input id="notion-page-token" type="password" value={pageToken} onChange={(e) => setPageToken(e.target.value)} placeholder="secret_..." autoComplete="off" />
            {formError && <div className="notice error">! <span>{formError}</span></div>}
            <button className="primary" type="submit">Ouvrir l’export</button>
          </form>
        </section>
      </main>
    );
  }

  if (!pageId && !initialLessonId) return <Landing />;

  async function exportHtml() {
    if (chosen.length === 0) return setStatus({ kind: "error", text: "Choisissez au moins une leçon pour l’export HTML." });
    setStatus({ kind: "working", text: "Préparation du document HTML…" });
    try {
      const r = await fetch(`/api/export?${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessons: chosen, format: "html", size }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      const url = URL.createObjectURL(await r.blob());
      const a = Object.assign(document.createElement("a"), { href: url, download: `${chosen[0].name}.html` });
      a.click();
      URL.revokeObjectURL(url);
      setStatus({ kind: "success", text: "Le document HTML est prêt." });
    } catch (e) {
      setStatus({ kind: "error", text: e.message });
    }
  }

  async function exportWord() {
    if (chosen.length === 0) return setStatus({ kind: "error", text: "Choisissez au moins une leçon pour l’export Word." });
    setStatus({ kind: "working", text: "Préparation du document Word…" });
    try {
      const r = await fetch(`/api/export?${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessons: chosen, format: "docx" }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      const url = URL.createObjectURL(await r.blob());
      const a = Object.assign(document.createElement("a"), { href: url, download: `${chosen[0].name}.docx` });
      a.click();
      URL.revokeObjectURL(url);
      setStatus({ kind: "success", text: "Le document Word est prêt." });
    } catch (e) {
      setStatus({ kind: "error", text: e.message });
    }
  }

  async function exportPdf() {
    if (chosen.length === 0) return setStatus({ kind: "error", text: "Choisissez au moins une leçon pour l’export PDF." });
    setStatus({ kind: "working", text: "Ouverture de l’export HTML à imprimer…" });
    try {
      const r = await fetch(`/api/export?${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessons: chosen, format: "html", size }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      const html = await r.text();
      const printWindow = window.open("", "_blank");
      if (!printWindow) throw new Error("Le navigateur a bloqué la fenêtre. Autorisez les pop-ups puis réessayez.");
      let printed = false;
      const launchPrint = () => { if (printed) return; printed = true; setTimeout(() => printWindow.print(), 250); };
      printWindow.onload = launchPrint;
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(launchPrint, 1200);
      setStatus({ kind: "success", text: "Aperçu prêt : choisissez « Enregistrer au format PDF »." });
    } catch (e) {
      setStatus({ kind: "error", text: e.message });
    }
  }

  const notice = status && (
    <div className={`notice ${status.kind}`}>
      {status.kind === "working" ? "◌" : status.kind === "success" ? "✓" : "!"} <span>{status.text}</span>
    </div>
  );

  // Mode mono-leçon (vue embarquée /embed/<id>) : titre + exports, sans la liste.
  if (single) {
    return (
      <main className="single">
        <section className="surface">
          <h1>{loading ? "Chargement…" : current ? current.name : "Table introuvable"}</h1>
          {notice}
          <div className="actions">
            <button disabled={chosen.length !== 1 || status?.kind === "working"} onClick={exportWord}>
              ↓ Export Word
            </button>
            <button disabled={!chosen.length || status?.kind === "working"} onClick={exportHtml}>
              ↓ Export HTML
            </button>
            <button disabled={chosen.length !== 1 || status?.kind === "working"} onClick={exportPdf}>
              ↓ Export PDF (expérimental)
            </button>
            <div className="size-control single">
              <label htmlFor="pdf-size-single">Taille</label>
              <select id="pdf-size-single" value={size} onChange={(e) => setSize(e.target.value)} disabled={status?.kind === "working"}>
                <option value="small">Petit</option>
                <option value="medium">Moyen</option>
                <option value="large">Grand</option>
              </select>
            </div>
          </div>
          {!loading && !current && (
            <div className="notice error">! <span>Aucune table ne correspond à cet identifiant. Vérifiez le lien d’intégration.</span></div>
          )}
        </section>
      </main>
    );
  }

  return (
    <main>
      <section className="surface">
        <h1>Exporter des tables Notion en PDF, Word et HTML</h1>
        <div className="database">
          <div className="database-head">
            <input type="checkbox" checked={lessons.length > 0 && selected.length === lessons.length} onChange={() => setSelected(selected.length === lessons.length ? [] : lessons.map((lesson) => lesson.id))} />
            <span className="table-icon">▦</span>
            <span>Tables à exporter</span>
            <span className="count">{lessons.length}</span>
          </div>
          {loading && <div className="empty">Chargement des leçons…</div>}
          {!loading &&
            lessons.map((lesson) => (
              <label className="row" key={lesson.id}>
                <input type="checkbox" checked={selected.includes(lesson.id)} onChange={() => toggle(lesson.id)} />
                <span className="checkbox" aria-hidden="true">{selected.includes(lesson.id) && "✓"}</span>
                <span className="page-icon">◻</span>
                <span>{lesson.name}</span>
              </label>
            ))}
          {!loading && lessons.length === 0 && <div className="empty">Aucune table trouvée. Utilisez l’identifiant d’une table ou d’une page contenant des tables.</div>}
        </div>
        <div className="actions">
          <button disabled={!chosen.length || status?.kind === "working"} onClick={exportWord}>
            ↓ Exporter en Word
          </button>
          <button disabled={!chosen.length || status?.kind === "working"} onClick={exportHtml}>
            ↓ Exporter en HTML
          </button>
          <button disabled={!chosen.length || status?.kind === "working"} onClick={exportPdf}>
            ↓ Exporter en PDF (expérimental)
          </button>
          <div className="size-control">
            <label htmlFor="pdf-size">Taille du texte</label>
            <select id="pdf-size" value={size} onChange={(e) => setSize(e.target.value)} disabled={status?.kind === "working"}>
              <option value="small">Petit</option>
              <option value="medium">Moyen</option>
              <option value="large">Grand</option>
            </select>
          </div>
        </div>
        {notice}
      </section>
    </main>
  );
}
