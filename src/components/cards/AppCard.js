"use client";

import React from "react";
import { Box, Paper } from "@mui/material";
import { wrapTextBox } from "@/utils/wrapTextStyles";
import { useColorMode } from "@/contexts/ThemeContext";

const AppCard = ({ children, sx, interactive = true, ...props }) => {
  const { mode } = useColorMode();
  const isDark = mode === "dark";

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 4,
        overflow: "hidden",
        width: "100%",
        maxWidth: "100%",
        border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.05)",
        background: isDark
          ? "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)"
          : "#fff",
        boxShadow: isDark
          ? "0 10px 24px rgba(5,10,18,0.24), inset 0 1px 0 rgba(255,255,255,0.06)"
          : "0 4px 12px rgba(0,0,0,0.08)",
        backdropFilter: isDark ? "blur(12px)" : "none",
        transition: "all 0.3s ease",
        display: "flex",
        flexDirection: "column",
        ...wrapTextBox,
        ...(interactive && {
          "&:hover": {
            transform: "translateY(-2px)",
            boxShadow: isDark
              ? "0 14px 30px rgba(5,10,18,0.3), inset 0 1px 0 rgba(255,255,255,0.08)"
              : "0 12px 28px rgba(0,0,0,0.15)",
          },
        }),
        ...sx,
      }}
      {...props}
    >
      {children}
    </Paper>
  );
};

export const AppCardText = ({ sx, ...props }) => (
  <Box
    sx={{
      minWidth: 0,
      ...wrapTextBox,
      ...sx,
    }}
    {...props}
  />
);

export default AppCard;
