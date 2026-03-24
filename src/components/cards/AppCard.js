"use client";

import React from "react";
import { Box, Paper } from "@mui/material";
import { wrapTextBox } from "@/utils/wrapTextStyles";
import { useColorMode } from "@/contexts/ThemeContext";

const AppCard = ({ children, sx, ...props }) => {
  const { mode } = useColorMode();
  const isDark = mode === "dark";

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 4,
        overflow: "hidden",
        backgroundColor: isDark ? "rgba(20, 20, 20, 0.6)" : "#fff",
        boxShadow: isDark ? "0 4px 12px rgba(0,0,0,0.4)" : "0 4px 12px rgba(0,0,0,0.08)",
        transition: "all 0.3s ease",
        display: "flex",
        flexDirection: "column",
        ...wrapTextBox,
        "&:hover": {
          transform: "translateY(-2px)",
          boxShadow: isDark ? "0 12px 28px rgba(0,0,0,0.6)" : "0 12px 28px rgba(0,0,0,0.15)",
        },
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
