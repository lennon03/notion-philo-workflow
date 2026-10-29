import { getRequestToken, requestPageId } from "../../../lib/auth";
import { getNotion, pageInfo } from "../../../lib/notion";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const token = getRequestToken(request);
    const pageId = requestPageId(request);
    if (!pageId) return Response.json({ lessons: [] });
    return Response.json({ lessons: [await pageInfo(getNotion(token), pageId)] });
  } catch (error) {
    return Response.json({ error: error.body || error.message || "Impossible de lire la page Notion." }, { status: error.status || 500 });
  }
}
