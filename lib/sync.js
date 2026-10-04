import { CACHE_MARKER_PREFIX, allRows, cloneChildren, findOrCreateCache, replaceBlocks, titleOf, writableRichText } from "./notion";

// Synchronise le cache d'une leçon (table) donnée.
// lesson: { id: data-source id de la table, name: nom affiché }.
// Retourne { lesson, cards, cacheUrl }. Partagé entre /api/sync (protégé
// par TOKEN_PWD) et /api/mcp (MCP public, sans auth : le secret Notion
// reste côté serveur dans tous les cas).
export async function syncLesson(notion, lesson) {
  if (!lesson?.id) throw new Error("Choisissez une leçon à synchroniser (lesson_id manquant).");
  const cards = await allRows(notion, lesson.id);
  const blocks = [
    {
      object: "block",
      type: "code",
      code: {
        language: "plain text",
        rich_text: [{ type: "text", text: { content: `${CACHE_MARKER_PREFIX}${lesson.id}` } }],
      },
    },
  ];
  for (const card of cards) {
    const property = Object.values(card.properties ?? {}).find((value) => value?.type === "title");
    const title = property
      ? writableRichText(property.title)
      : [{ type: "text", text: { content: titleOf(card).slice(0, 2000) } }];
    blocks.push({
      object: "block",
      type: "toggle",
      toggle: { rich_text: title, children: await cloneChildren(notion, card.id) },
    });
  }
  const cache = await findOrCreateCache(notion, lesson.id);
  await replaceBlocks(notion, cache.id, blocks);
  return { lesson: lesson.name ?? lesson.id, cards: cards.length, cacheUrl: cache.url };
}
