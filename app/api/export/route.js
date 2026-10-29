import { getRequestToken, isAuthorized, unauthorizedResponse } from "../../../lib/auth";
import { exportLesson } from "../../../lib/export-docx";
import { exportLessonPdf } from "../../../lib/export-pdf";

export const runtime = "nodejs";

function filename(name, ext) { return `${name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "lecon"}.${ext}`; }

export async function POST(request) {
  if (!isAuthorized(getRequestToken(request))) return unauthorizedResponse();
  try {
    const { lesson, format } = await request.json();
    if (!lesson?.id || !lesson?.name) return Response.json({ error: "Choisissez une leçon à exporter." }, { status: 400 });
    if (format === "pdf") {
      const document = await exportLessonPdf(lesson.id, lesson.name);
      return new Response(document, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename=\"${filename(lesson.name, "pdf")}\"` } });
    }
    const document = await exportLesson(lesson.id, lesson.name);
    return new Response(document, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename=\"${filename(lesson.name, "docx")}\"` } });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error.body || error.message || "L’export a échoué." }, { status: 500 });
  }
}
