import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

// Pied de page « Page X/Y » en bas à droite. Chrome injecte pageNumber /
// totalPages via ses classes CSS dédiées dans displayHeaderFooter.
function footerTemplate() {
  return `
    <div style="
      font-size:9px;
      width:100%;
      padding:0 15mm 8px 15mm;
      display:flex;
      justify-content:flex-end;
      color:#8A8F98;
      font-family:Calibri,'Segoe UI',system-ui,sans-serif;
    ">
      <span>Page <span class="pageNumber"></span>/<span class="totalPages"></span></span>
    </div>`;
}

// Rend la page HTML en PDF A4 via Chromium headless. `margin` reprend les
// gouttières de la mise en page HTML pour que le contenu tombe juste.
export async function renderPdf(html, { marginMm = 20 } = {}) {
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });
  try {
    const page = await browser.newPage();
    // Le HTML embarque sa propre mise en page d'impression ; on ne laisse pas
    // Chromium appliquer une seconde fois des marges par défaut.
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: footerTemplate(),
      margin: { top: `${marginMm}mm`, bottom: `${marginMm}mm`, left: `${marginMm}mm`, right: `${marginMm}mm` },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
