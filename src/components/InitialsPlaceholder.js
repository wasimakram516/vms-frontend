"use client";

import { Box, Typography, useTheme } from "@mui/material";

export default function InitialsPlaceholder({
  name = "Placeholder",
  size = 160, 
  variant = "rounded", // "circle" | "rounded"
  fontSize,
  bgColor,
}) {

  // Extract initials (max 2 letters)
  const initials = name
    .split(" ")
    .map((word) => word[0]?.toUpperCase())
    .slice(0, 2)
    .join("");

  return (
    <Box
      sx={{
        width: "100%", 
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: bgColor || "background",
        color: "primary",
        fontWeight: "bold",
        borderRadius: variant === "circle" ? "50%" : 2,
        userSelect: "none",
      }}
    >
      <Typography
        fontWeight="bold"
        sx={{
          fontSize: fontSize || size / 3.5,
          textAlign: "center",
        }}
      >
        {initials || "?"}
      </Typography>
    </Box>
  );
}
