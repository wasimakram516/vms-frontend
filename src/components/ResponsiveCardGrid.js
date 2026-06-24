"use client";

import { Box } from "@mui/material";

export default function ResponsiveCardGrid({
  children,
  minItemWidth = 280,
  maxItemWidth = 480,
  gap = { xs: 3, md: 4 },
  sx = {},
}) {
  const minW =
    typeof minItemWidth === "number" ? `${Math.max(minItemWidth, 1)}px` : minItemWidth;
  const maxW =
    typeof maxItemWidth === "number" ? `${maxItemWidth}px` : maxItemWidth;

  return (
    <Box
      sx={[
        {
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: { xs: 3, sm: 3, md: 4, lg: 4 },
          width: "100%",
          "& > *": {
            boxSizing: "border-box",
            width: {
              xs: "100%",
              sm: "calc(50% - 12px)",
              md: "calc(50% - 16px)",
            },
            flex: {
              xs: "0 0 100%",
              sm: "0 0 calc(50% - 12px)",
              md: "0 0 calc(50% - 16px)",
              lg: `0 1 ${minW}`,
            },
            maxWidth: {
              xs: maxW,
              sm: "calc(50% - 12px)",
              md: "calc(50% - 16px)",
              lg: maxW,
            },
            minWidth: { xs: minW, sm: 0, md: 0, lg: minW },
          },
        },
        sx,
      ]}
    >
      {children}
    </Box>
  );
}
