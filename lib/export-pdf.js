import PDFDocument from "pdfkit";
import { allChildren, allRows, getNotion, titleOf } from "./notion";

function fontFor(annotations = {}) {
  if (annotations.code) return "Courier";
  if (annotations.bold && annotations.italic) return "Helvetica-BoldOblique";
  if (annotations.bold) return "Helvetica-Bold";
  if (annotations.italic) return "Helvetica-Oblique";
  return "Helvetica";
}

function renderRichText(doc, richText, options = {}) {
  const items = richText ?? [];
  if (!items.length) {
    doc.text("", options);
    return;
  }
  items.forEach((item, index) => {
    const annotations = item.annotations ?? {};
    doc.font(fontFor(annotations)).fontSize(options.fontSize ?? 11).fillColor(options.color ?? "#28303A");
    const text = item.plain_text ?? item.text?.content ?? "";
    doc.text(text, { ...options, continued: index < items.length - 1 });
  });
  doc.text("", { continued: false });
}

async function renderBlocks(doc, notion, parentId, depth = 0) {
  for (const block of await allChildren(notion, parentId)) {
    const value = block[block.type] ?? {};
    const indent = depth * 16;
    switch (block.type) {
      case "heading_1":
        doc.moveDown(0.3);
        doc.font("Helvetica-Bold").fontSize(14).fillColor("#1D4F69");
        renderRichText(doc, value.rich_text, { indent, fontSize: 14, color: "#1D4F69" });
        doc.moveDown(0.1);
        break;
      case "heading_2":
        doc.moveDown(0.25);
        doc.font("Helvetica-Bold").fontSize(13).fillColor("#1D4F69");
        renderRichText(doc, value.rich_text, { indent, fontSize: 13, color: "#1D4F69" });
        doc.moveDown(0.1);
        break;
      case "heading_3":
        doc.moveDown(0.2);
        doc.font("Helvetica-Bold").fontSize(12).fillColor("#1D4F69");
        renderRichText(doc, value.rich_text, { indent, fontSize: 12, color: "#1D4F69" });
        doc.moveDown(0.1);
        break;
      case "bulleted_list_item":
        doc.font("Helvetica").fontSize(11).fillColor("#28303A");
        doc.text("• ", { indent, continued: true });
        renderRichText(doc, value.rich_text, { indent: 0, fontSize: 11, color: "#28303A" });
        doc.moveDown(0.15);
        break;
      case "numbered_list_item":
        doc.font("Helvetica").fontSize(11).fillColor("#28303A");
        doc.text("• ", { indent, continued: true });
        renderRichText(doc, value.rich_text, { indent: 0, fontSize: 11, color: "#28303A" });
        doc.moveDown(0.15);
        break;
      case "to_do":
        doc.font("Helvetica").fontSize(11).fillColor("#28303A");
        doc.text(value.checked ? "☑ " : "☐ ", { indent, continued: true });
        renderRichText(doc, value.rich_text, { indent: 0, fontSize: 11, color: "#28303A" });
        doc.moveDown(0.15);
        break;
      case "quote":
        doc.font("Helvetica-Oblique").fontSize(11).fillColor("#28303A");
        renderRichText(doc, value.rich_text, { indent: indent + 12, fontSize: 11, color: "#28303A" });
        doc.moveDown(0.15);
        break;
      case "code":
        doc.font("Courier").fontSize(10).fillColor("#28303A");
        renderRichText(doc, value.rich_text, { indent, fontSize: 10, color: "#28303A" });
        doc.moveDown(0.15);
        break;
      case "callout":
        doc.font("Helvetica").fontSize(11).fillColor("#28303A");
        doc.text("💡 ", { indent, continued: true });
        renderRichText(doc, value.rich_text, { indent: 0, fontSize: 11, color: "#28303A" });
        doc.moveDown(0.15);
        break;
      case "equation":
        doc.font("Helvetica-Oblique").fontSize(11).fillColor("#28303A");
        doc.text(value.expression ?? "", { indent });
        doc.moveDown(0.15);
        break;
      case "divider":
        doc.moveDown(0.2);
        doc.moveTo(doc.x, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor("#D3D1CB").stroke();
        doc.moveDown(0.2);
        break;
      default:
        if (Array.isArray(value.rich_text) && value.rich_text.length) {
          doc.font("Helvetica").fontSize(11).fillColor("#28303A");
          renderRichText(doc, value.rich_text, { indent, fontSize: 11, color: "#28303A" });
          doc.moveDown(0.15);
        }
    }
    if (block.has_children) await renderBlocks(doc, notion, block.id, depth + 1);
  }
}

export async function exportLessonPdf(dataSourceId, lessonName) {
  const notion = getNotion();
  const pages = await allRows(notion, dataSourceId);

  const doc = new PDFDocument({ size: "A4", margins: { top: 50, bottom: 50, left: 50, right: 50 } });
  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));

  doc.font("Helvetica-Bold").fontSize(22).fillColor("#1D364F").text(`Définitions de philosophie — ${lessonName}`);
  doc.moveDown(0.6);

  for (const page of pages) {
    doc.font("Helvetica-Bold").fontSize(14).fillColor("#1D4F69").text(titleOf(page));
    doc.moveDown(0.2);
    await renderBlocks(doc, notion, page.id, 0);
    doc.moveDown(0.3);
  }

  doc.end();
  await new Promise((resolve) => doc.on("end", resolve));
  return Buffer.concat(chunks);
}
