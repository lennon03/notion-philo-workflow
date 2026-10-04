import { lessons } from "../../../lib/notion";

export const runtime = "nodejs";

export async function GET() {
  try {
    return Response.json({ lessons: await lessons() });
  } catch (error) {
    return Response.json({ error: error.message || "Impossible de lire les leçons Notion." }, { status: 500 });
  }
}
