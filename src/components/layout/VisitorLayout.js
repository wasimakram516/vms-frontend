"use client";

import { useState } from "react";
import { Box, Typography, GlobalStyles } from "@mui/material";
import { motion } from "framer-motion";
import { useColorMode } from "@/contexts/ThemeContext";
import ICONS from "@/utils/iconUtil";

const transition = { duration: 0.6, ease: [0.43, 0.13, 0.23, 0.96] };
const bgPortrait  = "/bg-portrait.webp";
const bgLandscape = "/bg-landscape.webp";
const brandLogoSrc = "/logo-light.png";

const fontStyles = (
  <GlobalStyles
    styles={`
      @import url('https://fonts.googleapis.com/css2?family=Comfortaa:wght@300;400;500;600;700&display=swap');
    `}
  />
);

export default function VisitorLayout({ 
  children, 
  title = "Sinan Sentry",
  subtitle = "Experience a seamless visitor journey at Sinan. Please select your visit type to proceed.",
  maxWidth = 450,
  justifyContent = "flex-start",
}) {
  const { mode } = useColorMode();
  const isDark = mode === "dark";
  const [isMobileCardExpanded, setIsMobileCardExpanded] = useState(true);
  const MobileCardToggleIcon = isMobileCardExpanded ? ICONS.expandMore : ICONS.expandLess;

  return (
    <>
      {fontStyles}
      <Box
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
            flex: { xs: "0 0 auto", md: "0 0 45%" },
            minHeight: { md: "auto" },
            maxHeight: {
              xs: isMobileCardExpanded ? 0 : 400,
              sm: isMobileCardExpanded ? 0 : 420,
              md: "100vh",
            },
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            px: { xs: 3, sm: 4, md: 6 },
            pt: { xs: isMobileCardExpanded ? 0 : 4, md: 6 },
            pb: { xs: isMobileCardExpanded ? 0 : 5, md: 6 },
            zIndex: 1,
            overflow: "hidden",
            color: "#fff",
            transition: "max-height 0.4s ease, padding 0.4s ease",
            "&::before": {
              content: '""',
              position: "absolute",
              top: 0, left: 0, right: 0, bottom: 0,
              bgcolor: "rgba(0,0,0,0.35)",
              display: { xs: "block", md: "none" },
              zIndex: 0,
            },
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
                  sx={{
                    fontFamily: "'Comfortaa', cursive",
                    fontSize: { xs: "1.45rem", sm: "1.7rem", md: "3rem" },
                    fontWeight: 800,
                    color: "#fff",
                    mb: { xs: 0.75, md: 2 },
                    lineHeight: 1.1,
                    opacity: { xs: 0.92, md: 1 },
                  }}
                >
                  {title}
                </Typography>
                <Typography
                  sx={{
                    color: "rgba(255,255,255,0.8)",
                    maxWidth: 320,
                    lineHeight: 1.6,
                    fontSize: { xs: "0.92rem", md: "1rem" },
                  }}
                >
                  {subtitle}
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
            background: "transparent",
            zIndex: 1,
            position: "relative",
            mt: { xs: isMobileCardExpanded ? 0 : -3, md: 0 },
            borderTopLeftRadius: { xs: 32, md: 0 },
            borderTopRightRadius: { xs: 32, md: 0 },
            transition: "margin-top 0.4s ease, border-radius 0.4s ease",
            "&::before": {
              content: '""',
              position: "absolute",
              top: 0, left: 0, right: 0, bottom: 0,
              bgcolor: isDark ? "rgba(18,24,33,0.65)" : "rgba(255,255,255,0.55)",
              display: { xs: "block", md: "none" },
              zIndex: 0,
              borderTopLeftRadius: "inherit",
              borderTopRightRadius: "inherit",
            },
          }}
        >
          <Box
            sx={{
              display: { xs: "block", md: "none" },
              position: "absolute",
              top: 4,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 3,
            }}
          >
            <Box
              component="button"
              type="button"
              aria-controls="visitor-layout-content-inner"
              aria-expanded={isMobileCardExpanded}
              aria-label={isMobileCardExpanded ? "Collapse card" : "Expand card"}
              onClick={() => setIsMobileCardExpanded((prev) => !prev)}
              sx={{
                appearance: "none",
                border: 0,
                bgcolor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                color: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.5)",
                borderRadius: "50%",
                width: 32,
                height: 32,
                p: 0,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "transform 0.2s ease, opacity 0.2s ease",
                opacity: 0.8,
                "&:hover": {
                  transform: "translateY(-1px)",
                  opacity: 1,
                },
                "&:focus-visible": {
                  outline: "2px solid",
                  outlineColor: "primary.main",
                  outlineOffset: 2,
                  opacity: 1,
                },
              }}
            >
              <MobileCardToggleIcon sx={{ fontSize: 24 }} />
            </Box>
          </Box>
          <Box
            id="visitor-layout-content-inner"
            sx={{
              minHeight: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: { xs: "flex-start", md: justifyContent },
              alignItems: "center",
              pt: { xs: isMobileCardExpanded ? 6 : 7, md: 8 },
              pb: { xs: isMobileCardExpanded ? 3.5 : 4.25, md: 8 },
              px: { xs: 3, md: 4 },
              transition: "padding 0.35s ease",
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
                  backdropFilter: "blur(20px)",
                  background: isDark
                    ? "linear-gradient(180deg, rgba(34, 43, 55, 0.88) 0%, rgba(22, 29, 38, 0.85) 100%)"
                    : "rgba(255, 255, 255, 0.82)",
                  p: { xs: 3, md: 5 },
                  borderRadius: { xs: 4, md: 6 },
                  boxShadow: isDark
                    ? "0 24px 44px rgba(5, 10, 18, 0.3), inset 0 1px 0 rgba(255,255,255,0.08)"
                    : "0 8px 32px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.9)",
                  border: "1px solid",
                  borderColor: isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(255,255,255,0.7)",
                }}
              >
                {children}
              </Box>
            </motion.div>
          </Box>
        </Box>
      </Box>
    </>
  );
}
