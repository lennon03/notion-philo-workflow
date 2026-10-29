import { readFileSync } from "node:fs";
import { join } from "node:path";
import hljs from "highlight.js/lib/common";
import katex from "katex";
import { allChildren, allRows, getNotion, titleOf } from "./notion";

function katexStyles() {
  const css = readFileSync("lib/katex-inline.txt", "utf8");
  return css.replace(/url\(fonts\/([^)]+)\)/g, (_, file) => {
    const extension = file.split(".").pop();
    const mime = extension === "woff2" ? "font/woff2" : extension === "woff" ? "font/woff" : "font/ttf";
    const data = readFileSync(join("node_modules/katex/dist/fonts", file)).toString("base64");
    return `url(data:${mime};base64,${data})`;
  });
}

const KATEX_CSS = katexStyles();
const FIRA_CODE_FONT = `data:font/woff2;base64,${readFileSync("node_modules/@fontsource/fira-code/files/fira-code-latin-400-normal.woff2").toString("base64")}`;

// Notion color name -> CSS color (same palette as the Word export).
const COLORS = { gray: "#787774", brown: "#9F6B53", orange: "#D9730D", yellow: "#CB912F", green: "#448361", blue: "#337EA9", purple: "#9065B0", pink: "#C14C8A", red: "#D44C47", default: "#28303A" };
function colorOf(value) { return COLORS[String(value ?? "default").replace("_background", "")] ?? COLORS.default; }
function backgroundOf(value) { return String(value ?? "").endsWith("_background") ? colorOf(value) : null; }

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function richTextContent(item) {
  if (item?.type === "text") return item.text?.content ?? item.plain_text ?? "";
  if (item?.type === "equation") return item.equation?.expression ?? item.plain_text ?? "";
  return item?.plain_text ?? item?.text?.content ?? "";
}

// Mark programming operators so the bundled Fira Code font can render their
// ligatures consistently in both local and serverless Chromium.
function renderOperators(value) {
  const escaped = escapeHtml(value);
  return escaped
    .replace(/=&gt;/g, '<span class="operator">=&gt;</span>')
    .replace(/-&gt;/g, '<span class="operator">-&gt;</span>');
}

function renderLatex(expression, displayMode = false) {
  try {
    return katex.renderToString(String(expression ?? ""), {
      displayMode,
      throwOnError: false,
      output: "htmlAndMathml",
    });
  } catch {
    return escapeHtml(expression);
  }
}

function renderCode(value, language) {
  const source = (value ?? "").toString();
  const normalized = String(language ?? "").toLowerCase().replace(/[\s_]+/g, "-");
  if (!normalized || normalized === "plain-text" || normalized === "text") return escapeHtml(source);
  if (!hljs.getLanguage(normalized)) return escapeHtml(source);
  return hljs.highlight(source, { language: normalized, ignoreIllegals: true }).value;
}

function imageUrl(value) {
  const candidate = value?.type === "external" ? value.external?.url : value?.file?.url;
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

function captionHtml(caption = []) {
  const text = caption.map((item) => item.plain_text ?? item.text?.content ?? "").join("");
  return text ? `<figcaption>${escapeHtml(text)}</figcaption>` : "";
}

// Preserve rich-text annotations, matching what the docx export keeps.
function runsHtml(richText = []) {
  return richText
    .map((item) => {
      if (item.type === "equation") return renderLatex(item.equation?.expression ?? item.plain_text ?? "");
      const text = renderOperators(richTextContent(item));
      if (!text) return "";
      const a = item.annotations ?? {};
      const style = [];
      if (a.color && a.color !== "default" && !a.color.endsWith("_background")) style.push(`color:${colorOf(a.color)}`);
      const bg = backgroundOf(a.color);
      if (bg) style.push(`background-color:${bg}`);
      let html = text;
      if (a.code) html = `<code>${html}</code>`;
      if (a.bold) html = `<strong>${html}</strong>`;
      if (a.italic) html = `<em>${html}</em>`;
      if (a.underline) html = `<u>${html}</u>`;
      if (a.strikethrough) html = `<s>${html}</s>`;
      return style.length ? `<span style="${style.join(";")}">${html}</span>` : html;
    })
    .join("");
}

function blockHtml(block, depth) {
  const value = block[block.type] ?? {};
  const runs = () => runsHtml(value.rich_text ?? []);
  const indent = { style: `margin-left:${depth * 18}px` };
  switch (block.type) {
    case "heading_1":
      return `<h1>${runs()}</h1>`;
    case "heading_2":
      return `<h2>${runs()}</h2>`;
    case "heading_3":
      return `<h3>${runs()}</h3>`;
    case "bulleted_list_item":
      return `<ul><li${depth ? ` data-depth="${depth}"` : ""}>${runs()}</li></ul>`;
    case "numbered_list_item":
      return `<ol><li${depth ? ` data-depth="${depth}"` : ""}>${runs()}</li></ol>`;
    case "to_do":
      return `<p class="todo"${depth ? ` style="margin-left:${depth * 18}px"` : ""}>${value.checked ? "☑" : "☐"} ${runs()}</p>`;
    case "quote":
      return `<blockquote${depth ? ` style="margin-left:${depth * 18}px"` : ""}>${runs()}</blockquote>`;
    case "code":
      return `<pre class="code-block"><code class="language-${escapeHtml(value.language ?? "text")}">${renderCode(value.rich_text?.map(richTextContent).join("") ?? "", value.language)}</code></pre>${captionHtml(value.caption)}`;
    case "callout":
      return `<div class="callout"${depth ? ` style="margin-left:${depth * 18}px"` : ""}>💡 ${runs()}</div>`;
    case "equation":
      return `<div class="equation">${renderLatex(value.expression ?? "", true)}</div>`;
    case "image": {
      const url = imageUrl(value);
      if (!url) return `<p class="image-fallback">${captionHtml(value.caption) || "Image indisponible"}</p>`;
      return `<figure class="notion-image"><img src="${escapeHtml(url)}" alt="${escapeHtml(value.caption?.map((item) => item.plain_text ?? item.text?.content ?? "").join("") ?? "")}" />${captionHtml(value.caption)}</figure>`;
    }
    case "divider":
      return `<hr />`;
    case "table_row":
      return `<p class="table-row"${depth ? ` style="margin-left:${depth * 18}px"` : ""}>${(value.cells ?? []).map((cell) => runsHtml(cell)).join(" &nbsp;|&nbsp; ")}</p>`;
    default: {
      if (Array.isArray(value.rich_text) && value.rich_text.length) return `<p${depth ? ` style="margin-left:${depth * 18}px"` : ""}>${runs()}</p>`;
      return "";
    }
  }
}

async function blocksHtml(notion, parentId, depth = 0) {
  const parts = [];
  for (const block of await allChildren(notion, parentId)) {
    parts.push(blockHtml(block, depth));
    if (block.has_children && block.type !== "table") parts.push(await blocksHtml(notion, block.id, depth + 1));
  }
  return parts.join("\n");
}

const SIZE_PRESETS = {
  small: { scale: 0.82, spacing: 0.72 },
  medium: { scale: 0.82, spacing: 1 },
  large: { scale: 1, spacing: 1 },
};

function sizePreset(value) {
  if (typeof value === "number") {
    if (value >= 3) return SIZE_PRESETS.large;
    return SIZE_PRESETS.medium;
  }
  return SIZE_PRESETS[value] ?? SIZE_PRESETS.large;
}

// Génère la feuille de style d'impression. `size` module l'échelle typographique.
// Les titres gardent `break-after: avoid` (ne jamais finir une page sur un
// titre orphelin), mais aucun bloc n'impose `break-inside: avoid` : un contenu
// plus haut que la page doit pouvoir se répartir au lieu de laisser un blanc.
function styles(size = 3, forPdf = false) {
  const preset = sizePreset(size);
  const s = preset.scale;
  const spacing = preset.spacing;
  const imageMaxHeight = size === "small" || size === 1 ? 140 : size === "medium" || size === 2 ? 190 : 240;
  const pt = (base) => `${(base * s).toFixed(2)}pt`;
  const step = (base) => `${(base * s * spacing).toFixed(2)}pt`;
  // En mode PDF serveur, les marges sont imposées par Puppeteer : on ne les
  // déclare donc pas dans @page pour éviter un double espacement.
  const pageRule = forPdf
    ? "@page { size: A4; }"
    : "@page { size: A4; margin: 20mm 21mm; }";
  return `
  ${pageRule}
  * { box-sizing: border-box; }
  body { font-family: Calibri, "Segoe UI", system-ui, sans-serif; font-size: ${pt(11)}; line-height: 1.35; color: #28303A; margin: 0; }
  .title { font-size: ${pt(25)}; font-weight: 700; color: #1D364F; margin: 0 0 ${step(14)}; line-height: 1.15; }
  h1 { font-size: ${pt(15)}; font-weight: 700; color: #1D4F69; margin: ${step(10)} 0 ${step(5)}; break-after: avoid; page-break-after: avoid; }
  h2 { font-size: ${pt(13)}; font-weight: 700; color: #1D4F69; margin: ${step(9)} 0 ${step(4)}; break-after: avoid; page-break-after: avoid; }
  h3 { font-size: ${pt(12)}; font-weight: 700; color: #1D4F69; margin: ${step(8)} 0 ${step(4)}; break-after: avoid; page-break-after: avoid; }
  p { margin: 0 0 ${step(4)}; orphans: 3; widows: 3; }
  ul, ol { margin: 0 0 ${step(4)}; padding-left: ${step(22)}; }
  li { margin: 0 0 ${step(2)}; }
  li[data-depth] { list-style: none; }
  blockquote { margin: 0 0 ${step(4)} 8pt; padding: 1pt 0 1pt 10pt; border-left: 3px solid #D3D1CB; font-style: italic; }
  pre { margin: 0 0 ${step(6)}; padding: ${step(6)} 8pt; background: #F1F1EF; font-family: Consolas, "Courier New", monospace; font-size: ${pt(10)}; white-space: pre-wrap; word-break: break-word; overflow-wrap: anywhere; }
  .code-block code { display: block; padding: 0; background: transparent; border-radius: 0; }
  .hljs-comment, .hljs-quote { color: #6A737D; font-style: italic; }
  .hljs-keyword, .hljs-selector-tag, .hljs-literal { color: #7A3E9D; }
  .hljs-string, .hljs-attr, .hljs-template-variable { color: #2A7B4F; }
  .hljs-number, .hljs-symbol, .hljs-bullet { color: #B05A00; }
  .hljs-title, .hljs-section, .hljs-name { color: #1D4F69; font-weight: 600; }
  .hljs-built_in, .hljs-type, .hljs-variable { color: #9C3A2E; }
  code { font-family: Consolas, "Courier New", monospace; font-size: 0.92em; background: #F1F1EF; padding: 0 2px; border-radius: 2px; }
  @font-face { font-family: "Fira Code Export"; src: url("${FIRA_CODE_FONT}") format("woff2"); font-weight: 400; font-style: normal; }
  .operator { color: inherit; font-family: "Fira Code Export", monospace; font-variant-ligatures: contextual; font-feature-settings: "calt" 1; }
  .callout { margin: 0 0 ${step(6)}; padding: ${step(6)} 8pt; background: #F7F7F5; border-radius: 3px; }
  .todo { margin: 0 0 ${step(3)}; }
  .equation { margin: 0 0 ${step(6)}; overflow-x: auto; }
  .katex-display { margin: 0; overflow-x: auto; overflow-y: hidden; }
  .notion-image { margin: 0 0 ${step(6)}; text-align: center; }
  .notion-image img { display: block; max-width: 100%; max-height: ${imageMaxHeight}mm; height: auto; margin: 0 auto; object-fit: contain; }
  .notion-image figcaption, .image-fallback figcaption { margin-top: ${step(2)}; color: #787774; font-size: ${pt(9)}; text-align: center; }
  .image-fallback { color: #9C3A2E; font-style: italic; }
  .table-row { margin: 0 0 ${step(3)}; font-size: ${pt(10.5)}; }
  hr { border: none; border-top: 1px solid #D3D1CB; margin: ${step(8)} 0; }
  .lesson + .lesson { break-before: page; page-break-before: always; }
`;
}

export async function exportLessonHtml(input, { size = 3, forPdf = false } = {}) {
  const lessons = Array.isArray(input) ? input : (input?.id ? [input] : [{ id: arguments[0], name: arguments[1] }]);
  const notion = getNotion();
  const sections = [];

  for (const lesson of lessons) {
    const cards = [];
    const pages = await allRows(notion, lesson.id);
    for (const page of pages) {
      cards.push(`<section class="card">\n<h1>${escapeHtml(titleOf(page))}</h1>\n${await blocksHtml(notion, page.id)}</section>`);
    }
    sections.push(`<article class="lesson">\n<p class="title">Définitions de philosophie — ${escapeHtml(lesson.name)}</p>\n${cards.join("\n")}\n</article>`);
  }

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Définitions de philosophie</title>
<style>${styles(size, forPdf)}</style>
<style>${KATEX_CSS}</style>
</head>
<body>
${sections.join("\n")}
</body>
</html>`;
}
