import { Client } from "@notionhq/client";

// Page conteneur regroupant tous les caches, enfant de NOTION_PARENT_PAGE_ID.
export const CARDS_PAGE_TITLE = "Card";
// Nom du seul champ titre attendu dans une table de leçon.
export const FRONT_PROPERTY = "Front";
// Chaque cache s'appelle "<nom de la leçon> Cards" et vit sous la page "Card".
export const CACHE_TITLE_SUFFIX = " Cards";
// Marqueur technique interne : identifie le cache d'une table même si la page
// est renommée manuellement.
export const CACHE_MARKER_PREFIX = "philo-cache:data-source=";

export function cachePageTitle(lessonName) {
  return `${(lessonName || "Leçon").trim()}${CACHE_TITLE_SUFFIX}`;
}

export function getNotion() {
  if (!process.env.NOTION_TOKEN) throw new Error("La variable serveur NOTION_TOKEN est absente.");
  return new Client({ auth: process.env.NOTION_TOKEN });
}

export function plainText(richText = []) {
  return richText.map((item) => item.plain_text ?? item.text?.content ?? "").join("");
}

// Remove Notion read-only display fields while retaining the actual formatting.
export function writableRichText(items = []) {
  return items.map((item) => {
    const annotations = item.annotations;
    if (item.type === "text") return { type: "text", text: { content: item.text?.content ?? item.plain_text ?? "", ...(item.text?.link ? { link: item.text.link } : {}) }, annotations };
    if (item.type === "equation") return { type: "equation", equation: { expression: item.equation?.expression ?? item.plain_text ?? "" }, annotations };
    if (item.type === "mention") return { type: "mention", mention: item.mention, annotations };
    return { type: "text", text: { content: item.plain_text ?? "" }, annotations };
  });
}

export function titleOf(page) {
  const property = Object.values(page.properties ?? {}).find((value) => value?.type === "title");
  return property ? plainText(property.title) : "Sans titre";
}

export function textBlocks(text) {
  const pieces = (text || "").match(/[\s\S]{1,1900}/g) ?? ["Réponse vide"];
  return pieces.map((content) => ({ object: "block", type: "paragraph", paragraph: { rich_text: content ? [{ type: "text", text: { content } }] : [] } }));
}

export async function allChildren(notion, blockId) {
  const blocks = [];
  let cursor;
  do {
    const result = await notion.blocks.children.list({ block_id: blockId, page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) });
    blocks.push(...result.results);
    cursor = result.has_more ? result.next_cursor : undefined;
  } while (cursor);
  return blocks;
}

function copyBlock(block, children) {
  const value = block[block.type] ?? {};
  const rich = { rich_text: writableRichText(value.rich_text ?? []), ...(value.color && value.color !== "default" ? { color: value.color } : {}) };
  const nested = (content) => ({ object: "block", type: block.type, [block.type]: { ...content, ...(children.length ? { children } : {}) } });
  if (["paragraph", "heading_1", "heading_2", "heading_3", "bulleted_list_item", "numbered_list_item", "quote", "toggle"].includes(block.type)) return nested(rich);
  if (block.type === "to_do") return nested({ ...rich, checked: value.checked });
  if (block.type === "callout") return nested({ ...rich, icon: value.icon ?? undefined });
  if (block.type === "code") return nested({ rich_text: writableRichText(value.rich_text ?? []), caption: writableRichText(value.caption ?? []), language: value.language ?? "plain text" });
  if (block.type === "equation") return { object: "block", type: "equation", equation: { expression: value.expression ?? "" } };
  if (block.type === "divider") return { object: "block", type: "divider", divider: {} };
  if (block.type === "bookmark") return { object: "block", type: "bookmark", bookmark: { url: value.url, caption: writableRichText(value.caption ?? []) } };
  if (block.type === "table_row") return { object: "block", type: "table_row", table_row: { cells: (value.cells ?? []).map(writableRichText) } };
  if (block.type === "table") return nested({ table_width: value.table_width, has_column_header: value.has_column_header, has_row_header: value.has_row_header });
  const fallback = plainText(value.caption ?? []) || value.url || `[${block.type}]`;
  return { object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: fallback } }] } };
}

export async function cloneChildren(notion, parentId) {
  const result = [];
  for (const block of await allChildren(notion, parentId)) result.push(copyBlock(block, block.has_children ? await cloneChildren(notion, block.id) : []));
  return result;
}

function blockText(block) {
  const value = block[block.type] ?? {};
  if (Array.isArray(value.rich_text)) return plainText(value.rich_text);
  if (block.type === "equation") return value.expression ?? "";
  if (block.type === "table_row") return (value.cells ?? []).map(plainText).join("\t");
  if (["bookmark", "link_preview"].includes(block.type)) return value.url ?? "";
  if (["child_page", "child_database"].includes(block.type)) return value.title ?? "";
  return "";
}

export async function pageBodyText(notion, pageId) {
  const lines = [];
  async function visit(id, depth = 0) {
    for (const block of await allChildren(notion, id)) {
      const text = blockText(block);
      if (text) lines.push(`${"  ".repeat(depth)}${text}`);
      if (block.has_children) await visit(block.id, depth + 1);
    }
  }
  await visit(pageId);
  return lines.join("\n").trim();
}

export async function allRows(notion, dataSourceId) {
  const pages = [];
  let cursor;
  do {
    const result = await notion.dataSources.query({ data_source_id: dataSourceId, page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) });
    pages.push(...result.results);
    cursor = result.has_more ? result.next_cursor : undefined;
  } while (cursor);
  return pages;
}

export async function lessons() {
  const configured = process.env.NOTION_LESSONS_JSON;
  if (configured) return JSON.parse(configured);
  const notion = getNotion();
  const parentId = process.env.NOTION_PARENT_PAGE_ID;
  if (!parentId) throw new Error("La variable NOTION_PARENT_PAGE_ID est absente.");
  const blocks = await allChildren(notion, parentId);
  const result = [];
  for (const block of blocks.filter((item) => item.type === "child_database")) {
    const database = await notion.databases.retrieve({ database_id: block.id });
    const source = database.data_sources?.[0];
    if (source) result.push({ id: source.id, name: block.child_database.title || source.name || "Leçon sans titre" });
  }
  return result;
}

export async function findOrCreateCardsPage(notion) {
  const parentId = process.env.NOTION_PARENT_PAGE_ID;
  if (!parentId) throw new Error("La variable NOTION_PARENT_PAGE_ID est absente.");
  const children = await allChildren(notion, parentId);
  const existing = children.find((item) => item.type === "child_page" && item.child_page.title === CARDS_PAGE_TITLE);
  if (existing) return existing;
  const created = await notion.pages.create({
    parent: { page_id: parentId },
    properties: { title: { title: [{ type: "text", text: { content: CARDS_PAGE_TITLE } }] } },
  });
  return { id: created.id, child_page: { title: CARDS_PAGE_TITLE } };
}

// Cache d'une leçon : une page par table, sous la page conteneur "Card".
// Retrouvée via le marqueur interne, pas via le titre, pour survivre à un
// renommage manuel de la page. Sinon une page "<leçon> Cards" est créée ; son
// contenu est ensuite écrit par replaceBlocks.
export async function findOrCreateCache(notion, dataSourceId, lessonName) {
  const cardsPage = await findOrCreateCardsPage(notion);
  const candidates = await allChildren(notion, cardsPage.id);
  for (const candidate of candidates.filter((item) => item.type === "child_page")) {
    const children = await allChildren(notion, candidate.id);
    const marker = children.find((block) => block.type === "code" && plainText(block.code.rich_text).trim() === `${CACHE_MARKER_PREFIX}${dataSourceId}`);
    if (marker) {
      // Un bloc child_page ne porte pas d'url : il faut relire la page pour
      // pouvoir renvoyer cacheUrl à l'appelant.
      const page = await notion.pages.retrieve({ page_id: candidate.id });
      return { id: candidate.id, url: page.url, child_page: candidate.child_page };
    }
  }
  const title = cachePageTitle(lessonName);
  const created = await notion.pages.create({
    parent: { page_id: cardsPage.id },
    properties: { title: { title: [{ type: "text", text: { content: title } }] } },
  });
  return { id: created.id, url: created.url, child_page: { title } };
}

// Crée une table de leçon enfant de NOTION_PARENT_PAGE_ID, avec une unique
// propriété titre nommée exactement "Front". La réponse expose data_sources[0],
// dont l'id est le lesson_id utilisé par le MCP.
export async function createLessonTable(notion, name) {
  const parentId = process.env.NOTION_PARENT_PAGE_ID;
  if (!parentId) throw new Error("La variable NOTION_PARENT_PAGE_ID est absente.");
  const database = await notion.databases.create({
    parent: { type: "page_id", page_id: parentId },
    title: [{ type: "text", text: { content: name } }],
    initial_data_source: { properties: { [FRONT_PROPERTY]: { title: {} } } },
  });
  const dataSource = database.data_sources?.[0];
  if (!dataSource) throw new Error("La table a été créée mais Notion n'a pas renvoyé de data source.");
  return { id: dataSource.id, name, databaseId: database.id, url: database.url };
}

export async function replaceBlocks(notion, pageId, blocks) {
  const existing = await allChildren(notion, pageId);
  for (const block of existing) await notion.blocks.delete({ block_id: block.id });
  for (let index = 0; index < blocks.length; index += 100) await notion.blocks.children.append({ block_id: pageId, children: blocks.slice(index, index + 100) });
}
