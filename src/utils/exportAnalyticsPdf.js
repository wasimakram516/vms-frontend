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

/** Format a YYYY-MM-DD string as "16 Mar 2026" */
function formatDateReadable(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "UTC",
  });
}

/** Format current time shifted by tzOffset as "14 Apr 2026, 3:31 pm" (12:00 am for midnight) */
function formatNow(tzOffset) {
  const shifted = new Date(Date.now() - tzOffset * 60_000);
  const datePart = shifted.toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "UTC",
  });
  const timePart = shifted.toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", hour12: true, timeZone: "UTC",
  }).toLowerCase();
  return `${datePart}, ${timePart}`;
}

/** Build full timezone name: "Pakistan Standard Time (GMT +5)" */
function getTzFullName(tzOffset) {
  const h = -tzOffset / 60;
  const sign = h >= 0 ? "+" : "";
  const gmtSuffix = h === 0 ? "GMT" : `GMT ${sign}${h}`;
  try {
    const ianaName = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const parts = Intl.DateTimeFormat("en-US", { timeZone: ianaName, timeZoneName: "long" }).formatToParts(new Date());
    const longName = parts.find((p) => p.type === "timeZoneName")?.value;
    if (longName) return `${longName} (${gmtSuffix})`;
  } catch { /* fall through */ }
  return gmtSuffix;
}

// ── Light-mode color conversion helpers ───────────────────────────────────────

/** Parse a CSS color string into { r, g, b, a } or null if unrecognised. */
function parseColorStr(str) {
  if (!str) return null;
  str = str.trim();
  if (
    str === "transparent" || str === "none" ||
    str === "inherit"     || str === "currentColor" || str === "initial"
  ) return null;

  const rgba = str.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/
  );
  if (rgba) {
    return {
      r: +rgba[1], g: +rgba[2], b: +rgba[3],
      a: rgba[4] != null ? +rgba[4] : 1,
    };
  }

  if (str.startsWith("#")) {
    let h = str.slice(1);
    if (h.length === 3) h = h.split("").map(c => c + c).join("");
    if (h.length === 6) {
      const n = parseInt(h, 16);
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
    }
    if (h.length === 8) {
      const n = parseInt(h.slice(0, 6), 16);
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: parseInt(h.slice(6), 16) / 255 };
    }
  }

  return null;
}

function getLum({ r, g, b }) { return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }

/**
 * A color is "neutral" (white, light-gray, near-white) when its channels are
 * close together — i.e. low HSL saturation.  Bright colorful palette colors
 * like cyan #22d3ee or lime #a3e635 have a large spread between their max and
 * min channels and must NOT be converted.
 */
function isNeutral({ r, g, b }) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0) return true; // pure black
  return (max - min) / max < 0.20; // < 20 % relative spread = near-gray
}

function toStr({ r, g, b, a }) {
  return a >= 0.999
    ? `rgb(${r}, ${g}, ${b})`
    : `rgba(${r}, ${g}, ${b}, ${parseFloat(a.toFixed(3))})`;
}

/**
 * Convert a light/white-ish foreground color (text, stroke, SVG fill on shapes)
 * to its dark equivalent — keeping the same alpha so relative transparency is
 * preserved (e.g. rgba(255,255,255,0.4) → rgba(0,0,0,0.4)).
 *
 * Only neutral colors are converted; saturated chart palette colors are left
 * untouched so cyan, lime, orange, etc. remain in the PDF.
 */
function fgLightToDark(str) {
  if (!str) return str;
  const c = parseColorStr(str);
  if (!c) return str;
  if (getLum(c) > 0.55 && isNeutral(c)) return toStr({ r: 0, g: 0, b: 0, a: c.a });
  return str;
}

/**
 * Returns true when a light/neutral SVG fill should be left unconverted because
 * the element sits on a coloured (palette) background where white text is correct.
 *
 * Currently protects:
 *   • Funnel centre value labels  — fully-opaque white inside [data-pdf-funnel]
 *   • Treemap name/value labels   — any light neutral fill inside [data-pdf-treemap]
 */
function isPreservedFill(el, v) {
  const c = parseColorStr(v);
  if (!c || getLum(c) <= 0.5 || !isNeutral(c)) return false;
  if (el.closest("[data-pdf-treemap]")) return true;
  if (el.closest("[data-pdf-funnel]") && c.a >= 0.99) return true;
  return false;
}

/**
 * Convert a dark background color to white, and semi-transparent white
 * overlays (e.g. rgba(255,255,255,0.05) used for KpiCard tinting) to their
 * dark-tint equivalents.
 * Pass isOpacityControlled=true when the element also has a CSS `opacity`
 * property, which indicates a pure white used as a tinted color (heatmap cells).
 */
function bgToLight(str, isOpacityControlled = false) {
  if (!str) return str;
  const c = parseColorStr(str);
  if (!c) return str;
  const l = getLum(c);

  // Dark background → white (skip nearly-transparent ones).
  // Skip opacity-controlled elements: their dark color is intentional (e.g. light-mode
  // heatmap cells are black and must stay black — only the CSS opacity varies per cell).
  if (l < 0.25 && c.a > 0.05 && !isOpacityControlled) {
    return c.a < 0.3 ? "transparent" : "#ffffff";
  }

  // Semi-transparent white overlay → equivalent dark tint
  if (l > 0.7 && c.a < 0.3) {
    return toStr({ r: 0, g: 0, b: 0, a: parseFloat((c.a * 0.7).toFixed(3)) });
  }

  // Fully-opaque white used as a tinted color (dark-mode heatmap cell, controlled by opacity)
  if (l > 0.7 && c.a >= 0.9 && isOpacityControlled) {
    return "#000000";
  }

  return str;
}

/**
 * Inject a light-mode stylesheet and walk all elements in the cloned document
 * to convert dark-mode colors before html2canvas renders the snapshot.
 *
 * Three layers are fixed:
 *   1. CSS class rules  — MUI Emotion-generated classes
 *   2. Inline styles    — MUI sx prop + Recharts Legend formatter spans
 *   3. SVG attributes   — Recharts bakes stroke/fill directly onto SVG nodes
 */
export function applyLightModeToClone(clonedDoc) {

  // ── 1. CSS class overrides ────────────────────────────────────────────────
  const sheet = clonedDoc.createElement("style");
  sheet.textContent = `
    body {
      background-color: #f8f9fa !important;
      color: rgba(0,0,0,0.87) !important;
    }
    .MuiPaper-root {
      background-color: #ffffff !important;
      color: rgba(0,0,0,0.87) !important;
      border: 1px solid rgba(0,0,0,0.08) !important;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08) !important;
      backdrop-filter: none !important;
    }
    .MuiTypography-root { color: inherit !important; }
    .MuiDivider-root { border-color: rgba(0,0,0,0.12) !important; }
    .MuiTableCell-root {
      color: rgba(0,0,0,0.87) !important;
      border-bottom-color: rgba(0,0,0,0.12) !important;
    }
    .MuiTableCell-head { background-color: rgba(0,0,0,0.03) !important; }
    /* Default (uncolored) chips — convert dark-mode grays to light */
    .MuiChip-colorDefault {
      color: rgba(0,0,0,0.87) !important;
    }
    .MuiChip-colorDefault:not(.MuiChip-outlined) {
      background-color: rgba(0,0,0,0.08) !important;
    }
    .MuiChip-colorDefault.MuiChip-outlined {
      background-color: transparent !important;
      border-color: rgba(0,0,0,0.23) !important;
    }
    /* Semantic chips — restore light-mode palette colors */
    .MuiChip-colorError {
      color: #d32f2f !important;
      background-color: transparent !important;
    }
    .MuiChip-colorError.MuiChip-outlined { border-color: #d32f2f !important; }
    .MuiChip-colorWarning {
      color: #e65100 !important;
      background-color: transparent !important;
    }
    .MuiChip-colorWarning.MuiChip-outlined { border-color: #e65100 !important; }
    .MuiSvgIcon-root { color: rgba(0,0,0,0.54) !important; }
    .MuiButton-root {
      color: rgba(0,0,0,0.87) !important;
      border-color: rgba(0,0,0,0.3) !important;
    }
    .MuiButton-contained {
      background-color: #000000 !important;
      color: #ffffff !important;
    }
    .recharts-legend-item-text { color: rgba(0,0,0,0.7) !important; }
    .recharts-wrapper, .recharts-surface { background: transparent !important; }
    /* Allow pie labels that sit near the SVG edges to render without clipping */
    .recharts-surface { overflow: visible !important; }
  `;
  clonedDoc.head.appendChild(sheet);

  // ── 2. Inline styles (MUI sx / Recharts legend formatter spans) ───────────
  clonedDoc.querySelectorAll("[style]").forEach((el) => {
    const s = el.style;

    // Detect whether element has its own opacity (heatmap cells pattern)
    const elOpacity = parseFloat(s.opacity);
    // Treat any explicit positive opacity (including 1.0) as opacity-controlled so
    // maximum-intensity heatmap cells (opacity=1) are still inverted to black.
    const hasOpacity = !isNaN(elOpacity) && elOpacity > 0;

    if (s.backgroundColor) {
      const cv = bgToLight(s.backgroundColor, hasOpacity);
      if (cv !== s.backgroundColor) s.backgroundColor = cv;
    }

    // Shorthand background (only convert plain color values, skip gradients/urls)
    if (s.background && !s.background.includes("gradient") && !s.background.includes("url(")) {
      const cv = bgToLight(s.background, hasOpacity);
      if (cv !== s.background) s.background = cv;
    }

    if (s.color) {
      const cv = fgLightToDark(s.color);
      if (cv !== s.color) s.color = cv;
    }

    for (const prop of ["borderColor", "borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor", "outlineColor"]) {
      if (s[prop]) {
        const cv = fgLightToDark(s[prop]);
        if (cv !== s[prop]) s[prop] = cv;
      }
    }

    if (s.backdropFilter) s.backdropFilter = "none";
    // eslint-disable-next-line dot-notation
    if (s["webkitBackdropFilter"]) s["webkitBackdropFilter"] = "none";
  });

  // ── 3. SVG attribute fixes (Recharts bakes colors as XML attributes) ──────

  // stroke="" attributes — chart lines, axis lines, grid lines
  clonedDoc.querySelectorAll("[stroke]").forEach((el) => {
    const v = el.getAttribute("stroke");
    if (!v || v === "none" || v === "transparent" || v.startsWith("url(")) return;
    // Funnel/treemap elements sit on coloured backgrounds — keep their strokes white.
    if (el.closest("[data-pdf-funnel]") || el.closest("[data-pdf-treemap]")) return;
    const cv = fgLightToDark(v);
    if (cv !== v) el.setAttribute("stroke", cv);
  });

  // fill="" attributes — bars, area fills, axis tick text fill, etc.
  clonedDoc.querySelectorAll("[fill]").forEach((el) => {
    const v = el.getAttribute("fill");
    if (!v || v === "none" || v === "transparent" || v.startsWith("url(")) return;

    if (el.tagName.toLowerCase() === "rect") {
      // Rect elements are usually backgrounds — convert dark → light
      const cv = bgToLight(v);
      if (cv !== v) el.setAttribute("fill", cv);
    } else {
      // Skip fills on elements that sit on coloured backgrounds (funnel centre
      // labels, treemap labels) — they must stay white/light to remain readable.
      if (isPreservedFill(el, v)) return;
      // Lines, paths, polygons, text, etc. — convert light → dark
      const cv = fgLightToDark(v);
      if (cv !== v) el.setAttribute("fill", cv);
    }
  });

  // SVG <text> and <tspan> fill (axis labels, pie %, funnel labels)
  clonedDoc.querySelectorAll("text[fill], tspan[fill]").forEach((el) => {
    const v = el.getAttribute("fill");
    if (!v || v === "none") return;
    if (isPreservedFill(el, v)) return;
    const cv = fgLightToDark(v);
    if (cv !== v) el.setAttribute("fill", cv);
  });

  // <stop> colors inside <linearGradient> (Area chart fill gradients)
  clonedDoc.querySelectorAll("stop").forEach((stop) => {
    const attr = stop.getAttribute("stop-color");
    if (attr) {
      const cv = fgLightToDark(attr);
      if (cv !== attr) stop.setAttribute("stop-color", cv);
    }
    if (stop.style.stopColor) {
      const cv = fgLightToDark(stop.style.stopColor);
      if (cv !== stop.style.stopColor) stop.style.stopColor = cv;
    }
  });

  // SVG inline style colors (catch-all for anything not covered above)
  clonedDoc.querySelectorAll("svg *[style]").forEach((el) => {
    const s = el.style;
    if (s.fill && s.fill !== "none" && !s.fill.startsWith("url(")) {
      if (!isPreservedFill(el, s.fill)) {
        const cv = el.tagName.toLowerCase() === "rect"
          ? bgToLight(s.fill)
          : fgLightToDark(s.fill);
        if (cv !== s.fill) s.fill = cv;
      }
    }
    if (s.stroke && s.stroke !== "none") {
      if (!el.closest("[data-pdf-funnel]") && !el.closest("[data-pdf-treemap]")) {
        const cv = fgLightToDark(s.stroke);
        if (cv !== s.stroke) s.stroke = cv;
      }
    }
    if (s.color) {
      const cv = fgLightToDark(s.color);
      if (cv !== s.color) s.color = cv;
    }
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
  const tzOffset  = getTzOffset();
  const tzFullName = getTzFullName(tzOffset);

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
  const HEADER_H  = 75;
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
    x: TEXT_X, y: PAGE_H - 26,
    size: 15, font: boldFont, color: rgb(1, 1, 1),
  });

  const fromReadable = from ? formatDateReadable(from) : "";
  const toReadable   = to   ? formatDateReadable(to)   : "";
  const rangeText    = `Period: ${fromReadable} to ${toReadable}   |   Generated: ${formatNow(tzOffset)}`;
  const tzLine       = `Timezone: ${tzFullName}`;

  page.drawText(rangeText, {
    x: TEXT_X, y: PAGE_H - 46,
    size: 8, font, color: rgb(0.75, 0.75, 0.75),
  });
  page.drawText(tzLine, {
    x: TEXT_X, y: PAGE_H - 60,
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
        onclone: applyLightModeToClone,
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
