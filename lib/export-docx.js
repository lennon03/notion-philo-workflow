import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { allRows, getNotion, pageBodyText, titleOf } from "./notion";

// Adapted from the existing export-docx.js: same source-first, read-only behaviour.
export async function exportLesson(dataSourceId, lessonName) {
  const notion = getNotion();
  const pages = await allRows(notion, dataSourceId);
  const children = [
    new Paragraph({ style: "Title", children: [new TextRun({ text: lessonName, bold: true, size: 44, color: "37352F" })] }),
    new Paragraph({ children: [new TextRun({ text: `${pages.length} cartes`, italics: true, color: "787774" })], spacing: { after: 260 } })
  ];
  for (const page of pages) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: titleOf(page), bold: true, size: 28, color: "37352F" })], keepNext: true }));
    const body = await pageBodyText(notion, page.id);
    for (const line of (body || "Réponse vide").split("\n")) children.push(new Paragraph({ children: [new TextRun({ text: line, size: 21, color: "37352F" })], spacing: { after: 80 } }));
  }
  const document = new Document({ sections: [{ children }], styles: { default: { document: { run: { font: "Arial", size: 21 } } } } });
  return Packer.toBuffer(document);
}
