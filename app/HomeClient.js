"use client";
import { useEffect, useMemo, useState } from "react";

export default function HomeClient({ token, initialLessonId }) {
  const single = Boolean(initialLessonId);
  const [lessons, setLessons] = useState([]);
  const [selected, setSelected] = useState(initialLessonId ? [initialLessonId] : []);
  const [size, setSize] = useState("large");
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const query = `?token=${encodeURIComponent(token)}`;

  useEffect(() => {
    fetch(`/api/lessons${query}`)
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

  async function exportHtml() {
    if (chosen.length === 0) return setStatus({ kind: "error", text: "Choisissez au moins une leçon pour l’export HTML." });
    setStatus({ kind: "working", text: "Préparation du document HTML…" });
    try {
      const r = await fetch(`/api/export${query}`, {
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
      const r = await fetch(`/api/export${query}`, {
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
      const r = await fetch(`/api/export${query}`, {
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
          <div className="eyebrow">Philosophie</div>
          <h1>{loading ? "Chargement…" : current ? current.name : "Leçon introuvable"}</h1>
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
        <div className="eyebrow">Philosophie</div>
        <h1>Révisions</h1>
        <p className="intro">Choisissez une ou plusieurs tables Notion à exporter. Les données sont lues directement depuis les tables sources.</p>
        <div className="database">
          <div className="database-head">
            <input type="checkbox" checked={lessons.length > 0 && selected.length === lessons.length} onChange={() => setSelected(selected.length === lessons.length ? [] : lessons.map((lesson) => lesson.id))} />
            <span className="table-icon">▦</span>
            <span>Leçons</span>
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
          {!loading && lessons.length === 0 && <div className="empty">Aucune table trouvée. Vérifiez le partage de la page et de ses bases avec l’intégration Notion.</div>}
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
        <p className="note">Le secret Notion reste uniquement sur le serveur Vercel. Les exports utilisent directement les données des tables sélectionnées.</p>
      </section>
    </main>
  );
}
