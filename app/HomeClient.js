"use client";
import { useEffect, useMemo, useRef, useState } from "react";

const TITLE = "Exporter en document";

/* Icons (lucide, 24px grid, stroke 2) */
function Icon({ children, size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}
const CheckIcon = () => <Icon size={14}><path d="M20 6 9 17l-5-5" /></Icon>;
const ChevronRightIcon = () => <Icon size={14}><path d="m9 18 6-6-6-6" /></Icon>;
const ChevronIcon = () => <Icon size={14}><path d="m6 9 6 6 6-6" /></Icon>;
const FileIcon = () => <Icon><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M16 13H8" /><path d="M16 17H8" /></Icon>;
const TypeIcon = () => <Icon><path d="M12 4v16" /><path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2" /><path d="M9 20h6" /></Icon>;
const LinkIcon = () => <Icon><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></Icon>;
const CopyIcon = () => <Icon><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></Icon>;
const LoaderIcon = () => <span className="loader" aria-hidden="true"><Icon><path d="M21 12a9 9 0 1 1-6.219-8.56" /></Icon></span>;
const XIcon = () => <Icon size={14}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></Icon>;
const ArrowRightIcon = () => <Icon><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></Icon>;
const ArrowLeftIcon = () => <Icon size={14}><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></Icon>;
const DownloadIcon = () => <Icon><path d="M12 15V3" /><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /></Icon>;
const ExternalIcon = () => <Icon><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3" /></Icon>;

const SIZES = [
  { value: "small", label: "Petit" },
  { value: "medium", label: "Moyen" },
  { value: "large", label: "Grand" },
];
const FORMATS = [
  { value: "pdf", label: "PDF" },
  { value: "docx", label: "Word" },
  { value: "html", label: "HTML", tag: "legacy" },
];

function TopBar({ action, page }) {
  return (
    <header className="topbar">
      <nav className="crumbs" aria-label="Fil d’Ariane">
        <span className="crumb-badge" aria-hidden="true">N</span>
        <span className="crumb-muted">Notion</span>
        <span className="crumb-sep" aria-hidden="true">/</span>
        {page ? (
          <>
            <a className="crumb-muted crumb-link" href="/">{TITLE}</a>
            <span className="crumb-sep" aria-hidden="true">/</span>
            <span className="crumb-current">{page}</span>
          </>
        ) : (
          <span className="crumb-current">{TITLE}</span>
        )}
      </nav>
      {action}
    </header>
  );
}

function Notice({ status }) {
  if (!status) return null;
  // lucide circle-check / circle-alert / loader-circle, as in T3 thread statuses.
  const icon = {
    success: <Icon><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></Icon>,
    error: <Icon><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></Icon>,
    working: <Icon><path d="M21 12a9 9 0 1 1-6.219-8.56" /></Icon>,
  }[status.kind];
  return (
    <div className={`notice ${status.kind}`} role={status.kind === "error" ? "alert" : "status"}>
      <span className="notice-icon">{icon}</span>
      <span className="notice-text">{status.text}</span>
    </div>
  );
}

// Glass popover anchored to a composer pill (T3 model / reasoning menus).
function Popover({ label, trigger, title, meta, side = "bottom", align = "start", disabled, children, className = "" }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e) => { if (!root.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      root.current?.querySelector(".pill")?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    const focusTarget = root.current?.querySelector('.popup [aria-checked="true"], .popup input');
    focusTarget?.focus();
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="popover" ref={root}>
      <button type="button" className="pill" aria-haspopup="dialog" aria-expanded={open} aria-label={label} disabled={disabled} onClick={() => setOpen((o) => !o)}>
        {trigger}
      </button>
      {open && (
        <div className={`popup side-${side} align-${align} ${className}`} role="dialog" aria-label={title}>
          <div className="popup-head">
            <span>{title}</span>
            {meta && <span className="popup-meta">{meta}</span>}
          </div>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

function RadioMenu({ label, options, value, onChange, close }) {
  function onKeyDown(e) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...e.currentTarget.querySelectorAll('[role="radio"]')];
    const next = (items.indexOf(document.activeElement) + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items[next].focus();
  }
  return (
    <div className="popup-list" role="radiogroup" aria-label={label} onKeyDown={onKeyDown}>
      {options.map((item) => (
        <button
          key={item.value}
          type="button"
          role="radio"
          aria-checked={item.value === value}
          tabIndex={item.value === value ? 0 : -1}
          className="menu-item"
          onClick={() => { onChange(item.value); close(); }}
        >
          <span className="menu-label">{item.label}</span>
          {item.tag && <span className="tag">{item.tag}</span>}
          {item.value === value && <CheckIcon />}
        </button>
      ))}
    </div>
  );
}

function parsePageId(input) {
  const value = input.trim();
  if (/^(?:[0-9a-f]{32}|[0-9a-f-]{36})$/i.test(value)) return value;
  try {
    return new URL(value).pathname.match(/([0-9a-f]{32}|[0-9a-f-]{36})$/i)?.[1] ?? null;
  } catch {
    return null;
  }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback for contexts where the async clipboard API is unavailable.
    const area = Object.assign(document.createElement("textarea"), { value: text });
    area.style.cssText = "position:fixed;opacity:0";
    document.body.append(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    if (!ok) throw new Error("copy failed");
  }
}

async function saveToken(token) {
  const r = await fetch("/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
  if (!r.ok) throw new Error((await r.json().catch(() => null))?.error || "Impossible d’enregistrer le token.");
}

// Recently exported pages: ids and names only (never the token), kept in this
// browser's localStorage as a convenience.
const RECENTS_KEY = "export-recents";
function loadRecents() {
  try {
    const items = JSON.parse(localStorage.getItem(RECENTS_KEY) || "[]");
    return Array.isArray(items) ? items.filter((item) => item?.id && item?.name) : [];
  } catch {
    return [];
  }
}
function storeRecents(items) {
  try { localStorage.setItem(RECENTS_KEY, JSON.stringify(items)); } catch {}
}
function rememberExport(entry) {
  storeRecents([{ ...entry, at: Date.now() }, ...loadRecents().filter((item) => item.id !== entry.id)].slice(0, 8));
}
function timeAgo(at) {
  const minutes = Math.round((Date.now() - at) / 60000);
  const rtf = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });
  if (minutes < 60) return rtf.format(-minutes, "minute");
  if (minutes < 60 * 24) return rtf.format(-Math.round(minutes / 60), "hour");
  return rtf.format(-Math.round(minutes / 1440), "day");
}

function Recents() {
  const [items, setItems] = useState([]);
  useEffect(() => setItems(loadRecents()), []);
  if (!items.length) return null;
  function remove(id) {
    const next = items.filter((item) => item.id !== id);
    storeRecents(next);
    setItems(next);
  }
  return (
    <section className="recents">
      <h2>Pages récentes</h2>
      <div className="card">
        {items.map((item) => (
          <div className="recent-row" key={item.id}>
            <a className="recent-link" href={`/?${new URLSearchParams({ id: item.id })}`}>
              <FileIcon />
              <span className="recent-name">{item.name}</span>
              <span className="recent-meta">{[item.format, item.at && timeAgo(item.at)].filter(Boolean).join(" · ")}</span>
            </a>
            <button type="button" className="icon-btn" onClick={() => remove(item.id)} aria-label={`Retirer ${item.name} des pages récentes`} title="Retirer">
              <XIcon />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

const EXAMPLES = [
  { src: "/notion-example.png", alt: "Exemple de base de données Notion compatible", caption: "La page doit contenir une base de données, une ligne par fiche." },
  { src: "/export-preview.png", alt: "Aperçu d’un document exporté", caption: "Le document exporté." },
];

function Landing({ hasSavedToken }) {
  const [pageUrl, setPageUrl] = useState("");
  const [pageToken, setPageToken] = useState("");
  const [formError, setFormError] = useState("");
  const [copied, setCopied] = useState(false);
  const [zoomed, setZoomed] = useState(null);
  const [advanced, setAdvanced] = useState(false);
  const [savedToken, setSavedToken] = useState(hasSavedToken);
  const [replacing, setReplacing] = useState(false);
  const [working, setWorking] = useState(false);

  function pageParams() {
    setFormError("");
    if (!pageUrl.trim()) {
      setFormError("Collez une URL Notion ou saisissez un identifiant de page.");
      return null;
    }
    const id = parsePageId(pageUrl);
    if (!id) {
      setFormError("Cette URL Notion ne contient pas d’identifiant de page valide.");
      return null;
    }
    return new URLSearchParams({ id });
  }

  // A typed token goes into the HttpOnly cookie, never into a URL.
  async function persistToken() {
    if (!pageToken.trim()) return true;
    try {
      await saveToken(pageToken.trim());
      setSavedToken(true);
      setReplacing(false);
      setPageToken("");
      return true;
    } catch (e) {
      setAdvanced(true);
      setFormError(e.message);
      return false;
    }
  }

  async function openPage(event) {
    event.preventDefault();
    const params = pageParams();
    if (!params) return;
    setWorking(true);
    if (await persistToken()) window.location.assign(`/?${params}`);
    else setWorking(false);
  }

  async function forgetToken() {
    await fetch("/api/session", { method: "DELETE" });
    setSavedToken(false);
    setReplacing(false);
  }

  async function copyEmbed() {
    const params = pageParams();
    if (!params || !(await persistToken())) return;
    try {
      await copyText(`${window.location.origin}/embed?${params}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setFormError("Impossible de copier le lien dans le presse-papiers.");
    }
  }

  useEffect(() => {
    if (!zoomed) return;
    const onKey = (e) => { if (e.key === "Escape") setZoomed(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [zoomed]);

  return (
    <div className="app">
      <TopBar />
      <main className="landing">
        <header className="hero-head">
          <h1 className="hero">{TITLE}</h1>
          <p className="hero-sub">Collez le lien d’une page Notion contenant des tables.</p>
        </header>

        <form className="composer" onSubmit={openPage} noValidate>
          <div className="field">
            <label className="settings-title" htmlFor="notion-page-url">Lien de la page Notion</label>
            <div className="field-input">
              <LinkIcon />
              <input
                id="notion-page-url"
                type="url"
                inputMode="url"
                value={pageUrl}
                onChange={(e) => setPageUrl(e.target.value)}
                placeholder="https://www.notion.so/…"
                autoComplete="off"
                spellCheck="false"
                autoFocus
              />
            </div>
          </div>
          <div className="composer-foot">
            <button className="pill" type="button" onClick={copyEmbed}>
              {copied ? <><CheckIcon /><span>Lien copié</span></> : <><CopyIcon /><span>Copier le lien embed</span></>}
            </button>
            <button className="send" type="submit" disabled={working}>
              <span>Ouvrir l’export</span>
              {working ? <LoaderIcon /> : <ArrowRightIcon />}
            </button>
          </div>
          <div className={`collapsible ${advanced ? "open" : ""}`}>
            <button type="button" className="collapsible-trigger" aria-expanded={advanced} aria-controls="advanced-panel" onClick={() => setAdvanced((o) => !o)}>
              <ChevronRightIcon />
              <span>Avancé</span>
              {!advanced && (savedToken || pageToken.trim()) && <span className="collapsible-meta">{savedToken ? "Token enregistré" : "Token ajouté"}</span>}
            </button>
            {advanced && (
              <div id="advanced-panel" className="settings-row">
                <div className="settings-text">
                  <label className="settings-title" htmlFor="notion-page-token">Notion Token</label>
                  {savedToken && !replacing ? (
                    <p className="settings-desc">Enregistré dans ce navigateur (cookie sécurisé, 30 jours). Il n’apparaît jamais dans les liens.</p>
                  ) : (
                    <p className="settings-desc">
                      Facultatif, seulement si la page est privée. Créez une intégration dans{" "}
                      <a href="https://www.notion.so/my-integrations" target="_blank" rel="noreferrer">My integrations</a>, puis copiez son token.
                    </p>
                  )}
                </div>
                {savedToken && !replacing ? (
                  <div className="settings-actions">
                    <button type="button" className="btn-xs" onClick={() => setReplacing(true)}>Remplacer</button>
                    <button type="button" className="btn-xs danger" onClick={forgetToken}>Supprimer</button>
                  </div>
                ) : (
                  <input
                    id="notion-page-token"
                    className="settings-input"
                    type="password"
                    value={pageToken}
                    onChange={(e) => setPageToken(e.target.value)}
                    placeholder="ntn_…"
                    autoComplete="off"
                    spellCheck="false"
                    autoFocus={replacing}
                  />
                )}
              </div>
            )}
          </div>
        </form>
        <Notice status={formError ? { kind: "error", text: formError } : null} />

        <Recents />

        <section className="examples-section">
          <h2>Comment ça marche</h2>
          <div className="examples">
            {EXAMPLES.map((ex) => (
              <figure className="example" key={ex.src}>
                <button type="button" className="example-media" onClick={() => setZoomed(ex)} aria-label={`Agrandir : ${ex.alt}`}>
                  <img src={ex.src} alt={ex.alt} />
                </button>
                <figcaption>{ex.caption}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      </main>

      {zoomed && (
        <div className="lightbox" role="dialog" aria-label={zoomed.alt} onClick={() => setZoomed(null)}>
          <img src={zoomed.src} alt={zoomed.alt} />
        </div>
      )}
    </div>
  );
}

export default function HomeClient({ urlToken, pageId, hasSavedToken }) {
  const [lessons, setLessons] = useState([]);
  const [selected, setSelected] = useState([]);
  const [size, setSize] = useState("medium");
  const [format, setFormat] = useState("pdf");
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(Boolean(pageId));
  const [pageName, setPageName] = useState("");
  // Falls back to ?token= only if the cookie could not be set.
  const [fallbackToken, setFallbackToken] = useState(null);
  const query = new URLSearchParams({ ...(pageId ? { id: pageId } : {}), ...(fallbackToken ? { token: fallbackToken } : {}) }).toString();

  useEffect(() => {
    if (!pageId) return;
    let cancelled = false;
    (async () => {
      let token = null;
      if (urlToken) {
        // Legacy links carry ?token=: move it into the cookie and drop it from the address bar.
        try {
          await saveToken(urlToken);
        } catch {
          token = urlToken;
        }
        const url = new URL(window.location.href);
        url.searchParams.delete("token");
        window.history.replaceState(null, "", url);
      }
      try {
        const r = await fetch(`/api/lessons?${new URLSearchParams({ id: pageId, ...(token ? { token } : {}) })}`);
        const body = await r.json();
        if (!r.ok) throw new Error(body.error);
        if (cancelled) return;
        setFallbackToken(token);
        setLessons(body.lessons);
        setPageName(body.page?.name || body.lessons[0]?.name || "Page Notion");
      } catch (error) {
        if (!cancelled) setStatus({ kind: "error", text: error.message });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pageId, urlToken]);

  const chosen = useMemo(() => lessons.filter((lesson) => selected.includes(lesson.id)), [lessons, selected]);
  const toggle = (id) => setSelected((items) => (items.includes(id) ? items.filter((item) => item !== id) : [...items, id]));
  const allSelected = lessons.length > 0 && lessons.every((lesson) => selected.includes(lesson.id));
  const busy = status?.kind === "working";

  if (!pageId) return <Landing hasSavedToken={hasSavedToken} />;

  const currentFormat = FORMATS.find((f) => f.value === format);
  const currentSize = SIZES.find((s) => s.value === size);

  async function downloadExport() {
    const label = currentFormat.label;
    setStatus({ kind: "working", text: `Préparation du document ${label}…` });
    try {
      const r = await fetch(`/api/export?${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessons: chosen, format, size }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => null);
        throw new Error(body?.error || `L’export ${label} a échoué (erreur ${r.status}).`);
      }
      const url = URL.createObjectURL(await r.blob());
      const name = (chosen.length === 1 ? chosen[0].name.trim() : "") || "export";
      Object.assign(document.createElement("a"), { href: url, download: `${name}.${format}` }).click();
      URL.revokeObjectURL(url);
      rememberExport({ id: pageId, name: pageName, format: label });
      setStatus({ kind: "success", text: `Le document ${label} est téléchargé.` });
    } catch (e) {
      setStatus({ kind: "error", text: e.message });
    }
  }

  // HTML is not a file: the page is rendered live by /view in a new tab.
  function openHtml() {
    const params = new URLSearchParams({ ...(fallbackToken ? { token: fallbackToken } : {}), size });
    for (const lesson of chosen) {
      params.append("t", lesson.id);
      params.append("n", lesson.name.trim());
    }
    window.open(`/view?${params}`, "_blank", "noopener");
    rememberExport({ id: pageId, name: pageName, format: "HTML" });
    setStatus({ kind: "success", text: "La page HTML s’ouvre dans un nouvel onglet." });
  }

  function runExport() {
    if (!chosen.length) return setStatus({ kind: "error", text: "Choisissez au moins une table." });
    return format === "html" ? openHtml() : downloadExport();
  }

  return (
    <div className="app">
      <TopBar page={pageName} action={<a className="pill" href="/"><ArrowLeftIcon /><span>Changer de page</span></a>} />
      <main className="page">
        <section className="section">
          <div className="section-head">
            <h2>Tables <span className="section-count">{loading ? "" : lessons.length}</span></h2>
            {!loading && lessons.length > 0 && (
              <button type="button" className="btn-xs" onClick={() => setSelected(allSelected ? [] : lessons.map((lesson) => lesson.id))}>
                {allSelected ? "Tout désélectionner" : "Tout sélectionner"}
              </button>
            )}
          </div>
          <div className="card">
            {loading && <div className="empty"><LoaderIcon /> Chargement des tables…</div>}
            {!loading && lessons.map((lesson) => (
              <label className="setting-row" key={lesson.id} title={lesson.name}>
                <span className="setting-label">{lesson.name}</span>
                <input type="checkbox" role="switch" className="switch" checked={selected.includes(lesson.id)} onChange={() => toggle(lesson.id)} aria-label={lesson.name} />
              </label>
            ))}
            {!loading && lessons.length === 0 && (
              <div className="empty">Aucune table trouvée. Utilisez l’identifiant d’une table ou d’une page contenant des tables.</div>
            )}
          </div>
        </section>

      <div className="dock">
        <div className="dock-inner">
          <Notice status={status} />
          <div className="composer composer-bar">
            <div className="composer-foot">
              <div className="composer-pills">
                <Popover label={`Format : ${currentFormat.label}`} title="Format" side="top" disabled={busy} trigger={<><FileIcon /><span>{currentFormat.label}</span><ChevronIcon /></>}>
                  {(close) => <RadioMenu label="Format" options={FORMATS} value={format} onChange={setFormat} close={close} />}
                </Popover>
                {format !== "docx" && (
                  <Popover label={`Taille du texte : ${currentSize.label}`} title="Taille du texte" side="top" disabled={busy} trigger={<><TypeIcon /><span>{currentSize.label}</span><ChevronIcon /></>}>
                    {(close) => <RadioMenu label="Taille du texte" options={SIZES} value={size} onChange={setSize} close={close} />}
                  </Popover>
                )}
              </div>
              <button type="button" className="send" disabled={!chosen.length || busy} onClick={runExport}>
                {busy ? <LoaderIcon /> : format === "html" ? <ExternalIcon /> : <DownloadIcon />}
                <span>{format === "html" ? "Ouvrir" : "Exporter"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      </main>
    </div>
  );
}
