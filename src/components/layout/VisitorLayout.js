"use client";

import { Box, Typography, GlobalStyles } from "@mui/material";
import { motion } from "framer-motion";
import { useColorMode } from "@/contexts/ThemeContext";
import bgImage from "../../../public/bgImage.png";

const transition = { duration: 0.6, ease: [0.43, 0.13, 0.23, 0.96] };

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
    ? "linear-gradient(135deg, #000000 0%, #1a1a1a 100%)" 
    : "linear-gradient(135deg, #000000 0%, #333333 100%)";

  return (
    <>
      {fontStyles}
      <Box
        sx={{
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Left / Background Panel */}
        <Box
          sx={{
            position: { xs: "absolute", md: "relative" },
            top: 0, left: 0, right: 0, bottom: 0,
            flex: { md: "0 0 45%" },
            background: bgImage ? `url(${bgImage.src})` : brandGradient,
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
            <Typography
              sx={{
                fontFamily: "'Comfortaa', cursive",
                fontSize: { xs: "2rem", md: "3rem" },
                fontWeight: 800,
                color: "#fff",
                mb: { xs: 1, md: 2 },
                lineHeight: 1.1,
                textAlign: { xs: "center", md: "left" },
                opacity: { xs: 0.9, md: 1 },
                position: { xs: "absolute", md: "relative" },
                top: { xs: 40, md: "auto" },
                width: { xs: "100%", md: "auto" },
                left: { xs: 0, md: "auto" },
                zIndex: { xs: 2, md: 1 },
              }}
            >
              {title}
            </Typography>
            <Typography 
              sx={{ 
                color: "rgba(255,255,255,0.8)", 
                maxWidth: { md: 320 }, 
                lineHeight: 1.6,
                display: { xs: "none", md: "block" }
              }}
            >
              {subtitle}
            </Typography>
          </motion.div>
        </Box>

        {/* Right / Content Panel */}
        <Box
          sx={{
            flex: 1,
            overflowY: "auto",
            bgcolor: { md: "background.default" },
            zIndex: 1,
            position: "relative",
          }}
        >
          <Box
            sx={{
              minHeight: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: justifyContent, 
              alignItems: "center",
              py: { xs: 4, md: 8 }, 
              px: { xs: 2, md: 4 },
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
                  bgcolor: isDark ? "rgba(26, 26, 26, 0.85)" : "rgba(255, 255, 255, 0.9)", 
                  p: { xs: 3, md: 5 },
                  borderRadius: 6,
                  boxShadow: 24,
                  border: "1px solid",
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
