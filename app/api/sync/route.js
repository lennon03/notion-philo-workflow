import { CACHE_MARKER_PREFIX, allRows, cloneChildren, findOrCreateCache, getNotion, replaceBlocks, titleOf, writableRichText } from "../../../lib/notion";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const { lessons } = await request.json();
    if (!Array.isArray(lessons) || lessons.length === 0) return Response.json({ error: "Sélectionnez au moins une leçon." }, { status: 400 });
    const notion = getNotion();
    const results = [];
    for (const lesson of lessons) {
      const cards = await allRows(notion, lesson.id);
      const blocks = [{ object: "block", type: "code", code: { language: "plain text", rich_text: [{ type: "text", text: { content: `${CACHE_MARKER_PREFIX}${lesson.id}` } }] } }];
      for (const card of cards) {
        const property = Object.values(card.properties ?? {}).find((value) => value?.type === "title");
        const title = property ? writableRichText(property.title) : [{ type: "text", text: { content: titleOf(card).slice(0, 2000) } }];
        blocks.push({ object: "block", type: "toggle", toggle: { rich_text: title, children: await cloneChildren(notion, card.id) } });
      }
      const cache = await findOrCreateCache(notion, lesson.id);
      await replaceBlocks(notion, cache.id, blocks);
      results.push({ lesson: lesson.name, cards: cards.length, cacheUrl: cache.url });
    }
    return Response.json({ results });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error.body || error.message || "La synchronisation a échoué." }, { status: 500 });
  }
}
