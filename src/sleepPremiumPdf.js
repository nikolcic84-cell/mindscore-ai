import { jsPDF } from "jspdf";
import { buildSleepPremiumReport } from "./psychology/sleepPremiumReport.js";

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN_X = 22;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const CONTENT_TOP = 30;
const CONTENT_BOTTOM = 275;
const COLORS = {
  paper: [250, 247, 252],
  ink: [45, 37, 56],
  body: [75, 67, 86],
  muted: [127, 116, 139],
  lavender: [148, 116, 187],
  lavenderLight: [235, 226, 246],
  line: [222, 213, 232],
  white: [255, 255, 255],
};

const fillPage = (doc) => {
  doc.setFillColor(...COLORS.paper);
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, "F");
};

const drawPageHeader = (doc) => {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.2);
  doc.setTextColor(...COLORS.muted);
  doc.text("MINDSCORE AI", MARGIN_X, 17);
  doc.setFont("helvetica", "normal");
  doc.text("TVOJA PRIČA O SNU", PAGE_WIDTH - MARGIN_X, 17, { align: "right" });
  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.25);
  doc.line(MARGIN_X, 21, PAGE_WIDTH - MARGIN_X, 21);
};

const drawPageFooter = (doc, page) => {
  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.25);
  doc.line(MARGIN_X, 282, PAGE_WIDTH - MARGIN_X, 282);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  doc.text("MindScore AI · Informativni wellness izveštaj", MARGIN_X, 288);
  doc.text(String(page).padStart(2, "0"), PAGE_WIDTH - MARGIN_X, 288, { align: "right" });
};

const drawWrappedParagraph = (doc, text, x, y, width, options = {}) => {
  const { fontSize = 10.6, lineHeight = 5.6, color = COLORS.body, font = "normal" } = options;
  doc.setFont("helvetica", font);
  doc.setFontSize(fontSize);
  doc.setTextColor(...color);
  const lines = doc.splitTextToSize(text, width);
  lines.forEach((line) => {
    if (y > CONTENT_BOTTOM) return;
    doc.text(line, x, y);
    y += lineHeight;
  });
  return y;
};

const addContentPage = (doc, pageNumber) => {
  doc.addPage();
  fillPage(doc);
  drawPageHeader(doc);
  return { pageNumber: pageNumber + 1, y: CONTENT_TOP };
};

const renderSleepReport = (doc, report) => {
  let pageNumber = 1;
  fillPage(doc);

  // Cover
  doc.setFillColor(...COLORS.lavenderLight);
  doc.circle(180, 52, 44, "F");
  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.4);
  doc.roundedRect(MARGIN_X, 32, CONTENT_WIDTH, 230, 8, 8, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.ink);
  doc.text("MindScore AI", MARGIN_X + 12, 55);

  doc.setFillColor(...COLORS.lavender);
  doc.roundedRect(MARGIN_X + 12, 70, 29, 1.3, 0.6, 0.6, "F");

  doc.setFontSize(23);
  doc.setTextColor(...COLORS.ink);
  doc.text("TVOJA PRIČA O SNU", MARGIN_X + 12, 94, { maxWidth: CONTENT_WIDTH - 24 });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...COLORS.muted);
  doc.text("Personalizovani izveštaj na osnovu tvojih odgovora", MARGIN_X + 12, 106, {
    maxWidth: CONTENT_WIDTH - 24,
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.lavender);
  doc.text("TVOJ POTPIS SNA", MARGIN_X + 12, 143);

  doc.setFontSize(report.signature.signature.length > 18 ? 20 : 25);
  doc.setTextColor(...COLORS.ink);
  const signatureLines = doc.splitTextToSize(report.signature.signature, CONTENT_WIDTH - 24);
  doc.text(signatureLines, MARGIN_X + 12, 158, { maxWidth: CONTENT_WIDTH - 24 });

  doc.setFillColor(...COLORS.white);
  doc.roundedRect(MARGIN_X + 12, 185, CONTENT_WIDTH - 24, 57, 5, 5, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.4);
  doc.setTextColor(...COLORS.body);
  const summaryLines = doc.splitTextToSize(report.signature.shortText, CONTENT_WIDTH - 44);
  doc.text(summaryLines, MARGIN_X + 22, 202, { maxWidth: CONTENT_WIDTH - 44, lineHeightFactor: 1.5 });
  drawPageFooter(doc, pageNumber);

  let y = CONTENT_TOP;
  for (const section of report.sections) {
    if (y > CONTENT_BOTTOM - 42) {
      const next = addContentPage(doc, pageNumber);
      pageNumber = next.pageNumber;
      y = next.y;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...COLORS.ink);
    const titleLines = doc.splitTextToSize(section.title, CONTENT_WIDTH);
    doc.text(titleLines, MARGIN_X, y);
    y += titleLines.length * 7 + 4;

    for (const paragraph of section.paragraphs || []) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.6);
      const paragraphLines = doc.splitTextToSize(paragraph, CONTENT_WIDTH);
      const paragraphHeight = paragraphLines.length * 5.6 + 3;
      if (y + paragraphHeight > CONTENT_BOTTOM) {
        const next = addContentPage(doc, pageNumber);
        pageNumber = next.pageNumber;
        y = next.y;
      }
      y = drawWrappedParagraph(doc, paragraph, MARGIN_X, y, CONTENT_WIDTH, { lineHeight: 5.6 });
      y += 3;
    }

    for (const bullet of section.bullets || []) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.2);
      const lines = doc.splitTextToSize(bullet, CONTENT_WIDTH - 10);
      const height = lines.length * 5.4 + 2;
      if (y + height > CONTENT_BOTTOM) {
        const next = addContentPage(doc, pageNumber);
        pageNumber = next.pageNumber;
        y = next.y;
      }
      doc.setFillColor(...COLORS.lavender);
      doc.circle(MARGIN_X + 1.4, y - 1.1, 0.8, "F");
      y = drawWrappedParagraph(doc, bullet, MARGIN_X + 6, y, CONTENT_WIDTH - 6, {
        fontSize: 10.2,
        lineHeight: 5.4,
      });
      y += 2;
    }

    y += 8;
  }

  for (let page = 2; page <= pageNumber; page += 1) {
    doc.setPage(page);
    drawPageFooter(doc, page);
  }

  return doc;
};

export const buildSleepPremiumPdf = ({ answers }) => {
  const report = buildSleepPremiumReport(answers);
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  return renderSleepReport(doc, report);
};

export { renderSleepReport };
