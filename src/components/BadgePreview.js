"use client";

import { Box, Typography } from "@mui/material";
import { useColorMode } from "@/contexts/ThemeContext";

const PREVIEW_SCALE = 0.3;
const A6_WIDTH_PX = 297.6 * (96 / 72);
const A6_HEIGHT_PX = 419.5 * (96 / 72);

export default function BadgePreview({ template, showQr = true, getAllSelectedFields }) {
  const { mode } = useColorMode();
  const layout = template?.layoutJson || {};

  const renderField = (fieldName, customization) => {
    if (!customization) return null;

    const yPercent = customization.y || 0;
    const alignment = customization.alignment || "left";
    const text = customization.text || `Sample ${fieldName}`;
    const fontSize = customization.fontSize || 14;
    const color = customization.color || "#000000";
    const isBold = customization.isBold || false;
    const isItalic = customization.isItalic || false;
    const isUnderline = customization.isUnderline || false;
    const fontFamily = customization.fontFamily || "Arial";

    let positionStyle = {};
    let textAlignStyle = {};
    const widthStyle = { width: "90%", maxWidth: "90%" };

    if (alignment === "center") {
      positionStyle = { left: "5%" };
      textAlignStyle = { textAlign: "center" };
    } else if (alignment === "right") {
      positionStyle = { right: "5%" };
      textAlignStyle = { textAlign: "right" };
    } else {
      positionStyle = { left: `${customization.x || 0}%` };
      textAlignStyle = { textAlign: "left" };
    }

    return (
      <Box
        sx={{
          position: "absolute",
          top: `${yPercent}%`,
          ...positionStyle,
          width: widthStyle.width,
          maxWidth: widthStyle.maxWidth,
          fontSize: `${fontSize}px`,
          fontFamily: `"${fontFamily}", sans-serif`,
          lineHeight: 1.0,
          color: color,
          fontWeight: isBold ? "bold" : "normal",
          fontStyle: isItalic ? "italic" : "normal",
          textDecoration: isUnderline ? "underline" : "none",
          margin: 0,
          padding: 0,
          display: "block",
          boxSizing: "border-box",
          height: "auto",
          minHeight: 0,
          ...textAlignStyle,
        }}
      >
        {text}
      </Box>
    );
  };

  return (
    <Box
      sx={{
        width: A6_WIDTH_PX * PREVIEW_SCALE,
        height: A6_HEIGHT_PX * PREVIEW_SCALE,
        bgcolor: "white",
        position: "relative",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        border: "1px solid #ddd",
        borderRadius: 1,
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          width: A6_WIDTH_PX,
          height: A6_HEIGHT_PX,
          bgcolor: "white",
          position: "relative",
          transform: `scale(${PREVIEW_SCALE})`,
          transformOrigin: "top left",
        }}
      >
        {getAllSelectedFields
          ? getAllSelectedFields().map(([fieldName, customization]) => (
              <Box key={fieldName}>
                {renderField(fieldName, customization)}
              </Box>
            ))
          : Object.entries(layout)
              .filter(([key]) => !key.startsWith('_') && key !== 'qr_token')
              .map(([fieldName, customization]) => (
                <Box key={fieldName}>
                  {renderField(fieldName, customization)}
                </Box>
              ))}

        {/* QR Code placeholder */}
        {showQr && layout._qrCode && (
          <Box
            sx={{
              position: "absolute",
              top: `${layout._qrCode.y || 85}%`,
              left: `${layout._qrCode.x || 5}%`,
              width: layout._qrCode.size || 70,
              height: layout._qrCode.size || 70,
              bgcolor: "white",
              border: "1px solid #ddd",
              borderRadius: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Typography
              sx={{
                color: "#000000",
                fontSize: "10px",
                fontWeight: "bold",
              }}
            >
              QR CODE
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
