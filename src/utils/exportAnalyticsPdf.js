"use client";

import html2canvas from "html2canvas";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

const PAGE_W    = 595.28;
const PAGE_H    = 841.89;
const MARGIN    = 36;
const CONTENT_W = PAGE_W - MARGIN * 2;

// ── Timezone helpers ──────────────────────────────────────────────────────────

function getTzOffset() {
  return new Date().getTimezoneOffset(); // e.g. -300 for UTC+5, -240 for UTC+4
}

function getTzLabel(offset) {
  const h = -offset / 60;
  if (h === 0) return "UTC";
  return h > 0 ? `UTC+${h}` : `UTC${h}`;
}

/** Format a YYYY-MM-DD string as "16 Mar 2026" */
function formatDateReadable(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "UTC",
  });
}

/** Format current time shifted by tzOffset as "14 Apr 2026, 03:31 pm" */
function formatNow(tzOffset) {
  const shifted = new Date(Date.now() - tzOffset * 60_000);
  return shifted.toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
    timeZone: "UTC",
  });
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Captures each analytics section from the DOM and assembles a PDF.
 *
 * @param {Array<{ ref: React.RefObject }>} sectionRefs
 * @param {{ from: string, to: string }} options
 */
export async function exportAnalyticsPdf(sectionRefs, { from, to }) {
  const tzOffset = getTzOffset();
  const tzLabel  = getTzLabel(tzOffset);

  const pdf      = await PDFDocument.create();
  const font     = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);

  // ── Load Sinan logo (white/light variant for dark header) ─────────────────
  let logoImage    = null;
  let logoNatW     = 0;
  let logoNatH     = 0;
  try {
    const logoBytes = await fetch("/logo-mark-light.png").then((r) => r.arrayBuffer());
    logoImage = await pdf.embedPng(logoBytes);
    const dims = logoImage.scale(1);
    logoNatW = dims.width;
    logoNatH = dims.height;
  } catch {
    // Logo unavailable — render header without it
  }

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y    = PAGE_H - MARGIN;

  // ── Header block ──────────────────────────────────────────────────────────
  const HEADER_H  = 62;
  const LOGO_H    = 38;                          // logo render height
  const LOGO_W    = logoImage && logoNatH > 0
    ? Math.round((logoNatW / logoNatH) * LOGO_H)
    : 0;
  const LOGO_X    = MARGIN;
  const LOGO_Y    = PAGE_H - HEADER_H + (HEADER_H - LOGO_H) / 2;  // vertically centered
  const TEXT_X    = logoImage ? LOGO_X + LOGO_W + 10 : MARGIN;

  page.drawRectangle({
    x: 0, y: PAGE_H - HEADER_H,
    width: PAGE_W, height: HEADER_H,
    color: rgb(0.102, 0.102, 0.18),
  });

  if (logoImage) {
    page.drawImage(logoImage, {
      x: LOGO_X, y: LOGO_Y,
      width: LOGO_W, height: LOGO_H,
    });
  }

  page.drawText("Sinan VMS - Analytics Report", {
    x: TEXT_X, y: PAGE_H - 28,
    size: 15, font: boldFont, color: rgb(1, 1, 1),
  });

  const fromReadable = from ? formatDateReadable(from) : "";
  const toReadable   = to   ? formatDateReadable(to)   : "";
  const rangeText    = `Period: ${fromReadable} to ${toReadable}   |   Generated: ${formatNow(tzOffset)} (${tzLabel})`;

  page.drawText(rangeText, {
    x: TEXT_X, y: PAGE_H - 48,
    size: 8, font, color: rgb(0.75, 0.75, 0.75),
  });

  y = PAGE_H - HEADER_H - 14;

  // ── Capture each section ─────────────────────────────────────────────────
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

      // New page if not enough space
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

  // ── Page numbers ─────────────────────────────────────────────────────────
  const pages = pdf.getPages();
  pages.forEach((pg, i) => {
    const text = `Page ${i + 1} of ${pages.length}`;
    const tw   = font.widthOfTextAtSize(text, 8);
    pg.drawText(text, {
      x: (PAGE_W - tw) / 2, y: 16,
      size: 8, font, color: rgb(0.6, 0.6, 0.6),
    });
  });

  // ── Download ──────────────────────────────────────────────────────────────
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
