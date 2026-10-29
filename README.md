# Notion Table Exporter

Export content from Notion pages that use tables into clean, readable documents.

This tool is useful for Notion pages where the content you want to export is stored inside one or more tables. Select the tables you need, choose an export format, and download the result.

![Example exported document](docs/example-export.png)

## What it supports

- Export one or multiple Notion tables together
- HTML, Word (`.docx`), and PDF-ready exports
- Code blocks and inline code
- LaTeX formulas
- Images
- Lists, headings, paragraphs, dividers, and other common Notion content

## Exporting a page

1. Open the exporter.
2. Paste the link to a Notion page containing your tables.
3. Select the tables to include.
4. Choose the text size when exporting HTML or PDF.
5. Click the format you want:
   - **HTML** — download an HTML document.
   - **Word** — download a `.docx` document.
   - **PDF** — open a print-ready document and choose **Save as PDF** in your browser.

The exporter uses the page link directly. Make sure the page is shared with the exporter before opening it.

## Connect your Notion account

Create an internal integration at https://www.notion.so/my-integrations and share each target page with it. Enter the token in the settings panel, or use `NOTION_API_TOKEN` / a `.env` file.

The link above is where you create the integration and get your token.

## PDF limitations

PDF export is experimental. Font ligatures may not render perfectly, and there may be other minor formatting quirks because the PDF is generated through the browser's print workflow.

## Embed a single table

To show one table directly in the export interface, use:

```text
/embed/<page_or_table_id>
```
