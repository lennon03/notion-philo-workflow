import { jsPDF } from "jspdf";
import { allChildren, allRows, getNotion, titleOf, plainText } from "./notion";

const MARGIN = 15;
const PAGE_WIDTH = 210;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function ensureSpace(doc, y, needed) {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed > pageHeight - MARGIN) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

async function renderBlocks(doc, notion, parentId, depth, yRef) {
  let y = yRef.y;
  for (const block of await allChildren(notion, parentId)) {
    const value = block[block.type] ?? {};
    const indent = depth * 6;
    const maxWidth = CONTENT_WIDTH - indent;
    const x = MARGIN + indent;
    switch (block.type) {
      case "heading_1":
      case "heading_2":
      case "heading_3": {
        const size = block.type === "heading_1" ? 14 : block.type === "heading_2" ? 13 : 12;
        const text = plainText(value.rich_text ?? []);
        y = ensureSpace(doc, y, size * 0.5 + 4);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(size);
        doc.setTextColor(29, 79, 105);
        const lines = doc.splitTextToSize(text, maxWidth);
        doc.text(lines, x, y);
        y += lines.length * (size * 0.45) + 3;
        break;
      }
      case "bulleted_list_item":
      case "numbered_list_item": {
        const text = plainText(value.rich_text ?? []);
        y = ensureSpace(doc, y, 6);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(40, 48, 58);
        const lines = doc.splitTextToSize(`• ${text}`, maxWidth);
        doc.text(lines, x, y);
        y += lines.length * 4.5 + 2;
        break;
      }
      case "to_do": {
        const text = plainText(value.rich_text ?? []);
        y = ensureSpace(doc, y, 6);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(40, 48, 58);
        const lines = doc.splitTextToSize(`${value.checked ? "☑ " : "☐ "}${text}`, maxWidth);
        doc.text(lines, x, y);
        y += lines.length * 4.5 + 2;
        break;
      }
      case "quote": {
        const text = plainText(value.rich_text ?? []);
        y = ensureSpace(doc, y, 6);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(11);
        doc.setTextColor(40, 48, 58);
        const lines = doc.splitTextToSize(text, maxWidth);
        doc.text(lines, x + 4, y);
        y += lines.length * 4.5 + 2;
        break;
      }
      case "code": {
        const text = plainText(value.rich_text ?? []);
        y = ensureSpace(doc, y, 6);
        doc.setFont("courier", "normal");
        doc.setFontSize(10);
        doc.setTextColor(40, 48, 58);
        const lines = doc.splitTextToSize(text, maxWidth);
        doc.text(lines, x, y);
        y += lines.length * 4 + 2;
        break;
      }
      case "callout": {
        const text = plainText(value.rich_text ?? []);
        y = ensureSpace(doc, y, 6);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(40, 48, 58);
        const lines = doc.splitTextToSize(`💡 ${text}`, maxWidth);
        doc.text(lines, x, y);
        y += lines.length * 4.5 + 2;
        break;
      }
      case "equation": {
        const text = value.expression ?? "";
        y = ensureSpace(doc, y, 6);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(11);
        doc.setTextColor(40, 48, 58);
        const lines = doc.splitTextToSize(text, maxWidth);
        doc.text(lines, x, y);
        y += lines.length * 4.5 + 2;
        break;
      }
      case "divider": {
        y = ensureSpace(doc, y, 6);
        doc.setDrawColor(211, 209, 203);
        doc.line(x, y, x + maxWidth, y);
        y += 4;
        break;
      }
      default: {
        if (Array.isArray(value.rich_text) && value.rich_text.length) {
          const text = plainText(value.rich_text);
          y = ensureSpace(doc, y, 6);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(11);
          doc.setTextColor(40, 48, 58);
          const lines = doc.splitTextToSize(text, maxWidth);
          doc.text(lines, x, y);
          y += lines.length * 4.5 + 2;
        }
      }
    }
    if (block.has_children) {
      const nested = await renderBlocks(doc, notion, block.id, depth + 1, { y });
      y = nested.y;
    }
  }
  yRef.y = y;
  return yRef;
}

export async function exportLessonPdf(input) {
  const lessons = Array.isArray(input) ? input : (input?.id ? [input] : [{ id: arguments[0], name: arguments[1] }]);
  const notion = getNotion();

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const state = { y: MARGIN };

  for (const lesson of lessons) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(29, 54, 79);
    const titleLines = doc.splitTextToSize(`Définitions de philosophie — ${lesson.name}`, CONTENT_WIDTH);
    doc.text(titleLines, MARGIN, state.y);
    state.y += titleLines.length * 9 + 4;

    const pages = await allRows(notion, lesson.id);
    for (const page of pages) {
      state.y = ensureSpace(doc, state.y, 8);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(29, 79, 105);
      const pageLines = doc.splitTextToSize(titleOf(page), CONTENT_WIDTH);
      doc.text(pageLines, MARGIN, state.y);
      state.y += pageLines.length * 6 + 2;
      await renderBlocks(doc, notion, page.id, 0, state);
      state.y += 4;
    }
  }

  return Buffer.from(doc.output("arraybuffer"));
}
