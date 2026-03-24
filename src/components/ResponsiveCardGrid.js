"use client";

import { Box } from "@mui/material";

export default function ResponsiveCardGrid({
  children,
  minItemWidth = 320,
  maxItemWidth = 420,
  gap = { xs: 3, md: 4 },
  sx = {},
}) {
  const minWidthValue =
    typeof minItemWidth === "number" ? `${minItemWidth}px` : minItemWidth;
  const maxWidthValue =
    typeof maxItemWidth === "number" ? `${maxItemWidth}px` : maxItemWidth;

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          sm: `repeat(auto-fit, minmax(${minWidthValue}, ${maxWidthValue}))`,
        },
        justifyContent: "center",
        gap,
        width: "100%",
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}
