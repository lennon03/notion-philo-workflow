import { exportLessonHtml } from "../../lib/export-html";
import { getNotion } from "../../lib/notion";
import { getRequestToken } from "../../lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

// Renders the HTML export live as a normal web page (no file, no storage):
// /view?size=medium&t=<table id>&n=<table name>[&t=…&n=…] (token from the cookie)
export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const ids = params.getAll("t");
  const names = params.getAll("n");
  const lessons = ids.map((id, i) => ({ id, name: names[i] || "Table Notion", type: "table" }));
  if (!lessons.length) return page("Aucune table indiquée dans le lien.", 400);
  try {
    const html = await exportLessonHtml(lessons, { size: params.get("size") || "medium", notion: getNotion(getRequestToken(request)) });
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error(error);
    return page(error.body || error.message || "L’export a échoué.", 500);
  }
}

function page(message, status) {
  const text = String(message).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  return new Response(
    `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Export indisponible</title><body style="font-family:system-ui,sans-serif;max-width:560px;margin:64px auto;padding:0 16px;color:#18181b"><h1 style="font-size:20px;font-weight:600">Export indisponible</h1><p style="color:#71717b">${text}</p></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
