"use client";

import { Box, Typography, GlobalStyles } from "@mui/material";
import { motion } from "framer-motion";
import { useColorMode } from "@/contexts/ThemeContext";

const transition = { duration: 0.6, ease: [0.43, 0.13, 0.23, 0.96] };
const backgroundImageUrl = "/bgImage.webp";
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
  title = "Sinan VMS", 
  subtitle = "Experience a seamless visitor journey at Sinan. Please select your visit type to proceed.",
  maxWidth = 450,
  justifyContent = "flex-start",
}) {
  const { mode } = useColorMode();
  const isDark = mode === "dark";

  const brandGradient = isDark 
    ? "linear-gradient(135deg, #121922 0%, #1c2530 100%)" 
    : "linear-gradient(135deg, #000000 0%, #333333 100%)";

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
          bgcolor: { xs: "background.paper", md: "transparent" },
        }}
      >
        {/* Left / Background Panel */}
        <Box
          sx={{
            position: "relative",
            top: 0, left: 0, right: 0, bottom: 0,
            flex: { xs: "0 0 auto", md: "0 0 45%" },
            minHeight: { xs: 300, sm: 340, md: "auto" },
            background: `url(${backgroundImageUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            p: { xs: 4, md: 6 },
            zIndex: { xs: 0, md: 1 },
            overflow: "hidden",
            color: "#fff",
            "&::before": {
              content: '""',
              position: "absolute",
              top: 0, left: 0, right: 0, bottom: 0,
              bgcolor: "rgba(0,0,0,0.5)",
              zIndex: 0
            }
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
                alt="Sinan VMS logo"
                sx={{
                  width: { xs: 190, md: 280 },
                  height: { xs: 190, md: 280 },
                  mb: { xs: 2, md: 3 },
                  objectFit: "contain",
                  filter: "drop-shadow(0 12px 24px rgba(0,0,0,0.28))",
                }}
              />
              <Typography
                sx={{
                  fontFamily: "'Comfortaa', cursive",
                  fontSize: { xs: "2rem", md: "3rem" },
                  fontWeight: 800,
                  color: "#fff",
                  mb: { xs: 1, md: 2 },
                  lineHeight: 1.1,
                  opacity: { xs: 0.9, md: 1 },
                  display: { xs: "none", md: "block" },
                }}
              >
                {title}
              </Typography>
              <Typography 
                sx={{ 
                  color: "rgba(255,255,255,0.8)", 
                  maxWidth: 320, 
                  lineHeight: 1.6,
                  display: { xs: "none", md: "block" },
                }}
              >
                {subtitle}
              </Typography>
            </Box>
          </motion.div>
        </Box>

        {/* Right / Content Panel */}
        <Box
          sx={{
            flex: 1,
            overflowY: "auto",
            bgcolor: { xs: "background.paper", md: "background.default" },
            zIndex: 1,
            position: "relative",
            mt: { xs: -4, md: 0 },
            borderTopLeftRadius: { xs: 32, md: 0 },
            borderTopRightRadius: { xs: 32, md: 0 },
            boxShadow: {
              xs: "0 -16px 32px rgba(9, 18, 31, 0.18)",
              md: "none",
            },
          }}
        >
          <Box
            sx={{
              minHeight: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: { xs: "flex-start", md: justifyContent }, 
              alignItems: "center",
              py: { xs: 3.5, md: 8 }, 
              px: { xs: 3, md: 4 },
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
                      ? "linear-gradient(180deg, rgba(34, 43, 55, 0.92) 0%, rgba(22, 29, 38, 0.9) 100%)"
                      : "rgba(255, 255, 255, 0.9)",
                  },
                  p: { xs: 0, md: 5 },
                  borderRadius: { xs: 0, md: 6 },
                  boxShadow: {
                    xs: "none",
                    md: isDark
                      ? "0 24px 44px rgba(5, 10, 18, 0.3), inset 0 1px 0 rgba(255,255,255,0.08)"
                      : 24,
                  },
                  border: { xs: "none", md: "1px solid" },
                  borderColor: isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)",
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
