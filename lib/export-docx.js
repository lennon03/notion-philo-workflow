import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { allChildren, allRows, getNotion, titleOf } from "./notion";

const COLORS = { gray: "787774", brown: "9F6B53", orange: "D9730D", yellow: "CB912F", green: "448361", blue: "337EA9", purple: "9065B0", pink: "C14C8A", red: "D44C47" };
function color(value) { return COLORS[value?.replace("_background", "")] ?? "28303A"; }
function runs(richText = []) {
  return richText.map((item) => {
    const a = item.annotations ?? {};
    return new TextRun({ text: item.plain_text ?? item.text?.content ?? "", bold: a.bold, italics: a.italic, strike: a.strikethrough, underline: a.underline ? {} : undefined, font: a.code ? "Consolas" : "Calibri", color: color(a.color), shading: a.color?.endsWith("_background") ? { fill: color(a.color) } : undefined });
  });
}
function paragraphFor(block, depth = 0) {
  const value = block[block.type] ?? {};
  const common = { children: runs(value.rich_text), spacing: { after: 80 }, keepLines: true };
  if (block.type === "heading_1") return new Paragraph({ ...common, heading: HeadingLevel.HEADING_1, keepNext: true });
  if (block.type === "heading_2") return new Paragraph({ ...common, heading: HeadingLevel.HEADING_2, keepNext: true });
  if (block.type === "heading_3") return new Paragraph({ ...common, heading: HeadingLevel.HEADING_3, keepNext: true });
  if (block.type === "bulleted_list_item") return new Paragraph({ ...common, bullet: { level: Math.min(depth, 8) } });
  if (block.type === "numbered_list_item") return new Paragraph({ ...common, children: [new TextRun({ text: `${"  ".repeat(depth)}• ` }), ...runs(value.rich_text)] });
  if (block.type === "to_do") return new Paragraph({ ...common, children: [new TextRun({ text: value.checked ? "☑ " : "☐ " }), ...runs(value.rich_text)] });
  if (block.type === "quote") return new Paragraph({ ...common, indent: { left: 500 }, border: { left: { color: "D3D1CB", space: 8, style: "single", size: 14 } } });
  if (block.type === "code") return new Paragraph({ ...common, shading: { fill: "F1F1EF" } });
  if (block.type === "callout") return new Paragraph({ ...common, children: [new TextRun({ text: "💡 " }), ...runs(value.rich_text)], shading: { fill: "F7F7F5" } });
  if (block.type === "equation") return new Paragraph({ children: [new TextRun({ text: value.expression ?? "", italics: true })], spacing: { after: 80 } });
  if (block.type === "divider") return new Paragraph({ border: { bottom: { color: "D3D1CB", space: 1, style: "single", size: 6 } } });
  return new Paragraph(common);
}
async function pageBodyParagraphs(notion, parentId, depth = 0) {
  const paragraphs = [];
  for (const block of await allChildren(notion, parentId)) {
    paragraphs.push(paragraphFor(block, depth));
    if (block.has_children) paragraphs.push(...await pageBodyParagraphs(notion, block.id, depth + 1));
  }
  return paragraphs;
}
// Preserves Notion rich-text annotations and the principal block structure.
export async function exportLesson(input) {
  const lessons = Array.isArray(input) ? input : (input?.id ? [input] : [{ id: arguments[0], name: arguments[1] }]);
  const notion = getNotion();
  const children = [];
  for (const lesson of lessons) {
    children.push(new Paragraph({ style: "Title", children: [new TextRun({ text: `Définitions de philosophie — ${lesson.name}`, font: "Calibri", size: 50, bold: true, color: "1D364F" })], spacing: { after: 280 } }));
    const pages = await allRows(notion, lesson.id);
    for (const page of pages) {
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: titleOf(page), font: "Calibri", size: 30, bold: true, color: "1D4F69" })], spacing: { before: 200, after: 100 }, keepNext: true }));
      children.push(...await pageBodyParagraphs(notion, page.id));
    }
  }
  const document = new Document({ sections: [{ properties: { page: { margin: { top: 1037, bottom: 1037, left: 1181, right: 1181 } } }, children }], styles: { default: { document: { run: { font: "Calibri", size: 21, color: "28303A" }, paragraph: { spacing: { after: 80 } } } } } });
  return Packer.toBuffer(document);
}
