"use client";
import { useEffect, useMemo, useState } from "react";

export default function HomeClient({ token, initialLessonId }) {
  const single = Boolean(initialLessonId);
  const [lessons, setLessons] = useState([]);
  const [selected, setSelected] = useState(initialLessonId ? [initialLessonId] : []);
  const [size, setSize] = useState(3);
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

  async function sync() {
    const toSync = single ? visible : lessons;
    if (!toSync.length) return setStatus({ kind: "error", text: "Aucune leçon à synchroniser." });
    setStatus({ kind: "working", text: "Synchronisation des caches…" });
    try {
      const r = await fetch(`/api/sync${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessons: toSync }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error);
      setStatus({ kind: "success", text: body.results.map((x) => `${x.lesson} : ${x.cards} cartes`).join(" · ") });
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
    setStatus({ kind: "working", text: "Préparation du document PDF…" });
    try {
      const r = await fetch(`/api/export${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessons: chosen, format: "pdf", size }),
      });
      const type = r.headers.get("content-type") || "";
      if (r.ok && type.includes("application/pdf")) {
        const url = URL.createObjectURL(await r.blob());
        const a = Object.assign(document.createElement("a"), { href: url, download: `${chosen[0].name}.pdf` });
        a.click();
        URL.revokeObjectURL(url);
        setStatus({ kind: "success", text: "Le document PDF est prêt." });
        return;
      }
      // Serveur indisponible : on bascule sur l'aperçu à imprimer.
      let message = "La génération PDF a échoué, ouverture de l'aperçu à imprimer.";
      try { message = (await r.json()).error || message; } catch {}
      setStatus({ kind: "working", text: message });
      const r2 = await fetch(`/api/export${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessons: chosen, format: "html", size }),
      });
      if (!r2.ok) throw new Error((await r2.json()).error);
      const html = await r2.text();
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

  // Mode mono-leçon (vue embarquée /embed/<id>) : titre + statut au-dessus
  // de deux boutons Exporter / Synchroniser, sans la liste des tables.
  if (single) {
    return (
      <main className="single">
        <section className="surface">
          <div className="eyebrow">Philosophie</div>
          <h1>{loading ? "Chargement…" : current ? current.name : "Leçon introuvable"}</h1>
          {notice}
          <div className="actions">
            <button className="primary" disabled={!chosen.length || status?.kind === "working"} onClick={sync}>
              ↻ Sync
            </button>
            <button disabled={chosen.length !== 1 || status?.kind === "working"} onClick={exportWord}>
              ↓ Export Word
            </button>
            <button disabled={chosen.length !== 1 || status?.kind === "working"} onClick={exportPdf}>
              ↓ Export PDF
            </button>
            <div className="size-control single">
              <label htmlFor="pdf-size-single">Taille</label>
              <input id="pdf-size-single" type="range" min="1" max="5" step="1" value={size} onChange={(e) => setSize(Number(e.target.value))} disabled={status?.kind === "working"} />
              <span className="size-value">{size}</span>
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
        <p className="intro">Choisissez les leçons à traiter. Les caches sont des vues générées : une nouvelle synchronisation les remet à jour sans doublons.</p>
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
          <button className="primary" disabled={loading || status?.kind === "working" || lessons.length === 0} onClick={sync}>
            ↻ Synchroniser le cache
          </button>
          <button disabled={!chosen.length || status?.kind === "working"} onClick={exportWord}>
            ↓ Exporter en Word
          </button>
          <button disabled={!chosen.length || status?.kind === "working"} onClick={exportPdf}>
            ↓ Exporter en PDF
          </button>
          <div className="size-control">
            <label htmlFor="pdf-size">Taille du texte</label>
            <input id="pdf-size" type="range" min="1" max="5" step="1" value={size} onChange={(e) => setSize(Number(e.target.value))} disabled={status?.kind === "working"} />
            <span className="size-value">{size}</span>
          </div>
        </div>
        {notice}
        <p className="note">Le secret Notion reste uniquement sur le serveur Vercel. Un cache est entièrement remplacé à chaque synchronisation.</p>
      </section>
    </main>
  );
}
