import { getRequestToken, requestPageId } from "../../../lib/auth";
import { getNotion, pageInfo } from "../../../lib/notion";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const token = getRequestToken(request);
    const pageId = requestPageId(request);
    if (!pageId) return Response.json({ lessons: [] });
    const notion = getNotion(token);
    try {
      const page = await pageInfo(notion, pageId);
      return Response.json({ lessons: page.sources, page: { id: page.id, name: page.name } });
    } catch (pageError) {
      try {
        const database = await notion.databases.retrieve({ database_id: pageId });
        const source = database.data_sources?.[0];
        const name = database.title?.[0]?.plain_text || "Table Notion";
        if (source) return Response.json({ lessons: [{ id: source.id, name, type: "table" }], page: { id: pageId, name } });
      } catch {
        // The identifier may be a data-source ID rather than a database ID.
      }
      try {
        await notion.dataSources.query({ data_source_id: pageId, page_size: 1 });
        return Response.json({ lessons: [{ id: pageId, name: "Table Notion", type: "table" }] });
      } catch {
        throw pageError;
      }
    }
  } catch (error) {
    return Response.json({ error: error.body || error.message || "Impossible de lire la page Notion." }, { status: error.status || 500 });
  }
}
