import html2canvas from "html2canvas";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { formatDateTimeWithLocale, formatDate } from "@/utils/dateUtils";

// Layout & font sizes
const FONT_TITLE = 16;
const FONT_SECTION = 14;
const FONT_LABEL = 9;
const FONT_VALUE = 9;
const FONT_PAGENUM = 10;
const FONT_TABLE = 7.5;

const LEFT_MARGIN = 42.52;
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const LINE_HEIGHT = 14.17;
const CHART_MAX_HEIGHT = 250;
const SPACING = 22.68;
const TABLE_ROW_H = 13;
const TABLE_HEADER_H = 16;

const loadCairoFonts = async (pdf) => {
  try {
    const regularResponse = await fetch("/fonts/cairo/Cairo-Regular.ttf");
    const regularBytes = await regularResponse.arrayBuffer();
    const font = await pdf.embedFont(regularBytes);

    const boldResponse = await fetch("/fonts/cairo/Cairo-Bold.ttf");
    const boldBytes = await boldResponse.arrayBuffer();
    const bold = await pdf.embedFont(boldBytes);

    return { font, bold };
  } catch (error) {
    console.error("Error loading Cairo fonts:", error);
    return null;
  }
};

const getTextX = (text, x, pageWidth, margin, isRTL, align = "left", font, fontSize) => {
  if (isRTL && align === "left") {
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    return pageWidth - margin - textWidth;
  }
  return x;
};

const renderLabelValue = (page, label, value, x, y, pageWidth, margin, isRTL, font, boldFont, fontSize) => {
  const colon = ":";
  const spacing = 2.8;

  if (isRTL) {
    const valueText = String(value);
    const labelText = String(label);
    const labelWidth = boldFont.widthOfTextAtSize(labelText, fontSize);
    const colonWidth = font.widthOfTextAtSize(colon, fontSize);
    const valueWidth = font.widthOfTextAtSize(valueText, fontSize);
    const labelX = pageWidth - margin - labelWidth;
    const colonX = labelX - spacing - colonWidth;
    const valueX = colonX - spacing - valueWidth;

    page.drawText(valueText, { x: valueX, y, size: fontSize, font });
    page.drawText(colon, { x: colonX, y, size: fontSize, font });
    page.drawText(labelText, { x: labelX, y, size: fontSize, font: boldFont });
  } else {
    const labelText = `${label}${colon} `;
    const labelWidth = boldFont.widthOfTextAtSize(labelText, fontSize);
    page.drawText(labelText, { x, y, size: fontSize, font: boldFont });
    page.drawText(String(value), { x: x + labelWidth, y, size: fontSize, font });
  }
};

const addEventHeader = async (
  pdf, page, eventInfo, pageWidth, margin,
  surveyInfo = null, language = "en", isRTL = false,
  translations = {}, font, boldFont
) => {
  if (!eventInfo) return PAGE_HEIGHT - margin;

  const logoMaxWidth = 113.39;
  const logoMaxHeight = 56.69;
  let currentY = PAGE_HEIGHT - margin;

  if (eventInfo.logoUrl) {
    try {
      const response = await fetch(eventInfo.logoUrl);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      let image;
      if (blob.type === "image/png") image = await pdf.embedPng(arrayBuffer);
      else image = await pdf.embedJpg(arrayBuffer);
      const imgDims = image.scale(Math.min(logoMaxWidth / image.width, logoMaxHeight / image.height));
      const logoX = isRTL ? pageWidth - margin - imgDims.width : margin;
      page.drawImage(image, { x: logoX, y: currentY - imgDims.height, width: imgDims.width, height: imgDims.height });
      currentY -= imgDims.height + 17;
    } catch (error) {
      console.error("Error loading event logo:", error);
    }
  }

  const eventName = String(eventInfo.name || "");
  const eventNameX = getTextX(eventName, margin, pageWidth, margin, isRTL, "left", boldFont, FONT_TITLE);
  page.drawText(eventName, { x: eventNameX, y: currentY, size: FONT_TITLE, font: boldFont, color: rgb(0.12, 0.16, 0.22) });
  currentY -= 14.17;

  if (eventInfo.subtitle) {
    renderLabelValue(page, eventInfo.subtitleLabel || "Event Name", String(eventInfo.subtitle), margin, currentY, pageWidth, margin, isRTL, font, boldFont, FONT_LABEL);
    currentY -= LINE_HEIGHT;
  }

  const fromDate = eventInfo.startDateFormatted || formatDate(eventInfo.startDate);
  const toDate = eventInfo.endDateFormatted || formatDate(eventInfo.endDate);
  const fromLabel = translations.from || "From";
  const toLabel = translations.to || "To";
  const venueLabel = translations.venue || "Venue";
  const registrationsLabel = translations.registrations || "Registrations";

  renderLabelValue(page, fromLabel, fromDate, margin, currentY, pageWidth, margin, isRTL, font, boldFont, FONT_LABEL);
  currentY -= LINE_HEIGHT;
  renderLabelValue(page, toLabel, toDate, margin, currentY, pageWidth, margin, isRTL, font, boldFont, FONT_LABEL);
  currentY -= LINE_HEIGHT;
  renderLabelValue(page, venueLabel, String(eventInfo.venue || ""), margin, currentY, pageWidth, margin, isRTL, font, boldFont, FONT_LABEL);
  currentY -= LINE_HEIGHT;

  if (eventInfo.registrations !== undefined && eventInfo.registrations !== null) {
    const regValue = String(eventInfo.registrations);
    renderLabelValue(page, registrationsLabel, regValue, margin, currentY, pageWidth, margin, isRTL, font, boldFont, FONT_LABEL);
    currentY -= LINE_HEIGHT;
  }

  if (surveyInfo) {
    if (surveyInfo.title) {
      renderLabelValue(page, translations.titleOfSurvey || "Title of survey", String(surveyInfo.title), margin, currentY, pageWidth, margin, isRTL, font, boldFont, FONT_LABEL);
      currentY -= LINE_HEIGHT;
    }
    if (surveyInfo.totalResponses !== undefined && surveyInfo.totalResponses !== null) {
      renderLabelValue(page, translations.totalResponses || "Total Responses", String(surveyInfo.totalResponses), margin, currentY, pageWidth, margin, isRTL, font, boldFont, FONT_LABEL);
      currentY -= LINE_HEIGHT;
    }
  }

  page.drawLine({
    start: { x: margin, y: currentY },
    end: { x: pageWidth - margin, y: currentY },
    thickness: 0.5,
    color: rgb(0.6, 0.6, 0.6),
  });

  return currentY - 8.5;
};

export const exportChartsToPDF = async (
  chartRefs,
  fieldLabels,
  chartDataArray,
  eventInfo,
  surveyInfo = null,
  language = "en",
  dir = "ltr",
  translations = {}
) => {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  const isRTL = dir === "rtl";
  const pageWidth = PAGE_WIDTH;
  const pageHeight = PAGE_HEIGHT;
  const margin = LEFT_MARGIN;
  const chartWidth = pageWidth - margin * 2;
  const spacing = SPACING;

  let font, boldFont;
  const fonts = await loadCairoFonts(pdf);
  if (fonts) {
    font = fonts.font;
    boldFont = fonts.bold;
  } else {
    font = await pdf.embedFont("Helvetica");
    boldFont = await pdf.embedFont("Helvetica-Bold");
  }

  // Mutable page state — updated by helpers below
  let page = pdf.addPage([pageWidth, pageHeight]);
  let yPosition;
  try {
    yPosition = await addEventHeader(pdf, page, eventInfo, pageWidth, margin, surveyInfo, language, isRTL, translations, font, boldFont);
  } catch (err) {
    console.error("Error rendering PDF header:", err);
    yPosition = PAGE_HEIGHT - margin;
  }
  yPosition -= spacing;

  const addNewPage = () => {
    page = pdf.addPage([pageWidth, pageHeight]);
    yPosition = pageHeight - margin;
  };

  const ensureSpace = (needed) => {
    if (yPosition - needed < margin + 10) addNewPage();
  };

  // ─── Table helpers ────────────────────────────────────────────────────────────

  const drawTableHeader = (cols) => {
    ensureSpace(TABLE_HEADER_H + 4);
    const tableWidth = cols.reduce((s, c) => s + c.width, 0);
    const tableX = margin;

    page.drawRectangle({
      x: tableX, y: yPosition - TABLE_HEADER_H,
      width: tableWidth, height: TABLE_HEADER_H,
      color: rgb(0.12, 0.16, 0.22),
    });

    let cx = isRTL ? tableX + tableWidth : tableX;
    const orderedCols = isRTL ? [...cols].reverse() : cols;
    for (const col of orderedCols) {
      if (isRTL) cx -= col.width;
      const tw = boldFont.widthOfTextAtSize(col.label, FONT_TABLE);
      let tx;
      if (col.align === "right") tx = cx + col.width - tw - 3;
      else if (col.align === "center") tx = cx + (col.width - tw) / 2;
      else tx = cx + 4;
      page.drawText(col.label, {
        x: Math.max(tx, cx + 2),
        y: yPosition - TABLE_HEADER_H + 4,
        size: FONT_TABLE, font: boldFont, color: rgb(1, 1, 1),
      });
      if (!isRTL) cx += col.width;
    }
    yPosition -= TABLE_HEADER_H;
  };

  const drawTableRow = (cols, values, rowIndex, isSummary = false) => {
    ensureSpace(TABLE_ROW_H);
    const tableWidth = cols.reduce((s, c) => s + c.width, 0);
    const tableX = margin;

    if (isSummary) {
      page.drawRectangle({
        x: tableX, y: yPosition - TABLE_ROW_H,
        width: tableWidth, height: TABLE_ROW_H,
        color: rgb(0.88, 0.92, 0.97),
      });
    } else if (rowIndex % 2 === 0) {
      page.drawRectangle({
        x: tableX, y: yPosition - TABLE_ROW_H,
        width: tableWidth, height: TABLE_ROW_H,
        color: rgb(0.96, 0.97, 0.98),
      });
    }

    page.drawLine({
      start: { x: tableX, y: yPosition - TABLE_ROW_H },
      end: { x: tableX + tableWidth, y: yPosition - TABLE_ROW_H },
      thickness: 0.3, color: rgb(0.82, 0.82, 0.82),
    });

    let cx = isRTL ? tableX + tableWidth : tableX;
    const orderedCols = isRTL ? [...cols].reverse() : cols;
    const orderedVals = isRTL ? [...values].reverse() : values;

    for (let i = 0; i < orderedCols.length; i++) {
      const col = orderedCols[i];
      const val = String(orderedVals[i] ?? "");
      if (isRTL) cx -= col.width;
      const rowFont = isSummary ? boldFont : font;
      const tw = rowFont.widthOfTextAtSize(val, FONT_TABLE);
      let tx;
      if (col.align === "right") tx = cx + col.width - tw - 3;
      else if (col.align === "center") tx = cx + (col.width - tw) / 2;
      else tx = cx + 4;
      page.drawText(val, {
        x: Math.max(tx, cx + 2),
        y: yPosition - TABLE_ROW_H + 3,
        size: FONT_TABLE, font: rowFont, color: rgb(0.12, 0.16, 0.22),
      });
      if (!isRTL) cx += col.width;
    }
    yPosition -= TABLE_ROW_H;
  };

  const renderDataTable = (chartData) => {
    const t = translations;
    const tableWidth = pageWidth - margin * 2;

    if (chartData.chartType === "pie" && chartData.data && chartData.data.length > 0) {
      const cols = [
        { label: "#", width: tableWidth * 0.08, align: "center" },
        { label: t.category || "Category", width: tableWidth * 0.52, align: "left" },
        { label: t.count || "Count", width: tableWidth * 0.2, align: "right" },
        { label: t.percentage || "Percentage", width: tableWidth * 0.2, align: "right" },
      ];

      yPosition -= 8;
      drawTableHeader(cols);

      const total = chartData.data.reduce((s, d) => s + d.value, 0);
      chartData.data.forEach((item, idx) => {
        const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) + "%" : "0%";
        drawTableRow(cols, [String(idx + 1), item.label, String(item.value), pct], idx);
      });

      // Total summary row
      drawTableRow(cols, ["", t.total || "Total", String(total), "100%"], -1, true);

    } else if (chartData.chartType === "line" && chartData.xData && chartData.xData.length > 0) {
      const cols = [
        { label: t.timestamp || "Timestamp", width: tableWidth * 0.7, align: "left" },
        { label: t.count || "Count", width: tableWidth * 0.3, align: "right" },
      ];

      yPosition -= 8;
      drawTableHeader(cols);

      chartData.xData.forEach((label, idx) => {
        drawTableRow(cols, [label, String(chartData.yData[idx])], idx);
      });

      // Summary rows
      const totalCount = chartData.yData.reduce((s, v) => s + (v || 0), 0);
      const maxVal = Math.max(...chartData.yData);
      const peakIdx = chartData.yData.indexOf(maxVal);

      drawTableRow(cols, [t.total || "Total", String(totalCount)], -1, true);
      if (peakIdx >= 0 && maxVal > 0) {
        const peakLabel = t.peak || "Peak";
        drawTableRow(cols, [`${peakLabel}: ${chartData.xData[peakIdx]}`, String(maxVal)], -2, true);
      }
    }
  };

  // ─── Chart rendering loop ─────────────────────────────────────────────────────

  let isFirstChart = true;

  for (let i = 0; i < chartRefs.length; i++) {
    const chartElement = chartRefs[i];
    const fieldLabel = fieldLabels[i];
    const chartData = chartDataArray[i];
    if (!chartElement) continue;

    try {
      const legendElements = chartElement.querySelectorAll(
        '.MuiChartsLegend-root, [class*="MuiChartsLegend"]'
      );
      legendElements.forEach((el) => (el.style.display = "none"));

      const canvas = await html2canvas(chartElement, {
        scale: 2, backgroundColor: "#ffffff", logging: false, useCORS: true,
      });

      legendElements.forEach((el) => (el.style.display = ""));

      const imgData = canvas.toDataURL("image/png");
      const imgBytes = await fetch(imgData).then((res) => res.arrayBuffer());
      const chartImage = await pdf.embedPng(imgBytes);

      const imgAspectRatio = canvas.width / canvas.height;
      const chartHeight = Math.min(chartWidth / imgAspectRatio, CHART_MAX_HEIGHT);

      const titleHeight = 14;
      const isSpecial = chartData.type === "special";
      const metadataHeight =
        chartData.chartType === "line" ? 45 :
        (chartData.type === "text" || chartData.type === "number" || isSpecial) ? 14 : 0;
      const totalHeight = titleHeight + spacing + metadataHeight + spacing + chartHeight + spacing;

      if (yPosition - totalHeight < margin && !isFirstChart) addNewPage();

      // Section title
      const fieldLabelX = getTextX(fieldLabel, margin, pageWidth, margin, isRTL, "left", boldFont, FONT_SECTION);
      page.drawText(fieldLabel, {
        x: fieldLabelX, y: yPosition,
        size: FONT_SECTION, font: boldFont, color: rgb(0.12, 0.16, 0.22),
      });
      yPosition -= 20;

      // Metadata
      if (chartData.chartType === "pie" && (chartData.type === "text" || chartData.type === "number")) {
        renderLabelValue(page, translations.topN || "Top N", String(chartData.topN ?? 10), margin, yPosition, pageWidth, margin, isRTL, font, boldFont, FONT_LABEL);
        yPosition -= LINE_HEIGHT;
      } else if (chartData.chartType === "line") {
        const startDate = formatDateTimeWithLocale(chartData.startDateTime);
        const endDate = formatDateTimeWithLocale(chartData.endDateTime);
        const intervalValue = `${chartData.intervalMinutes ?? 60} min`;
        renderLabelValue(page, translations.from || "From", startDate, margin, yPosition, pageWidth, margin, isRTL, font, boldFont, FONT_LABEL);
        yPosition -= LINE_HEIGHT;
        renderLabelValue(page, translations.to || "To", endDate, margin, yPosition, pageWidth, margin, isRTL, font, boldFont, FONT_LABEL);
        yPosition -= LINE_HEIGHT;
        renderLabelValue(page, translations.intervalMinutes || "Interval (min)", intervalValue, margin, yPosition, pageWidth, margin, isRTL, font, boldFont, FONT_LABEL);
        yPosition -= LINE_HEIGHT;
      }

      yPosition -= spacing + 8.5;

      // Chart screenshot
      const chartX = isRTL ? pageWidth - margin - chartWidth : margin;
      page.drawImage(chartImage, {
        x: chartX, y: yPosition - chartHeight,
        width: chartWidth, height: chartHeight,
      });
      yPosition -= chartHeight + spacing;

      // Data table
      renderDataTable(chartData);

      // Section divider
      yPosition -= spacing / 2;
      ensureSpace(1);
      page.drawLine({
        start: { x: margin, y: yPosition },
        end: { x: pageWidth - margin, y: yPosition },
        thickness: 0.3, color: rgb(0.6, 0.6, 0.6),
      });
      yPosition -= spacing;

      isFirstChart = false;
    } catch (error) {
      console.error(`Error capturing chart ${i}:`, error);
    }
  }

  // Page numbers
  const pages = pdf.getPages();
  const totalPages = pages.length;
  const pageLabel = translations.page || "Page";
  const ofLabel = translations.of || "of";

  for (let i = 0; i < totalPages; i++) {
    const pg = pages[i];
    const pageText = language === "ar"
      ? `الصفحة ${i + 1} من ${totalPages}`
      : `${pageLabel} ${i + 1} ${ofLabel} ${totalPages}`;
    const textWidth = font.widthOfTextAtSize(pageText, FONT_PAGENUM);
    pg.drawText(pageText, {
      x: (pageWidth - textWidth) / 2, y: 20,
      size: FONT_PAGENUM, font, color: rgb(0.47, 0.47, 0.47),
    });
  }

  const pdfBytes = await pdf.save();
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const name = surveyInfo?.title || eventInfo?.name || "insights";
  const sanitizedName = name.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_").trim();
  link.download = `${sanitizedName}_insights.pdf`;
  link.click();
  URL.revokeObjectURL(url);
};
