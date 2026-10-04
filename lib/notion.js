import { Client } from "@notionhq/client";

export const CACHE_TITLE = "- cache -";
export const CACHE_MARKER_PREFIX = "philo-cache:data-source=";

export function getNotion() {
  if (!process.env.NOTION_TOKEN) throw new Error("La variable serveur NOTION_TOKEN est absente.");
  return new Client({ auth: process.env.NOTION_TOKEN });
}

export function plainText(richText = []) {
  return richText.map((item) => item.plain_text ?? item.text?.content ?? "").join("");
}

export function titleOf(page) {
  const property = Object.values(page.properties ?? {}).find((value) => value?.type === "title");
  return property ? plainText(property.title) : "Sans titre";
}

export function textBlocks(text) {
  const pieces = (text || "").match(/[\s\S]{1,1900}/g) ?? ["Réponse vide"];
  return pieces.map((content) => ({ object: "block", type: "paragraph", paragraph: { rich_text: content ? [{ type: "text", text: { content } }] : [] } }));
}

async function allChildren(notion, blockId) {
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

export async function findOrCreateCache(notion, dataSourceId) {
  const parentId = process.env.NOTION_PARENT_PAGE_ID;
  if (!parentId) throw new Error("La variable NOTION_PARENT_PAGE_ID est absente.");
  const candidates = await allChildren(notion, parentId);
  for (const candidate of candidates.filter((item) => item.type === "child_page" && item.child_page.title === CACHE_TITLE)) {
    const children = await allChildren(notion, candidate.id);
    const marker = children.find((block) => block.type === "code" && plainText(block.code.rich_text).trim() === `${CACHE_MARKER_PREFIX}${dataSourceId}`);
    if (marker) return candidate;
  }
  const created = await notion.pages.create({ parent: { page_id: parentId }, properties: { title: { title: [{ type: "text", text: { content: CACHE_TITLE } }] } } });
  return created;
}

export async function replaceBlocks(notion, pageId, blocks) {
  const existing = await allChildren(notion, pageId);
  for (const block of existing) await notion.blocks.delete({ block_id: block.id });
  for (let index = 0; index < blocks.length; index += 100) await notion.blocks.children.append({ block_id: pageId, children: blocks.slice(index, index + 100) });
}
