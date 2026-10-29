import { getRequestToken, isAuthorized, unauthorizedResponse } from "../../../lib/auth";
import { exportLesson } from "../../../lib/export-docx";
import { exportLessonHtml } from "../../../lib/export-html";

export const runtime = "nodejs";

function filename(name, ext) { return `${name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "lecon"}.${ext}`; }

export async function POST(request) {
  if (!isAuthorized(getRequestToken(request))) return unauthorizedResponse();
  try {
    const { lesson, lessons, format } = await request.json();
    const list = Array.isArray(lessons) && lessons.length ? lessons : (lesson?.id ? [lesson] : []);
    if (!list.length || list.some((item) => !item?.id || !item?.name)) return Response.json({ error: "Choisissez au moins une leçon à exporter." }, { status: 400 });
    const baseName = list.length === 1 ? list[0].name : "lecons";
    if (format === "html" || format === "pdf") {
      // La page HTML stylée est ouverte puis imprimée par le navigateur, ce qui
      // donne un PDF nettement plus fidèle qu'une génération PDF programmatique.
      const html = await exportLessonHtml(list);
      return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    const document = await exportLesson(list);
    return new Response(document, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename=\"${filename(baseName, "docx")}\"` } });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error.body || error.message || "L’export a échoué." }, { status: 500 });
  }
}
