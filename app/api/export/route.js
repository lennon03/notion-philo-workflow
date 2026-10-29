import { getRequestToken, isAuthorized, unauthorizedResponse } from "../../../lib/auth";
import { exportLesson } from "../../../lib/export-docx";
import { exportLessonHtml } from "../../../lib/export-html";
import { renderPdf } from "../../../lib/pdf";

export const runtime = "nodejs";
// Le rendu PDF via Chromium headless dépasse le délai par défaut froid.
export const maxDuration = 60;

function filename(name, ext) { return `${name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "lecon"}.${ext}`; }

export async function POST(request) {
  if (!isAuthorized(getRequestToken(request))) return unauthorizedResponse();
  try {
    const { lesson, lessons, format, size } = await request.json();
    const list = Array.isArray(lessons) && lessons.length ? lessons : (lesson?.id ? [lesson] : []);
    if (!list.length || list.some((item) => !item?.id || !item?.name)) return Response.json({ error: "Choisissez au moins une leçon à exporter." }, { status: 400 });
    const baseName = list.length === 1 ? list[0].name : "lecons";
    if (format === "pdf") {
      // PDF réel rendu par Chromium headless : marges, fonds imprimés et
      // pied de page « Page X/Y » fournis par puppeteer (displayHeaderFooter).
      const html = await exportLessonHtml(list, { size, forPdf: true });
      const document = await renderPdf(html);
      return new Response(document, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename=\"${filename(baseName, "pdf")}\"` } });
    }
    if (format === "html") {
      // Page HTML imprimable, ouverte puis imprimée par le navigateur.
      const html = await exportLessonHtml(list, { size });
      return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    const document = await exportLesson(list);
    return new Response(document, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename=\"${filename(baseName, "docx")}\"` } });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error.body || error.message || "L’export a échoué." }, { status: 500 });
  }
}
