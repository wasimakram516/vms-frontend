"use client";

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Font,
} from "@react-pdf/renderer";

// Register default fonts (Optional: using built-in fonts is safer for now)
/*
Font.register({
  family: "Arial",
  fonts: [
    { src: "https://fonts.gstatic.com/s/arial/v12/NHkCfLq8p2I1g5G8.woff2", fontWeight: 400 },
    { src: "https://fonts.gstatic.com/s/arial/v12/NHkCfLq8p2I1g5G8.woff2", fontWeight: 700 },
  ],
});
*/


const A6_WIDTH = 297.6;
const A6_HEIGHT = 419.5;
const NAME_WIDTH_PERCENT = 0.9;
const AVAILABLE_NAME_WIDTH = A6_WIDTH * NAME_WIDTH_PERCENT;
const COMPANY_WIDTH_PERCENT = 0.7;
const AVAILABLE_COMPANY_WIDTH = A6_WIDTH * COMPANY_WIDTH_PERCENT;

const styles = StyleSheet.create({
  page: {
    width: A6_WIDTH,
    height: A6_HEIGHT,
    backgroundColor: "#ffffff",
    position: "relative",
    paddingTop: 120,
    paddingBottom: 10,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    fontFamily: "Helvetica",
  },
  pageCustomized: {
    width: A6_WIDTH,
    height: A6_HEIGHT,
    backgroundColor: "#ffffff",
    position: "relative",
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: 0,
    display: "flex",
    flexDirection: "column",
    fontFamily: "Helvetica",
  },

  contentArea: {
    width: "100%",
    textAlign: "center",
  },
  qrWrapper: {
    position: "absolute",
    bottom: 20,
    left: 25,
    width: 90,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  qrImage: { width: 70, height: 70 },
  token: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#0077b6",
    letterSpacing: 0.7,
    textAlign: "center",
  },
  name: {
    fontWeight: "bold",
    color: "#000",
    width: `${NAME_WIDTH_PERCENT * 100}%`,
    lineHeight: 1.2,
    textAlign: "center",
    alignSelf: "center",
  },
  company: {
    color: "#000",
    marginTop: 1,
    width: `${COMPANY_WIDTH_PERCENT * 100}%`,
    lineHeight: 1.2,
    textAlign: "center",
    alignSelf: "center",
  },
  badgeIdentifier: {
    fontSize: 14,
    fontWeight: "bold",
    textTransform: "uppercase",
    color: "#0077b6",
    marginTop: 10,
    maxWidth: "80%",
    lineHeight: 1.2,
    textAlign: "center",
    alignSelf: "center",
  },
});

function calculateNameFontSize(name) {
  if (!name) return 25;

  const length = name.length;
  const avgCharsPerLine = 25;
  const maxLines = 2;
  const maxChars = avgCharsPerLine * maxLines;

  if (length <= 15) {
    return 25;
  } else if (length <= avgCharsPerLine) {
    const fontSize = 25 - (length - 15) * 0.5;
    return Math.max(20, fontSize);
  } else if (length <= maxChars) {
    const fontSize = 20 - (length - avgCharsPerLine) * 0.35;
    return Math.max(15, fontSize);
  } else {
    const fontSize = 15 - (length - maxChars) * 0.25;
    return Math.max(12, fontSize);
  }
}

function calculateCompanyFontSize(company) {
  if (!company) return 20;

  const length = company.length;
  const avgCharsPerLine = 30;
  const maxLines = 2;
  const maxChars = avgCharsPerLine * maxLines;

  if (length <= 20) {
    return 20;
  } else if (length <= avgCharsPerLine) {
    const fontSize = 20 - (length - 20) * 0.4;
    return Math.max(16, fontSize);
  } else if (length <= maxChars) {
    const fontSize = 16 - (length - avgCharsPerLine) * 0.3;
    return Math.max(12, fontSize);
  } else {
    const fontSize = 12 - (length - maxChars) * 0.2;
    return Math.max(10, fontSize);
  }
}

function wrapTextAtWords(text, fontSize, availableWidth, isBold = false) {
  if (!text) return [text];

  const words = text.trim().split(/\s+/);
  if (words.length === 0) return [text];

  const charWidthRatio = isBold ? 0.75 : 0.65;
  const estimatedCharWidth = fontSize * charWidthRatio;
  const safetyMargin = 0.85;
  const effectiveWidth = availableWidth * safetyMargin;

  const lines = [];
  let currentLine = "";

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const estimatedWidth = testLine.length * estimatedCharWidth;

    if (estimatedWidth > effectiveWidth && currentLine && lines.length < 1) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.slice(0, 2);
}

function parseHTMLToText(html) {
  if (!html) return {
    text: "",
    isBold: false,
    isItalic: false,
    isUnderline: false,
    color: "#000000",
    fontSize: null
  };

  let text = html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();

  const isBold = /<(strong|b)>/i.test(html) || /font-weight:\s*(bold|700|800|900)/i.test(html);
  const isItalic = /<(em|i)>/i.test(html) || /font-style:\s*italic/i.test(html);
  const isUnderline = /<u>/i.test(html) || /text-decoration:\s*underline/i.test(html);

  const colorMatch = html.match(/color:\s*([^;'"]+)/i) || html.match(/color="([^"]+)"/i);
  const color = colorMatch ? colorMatch[1].trim() : "#000000";

  let fontFamily = null;
  const fontFamilyMatch = html.match(/font-family:\s*([^;]+)/i);
  if (fontFamilyMatch) {
    let fontFamilyStr = fontFamilyMatch[1].trim();
    fontFamilyStr = fontFamilyStr
      .replace(/&quot;?/g, "")
      .replace(/&apos;?/g, "")
      .replace(/&amp;?/g, "&")
      .replace(/&lt;?/g, "")
      .replace(/&gt;?/g, "")
      .replace(/&[a-z0-9]+;?/gi, "")
      .replace(/&[^a-z0-9\s]/gi, "")
      .replace(/['"]/g, "")
      .trim();
    fontFamily = fontFamilyStr.split(",")[0].trim();
    if (!fontFamily || fontFamily.length === 0 || fontFamily.startsWith("&")) {
      fontFamily = null;
    }
  }

  let fontSize = null;
  const sizeAttrMatch = html.match(/size="?(\d+)"?/i);
  if (sizeAttrMatch) {
    const sizeValue = parseInt(sizeAttrMatch[1]);
    const sizeMap = { 1: 10, 2: 13, 3: 16, 4: 18, 5: 24, 6: 32, 7: 48 };
    fontSize = sizeMap[sizeValue] || 16;
  }

  const fontSizeMatch = html.match(/font-size:\s*([^;'"]+)/i);
  if (fontSizeMatch) {
    const sizeStr = fontSizeMatch[1].trim();
    fontSize = parseFloat(sizeStr);
  }

  return { text, isBold: !!isBold, isItalic: !!isItalic, isUnderline: !!isUnderline, color, fontSize, fontFamily };
}

function getFieldValue(fieldName, data) {
  if (!fieldName || !data) return "";

  const fieldValues = data.fieldValues || {};
  const normalizedFieldName = fieldName.toLowerCase().replace(/[^a-z0-9]/g, "");

  // Check fieldValues (custom fields)
  const customFieldMatch = Object.keys(fieldValues).find(key => 
    key.toLowerCase().replace(/[^a-z0-9]/g, "") === normalizedFieldName
  );
  if (customFieldMatch) {
    return String(fieldValues[customFieldMatch]);
  }

  // Map standard fields
  const fieldMap = {
    fullname: data.fullName,
    name: data.fullName,
    company: data.company,
    companyname: data.company,
    organization: data.company,
    email: data.email,
    emailaddress: data.email,
    phone: data.phone,
    phonenumber: data.phone,
    mobile: data.phone,
    purpose: data.purposeOfVisit,
    purposeofvisit: data.purposeOfVisit,
  };

  return fieldMap[normalizedFieldName] || "";
}

export default function BadgePDF({ data, qrCodeDataUrl, customizations, single = true }) {
  const hasCustomizations = customizations && typeof customizations === "object" && Object.keys(customizations).length > 0;
  
  // Custom layout rendering based on badge template layout_json
  if (hasCustomizations) {
    const customFields = Object.keys(customizations).filter(key => key !== "_qrCode" && !key.startsWith("_"));

    const content = (
      <Page size={[A6_WIDTH, A6_HEIGHT]} style={styles.pageCustomized}>
        {customFields.map((fieldName) => {
          const customization = customizations[fieldName];
          if (!customization) return null;

          const fieldValue = getFieldValue(fieldName, data);
          
          if (!fieldValue) return null;

          let fontSize, color, isBold, isItalic, isUnderline, fontFamily;

          if (customization.content && typeof customization.content === "string" && customization.content.includes("<")) {
            const parsed = parseHTMLToText(customization.content);
            fontSize = parsed.fontSize || 14;
            color = parsed.color || "#000000";
            isBold = parsed.isBold || false;
            isItalic = parsed.isItalic || false;
            isUnderline = parsed.isUnderline || false;
            fontFamily = parsed.fontFamily || "Helvetica";
          } else {
            fontSize = customization.fontSize !== undefined ? customization.fontSize : 14;
            color = customization.color || "#000000";
            isBold = customization.isBold || false;
            isItalic = customization.isItalic || false;
            isUnderline = customization.isUnderline || false;
            fontFamily = customization.fontFamily || "Helvetica";
          }

          const yPercent = customization.y || 0;
          const alignment = customization.alignment || "left";
          const fontSizePt = fontSize * (72 / 96);
          const baselineAdjustmentPt = fontSizePt * 0.2;
          const baselineAdjustmentPercent = (baselineAdjustmentPt / A6_HEIGHT) * 100;
          const adjustedYPercent = Math.max(0, yPercent - baselineAdjustmentPercent);

          const textStyle = {
            fontSize: isNaN(fontSizePt) ? 12 : fontSizePt,
            color: color || "#000000",
            textAlign: alignment || "left",
            lineHeight: 1.0,
            fontFamily: "Helvetica",
            margin: 0,
            padding: 0,
          };

          if (isBold) textStyle.fontWeight = "bold";
          if (isItalic) textStyle.fontStyle = "italic";
          if (isUnderline) textStyle.textDecoration = "underline";

          let viewStyle = {
            position: "absolute",
            top: `${adjustedYPercent || 0}%`,
            margin: 0,
            padding: 0,
          };

          if (alignment === "center") {
            viewStyle.left = "5%";
            viewStyle.width = "90%";
            viewStyle.maxWidth = "90%";
          } else if (alignment === "right") {
            viewStyle.right = "5%";
            viewStyle.width = "90%";
            viewStyle.maxWidth = "90%";
          } else {
            const xPercent = customization.x || 0;
            viewStyle.left = `${xPercent}%`;
            viewStyle.maxWidth = "90%";
          }

          return (
            <View key={fieldName} style={viewStyle}>
              <Text style={textStyle}>{String(fieldValue || "")}</Text>
            </View>
          );
        })}

        {/* QR Code */}
        {data.showQrOnBadge && customizations._qrCode && qrCodeDataUrl && (
          <View
            style={{
              position: "absolute",
              left: `${customizations._qrCode.x || 5}%`,
              top: `${customizations._qrCode.y || 85}%`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <Image
              src={qrCodeDataUrl}
              style={{
                width: ((customizations._qrCode.size || 70) * (72 / 96)) || 50,
                height: ((customizations._qrCode.size || 70) * (72 / 96)) || 50,
              }}
            />
            <Text
              style={{
                fontSize: (((customizations._qrCode.size || 70) / 70) * 9 * (72 / 96)) || 7,
                fontWeight: "bold",
                color: "#0077b6",
                letterSpacing: 0.7,
                marginTop: 2,
                fontFamily: "Helvetica",
              }}
            >
              {String(data.token || "")}
            </Text>
          </View>
        )}

      </Page>
    );

    return single ? <Document>{content}</Document> : content;
  }


  // Default layout (no customizations)
  const nameFontSize = calculateNameFontSize(data?.fullName);
  const nameStyle = {
    fontWeight: "bold",
    color: "#000",
    lineHeight: 1.2,
    textAlign: "center",
    fontSize: isNaN(nameFontSize) ? 20 : nameFontSize,
    fontFamily: "Helvetica",
  };

  let companyFontSize = calculateCompanyFontSize(data?.company);
  const maxCompanyFontSize = nameFontSize * 0.85;
  companyFontSize = Math.min(companyFontSize, maxCompanyFontSize);
  const companyStyle = {
    color: "#000",
    marginTop: 1,
    lineHeight: 1.2,
    textAlign: "center",
    alignSelf: "center",
    fontSize: isNaN(companyFontSize) ? 16 : companyFontSize,
    fontFamily: "Helvetica",
  };

  const nameLines = data?.fullName ? wrapTextAtWords(data.fullName, nameFontSize, AVAILABLE_NAME_WIDTH, true) : [];
  const companyLines = data?.company ? wrapTextAtWords(data.company, companyFontSize, AVAILABLE_COMPANY_WIDTH, false) : [];

  const content = (
    <Page size={[A6_WIDTH, A6_HEIGHT]} style={styles.page}>
      <View style={styles.contentArea}>
        {nameLines.length > 0 && (
          <View style={{ width: `${NAME_WIDTH_PERCENT * 100}%`, alignSelf: "center" }}>
            {nameLines.map((line, index) => (
              <Text key={index} style={nameStyle}>{String(line || "")}</Text>
            ))}
          </View>
        )}
        {companyLines.length > 0 && (
          <View style={{ width: `${COMPANY_WIDTH_PERCENT * 100}%`, alignSelf: "center" }}>
            {companyLines.map((line, index) => (
              <Text key={index} style={companyStyle}>{String(line || "")}</Text>
            ))}
          </View>
        )}
        {data.badgeIdentifier && (
          <Text style={{ ...styles.badgeIdentifier, fontFamily: "Helvetica" }}>{String(data.badgeIdentifier || "")}</Text>
        )}
      </View>

      {data.showQrOnBadge && (
        <View style={styles.qrWrapper}>
          <Image src={qrCodeDataUrl} style={styles.qrImage} />
          <Text style={{ ...styles.token, fontFamily: "Helvetica" }}>{String(data.token || "")}</Text>
        </View>
      )}
    </Page>
  );


  return single ? <Document>{content}</Document> : content;
}
