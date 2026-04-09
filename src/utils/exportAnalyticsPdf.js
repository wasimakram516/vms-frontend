"use client";

import html2canvas from "html2canvas";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

const PAGE_W  = 595.28;
const PAGE_H  = 841.89;
const MARGIN  = 36;
const CONTENT_W = PAGE_W - MARGIN * 2;

/**
 * Captures each analytics section from the DOM and assembles a PDF.
 *
 * @param {Array<{ ref: React.RefObject }>} sectionRefs
 * @param {{ from: string, to: string }} options
 */
export async function exportAnalyticsPdf(sectionRefs, { from, to }) {
  const pdf      = await PDFDocument.create();
  const font     = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y    = PAGE_H - MARGIN;

  // ── Title block ──────────────────────────────────────────────────────────────
  const HEADER_H = 56;
  page.drawRectangle({
    x: 0, y: PAGE_H - HEADER_H,
    width: PAGE_W, height: HEADER_H,
    color: rgb(0.102, 0.102, 0.18),
  });
  page.drawText("Sinan VMS - Analytics Report", {
    x: MARGIN, y: PAGE_H - 34,
    size: 15, font: boldFont, color: rgb(1, 1, 1),
  });
  const rangeText = `Period: ${from ?? ""} to ${to ?? ""}   |   Generated: ${new Date().toLocaleDateString("en-GB")}`;
  page.drawText(rangeText, {
    x: MARGIN, y: PAGE_H - 50,
    size: 8, font, color: rgb(0.75, 0.75, 0.75),
  });
  y = PAGE_H - HEADER_H - 14;

  // ── Capture each section ─────────────────────────────────────────────────────
  for (const { ref } of sectionRefs) {
    if (!ref?.current) continue;

    try {
      const canvas = await html2canvas(ref.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        logging: false,
        useCORS: true,
        allowTaint: true,
      });

      const imgBytes = await fetch(canvas.toDataURL("image/png")).then((r) =>
        r.arrayBuffer()
      );
      const img   = await pdf.embedPng(imgBytes);
      const ratio = canvas.width / canvas.height;

      // Fit within content width, cap at 70% of page height
      let imgW = CONTENT_W;
      let imgH = imgW / ratio;
      if (imgH > PAGE_H * 0.72) {
        imgH = PAGE_H * 0.72;
        imgW = imgH * ratio;
      }

      const xOffset = MARGIN + (CONTENT_W - imgW) / 2;

      // New page if not enough space (need imgH + 20 for separator + some padding)
      if (y - imgH < MARGIN + 16) {
        page = pdf.addPage([PAGE_W, PAGE_H]);
        y    = PAGE_H - MARGIN;
      }

      page.drawImage(img, {
        x: xOffset, y: y - imgH,
        width: imgW, height: imgH,
      });
      y -= imgH + 12;

      // Thin separator line between sections
      if (y > MARGIN + 12) {
        page.drawLine({
          start: { x: MARGIN, y },
          end:   { x: PAGE_W - MARGIN, y },
          thickness: 0.3,
          color: rgb(0.83, 0.83, 0.83),
        });
        y -= 14;
      }
    } catch (err) {
      console.error("Failed to capture analytics section:", err);
    }
  }

  // ── Page numbers ─────────────────────────────────────────────────────────────
  const pages = pdf.getPages();
  pages.forEach((pg, i) => {
    const text = `${i + 1} / ${pages.length}`;
    const tw   = font.widthOfTextAtSize(text, 8);
    pg.drawText(text, {
      x: (PAGE_W - tw) / 2, y: 16,
      size: 8, font, color: rgb(0.6, 0.6, 0.6),
    });
  });

  // ── Download ─────────────────────────────────────────────────────────────────
  const bytes = await pdf.save();
  const blob  = new Blob([bytes], { type: "application/pdf" });
  const url   = URL.createObjectURL(blob);
  const a     = document.createElement("a");
  a.href     = url;
  a.download = `sinan-analytics-${from ?? "start"}-${to ?? "end"}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
