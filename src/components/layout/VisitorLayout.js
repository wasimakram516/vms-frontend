"use client";

import { useState } from "react";
import { Box, GlobalStyles, Typography } from "@mui/material";
import { motion } from "framer-motion";
import { useColorMode } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";

const transition = { duration: 0.6, ease: [0.43, 0.13, 0.23, 0.96] };
const bgPortrait  = "/bg-portrait.webp";
const bgLandscape = "/bg-landscape.webp";
const brandLogoSrc = "/logo-light.png";

const fontStyles = (
  <GlobalStyles
    styles={`
      @font-face {
        font-family: 'DINNextLTArabic';
        src: url('/DINNextLTArabic-Regular.ttf') format('truetype');
        font-weight: normal;
        font-style: normal;
        font-display: swap;
      }

      [dir="rtl"],
      [dir="rtl"] .MuiTypography-root,
      [dir="rtl"] .MuiInputBase-input,
      [dir="rtl"] .MuiButton-root,
      [dir="rtl"] .MuiMenuItem-root,
      [dir="rtl"] .MuiInputLabel-root,
      [dir="rtl"] .MuiFormHelperText-root,
      [dir="rtl"] .MuiFormLabel-root,
      [dir="rtl"] .MuiTab-root,
      [dir="rtl"] .MuiSelect-select,
      [dir="rtl"] .MuiTooltip-tooltip,
      [dir="rtl"] .MuiAlert-message,
      [dir="rtl"] .MuiChip-label {
        font-family: 'DINNextLTArabic', sans-serif !important;
      }

      [dir="rtl"] .visitor-layout-brand-title {
        font-family: 'Comfortaa', cursive !important;
      }
    `}
  />
);

export default function VisitorLayout({
  children,
  title,
  subtitle,
  mobileSubheading = "",
  maxWidth = 450,
  justifyContent = "flex-start",
}) {
  const { mode } = useColorMode();
  const { t } = useLanguage();
  const isDark = mode === "dark";
  const effectiveTitle = title ?? t("layoutBrandTitle");
  const effectiveSubtitle = subtitle ?? t("layoutBrandSubtitle");
  const [isMobileCardExpanded] = useState(true);

  const rtlInputStyles = (
    <GlobalStyles
      styles={{
        '[dir="rtl"] #visitor-layout-root .MuiOutlinedInput-notchedOutline': {
          borderColor: isDark ? 'rgba(255,255,255,0.1) !important' : 'rgba(0,0,0,0.1) !important',
        },
        '[dir="rtl"] #visitor-layout-root .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
          borderColor: isDark ? 'rgba(255,255,255,0.3) !important' : 'rgba(0,0,0,0.3) !important',
        },
        '[dir="rtl"] #visitor-layout-root .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
          borderColor: isDark ? '#ffffff !important' : '#000000 !important',
          borderWidth: '1px !important',
        },
      }}
    />
  );

  return (
    <>
      {fontStyles}
      {rtlInputStyles}
      <Box
        id="visitor-layout-root"
        sx={{
          height: "100%",
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          position: "relative",
          overflow: "hidden",
          background: {
            xs: `url(${bgPortrait}) center/cover no-repeat`,
            md: `url(${bgLandscape}) center/cover no-repeat`,
          },
          "&::before": {
            content: '""',
            position: "absolute",
            top: 0, left: 0, right: 0, bottom: 0,
            bgcolor: "rgba(0,0,0,0.05)",
            display: { xs: "none", md: "block" },
            zIndex: 0,
          },
        }}
      >
        {/* Left / Background Panel */}
        <Box
          sx={{
            position: "relative",
            top: 0, left: 0, right: 0, bottom: 0,
            flex: { md: "0 0 45%" },
            display: { xs: "none", md: "flex" },
            flexDirection: "column",
            justifyContent: "center",
            px: { md: 6 },
            pt: { md: 6 },
            pb: { md: 6 },
            zIndex: 1,
            overflow: "hidden",
            color: "#fff",
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={transition}
            style={{ position: "relative", zIndex: 1 }}
          >
            <Box
              sx={{
                position: "relative",
                width: "100%",
                zIndex: { xs: 2, md: 1 },
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
              }}
            >
              <Box
                component="img"
                src={brandLogoSrc}
                alt="Sinan Sentry logo"
                sx={{
                  width: {
                    xs: isMobileCardExpanded ? 110 : 176,
                    sm: isMobileCardExpanded ? 132 : 192,
                    md: 280,
                  },
                  height: {
                    xs: isMobileCardExpanded ? 110 : 176,
                    sm: isMobileCardExpanded ? 132 : 192,
                    md: 280,
                  },
                  mb: { xs: isMobileCardExpanded ? 0.5 : 1.5, md: 3 },
                  objectFit: "contain",
                  filter: "drop-shadow(0 12px 24px rgba(0,0,0,0.28))",
                  transition:
                    "width 0.35s ease, height 0.35s ease, margin-bottom 0.35s ease",
                }}
              />
              <Box
                sx={{
                  maxWidth: 340,
                  maxHeight: { xs: isMobileCardExpanded ? 0 : 220, md: 220 },
                  opacity: { xs: isMobileCardExpanded ? 0 : 1, md: 1 },
                  overflow: "hidden",
                  transform: {
                    xs: isMobileCardExpanded ? "translateY(-12px)" : "translateY(0)",
                    md: "translateY(0)",
                  },
                  transition:
                    "max-height 0.3s ease, opacity 0.25s ease, transform 0.3s ease",
                  pointerEvents: { xs: isMobileCardExpanded ? "none" : "auto", md: "auto" },
                }}
              >
                <Typography
                  dir="ltr"
                  className="visitor-layout-brand-title"
                  sx={{
                    fontSize: { xs: "1.45rem", sm: "1.7rem", md: "3rem" },
                    fontWeight: 800,
                    color: "#fff",
                    mb: { xs: 0.75, md: 2 },
                    lineHeight: 1.1,
                    opacity: { xs: 0.92, md: 1 },
                    fontFamily: "'Comfortaa', cursive",
                  }}
                >
                  {effectiveTitle}
                </Typography>
                <Typography
                  dir="ltr"
                  sx={{
                    color: "rgba(255,255,255,0.8)",
                    maxWidth: 320,
                    lineHeight: 1.6,
                    fontSize: { xs: "0.92rem", md: "1rem" },
                  }}
                >
                  {effectiveSubtitle}
                </Typography>
              </Box>
            </Box>
          </motion.div>
        </Box>

        {/* Right / Content Panel */}
        <Box
          id="visitor-layout-content-panel"
          sx={{
            flex: 1,
            overflowY: "auto",
            bgcolor: {
              xs: isDark ? "rgba(18,24,33,0.72)" : "rgba(220,225,235,0.88)",
              md: "transparent",
            },
            zIndex: 1,
            position: "relative",
          }}
        >
          <Box
            id="visitor-layout-content-inner"
            sx={{
              width: "100%",
              minHeight: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: { xs: "flex-start", md: justifyContent },
              alignItems: "center",
              pt: { xs: 3, md: 8 },
              pb: { xs: 4, md: 8 },
              px: { xs: 2.5, md: 4 },
              position: "relative",
              zIndex: 1,
            }}
          >
              <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={transition}
              style={{ width: "100%", maxWidth: maxWidth }}
            >
              <Box
                sx={{
                  width: "100%",
                  backdropFilter: { xs: "none", md: "blur(20px)" },
                  background: {
                    xs: "transparent",
                    md: isDark
                      ? "linear-gradient(180deg, rgba(34, 43, 55, 0.88) 0%, rgba(22, 29, 38, 0.85) 100%)"
                      : "rgba(255, 255, 255, 0.82)",
                  },
                  p: { xs: 3.5, md: 5 },
                  borderRadius: { xs: 0, md: 6 },
                  boxShadow: {
                    xs: "none",
                    md: isDark
                      ? "0 24px 44px rgba(5, 10, 18, 0.3), inset 0 1px 0 rgba(255,255,255,0.08)"
                      : "0 8px 32px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.9)",
                  },
                  border: {
                    xs: "none",
                    md: "1px solid",
                  },
                  borderColor: {
                    md: isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(255,255,255,0.7)",
                  },
                }}
              >
                {/* Mobile Header (Rendered inside the card only on xs) */}
                <Box sx={{ display: { xs: "flex", md: "none" }, flexDirection: "column", alignItems: "center", textAlign: "center", mb: 2 }}>
                   <Box
                    component="img"
                    src={brandLogoSrc}
                    alt="Sinan Sentry logo"
                    sx={{
                      width: 120,
                      height: 120,
                      mb: 0.5,
                      objectFit: "contain",
                      filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.15))",
                    }}
                  />
                  {mobileSubheading && (
                    <Typography
                      variant="subtitle2"
                      sx={{
                        fontWeight: 800,
                        color: isDark ? "#ffffff" : "text.primary",
                        mb: 1,
                        fontSize: "0.9rem",
                        lineHeight: 1.2,
                        maxWidth: 240,
                      }}
                    >
                      {mobileSubheading}
                    </Typography>
                  )}
                </Box>

                {children}
              </Box>
            </motion.div>
          </Box>
        </Box>
      </Box>
    </>
  );
}
