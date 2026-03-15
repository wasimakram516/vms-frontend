import html2canvas from "html2canvas";

const TEMPLATE_WIDTH = 1280;
const TEMPLATE_HEIGHT = 960;

// Maps alignment to default X%
const ALIGN_X_MAP = { left: 20, center: 50, right: 90, justify: 36 };

/** Encode spaces in the URL so fetch works. */
function normalizeImageUrl(url) {
  if (!url || typeof url !== "string") return url;
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;
  return url.replace(/\s/g, "%20");
}

function getProxyImageUrl(normalizedUrl) {
  const base =
    typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_URL
      ? process.env.NEXT_PUBLIC_API_URL
      : typeof window !== "undefined" && window.__API_BASE_URL__
        ? window.__API_BASE_URL__
        : "http://localhost:4000/api";
  const baseClean = base.replace(/\/$/, "");
  return `${baseClean}/global-config/proxy-image?url=${encodeURIComponent(normalizedUrl)}`;
}

async function resolveImageUrl(url) {
  if (!url || typeof url !== "string" || url.startsWith("data:") || url.startsWith("blob:")) {
    return url;
  }
  const normalized = normalizeImageUrl(url);
  try {
    const res = await fetch(normalized, { mode: "cors", credentials: "omit" });
    if (res.ok) {
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    }
  } catch (_) { }
  try {
    const proxyUrl = getProxyImageUrl(normalized);
    const res = await fetch(proxyUrl, { credentials: "include" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch (_) {
    return null;
  }
}

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) { resolve(null); return; }
    const img = new Image();
    if (!src.startsWith("blob:") && !src.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Resolve stored font name to actual @font-face family from config fonts. */
function resolveFontFamily(rawFamily, fonts) {
  if (!rawFamily || !Array.isArray(fonts) || fonts.length === 0) return rawFamily;
  const key = String(rawFamily).trim().toLowerCase();
  const found = fonts.find((font) => String(font.family || font.name || "").trim().toLowerCase() === key);
  return found ? (found.family || found.name || rawFamily) : rawFamily;
}

/** Inject @font-face for all font files so each weight/style is available. */
function ensureFontsLoaded(fonts) {
  if (!Array.isArray(fonts) || typeof document === "undefined") return;
  const id = "qr-download-fonts";
  if (document.getElementById(id)) return;
  let css = "";
  const base = typeof window !== "undefined" ? window.location.origin : "";
  fonts.forEach((font) => {
    const family = font.family || font.name;
    if (!family || !Array.isArray(font.files) || font.files.length === 0) return;
    font.files.forEach((file) => {
      const format = file.path?.toLowerCase().endsWith(".otf") ? "opentype" : "truetype";
      const url = file.path ? (file.path.startsWith("http") ? file.path : base + file.path) : "";
      if (!url) return;
      css += `@font-face{font-family:"${family}";src:url("${url}") format("${format}");font-weight:${file.weight ?? 400};font-style:${file.style ?? "normal"};font-display:swap;}\n`;
    });
  });
  if (!css) return;
  const el = document.createElement("style");
  el.id = id;
  el.textContent = css;
  document.head.appendChild(el);
}


async function renderCustomFieldAsImage(f, fonts = []) {
  const text = String(f.text ?? "").trim() || (f.label || "field1");
  if (!text) return null;

  const fontSize = Math.round(Math.max(8, Math.min(100, Number(f.fontSize) || 14)));
  const rawFamily = (f.fontFamily && String(f.fontFamily).trim()) ? String(f.fontFamily).trim() : "Arial";
  const resolvedFamily = resolveFontFamily(rawFamily, fonts) || rawFamily;
  const fontFamilyCss = (resolvedFamily === "Arial" || resolvedFamily === "sans-serif")
    ? "Arial, sans-serif"
    : `"${String(resolvedFamily).replace(/"/g, "")}", sans-serif`;

  const color = (f.color && String(f.color).trim()) ? f.color : "#333333";
  const alignment = (f.alignment && String(f.alignment).trim()) ? f.alignment : "left";
  const xPct = Number.isFinite(Number(f.x)) ? Number(f.x) : (ALIGN_X_MAP[alignment] ?? 20);

  const div = document.createElement("div");
  div.textContent = text;

  const isJustify = alignment === "justify";

  const justifyWidth = isJustify
    ? Math.round(TEMPLATE_WIDTH * (1 - xPct / 100) * 0.9)
    : null;

  Object.assign(div.style, {
    position: "fixed",
    left: "-9999px",
    top: "0",
    // inline-block for all alignments; block+fixed-width only for justify
    display: isJustify ? "block" : "inline-block",
    width: isJustify ? `${justifyWidth}px` : "auto",
    boxSizing: "border-box",
    padding: "0",
    margin: "0",
    background: "transparent",
    fontSize: `${fontSize}px`,
    fontFamily: fontFamilyCss,
    color,
    fontWeight: f.isBold ? "bold" : "normal",
    fontStyle: f.isItalic ? "italic" : "normal",
    textDecoration: f.isUnderline ? "underline" : "none",
    textAlign: alignment,
    lineHeight: "1.2",
    textAlignLast: isJustify ? "justify" : "auto",
    whiteSpace: isJustify ? "normal" : "nowrap",
  });

  document.body.appendChild(div);
  try {
    const canvas = await html2canvas(div, {
      useCORS: true,
      scale: 1,
      logging: false,
      backgroundColor: null,
    });
    document.body.removeChild(div);
    const img = await new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = canvas.toDataURL("image/png");
    });
    return img;
  } catch (_) {
    if (div.parentNode) document.body.removeChild(div);
    return null;
  }
}

/** Draw image on canvas with "cover" behavior (scale to cover rect, centered). */
function drawImageCover(ctx, img, destX, destY, destW, destH) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  const scale = Math.max(destW / iw, destH / ih);
  const sx = (iw - destW / scale) / 2;
  const sy = (ih - destH / scale) / 2;
  ctx.drawImage(img, sx, sy, iw - 2 * sx, ih - 2 * sy, destX, destY, destW, destH);
}

/** Draw image on canvas with "contain" behavior (fit inside rect, centered). */
function drawImageContain(ctx, img, destX, destY, destW, destH) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  const scale = Math.min(destW / iw, destH / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(img, 0, 0, iw, ih, destX + (destW - dw) / 2, destY + (destH - dh) / 2, dw, dh);
}

export async function downloadDefaultQrWrapperAsImage(defaultQrWrapper, qrValue, filename, options = {}) {
  const { fonts: configFonts = [] } = options;
  const QRCode = (await import("qrcode")).default;

  const blobUrlsToRevoke = [];
  const bgUrl = defaultQrWrapper?.backgroundImage?.url;
  const logo = defaultQrWrapper?.logo;
  const items = defaultQrWrapper?.brandingMedia?.items ?? [];

  const [resolvedBgUrl, resolvedLogoUrl, ...resolvedBrandingUrls] = await Promise.all([
    bgUrl ? resolveImageUrl(bgUrl) : null,
    logo?.url ? resolveImageUrl(logo.url) : null,
    ...items.map((item) => (item?.url ? resolveImageUrl(item.url) : null)),
  ]);

  if (resolvedBgUrl?.startsWith("blob:")) blobUrlsToRevoke.push(resolvedBgUrl);
  if (resolvedLogoUrl?.startsWith("blob:")) blobUrlsToRevoke.push(resolvedLogoUrl);
  resolvedBrandingUrls.forEach((u) => { if (u?.startsWith("blob:")) blobUrlsToRevoke.push(u); });

  const qrSize = Math.max(1, Number(defaultQrWrapper?.qr?.size) || 120);
  const qrDataURL = await QRCode.toDataURL(qrValue, {
    width: qrSize,
    margin: 1,
    color: { dark: "#000000", light: "#ffffff" },
  });

  const [bgImage, logoImage, qrImage, ...brandingImages] = await Promise.all([
    resolvedBgUrl ? loadImage(resolvedBgUrl) : Promise.resolve(null),
    resolvedLogoUrl ? loadImage(resolvedLogoUrl) : Promise.resolve(null),
    loadImage(qrDataURL),
    ...items.map((item, idx) => {
      const url = item?.url ? (resolvedBrandingUrls[idx] ?? item.url) : null;
      return url ? loadImage(url) : Promise.resolve(null);
    }),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = TEMPLATE_WIDTH;
  canvas.height = TEMPLATE_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    blobUrlsToRevoke.forEach((url) => { try { URL.revokeObjectURL(url); } catch (_) { } });
    throw new Error("Canvas not supported");
  }

  // Background
  ctx.fillStyle = "#f5f5f5";
  ctx.fillRect(0, 0, TEMPLATE_WIDTH, TEMPLATE_HEIGHT);
  if (bgImage) drawImageCover(ctx, bgImage, 0, 0, TEMPLATE_WIDTH, TEMPLATE_HEIGHT);

  // Logo
  if (logoImage && logo) {
    const x = Number(logo.x);
    const y = Number(logo.y);
    const nw = logoImage.naturalWidth || logoImage.width || 1;
    const nh = logoImage.naturalHeight || logoImage.height || 1;
    const logoW = Number(logo.width);
    const logoH = Number(logo.height);
    const autoW = !Number.isFinite(logoW) || logoW === 0;
    const autoH = !Number.isFinite(logoH) || logoH === 0;
    let w, h;
    if (autoW && autoH) { w = Math.min(nw, TEMPLATE_WIDTH); h = Math.min(nh, TEMPLATE_HEIGHT); }
    else if (autoW && logoH > 0) { h = Math.max(1, logoH); w = Math.max(1, Math.round((nw / nh) * h)); }
    else if (logoW > 0 && autoH) { w = Math.max(1, logoW); h = Math.max(1, Math.round((nh / nw) * w)); }
    else { w = Math.max(1, logoW); h = Math.max(1, logoH); }
    const centerX = (Number.isFinite(x) ? x : 0) / 100 * TEMPLATE_WIDTH;
    const centerY = (Number.isFinite(y) ? y : 0) / 100 * TEMPLATE_HEIGHT;
    drawImageContain(ctx, logoImage, centerX - w / 2, centerY - h / 2, w, h);
  }

  // Branding media
  items.forEach((item, idx) => {
    const img = brandingImages[idx];
    if (!img) return;
    const x = Number(item.x);
    const y = Number(item.y);
    const nw = img.naturalWidth || img.width || 1;
    const nh = img.naturalHeight || img.height || 1;
    const itemW = Number(item.width);
    const itemH = Number(item.height);
    const autoW = !Number.isFinite(itemW) || itemW === 0;
    const autoH = !Number.isFinite(itemH) || itemH === 0;
    let w, h;
    if (autoW && autoH) { w = Math.min(nw, TEMPLATE_WIDTH); h = Math.min(nh, TEMPLATE_HEIGHT); }
    else if (autoW && itemH > 0) { h = Math.max(1, itemH); w = Math.max(1, Math.round((nw / nh) * h)); }
    else if (itemW > 0 && autoH) { w = Math.max(1, itemW); h = Math.max(1, Math.round((nh / nw) * w)); }
    else { w = Math.max(1, itemW || 200); h = Math.max(1, itemH || 60); }
    const centerX = (Number.isFinite(x) ? x : 50) / 100 * TEMPLATE_WIDTH;
    const centerY = (Number.isFinite(y) ? y : 15) / 100 * TEMPLATE_HEIGHT;
    drawImageContain(ctx, img, centerX - w / 2, centerY - h / 2, w, h);
  });

  // Custom fields
  const customFields = defaultQrWrapper?.customFields ?? [];
  ensureFontsLoaded(configFonts);
  if (typeof document !== "undefined" && document.fonts?.ready) await document.fonts.ready;

  for (const f of customFields) {
    const xPct = Number.isFinite(Number(f.x)) ? Number(f.x) : 0;
    const yPct = Number.isFinite(Number(f.y)) ? Number(f.y) : 0;
    const alignment = (f.alignment && String(f.alignment).trim()) ? f.alignment : "left";

    const textImg = await renderCustomFieldAsImage(f, configFonts);
    if (!textImg || !textImg.width || !textImg.height) continue;

    const centerX = (xPct / 100) * TEMPLATE_WIDTH;
    const centerY = (yPct / 100) * TEMPLATE_HEIGHT;

    let leftPx;
    if (alignment === "center") {
      leftPx = centerX - textImg.width / 2;
    } else if (alignment === "right") {
      leftPx = centerX - textImg.width;
    } else {
      leftPx = centerX - textImg.width / 2;
    }
    const topPx = centerY - textImg.height / 2;
    ctx.drawImage(textImg, leftPx, topPx, textImg.width, textImg.height);
  }

  // QR code
  if (qrImage) {
    const qrX = Number(defaultQrWrapper?.qr?.x);
    const qrY = Number(defaultQrWrapper?.qr?.y);
    const qrCenterX = (Number.isFinite(qrX) ? qrX : 50) / 100 * TEMPLATE_WIDTH;
    const qrCenterY = (Number.isFinite(qrY) ? qrY : 55) / 100 * TEMPLATE_HEIGHT;
    ctx.drawImage(qrImage, 0, 0, qrSize, qrSize, qrCenterX - qrSize / 2, qrCenterY - qrSize / 2, qrSize, qrSize);
  }

  // Logo overlay on QR
  if (logoImage && resolvedLogoUrl) {
    const qrX = Number(defaultQrWrapper?.qr?.x);
    const qrY = Number(defaultQrWrapper?.qr?.y);
    const qrCenterX = (Number.isFinite(qrX) ? qrX : 50) / 100 * TEMPLATE_WIDTH;
    const qrCenterY = (Number.isFinite(qrY) ? qrY : 55) / 100 * TEMPLATE_HEIGHT;
    const logoSize = Math.max(1, Math.round(qrSize * 0.22));
    drawImageContain(ctx, logoImage, qrCenterX - logoSize / 2, qrCenterY - logoSize / 2, logoSize, logoSize);
  }

  const dataURL = canvas.toDataURL("image/png");
  const link = document.createElement("a");
  link.href = dataURL;
  link.download = filename || "qr-wrapper.png";
  link.click();

  blobUrlsToRevoke.forEach((url) => { try { URL.revokeObjectURL(url); } catch (_) { } });
}

/** Returns true if the given wrapper object has any design (logo, background, branding, or custom fields). */
export function hasWrapperDesign(wrapper) {
  if (!wrapper || typeof wrapper !== "object") return false;
  return !!(
    wrapper.logo?.url ||
    wrapper.backgroundImage?.url ||
    (Array.isArray(wrapper.brandingMedia?.items) && wrapper.brandingMedia.items.length > 0) ||
    (Array.isArray(wrapper.customFields) && wrapper.customFields.length > 0)
  );
}

export function hasDefaultQrWrapperDesign(config) {
  return hasWrapperDesign(config?.defaultQrWrapper);
}