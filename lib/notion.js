import { Client } from "@notionhq/client";

// Nom du seul champ titre attendu dans une table de leçon.
export const FRONT_PROPERTY = "Front";

export function getNotion(token) {
  const auth = token || process.env.NOTION_TOKEN;
  if (!auth) throw new Error("Fournissez un token Notion dans l'URL ou configurez NOTION_TOKEN.");
  return new Client({ auth });
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

export async function pageInfo(notion, pageId) {
  const page = await notion.pages.retrieve({ page_id: pageId });
  return { id: page.id, name: titleOf(page), type: "page" };
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
