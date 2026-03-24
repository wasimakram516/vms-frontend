"use client";

import { Box, Skeleton, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import AppCard from "@/components/cards/AppCard";

export default function SinanLoader({
  title = "Loading Sinan VMS",
  description = "Preparing your experience...",
  fullScreen = false,
  minHeight = 360,
  topOffset = 0,
  cardMaxWidth = 440,
  skeletonLines = 3,
  showSkeletons = true,
  sx = {},
  cardSx = {},
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const logoSrc = isDark ? "/logo-mark-light.png" : "/logo-mark-dark.png";
  const resolvedMinHeight = fullScreen ? "100vh" : minHeight;
  const glowColor = isDark
    ? alpha(theme.palette.common.white, 0.12)
    : alpha(theme.palette.common.black, 0.08);
  const contentInset = typeof topOffset === "number" ? `${topOffset}px` : topOffset;

  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        ...sx,
        width: fullScreen ? "100vw" : "100%",
        minHeight: fullScreen ? "auto" : resolvedMinHeight,
        height: fullScreen ? `calc(100vh - ${contentInset})` : "auto",
        px: { xs: 2, sm: 3 },
        py: { xs: 3, sm: 4 },
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: fullScreen ? "fixed" : "relative",
        inset: fullScreen ? `${contentInset} 0 0 0` : "auto",
        zIndex: fullScreen ? theme.zIndex.tooltip + 10 : 1,
        overflow: "hidden",
        isolation: "isolate",
        backdropFilter: fullScreen ? "blur(16px)" : "none",
        bgcolor: fullScreen
          ? alpha(theme.palette.background.default, isDark ? 0.92 : 0.86)
          : "transparent",
        "@keyframes sinan-loader-float": {
          "0%, 100%": {
            transform: "translateY(0px) scale(1)",
          },
          "50%": {
            transform: "translateY(-6px) scale(1.02)",
          },
        },
        "@keyframes sinan-loader-panel-in": {
          from: {
            opacity: 0,
            transform: "translateY(8px) scale(0.985)",
          },
          to: {
            opacity: 1,
            transform: "translateY(0) scale(1)",
          },
        },
        "@keyframes sinan-loader-pulse": {
          "0%, 100%": {
            opacity: 0.62,
            transform: "scale(0.96)",
          },
          "50%": {
            opacity: 0.86,
            transform: "scale(0.99)",
          },
        },
        "@keyframes sinan-loader-sweep": {
          "0%": {
            left: "-35%",
          },
          "100%": {
            left: "105%",
          },
        },
        "@keyframes sinan-loader-shimmer": {
          "0%": {
            backgroundPosition: "220% 0",
          },
          "100%": {
            backgroundPosition: "-35% 0",
          },
        },
        "@keyframes sinan-loader-bar-run": {
          "0%": {
            left: "-34%",
          },
          "100%": {
            left: "104%",
          },
        },
        "@keyframes sinan-loader-spin": {
          from: {
            transform: "rotate(0deg)",
          },
          to: {
            transform: "rotate(360deg)",
          },
        },
        "@keyframes sinan-loader-spin-reverse": {
          from: {
            transform: "rotate(360deg)",
          },
          to: {
            transform: "rotate(0deg)",
          },
        },
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          position: "absolute",
          width: { xs: 180, sm: 240 },
          height: { xs: 180, sm: 240 },
          borderRadius: "50%",
          top: { xs: "8%", sm: "12%" },
          left: { xs: "-10%", sm: "6%" },
          background: `radial-gradient(circle, ${glowColor} 0%, transparent 72%)`,
          filter: "blur(12px)",
          pointerEvents: "none",
        }}
      />
      <Box
        aria-hidden="true"
        sx={{
          position: "absolute",
          width: { xs: 220, sm: 280 },
          height: { xs: 220, sm: 280 },
          borderRadius: "50%",
          right: { xs: "-18%", sm: "4%" },
          bottom: { xs: "-4%", sm: "8%" },
          background: `radial-gradient(circle, ${alpha(
            theme.palette.primary.main,
            isDark ? 0.1 : 0.06
          )} 0%, transparent 74%)`,
          filter: "blur(18px)",
          pointerEvents: "none",
        }}
      />

      <AppCard
        interactive={false}
        sx={{
          width: "100%",
          maxWidth: cardMaxWidth,
          px: { xs: 2.5, sm: 3.5 },
          py: { xs: 3, sm: 3.5 },
          position: "relative",
          overflow: "hidden",
          borderRadius: 4,
          boxShadow: isDark
            ? "0 24px 54px rgba(5,10,18,0.44), inset 0 1px 0 rgba(255,255,255,0.08)"
            : "0 24px 54px rgba(15,23,42,0.12)",
          animation: "sinan-loader-panel-in 0.3s ease-out",
          ...cardSx,
        }}
      >
        <Box
          aria-hidden="true"
          sx={{
            position: "absolute",
            left: "-35%",
            top: 0,
            width: "40%",
            height: 3,
            background: isDark
              ? "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.34) 55%, rgba(255,255,255,0.08) 100%)"
              : "linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.18) 40%, rgba(0,0,0,0.05) 100%)",
            animation: "sinan-loader-sweep 2.6s linear infinite",
            pointerEvents: "none",
          }}
        />

        <Stack spacing={3} sx={{ position: "relative", zIndex: 1 }}>
          <Stack spacing={2.5} alignItems="center">
            <Box
              sx={{
                position: "relative",
                width: { xs: 144, sm: 150 },
                height: { xs: 144, sm: 150 },
                p: { xs: "14px", sm: "14px" },
                boxSizing: "border-box",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                "&::before": {
                  content: '""',
                  position: "absolute",
                  inset: 18,
                  borderRadius: "999px",
                  background: isDark
                    ? "radial-gradient(circle, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.05) 62%, transparent 100%)"
                    : "radial-gradient(circle, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.03) 62%, transparent 100%)",
                  animation: "sinan-loader-pulse 2.6s ease-in-out infinite",
                },
              }}
            >
              <Box
                aria-hidden="true"
                sx={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  border: `2px solid ${isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.1)"}`,
                  borderTopColor: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.42)",
                  borderRightColor: isDark ? "rgba(255,255,255,0.42)" : "rgba(0,0,0,0.2)",
                  animation: "sinan-loader-spin 1s linear infinite",
                  zIndex: 0,
                }}
              />
              <Box
                aria-hidden="true"
                sx={{
                  position: "absolute",
                  inset: 12,
                  borderRadius: "50%",
                  border: `1.5px dashed ${isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.12)"}`,
                  animation: "sinan-loader-spin-reverse 1.65s linear infinite",
                  zIndex: 0,
                }}
              />
              <Box
                component="img"
                src={logoSrc}
                alt="Sinan loading mark"
                sx={{
                  width: "auto",
                  height: "auto",
                  maxWidth: { xs: 78, sm: 82 },
                  maxHeight: { xs: 78, sm: 82 },
                  objectFit: "contain",
                  position: "relative",
                  zIndex: 2,
                  animation: "sinan-loader-float 2.8s ease-in-out infinite",
                  filter: isDark
                    ? "drop-shadow(0 8px 16px rgba(255,255,255,0.12))"
                    : "drop-shadow(0 8px 16px rgba(15,23,42,0.14))",
                }}
              />
            </Box>

            <Stack spacing={0.75} alignItems="center">
              <Typography
                variant="h6"
                fontWeight={800}
                textAlign="center"
                sx={{
                  fontFamily: "'Comfortaa', cursive",
                  fontSize: { xs: "1.05rem", sm: "1.2rem" },
                }}
              >
                {title}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                textAlign="center"
                sx={{
                  maxWidth: 320,
                  lineHeight: 1.65,
                }}
              >
                {description}
              </Typography>
            </Stack>
          </Stack>

          {showSkeletons ? (
            <Stack spacing={1.2} sx={{ width: "100%", px: { xs: 0.5, sm: 1 } }}>
              <Box
                aria-hidden="true"
                sx={{
                  height: 10,
                  borderRadius: "999px",
                  border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)"}`,
                  background: isDark
                    ? "linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 48%, rgba(255,255,255,0.05) 100%)"
                    : "linear-gradient(90deg, rgba(0,0,0,0.035) 0%, rgba(255,255,255,0.62) 48%, rgba(0,0,0,0.035) 100%)",
                  backgroundSize: "220% 100%",
                  animation: "sinan-loader-shimmer 1.9s linear infinite",
                  position: "relative",
                  overflow: "hidden",
                  mb: 0.2,
                  "&::after": {
                    content: '""',
                    position: "absolute",
                    top: 1,
                    left: "-34%",
                    width: "34%",
                    height: "calc(100% - 2px)",
                    borderRadius: "inherit",
                    background: isDark
                      ? "linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.16) 50%, rgba(255,255,255,0.04) 100%)"
                      : "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.72) 50%, rgba(255,255,255,0) 100%)",
                    animation: "sinan-loader-bar-run 1.9s ease-in-out infinite",
                  },
                }}
              />
              {Array.from({ length: skeletonLines }).map((_, index) => (
                <Skeleton
                  key={index}
                  variant="rounded"
                  animation="wave"
                  height={index === 0 ? 12 : 10}
                  width={
                    index === 0
                      ? "88%"
                      : index === skeletonLines - 1
                        ? "56%"
                        : "100%"
                  }
                  sx={{
                    mx: "auto",
                    borderRadius: "999px",
                    bgcolor: isDark
                      ? alpha(theme.palette.common.white, 0.08)
                      : alpha(theme.palette.common.black, 0.06),
                  }}
                />
              ))}
            </Stack>
          ) : null}
        </Stack>
      </AppCard>
    </Box>
  );
}
