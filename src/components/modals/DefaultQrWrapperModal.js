"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  IconButton,
  Stack,
  Divider,
  Paper,
  Avatar,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from "@mui/material";
import QRCode from "qrcode";
import ICONS from "@/utils/iconUtil";
import getStartIconSpacing from "@/utils/getStartIconSpacing";
import { useMessage } from "@/contexts/MessageContext";
import ConfirmationDialog from "@/components/modals/ConfirmationDialog";
import RichTextEditor from "@/components/RichTextEditor";

const TEMPLATE_WIDTH = 1280;
const TEMPLATE_HEIGHT = 960;
const PREVIEW_SCALE = 0.25;
const PREVIEW_WIDTH = Math.round(TEMPLATE_WIDTH * PREVIEW_SCALE);
const PREVIEW_HEIGHT = Math.round(TEMPLATE_HEIGHT * PREVIEW_SCALE);
const DEFAULT_QR_SIZE = 120;

// Maps alignment to default X position
const ALIGN_X_MAP = { left: 20, center: 50, right: 90, justify: 34 };

const translations = {
  en: {
    title: "Default QR Ticket Wrapper",
    titleEvent: "Custom QR Ticket Wrapper",
    preview: "Preview",
    logo: "Logo",
    logoWidth: "Width",
    logoHeight: "Height",
    logoX: "X (%)",
    logoY: "Y (%)",
    backgroundImage: "Background image",
    brandingMedia: "Branding media",
    brandingWidth: "Width",
    brandingHeight: "Height",
    brandingX: "X (%)",
    brandingY: "Y (%)",
    addBrandingMedia: "Add branding media",
    clearAllBranding: "Clear all",
    willClearAllBranding: "Will clear all (toggle off?)",
    none: "None",
    confirmRemoveLogo: "Remove logo?",
    confirmRemoveLogoMsg: "Are you sure you want to remove the logo?",
    confirmRemoveBackground: "Remove background image?",
    confirmRemoveBackgroundMsg: "Are you sure you want to remove the background image?",
    confirmRemoveBranding: "Remove this item?",
    confirmRemoveBrandingMsg: "Are you sure you want to remove this branding image?",
    confirmClearAllBranding: "Clear all branding media?",
    confirmClearAllBrandingMsg: "Are you sure you want to remove all branding images?",
    qrPosition: "QR code",
    qrSize: "QR size",
    qrX: "QR X (%)",
    qrY: "QR Y (%)",
    addFields: "Add field",
    customFields: "Custom fields",
    fieldLabel: "Label",
    fieldKey: "Data key",
    xAxis: "X-Axis (%)",
    yAxis: "Y-Axis (%)",
    font: "Font",
    fieldFontSize: "Font size",
    save: "Save",
    cancel: "Cancel",
    remove: "Remove",
    upload: "Upload",
    eventName: "Event Name",
    eventStartDate: "Start Date",
    eventEndDate: "End Date",
    venue: "Venue",
    description: "Description",
    organizerName: "Organizer Name",
    organizerEmail: "Organizer Email",
    organizerPhone: "Organizer Phone",
    auto: "Auto",
  },
};

function getNextFieldName(existingFields) {
  const nums = existingFields
    .map((f) => parseInt(String(f.label || "").replace(/^field/i, ""), 10))
    .filter((n) => !Number.isNaN(n) && n >= 1);
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `field${next}`;
}

function num(v, def) {
  if (v === undefined || v === null || v === "") return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function capitalizeFirst(s) {
  if (!s || typeof s !== "string") return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function widthHeightFromConfig(configVal, defaultPx, hasConfig) {
  if (hasConfig && (configVal === 0 || configVal == null)) return null;
  if (!hasConfig) return defaultPx;
  return num(configVal, defaultPx);
}

function ClampedNumberInput({ value, min, max, onChange, label, inputProps = {}, sx, ...rest }) {
  const isZeroMinAndZero = min === 0 && (value === 0 || value === "0");
  const displayValue = (value !== undefined && value !== null && !isZeroMinAndZero) ? value : "";
  const handleChange = (e) => {
    const v = e.target.value;
    if (v === "") { onChange(min); return; }
    const n = parseFloat(v);
    if (!Number.isNaN(n)) onChange(n);
  };
  const handleBlur = (e) => {
    const v = e.target.value;
    if (v === "") { onChange(min); return; }
    const n = parseFloat(v);
    if (Number.isNaN(n)) { onChange(min); return; }
    const clamped = max != null ? Math.min(max, Math.max(min, n)) : Math.max(min, n);
    onChange(clamped);
  };
  return (
    <TextField
      size="small"
      type="number"
      label={label}
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      inputProps={{ min, max, ...inputProps }}
      sx={sx}
      {...rest}
    />
  );
}

function WidthHeightField({ width, height, onWidthChange, onHeightChange, widthLabel, heightLabel, t, minSize = 0, sx, defaultPx = 150 }) {
  const widthAuto = width == null;
  const heightAuto = height == null;
  return (
    <Stack direction="row" spacing={1.5} flexWrap="wrap" alignItems="center" sx={{ ...sx }}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
        <Typography variant="caption" color="text.secondary">{widthLabel}</Typography>
        <FormControl size="small" sx={{ minWidth: 72 }}>
          <Select
            value={widthAuto ? "auto" : "custom"}
            onChange={(e) => onWidthChange(e.target.value === "auto" ? null : (width != null ? Math.max(minSize, width) : defaultPx))}
            displayEmpty
          >
            <MenuItem value="auto">{t.auto}</MenuItem>
            <MenuItem value="custom">px</MenuItem>
          </Select>
        </FormControl>
        {!widthAuto && (
          <ClampedNumberInput label="" value={width} min={minSize} onChange={onWidthChange} sx={{ width: 90, minWidth: 80 }} />
        )}
      </Stack>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
        <Typography variant="caption" color="text.secondary">{heightLabel}</Typography>
        <FormControl size="small" sx={{ minWidth: 72 }}>
          <Select
            value={heightAuto ? "auto" : "custom"}
            onChange={(e) => onHeightChange(e.target.value === "auto" ? null : (height != null ? Math.max(minSize, height) : defaultPx))}
            displayEmpty
          >
            <MenuItem value="auto">{t.auto}</MenuItem>
            <MenuItem value="custom">px</MenuItem>
          </Select>
        </FormControl>
        {!heightAuto && (
          <ClampedNumberInput label="" value={height} min={minSize} onChange={onHeightChange} sx={{ width: 90, minWidth: 80 }} />
        )}
      </Stack>
    </Stack>
  );
}

function extractFormattingFromHtml(html) {
  if (!html) {
    return { text: "", fontSize: 14, color: "#000000", isBold: false, isItalic: false, isUnderline: false, fontFamily: "Arial", alignment: "left" };
  }
  const text = html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
  const isBold = /<(strong|b)>/i.test(html) || /font-weight:\s*(bold|700|800|900)/i.test(html);
  const isItalic = /<(em|i)>/i.test(html) || /font-style:\s*italic/i.test(html);
  const isUnderline = /<u>/i.test(html) || /text-decoration:\s*underline/i.test(html);
  const colorMatch = html.match(/color:\s*([^;'"]+)/i) || html.match(/color="([^"]+)"/i);
  const color = colorMatch ? colorMatch[1].trim() : "#000000";
  let fontSize = 14;
  const fontSizeMatch = html.match(/font-size:\s*([^;'"]+)/i);
  if (fontSizeMatch) {
    const n = parseFloat(fontSizeMatch[1].trim());
    if (!Number.isNaN(n) && n >= 8 && n <= 100) fontSize = Math.round(n);
  }
  let fontFamily = "Arial";
  const fontFamilyQuotedMatch = html.match(/font-family:\s*["']([^"']*)["']/i);
  const fontFamilyUnquotedMatch = html.match(/font-family:\s*([^;"']+)/i);
  if (fontFamilyQuotedMatch) fontFamily = fontFamilyQuotedMatch[1].trim().replace(/\\"/g, '"');
  else if (fontFamilyUnquotedMatch) fontFamily = fontFamilyUnquotedMatch[1].trim();
  // Parse all four alignment values including left and justify
  let alignment = "left";
  const alignMatch = html.match(/text-align:\s*(center|left|right|justify)/i);
  if (alignMatch) alignment = alignMatch[1].toLowerCase();
  return { text, fontSize, color, isBold: !!isBold, isItalic: !!isItalic, isUnderline: !!isUnderline, fontFamily, alignment };
}

function buildHtmlFromFormatting(textValue, fontSizeValue, colorValue, isBoldValue, isItalicValue, isUnderlineValue, alignmentValue, fontFamilyValue) {
  let html = String(textValue || "");
  if (isUnderlineValue) html = `<u>${html}</u>`;
  if (isItalicValue) html = `<em>${html}</em>`;
  if (isBoldValue) html = `<strong>${html}</strong>`;
  const styles = [];
  if (fontSizeValue && fontSizeValue !== 14) styles.push(`font-size: ${fontSizeValue}px`);
  if (colorValue && colorValue !== "#000000") styles.push(`color: ${colorValue}`);
  if (fontFamilyValue && fontFamilyValue !== "Arial") {
    const escaped = String(fontFamilyValue).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    styles.push(`font-family: "${escaped}"`);
  }
  if (styles.length > 0) html = `<span style="${styles.join("; ")}">${html}</span>`;
  // Always write text-align so extractFormattingFromHtml can always read it back
  const pStyle = ` style="text-align: ${alignmentValue || "left"}"`;
  return `<p${pStyle}>${html}</p>`;
}

function getContentFromField(f) {
  return buildHtmlFromFormatting(
    f.text ?? "",
    num(f.fontSize, 14),
    f.color ?? "#000000",
    f.isBold ?? false,
    f.isItalic ?? false,
    f.isUnderline ?? false,
    f.alignment ?? "left",
    f.fontFamily ?? "Arial"
  );
}

function QrWrapperFieldEditor({
  value,
  onChange,
  onFormattingChange,
  placeholder,
  dir,
  minHeight,
  maxHeight,
  x,
  y,
  fontFamily: fontFamilyProp,
  onXChange,
  onYChange,
  onFontFamilyChange,
  t,
  availableFonts = [],
}) {
  const editorContainerRef = useRef(null);
  const inputsContainerRef = useRef(null);
  const xInputRef = useRef(null);
  const yInputRef = useRef(null);
  const fontSelectRef = useRef(null);
  const lastFormattingRef = useRef({});
  const isUpdatingFromPropsRef = useRef(false);
  const onXChangeRef = useRef(onXChange);
  const onYChangeRef = useRef(onYChange);
  const onFontFamilyChangeRef = useRef(onFontFamilyChange);
  const onFormattingChangeRef = useRef(onFormattingChange);
  onXChangeRef.current = onXChange;
  onYChangeRef.current = onYChange;
  onFontFamilyChangeRef.current = onFontFamilyChange;
  onFormattingChangeRef.current = onFormattingChange;

  const [formatting, setFormatting] = useState(() => extractFormattingFromHtml(value));
  const formattingRef = useRef(formatting);
  formattingRef.current = formatting;
  const lastAlignmentRef = useRef(formatting.alignment);

  useEffect(() => {
    const parsed = extractFormattingFromHtml(value);
    setFormatting((prev) => ({ ...prev, ...parsed }));
  }, [value]);

  const htmlValue = buildHtmlFromFormatting(
    formatting.text,
    formatting.fontSize,
    formatting.color,
    formatting.isBold,
    formatting.isItalic,
    formatting.isUnderline,
    formatting.alignment,
    formatting.fontFamily
  );

  // Applies alignment change: updates state, fires onChange + onFormattingChange + onXChange
  const applyAlignmentChange = (newAlignment, prevFormatting) => {
    const next = { ...prevFormatting, alignment: newAlignment };
    lastFormattingRef.current = next;
    lastAlignmentRef.current = newAlignment;
    setFormatting(next);
    const built = buildHtmlFromFormatting(next.text, next.fontSize, next.color, next.isBold, next.isItalic, next.isUnderline, next.alignment, next.fontFamily);
    onChange(built);
    // Update X axis position based on alignment
    if (ALIGN_X_MAP[newAlignment] !== undefined) {
      onXChangeRef.current?.(ALIGN_X_MAP[newAlignment]);
    }
    onFormattingChangeRef.current?.({ text: next.text, fontSize: next.fontSize, color: next.color, isBold: next.isBold, isItalic: next.isItalic, isUnderline: next.isUnderline, fontFamily: next.fontFamily, alignment: next.alignment });
  };

  const handleHTMLChange = (html) => {
    if (isUpdatingFromPropsRef.current) return;

    let next = extractFormattingFromHtml(html);
    const prev = lastFormattingRef.current;

    // Preserve fontFamily if editor lost it (browser strips custom fonts)
    if ((!next.fontFamily || next.fontFamily === "Arial") && prev.fontFamily && prev.fontFamily !== "Arial") {
      next = { ...next, fontFamily: prev.fontFamily };
    }
    // Preserve fontSize if editor reset it
    if (next.fontSize === 14 && prev.fontSize && prev.fontSize !== 14) {
      next = { ...next, fontSize: prev.fontSize };
    }
    // NOTE: Do NOT preserve alignment here — we must allow left to come through

    const changed =
      next.text !== prev.text ||
      next.fontSize !== prev.fontSize ||
      next.color !== prev.color ||
      next.isBold !== prev.isBold ||
      next.isItalic !== prev.isItalic ||
      next.isUnderline !== prev.isUnderline ||
      next.fontFamily !== prev.fontFamily ||
      next.alignment !== prev.alignment;

    if (!changed) return;

    const alignmentChanged = next.alignment !== prev.alignment;
    lastFormattingRef.current = next;
    setFormatting(next);

    const built = buildHtmlFromFormatting(next.text, next.fontSize, next.color, next.isBold, next.isItalic, next.isUnderline, next.alignment, next.fontFamily);
    onChange(built);

    if (onFontFamilyChangeRef.current && next.fontFamily !== prev.fontFamily) {
      onFontFamilyChangeRef.current(next.fontFamily);
    }

    // Fire X update whenever alignment changes
    if (alignmentChanged && ALIGN_X_MAP[next.alignment] !== undefined) {
      onXChangeRef.current?.(ALIGN_X_MAP[next.alignment]);
    }

    onFormattingChangeRef.current?.({ text: next.text, fontSize: next.fontSize, color: next.color, isBold: next.isBold, isItalic: next.isItalic, isUnderline: next.isUnderline, fontFamily: next.fontFamily, alignment: next.alignment });
  };

  useEffect(() => {
    const checkAlignment = (isManualClick) => {
      if (!editorContainerRef.current) return;
      const editor = editorContainerRef.current.querySelector("[contenteditable=\"true\"]");
      if (!editor) return;
      const isLeft = document.queryCommandState("justifyLeft");
      const isCenter = document.queryCommandState("justifyCenter");
      const isRight = document.queryCommandState("justifyRight");
      const isFull = document.queryCommandState("justifyFull");
      let current = null;
      if (isFull) current = "justify";
      else if (isLeft && !isCenter && !isRight) current = "left";
      else if (isCenter && !isLeft && !isRight) current = "center";
      else if (isRight && !isLeft && !isCenter) current = "right";
      if (current && (isManualClick ? current !== lastAlignmentRef.current : true)) {
        applyAlignmentChange(current, formattingRef.current);
      }
    };
    const toolbar = editorContainerRef.current?.querySelector(".MuiToolbar-root");
    if (toolbar) {
      const alignmentButtons = toolbar.querySelectorAll("button[title*=\"Align\"], button[title*=\"Justify\"]");
      alignmentButtons.forEach((btn) => {
        btn.addEventListener("click", () => setTimeout(() => checkAlignment(true), 100));
      });
    }
  }, [onChange]);

  useEffect(() => {
    if (!editorContainerRef.current || isUpdatingFromPropsRef.current) return;
    const editor = editorContainerRef.current.querySelector("[contenteditable=\"true\"]");
    if (!editor) return;
    if (document.activeElement === editor || editor.contains(document.activeElement)) return;
    const expected = buildHtmlFromFormatting(
      formatting.text, formatting.fontSize, formatting.color,
      formatting.isBold, formatting.isItalic, formatting.isUnderline,
      formatting.alignment, formatting.fontFamily
    );
    if (editor.innerHTML !== expected) {
      isUpdatingFromPropsRef.current = true;
      editor.innerHTML = expected;
      lastFormattingRef.current = { ...formatting };
      setTimeout(() => { isUpdatingFromPropsRef.current = false; }, 0);
    }
  }, [formatting.text, formatting.fontSize, formatting.color, formatting.isBold, formatting.isItalic, formatting.isUnderline, formatting.alignment, formatting.fontFamily]);

  useEffect(() => {
    const injectInputs = () => {
      const toolbar = editorContainerRef.current?.querySelector(".MuiToolbar-root");
      const clearFormatBox = toolbar?.querySelector("button[title=\"Clear Formatting\"]")?.parentElement;
      if (!clearFormatBox || inputsContainerRef.current) return;
      if (clearFormatBox.querySelector(".qr-wrapper-position-inputs")) return;

      if (toolbar) {
        toolbar.style.setProperty("padding-top", "12px", "important");
        toolbar.style.setProperty("padding-bottom", "12px", "important");
      }

      const inputsBox = document.createElement("div");
      inputsBox.className = "qr-wrapper-position-inputs";
      inputsBox.style.cssText = "display:flex;gap:12px;align-items:center;padding-left:8px;padding-top:8px;padding-bottom:8px;border-left:1px solid rgba(0,0,0,0.12);margin-left:8px;margin-top:8px;";

      const makeInputRow = (labelText, inputEl) => {
        const container = document.createElement("div");
        container.style.cssText = "display:flex;align-items:center;gap:6px;";
        const label = document.createElement("label");
        label.textContent = labelText;
        label.style.cssText = "font-size:0.875rem;color:rgba(0,0,0,0.6);white-space:nowrap;";
        container.appendChild(label);
        container.appendChild(inputEl);
        return container;
      };

      const makeNumberInput = (initialValue, onInput) => {
        const input = document.createElement("input");
        input.type = "number";
        input.min = 0; input.max = 100; input.step = 1;
        input.style.cssText = "width:80px;height:32px;padding:4px 8px;border:1px solid rgba(0,0,0,0.23);border-radius:4px;font-size:0.875rem;";
        input.value = initialValue ?? 0;
        input.oninput = (e) => {
          const val = parseFloat(e.target.value);
          if (!Number.isNaN(val) && val >= 0 && val <= 100) onInput(val);
        };
        return input;
      };

      const xInput = makeNumberInput(x, (val) => onXChangeRef.current?.(val));
      xInputRef.current = xInput;
      const yInput = makeNumberInput(y, (val) => onYChangeRef.current?.(val));
      yInputRef.current = yInput;

      const fontSelect = document.createElement("select");
      fontSelect.style.cssText = "width:80px;height:32px;padding:4px;border:1px solid rgba(0,0,0,0.23);border-radius:4px;font-size:0.75rem;background-color:white;";
      fontSelectRef.current = fontSelect;

      const fontsToUse = availableFonts?.length > 0 ? availableFonts : [
        { name: "Arial", family: "Arial" },
        { name: "Futura", family: "Futura" },
        { name: "IBM Plex Sans Arabic", family: "IBM Plex Sans Arabic" },
      ];
      fontsToUse.forEach((font) => {
        const option = document.createElement("option");
        const fVal = font.family || font.name;
        option.value = fVal;
        option.textContent = capitalizeFirst(font.name || font.family);
        option.style.fontFamily = fVal;
        fontSelect.appendChild(option);
      });
      const currentFont = (formattingRef.current?.fontFamily && String(formattingRef.current.fontFamily).trim()) || "Arial";
      if (!Array.from(fontSelect.options).some((o) => o.value === currentFont)) {
        const opt = document.createElement("option");
        opt.value = currentFont;
        opt.textContent = capitalizeFirst(currentFont);
        opt.style.fontFamily = currentFont;
        fontSelect.appendChild(opt);
      }
      fontSelect.value = currentFont;
      fontSelect.onchange = (e) => {
        const val = e.target.value;
        const prev = formattingRef.current;
        const next = { ...prev, fontFamily: val };
        const built = buildHtmlFromFormatting(next.text, next.fontSize, next.color, next.isBold, next.isItalic, next.isUnderline, next.alignment, next.fontFamily);
        onChange(built);
        setFormatting(next);
        onFontFamilyChangeRef.current?.(val);
        onFormattingChangeRef.current?.({ text: next.text, fontSize: next.fontSize, color: next.color, isBold: next.isBold, isItalic: next.isItalic, isUnderline: next.isUnderline, fontFamily: next.fontFamily, alignment: next.alignment });
      };

      inputsBox.appendChild(makeInputRow(t.xAxis, xInput));
      inputsBox.appendChild(makeInputRow(t.yAxis, yInput));
      inputsBox.appendChild(makeInputRow(t.font, fontSelect));
      clearFormatBox.appendChild(inputsBox);
      inputsContainerRef.current = inputsBox;
    };

    const timeoutId = setTimeout(injectInputs, 100);
    return () => clearTimeout(timeoutId);
  }, [t.xAxis, t.yAxis, t.font, availableFonts]);

  useEffect(() => {
    if (xInputRef.current && document.activeElement !== xInputRef.current) {
      xInputRef.current.value = x ?? 0;
    }
  }, [x]);

  useEffect(() => {
    if (yInputRef.current && document.activeElement !== yInputRef.current) {
      yInputRef.current.value = y ?? 0;
    }
  }, [y]);

  useEffect(() => {
    const sel = fontSelectRef.current;
    if (!sel) return;
    const val = (formatting.fontFamily && String(formatting.fontFamily).trim()) || "Arial";
    if (!sel.querySelector(`option[value="${CSS.escape(val)}"]`)) {
      const opt = document.createElement("option");
      opt.value = val;
      opt.textContent = capitalizeFirst(val);
      opt.style.fontFamily = val;
      sel.appendChild(opt);
    }
    if (sel.value !== val) sel.value = val;
  }, [formatting.fontFamily]);

  return (
    <Box ref={editorContainerRef}>
      <RichTextEditor
        value={htmlValue}
        onChange={handleHTMLChange}
        placeholder={placeholder}
        dir={dir}
        minHeight={minHeight}
        maxHeight={maxHeight}
      />
    </Box>
  );
}

function formatEventDate(dateVal) {
  if (dateVal == null || dateVal === "") return "";
  if (typeof dateVal === "string" && dateVal.length >= 10) return dateVal.slice(0, 10);
  try {
    const d = new Date(dateVal);
    return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : "";
  } catch {
    return "";
  }
}

export default function DefaultQrWrapperModal({
  open,
  onClose,
  config,
  mode = "default",
  eventId,
  onSaveEventQrWrapper,
  eventData,
  selectedFields = {},
  includeLogo = false,
  includeBrandingMedia = false,
  includeBackground = false,
}) {
  const t = translations.en || {};
  const dir = "ltr";
  const { showMessage } = useMessage();
  const isEventMode = mode === "event";

  const wr = config?.defaultQrWrapper || {};
  const availableFonts = []; // Global Fonts context removed
  
  const [logo, setLogo] = useState({
    url: wr.logo?.url ?? "",
    width: widthHeightFromConfig(wr.logo?.width, 150, wr.logo != null),
    height: widthHeightFromConfig(wr.logo?.height, 150, wr.logo != null),
    x: num(wr.logo?.x, 0),
    y: num(wr.logo?.y, 0),
  });
  const [backgroundImage, setBackgroundImage] = useState({ url: wr.backgroundImage?.url ?? "" });

  const normalizeBrandingItems = (w) => {
    if (!w?.brandingMedia) return [];
    if (w.brandingMedia.url) {
      return [{
        _id: null, url: w.brandingMedia.url, file: null,
        width: widthHeightFromConfig(w.brandingMedia.width, 200, true),
        height: widthHeightFromConfig(w.brandingMedia.height, 60, true),
        x: num(w.brandingMedia.x, 50), y: num(w.brandingMedia.y, 15),
      }];
    }
    return (w.brandingMedia.items || []).map((i) => ({
      _id: i._id, url: i.url || "", file: null,
      width: widthHeightFromConfig(i.width, 200, true),
      height: widthHeightFromConfig(i.height, 60, true),
      x: num(i.x, 50), y: num(i.y, 15),
    }));
  };

  const [brandingMediaItems, setBrandingMediaItems] = useState(normalizeBrandingItems(wr));
  const [removeBrandingMediaIds, setRemoveBrandingMediaIds] = useState([]);
  const [pendingClearAllBranding, setPendingClearAllBranding] = useState(false);
  const [confirmRemoveLogo, setConfirmRemoveLogo] = useState(false);
  const [confirmRemoveBackground, setConfirmRemoveBackground] = useState(false);
  const [confirmRemoveBrandingIndex, setConfirmRemoveBrandingIndex] = useState(null);
  const [confirmClearAllBranding, setConfirmClearAllBranding] = useState(false);
  const [qr, setQr] = useState({
    x: num(wr.qr?.x, 50), y: num(wr.qr?.y, 55), size: num(wr.qr?.size, DEFAULT_QR_SIZE),
  });

  const mapConfigToCustomField = (f) => ({
    id: f.id || `f-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    label: f.label ?? getNextFieldName([]),
    x: num(f.x, 0), y: num(f.y, 0),
    fontSize: num(f.fontSize, 14),
    fontFamily: f.fontFamily ?? "Arial",
    text: f.text ?? "",
    color: f.color ?? "#000000",
    isBold: f.isBold ?? false,
    isItalic: f.isItalic ?? false,
    isUnderline: f.isUnderline ?? false,
    alignment: f.alignment ?? "left",
  });

  const [customFields, setCustomFields] = useState(
    Array.isArray(wr.customFields) ? wr.customFields.map(mapConfigToCustomField) : []
  );

  const EVENT_FIELD_IDS = new Set(["eventName", "eventStartDate", "eventEndDate", "venue", "description", "organizerName", "organizerEmail", "organizerPhone"]);

  const getExistingEventField = (id) => {
    const list = Array.isArray(wr.customFields) ? wr.customFields : [];
    return list.find((f) => f.id === id);
  };

  const buildEventFieldsFromSelection = () => {
    const ed = eventData || {};
    const sel = selectedFields || {};
    const out = [];
    const push = (id, label, rawValue) => {
      const existing = getExistingEventField(id);
      const text = (existing?.text != null && String(existing.text).trim() !== "")
        ? String(existing.text).trim() : String(rawValue ?? "").trim();
      out.push({
        id, label,
        x: num(existing?.x, 0), y: num(existing?.y, out.length * 8),
        fontSize: num(existing?.fontSize, 14),
        fontFamily: existing?.fontFamily ?? "Arial",
        text, color: existing?.color ?? "#000000",
        isBold: existing?.isBold ?? false,
        isItalic: existing?.isItalic ?? false,
        isUnderline: existing?.isUnderline ?? false,
        alignment: existing?.alignment ?? "left",
      });
    };
    if (sel.eventName) push("eventName", t.eventName, ed.name);
    if (sel.eventDates) {
      const startStr = formatEventDate(ed.startDate);
      if (startStr) push("eventStartDate", t.eventStartDate, startStr);
      const endStr = formatEventDate(ed.endDate);
      if (endStr) push("eventEndDate", t.eventEndDate, endStr);
    }
    if (sel.venue) push("venue", t.venue, ed.venue);
    if (sel.description) push("description", t.description, ed.description);
    if (sel.organizerName) push("organizerName", t.organizerName, ed.organizerName);
    if (sel.organizerEmail) push("organizerEmail", t.organizerEmail, ed.organizerEmail);
    if (sel.organizerPhone) push("organizerPhone", t.organizerPhone, ed.organizerPhone);
    return out;
  };

  const [eventFields, setEventFields] = useState([]);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(logo.url);
  const [backgroundFile, setBackgroundFile] = useState(null);
  const [backgroundPreview, setBackgroundPreview] = useState(backgroundImage.url);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const logoFileInputRef = useRef(null);
  const backgroundFileInputRef = useRef(null);
  const brandingFileInputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const wr = config?.defaultQrWrapper || {};
    const logoUrl = isEventMode && eventData?.logoUrl != null ? eventData.logoUrl : (wr.logo?.url ?? "");
    setLogo({
      url: logoUrl,
      width: widthHeightFromConfig(wr.logo?.width, 150, wr.logo != null),
      height: widthHeightFromConfig(wr.logo?.height, 150, wr.logo != null),
      x: num(wr.logo?.x, 0), y: num(wr.logo?.y, 0),
    });
    setBackgroundImage({ url: wr.backgroundImage?.url ?? "" });
    if (isEventMode && Array.isArray(eventData?.brandingMedia) && eventData.brandingMedia.length > 0) {
      const wrItems = wr.brandingMedia?.items || [];
      setBrandingMediaItems(
        eventData.brandingMedia.map((item, idx) => ({
          _id: item._id, url: item.logoUrl || item.url || "", file: null,
          width: widthHeightFromConfig(wrItems[idx]?.width, 200, true),
          height: widthHeightFromConfig(wrItems[idx]?.height, 60, true),
          x: num(wrItems[idx]?.x, 50), y: num(wrItems[idx]?.y, 15),
        }))
      );
    } else {
      setBrandingMediaItems(normalizeBrandingItems(wr));
    }
    setRemoveBrandingMediaIds([]);
    setPendingClearAllBranding(false);
    setQr({ x: num(wr.qr?.x, 50), y: num(wr.qr?.y, 55), size: num(wr.qr?.size, DEFAULT_QR_SIZE) });
    if (isEventMode && eventData) {
      setEventFields(buildEventFieldsFromSelection());
      const extraCustom = (Array.isArray(wr.customFields) ? wr.customFields : [])
        .filter((f) => !EVENT_FIELD_IDS.has(f.id)).map(mapConfigToCustomField);
      setCustomFields(extraCustom);
    } else {
      setCustomFields(Array.isArray(wr.customFields) ? wr.customFields.map(mapConfigToCustomField) : []);
    }
    setLogoPreview(isEventMode && eventData?.logoUrl != null ? eventData.logoUrl : (wr.logo?.url ?? ""));
    setBackgroundPreview(wr.backgroundImage?.url ?? "");
    setLogoFile(null);
    setBackgroundFile(null);
    if (logoFileInputRef.current) logoFileInputRef.current.value = "";
    if (backgroundFileInputRef.current) backgroundFileInputRef.current.value = "";
    if (brandingFileInputRef.current) brandingFileInputRef.current.value = "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    setLogoPreview(logoFile ? URL.createObjectURL(logoFile) : logo.url);
    return () => { if (logoFile) URL.revokeObjectURL(logoPreview); };
  }, [logoFile, logo.url]);

  useEffect(() => {
    setBackgroundPreview(backgroundFile ? URL.createObjectURL(backgroundFile) : backgroundImage.url);
    return () => { if (backgroundFile) URL.revokeObjectURL(backgroundPreview); };
  }, [backgroundFile, backgroundImage.url]);

  useEffect(() => {
    if (!open) return;
    QRCode.toDataURL("SAMPLE_TOKEN", { width: qr.size, margin: 1, color: { dark: "#000000", light: "#ffffff" } })
      .then(setQrCodeDataUrl).catch(() => setQrCodeDataUrl(""));
  }, [open, qr.size]);

  const handleAddField = () => {
    setCustomFields((prev) => {
      const nextName = getNextFieldName(prev);
      return [...prev, {
        id: `f-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        label: nextName, x: 0, y: 5 + prev.length * 8,
        fontSize: 14, fontFamily: "Arial", text: "",
        color: "#000000", isBold: false, isItalic: false, isUnderline: false, alignment: "left",
      }];
    });
  };

  const handleRemoveField = (id) => {
    setCustomFields((prev) => prev.filter((f) => f.id !== id));
  };

  const handleFieldChange = (id, key, val) => {
    setCustomFields((prev) => prev.map((f) => (f.id === id ? { ...f, [key]: val } : f)));
  };

  const handleFormattingChange = (id, fmt) => {
    setCustomFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...fmt } : f)));
  };

  const handleFieldContentChange = (id, html) => {
    const fmt = extractFormattingFromHtml(html);
    setCustomFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...fmt } : f)));
  };

  const handleEventFieldChange = (id, key, val) => {
    setEventFields((prev) => prev.map((f) => (f.id === id ? { ...f, [key]: val } : f)));
  };

  const handleEventFormattingChange = (id, fmt) => {
    setEventFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...fmt } : f)));
  };

  const handleEventFieldContentChange = (id, html) => {
    const fmt = extractFormattingFromHtml(html);
    setEventFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...fmt } : f)));
  };

  const handleBrandingItemFieldChange = (idx, key, val) => {
    setBrandingMediaItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: val };
      return next;
    });
  };

  const handleAddBrandingMedia = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const newItems = files.map((file) => ({
      _id: null, url: URL.createObjectURL(file), file,
      width: 200, height: 60, x: 50, y: 15,
    }));
    setBrandingMediaItems((prev) => [...prev, ...newItems]);
    e.target.value = "";
  };

  const handleConfirmRemoveBrandingItem = async () => {
    const idx = confirmRemoveBrandingIndex;
    if (idx === null) return;
    const item = brandingMediaItems[idx];
    if (item._id) {
      setRemoveBrandingMediaIds((prev) => [...prev, item._id]);
    } else if (item.url?.startsWith("blob:")) {
      URL.revokeObjectURL(item.url);
    }
    setBrandingMediaItems((prev) => prev.filter((_, i) => i !== idx));
    setConfirmRemoveBrandingIndex(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const formData = {
        logo: { ...logo, url: logo.url },
        backgroundImage: { ...backgroundImage, url: backgroundImage.url },
        brandingMedia: { items: brandingMediaItems.map(i => ({ ...i, url: i.url })) },
        qr,
        customFields: [...eventFields, ...customFields],
      };

      if (isEventMode && eventId && onSaveEventQrWrapper) {
        await onSaveEventQrWrapper(eventId, formData);
        onClose();
      } else {
        // Global config service was removed
        console.log("Saving default wrapper (service missing):", formData);
        onClose();
      }
    } catch (err) {
      showMessage(err?.message || "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  const renderFieldEditor = (f, onContentChange, onFormattingChangeFn, onXChangeFn, onYChangeFn, onFontFamilyChangeFn) => (
    <QrWrapperFieldEditor
      value={getContentFromField(f)}
      onChange={(html) => onContentChange(f.id, html)}
      onFormattingChange={(fmt) => onFormattingChangeFn(f.id, fmt)}
      placeholder={`${f.label}...`}
      dir={dir}
      minHeight="100px"
      maxHeight="200px"
      x={f.x}
      y={f.y}
      fontFamily={f.fontFamily ?? "Arial"}
      onXChange={(val) => onXChangeFn(f.id, "x", val)}
      onYChange={(val) => onYChangeFn(f.id, "y", val)}
      onFontFamilyChange={(val) => onFontFamilyChangeFn(f.id, "fontFamily", val)}
      t={t}
      availableFonts={availableFonts || []}
    />
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      dir={dir}
      PaperProps={{ sx: { height: "90vh", maxHeight: "90vh" } }}
    >
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: "bold", px: 3, pt: 3 }}>
        <Typography fontWeight="bold" fontSize="1.25rem">
          {isEventMode ? t.titleEvent : t.title}
        </Typography>
        <IconButton onClick={onClose} size="small"><ICONS.close /></IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0, display: "flex", flexDirection: "row", overflow: "hidden" }}>
        <Box sx={{ flex: 1, minWidth: 0, overflowY: "auto", p: 2, borderRight: "1px solid", borderColor: "divider" }}>
          <Stack spacing={2}>
            {isEventMode ? (
              <>
                {eventFields.length > 0 && (
                  <>
                    {eventFields.map((f) => (
                      <Paper key={f.id} variant="outlined" sx={{ p: 1.5 }}>
                        <Stack spacing={1.5}>
                          <Typography variant="subtitle1" fontWeight={600}>{f.label || f.id}</Typography>
                          {renderFieldEditor(f, handleEventFieldContentChange, handleEventFormattingChange, handleEventFieldChange, handleEventFieldChange, handleEventFieldChange)}
                        </Stack>
                      </Paper>
                    ))}
                    <Divider />
                  </>
                )}

                {customFields.map((f) => (
                  <Paper key={f.id} variant="outlined" sx={{ p: 1.5 }}>
                    <Stack spacing={1.5}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="subtitle1" fontWeight={600}>{f.label || "field1"}</Typography>
                        <IconButton size="small" color="error" onClick={() => handleRemoveField(f.id)} aria-label={t.remove}>
                          <ICONS.delete />
                        </IconButton>
                      </Stack>
                      {renderFieldEditor(f, handleFieldContentChange, handleFormattingChange, handleFieldChange, handleFieldChange, handleFieldChange)}
                    </Stack>
                  </Paper>
                ))}
                <Button variant="outlined" fullWidth startIcon={<ICONS.add />} sx={getStartIconSpacing(dir)} onClick={handleAddField}>
                  {t.addFields}
                </Button>
                {(eventFields.length > 0 || customFields.length > 0) && <Divider />}

                {includeLogo && (
                  <>
                    <Typography variant="subtitle1" fontWeight={600}>{t.logo}</Typography>
                    {logoPreview && <Avatar src={logoPreview} variant="square" sx={{ width: 72, height: 72 }} />}
                    <Stack direction="row" spacing={1.5} flexWrap="wrap" alignItems="center">
                      <WidthHeightField width={logo.width} height={logo.height} onWidthChange={(v) => setLogo((p) => ({ ...p, width: v }))} onHeightChange={(v) => setLogo((p) => ({ ...p, height: v }))} widthLabel={t.logoWidth} heightLabel={t.logoHeight} t={t} minSize={0} defaultPx={150} />
                      <ClampedNumberInput label={t.logoX} value={logo.x} min={0} max={100} onChange={(v) => setLogo((p) => ({ ...p, x: v }))} sx={{ width: 90, minWidth: 80 }} />
                      <ClampedNumberInput label={t.logoY} value={logo.y} min={0} max={100} onChange={(v) => setLogo((p) => ({ ...p, x: v }))} sx={{ width: 90, minWidth: 80 }} />
                    </Stack>
                    <Divider />
                  </>
                )}

                {includeBackground && (
                  <>
                    <Typography variant="subtitle1" fontWeight={600}>{t.backgroundImage}</Typography>
                    {backgroundPreview && <Avatar src={backgroundPreview} variant="square" sx={{ width: 72, height: 72 }} />}
                    <Divider />
                  </>
                )}

                {includeBrandingMedia && (
                  <>
                    <Typography variant="subtitle1" fontWeight={600}>{t.brandingMedia}</Typography>
                    <Stack spacing={1.5} sx={{ maxHeight: 360, overflow: "auto" }}>
                      {brandingMediaItems.length === 0 && <Typography color="text.secondary">{t.none}</Typography>}
                      {brandingMediaItems.map((item, idx) => (
                        <Paper key={idx} variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
                          <Stack direction="row" alignItems="flex-start" spacing={2}>
                            {item.url && <Avatar src={item.url} variant="square" sx={{ width: 56, height: 56, flexShrink: 0 }} />}
                            <Stack direction="row" spacing={1.5} flexWrap="wrap" alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
                              <WidthHeightField width={item.width} height={item.height} onWidthChange={(v) => handleBrandingItemFieldChange(idx, "width", v)} onHeightChange={(v) => handleBrandingItemFieldChange(idx, "height", v)} widthLabel={t.brandingWidth} heightLabel={t.brandingHeight} t={t} minSize={0} />
                              <ClampedNumberInput label={t.brandingX} value={item.x} min={0} max={100} onChange={(v) => handleBrandingItemFieldChange(idx, "x", v)} sx={{ width: 72, minWidth: 72 }} />
                              <ClampedNumberInput label={t.brandingY} value={item.y} min={0} max={100} onChange={(v) => handleBrandingItemFieldChange(idx, "y", v)} sx={{ width: 72, minWidth: 72 }} />
                            </Stack>
                            <Tooltip title={t.remove}>
                              <IconButton size="small" color="error" onClick={() => { if (!item._id) { if (item.url?.startsWith("blob:")) URL.revokeObjectURL(item.url); setBrandingMediaItems((prev) => prev.filter((_, i) => i !== idx)); } else { setConfirmRemoveBrandingIndex(idx); } }} aria-label={t.remove} sx={{ flexShrink: 0 }}>
                                <ICONS.delete />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </Paper>
                      ))}
                    </Stack>
                    <Divider />
                  </>
                )}
              </>
            ) : (
              <>
                <Typography variant="subtitle1" fontWeight={600}>{t.logo}</Typography>
                <Stack direction="row" alignItems="center" spacing={2}>
                  {logoPreview && <Avatar src={logoPreview} variant="square" sx={{ width: 72, height: 72 }} />}
                  <Button variant="outlined" component="label" size="small">
                    {t.upload}
                    <input ref={logoFileInputRef} type="file" accept="image/*" hidden onChange={(e) => { setLogoFile(e.target.files?.[0] || null); e.target.value = ""; }} />
                  </Button>
                  {logoPreview && (
                    <Button size="small" color="error" variant="text" onClick={() => { if (logoFile) { setLogoFile(null); setLogo((p) => ({ ...p, url: "" })); setLogoPreview(""); if (logoFileInputRef.current) logoFileInputRef.current.value = ""; } else { setConfirmRemoveLogo(true); } }}>
                      {t.remove}
                    </Button>
                  )}
                </Stack>
                <Stack direction="row" spacing={1.5} flexWrap="wrap" alignItems="center">
                  <WidthHeightField width={logo.width} height={logo.height} onWidthChange={(v) => setLogo((p) => ({ ...p, width: v }))} onHeightChange={(v) => setLogo((p) => ({ ...p, height: v }))} widthLabel={t.logoWidth} heightLabel={t.logoHeight} t={t} minSize={0} defaultPx={150} />
                  <ClampedNumberInput label={t.logoX} value={logo.x} min={0} max={100} onChange={(v) => setLogo((p) => ({ ...p, x: v }))} sx={{ width: 90, minWidth: 80 }} />
                  <ClampedNumberInput label={t.logoY} value={logo.y} min={0} max={100} onChange={(v) => setLogo((p) => ({ ...p, y: v }))} sx={{ width: 90, minWidth: 80 }} />
                </Stack>
                <Divider />

                <Typography variant="subtitle1" fontWeight={600}>{t.backgroundImage}</Typography>
                <Stack direction="row" alignItems="center" spacing={2}>
                  {backgroundPreview && <Avatar src={backgroundPreview} variant="square" sx={{ width: 72, height: 72 }} />}
                  <Button variant="outlined" component="label" size="small">
                    {t.upload}
                    <input ref={backgroundFileInputRef} type="file" accept="image/*" hidden onChange={(e) => { setBackgroundFile(e.target.files?.[0] || null); e.target.value = ""; }} />
                  </Button>
                  {backgroundPreview && (
                    <Button size="small" color="error" variant="text" onClick={() => { if (backgroundFile) { setBackgroundFile(null); setBackgroundImage((p) => ({ ...p, url: "" })); setBackgroundPreview(""); if (backgroundFileInputRef.current) backgroundFileInputRef.current.value = ""; } else { setConfirmRemoveBackground(true); } }}>
                      {t.remove}
                    </Button>
                  )}
                </Stack>
                <Divider />

                <Typography variant="subtitle1" fontWeight={600}>{t.brandingMedia}</Typography>
                <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1 }}>
                  <Button variant="outlined" component="label" size="small">
                    {t.addBrandingMedia}
                    <input ref={brandingFileInputRef} type="file" accept="image/*,video/*" multiple hidden onChange={handleAddBrandingMedia} />
                  </Button>
                  <Button variant="outlined" color="error" size="small" disabled={brandingMediaItems.length === 0}
                    onClick={() => { const hasExisting = brandingMediaItems.some((i) => i._id); if (hasExisting) { setConfirmClearAllBranding(true); } else { brandingMediaItems.forEach((i) => { if (i.url?.startsWith("blob:")) URL.revokeObjectURL(i.url); }); setBrandingMediaItems([]); if (brandingFileInputRef.current) brandingFileInputRef.current.value = ""; } }}>
                    {t.clearAllBranding}
                  </Button>
                </Stack>
                <Stack spacing={1.5} sx={{ maxHeight: 360, overflow: "auto" }}>
                  {brandingMediaItems.length === 0 && <Typography color="text.secondary">{t.none}</Typography>}
                  {brandingMediaItems.map((item, idx) => (
                    <Paper key={idx} variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
                      <Stack direction="row" alignItems="flex-start" spacing={2}>
                        <Avatar src={item.url} variant="square" sx={{ width: 56, height: 56, flexShrink: 0 }} />
                        <Stack direction="row" spacing={1.5} flexWrap="wrap" alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
                          <WidthHeightField width={item.width} height={item.height} onWidthChange={(v) => handleBrandingItemFieldChange(idx, "width", v)} onHeightChange={(v) => handleBrandingItemFieldChange(idx, "height", v)} widthLabel={t.brandingWidth} heightLabel={t.brandingHeight} t={t} minSize={0} />
                          <ClampedNumberInput label={t.brandingX} value={item.x} min={0} max={100} onChange={(v) => handleBrandingItemFieldChange(idx, "x", v)} sx={{ width: 72, minWidth: 72 }} />
                          <ClampedNumberInput label={t.brandingY} value={item.y} min={0} max={100} onChange={(v) => handleBrandingItemFieldChange(idx, "y", v)} sx={{ width: 72, minWidth: 72 }} />
                        </Stack>
                        <Tooltip title={t.remove}>
                          <IconButton size="small" color="error" onClick={() => { if (!item._id) { if (item.url?.startsWith("blob:")) URL.revokeObjectURL(item.url); setBrandingMediaItems((prev) => prev.filter((_, i) => i !== idx)); if (brandingFileInputRef.current) brandingFileInputRef.current.value = ""; } else { setConfirmRemoveBrandingIndex(idx); } }} aria-label={t.remove} sx={{ flexShrink: 0 }}>
                            <ICONS.delete />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
                <Divider />
              </>
            )}

            <Typography variant="subtitle1" fontWeight={600}>{t.qrPosition}</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <ClampedNumberInput label={t.qrX} value={qr.x} min={0} max={100} onChange={(v) => setQr((p) => ({ ...p, x: v }))} sx={{ width: 90 }} />
              <ClampedNumberInput label={t.qrY} value={qr.y} min={0} max={100} onChange={(v) => setQr((p) => ({ ...p, y: v }))} sx={{ width: 90 }} />
              <ClampedNumberInput label={t.qrSize} value={qr.size} min={60} onChange={(v) => setQr((p) => ({ ...p, size: v }))} sx={{ width: 100 }} />
            </Stack>
            <Divider />

            {!isEventMode && (
              <>
                {customFields.map((f) => (
                  <Paper key={f.id} variant="outlined" sx={{ p: 1.5 }}>
                    <Stack spacing={1.5}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="subtitle1" fontWeight={600}>{f.label || "field1"}</Typography>
                        <IconButton size="small" color="error" onClick={() => handleRemoveField(f.id)} aria-label={t.remove}>
                          <ICONS.delete />
                        </IconButton>
                      </Stack>
                      {renderFieldEditor(f, handleFieldContentChange, handleFormattingChange, handleFieldChange, handleFieldChange, handleFieldChange)}
                    </Stack>
                  </Paper>
                ))}
                <Button variant="outlined" fullWidth startIcon={<ICONS.add />} sx={getStartIconSpacing(dir)} onClick={handleAddField}>
                  {t.addFields}
                </Button>
              </>
            )}
          </Stack>
        </Box>

        <Box sx={{ width: "380px", flexShrink: 0, p: 2, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", bgcolor: "background.default" }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>{t.preview}</Typography>
          <Box sx={{ width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT, position: "relative", bgcolor: "#f5f5f5", borderRadius: 1, overflow: "hidden", border: "1px solid", borderColor: "divider" }}>
            <Box sx={{ position: "absolute", left: 0, top: 0, width: TEMPLATE_WIDTH, height: TEMPLATE_HEIGHT, transform: `scale(${PREVIEW_SCALE})`, transformOrigin: "0 0", bgcolor: "#f5f5f5" }}>
              {backgroundPreview && (!isEventMode || includeBackground) && (
                <Box component="img" src={backgroundPreview} alt="" sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
              )}
              {logoPreview && (!isEventMode || includeLogo) && (
                <Box component="img" src={logoPreview} alt="Logo" sx={{
                  position: "absolute", left: `${logo.x}%`, top: `${logo.y}%`,
                  width: (logo.width == null || logo.width === 0) ? "auto" : logo.width,
                  height: (logo.height == null || logo.height === 0) ? "auto" : logo.height,
                  ...((logo.width == null || logo.width === 0) && (logo.height == null || logo.height === 0) ? { maxWidth: TEMPLATE_WIDTH, maxHeight: TEMPLATE_HEIGHT } : {}),
                  objectFit: "contain", transform: "translate(-50%, -50%)",
                }} />
              )}
              {(!isEventMode || includeBrandingMedia) && brandingMediaItems.map((item, idx) =>
                item?.url ? (
                  <Box key={idx} component="img" src={item.url} alt="" sx={{
                    position: "absolute", left: `${item.x}%`, top: `${item.y}%`,
                    width: (item.width == null || item.width === 0) ? "auto" : item.width,
                    height: (item.height == null || item.height === 0) ? "auto" : item.height,
                    ...((item.width == null || item.width === 0) && (item.height == null || item.height === 0) ? { maxWidth: TEMPLATE_WIDTH, maxHeight: TEMPLATE_HEIGHT } : {}),
                    objectFit: "contain", transform: "translate(-50%, -50%)",
                  }} />
                ) : null
              )}
              {(isEventMode ? [...eventFields, ...customFields] : customFields).map((f) => (
                <Box
                  key={f.id}
                  sx={{
                    position: "absolute",
                    left: `${num(f.x, 0)}%`,
                    top: `${num(f.y, 0)}%`,
                    transform: "translate(-50%, -50%)",
                    fontSize: `${num(f.fontSize, 14) * PREVIEW_SCALE}px`,
                    fontFamily: f.fontFamily || "Arial",
                    fontWeight: f.isBold ? "bold" : "normal",
                    fontStyle: f.isItalic ? "italic" : "normal",
                    textDecoration: f.isUnderline ? "underline" : "none",
                    color: f.color || "#000000",
                    textAlign: f.alignment || "left",
                    // Use minWidth so justify has space to spread — nowrap prevented it
                    minWidth: (f.alignment === "justify") ? "300px" : "auto",
                    whiteSpace: (f.alignment === "justify") ? "normal" : "nowrap",
                    wordBreak: "normal",
                    padding: 0, margin: 0, lineHeight: 1,
                  }}
                  dangerouslySetInnerHTML={{
                    __html: getContentFromField(f).replace(/<p[^>]*>/gi, "").replace(/<\/p>/gi, "").trim(),
                  }}
                />
              ))}
              {qrCodeDataUrl && (
                <Box component="img" src={qrCodeDataUrl} alt="QR" sx={{ position: "absolute", left: `${qr.x}%`, top: `${qr.y}%`, width: qr.size, height: qr.size, transform: "translate(-50%, -50%)" }} />
              )}
              {qrCodeDataUrl && logoPreview && (
                <Box component="img" src={logoPreview} alt="" sx={{ position: "absolute", left: `${qr.x}%`, top: `${qr.y}%`, width: qr.size * 0.22, height: qr.size * 0.22, transform: "translate(-50%, -50%)", objectFit: "contain", pointerEvents: "none" }} />
              )}
            </Box>
          </Box>
        </Box>
      </DialogContent>

      <ConfirmationDialog open={confirmRemoveLogo} onClose={() => setConfirmRemoveLogo(false)}
        onConfirm={async () => {
          setLogoFile(null); setLogo((p) => ({ ...p, url: "" })); setLogoPreview(""); setConfirmRemoveLogo(false);
        }}
        title={t.confirmRemoveLogo} message={t.confirmRemoveLogoMsg} confirmButtonText={t.remove} confirmButtonIcon={<ICONS.delete />}
      />
      <ConfirmationDialog open={confirmRemoveBackground} onClose={() => setConfirmRemoveBackground(false)}
        onConfirm={async () => {
          setBackgroundFile(null); setBackgroundImage((p) => ({ ...p, url: "" })); setBackgroundPreview(""); setConfirmRemoveBackground(false);
        }}
        title={t.confirmRemoveBackground} message={t.confirmRemoveBackgroundMsg} confirmButtonText={t.remove} confirmButtonIcon={<ICONS.delete />}
      />
      <ConfirmationDialog open={confirmRemoveBrandingIndex !== null} onClose={() => setConfirmRemoveBrandingIndex(null)}
        onConfirm={handleConfirmRemoveBrandingItem}
        title={t.confirmRemoveBranding} message={t.confirmRemoveBrandingMsg} confirmButtonText={t.remove} confirmButtonIcon={<ICONS.delete />}
      />
      <ConfirmationDialog open={confirmClearAllBranding} onClose={() => setConfirmClearAllBranding(false)}
        onConfirm={async () => {
          if (digitalFileInputRef.current) digitalFileInputRef.current.value = "";
          setBrandingMediaItems([]); setPendingClearAllBranding(false); setConfirmClearAllBranding(false);
        }}
        title={t.confirmClearAllBranding} message={t.confirmClearAllBrandingMsg} confirmButtonText={t.remove} confirmButtonIcon={<ICONS.delete />}
      />

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="outlined" startIcon={<ICONS.cancel />} sx={getStartIconSpacing(dir)}>{t.cancel}</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving} startIcon={saving ? null : <ICONS.save />} sx={getStartIconSpacing(dir)}>
          {saving ? "..." : t.save}
        </Button>
      </DialogActions>
    </Dialog>
  );
}