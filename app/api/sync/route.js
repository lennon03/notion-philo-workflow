import { getRequestToken, isAuthorized, unauthorizedResponse } from "../../../lib/auth";
import { getNotion } from "../../../lib/notion";
import { syncLesson } from "../../../lib/sync";

export const runtime = "nodejs";

export async function POST(request) {
  if (!isAuthorized(getRequestToken(request))) return unauthorizedResponse();
  try {
    const { lessons } = await request.json();
    if (!Array.isArray(lessons) || lessons.length === 0) return Response.json({ error: "Sélectionnez au moins une leçon." }, { status: 400 });
    const notion = getNotion();
    const results = [];
    for (const lesson of lessons) {
      results.push(await syncLesson(notion, lesson));
    }
    return Response.json({ results });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error.body || error.message || "La synchronisation a échoué." }, { status: 500 });
  }
}
