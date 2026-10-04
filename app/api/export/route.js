import { exportLesson } from "../../../lib/export-docx";

export const runtime = "nodejs";

function filename(name) { return `${name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "lecon"}.docx`; }

export async function POST(request) {
  try {
    const { lesson } = await request.json();
    if (!lesson?.id || !lesson?.name) return Response.json({ error: "Choisissez une leçon à exporter." }, { status: 400 });
    const document = await exportLesson(lesson.id, lesson.name);
    return new Response(document, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename=\"${filename(lesson.name)}\"` } });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error.body || error.message || "L’export Word a échoué." }, { status: 500 });
  }
}
