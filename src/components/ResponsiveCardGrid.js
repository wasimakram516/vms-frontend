"use client";

import { Box } from "@mui/material";

export default function ResponsiveCardGrid({
  children,
  minItemWidth = 320,
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
          alignItems: "stretch",
          gap: { xs: 3, sm: 3, md: 4, lg: 4 },
          width: "100%",
          // Cards keep a consistent fixed width on every row and wrap up/down
          // with screen size — the column count adapts to the viewport while
          // each card stays the same size. justifyContent:center keeps every
          // row centered, including a partial last row (no left-align, no
          // over-stretched cards).
          "& > *": {
            boxSizing: "border-box",
            flexGrow: 0,
            flexShrink: 1,
            flexBasis: { xs: "100%", sm: minW },
            width: { xs: "100%", sm: minW },
            minWidth: 0,
            maxWidth: { xs: maxW, sm: minW },
            // Force auto height so align-items:stretch can equalize every card
            // in a row. A child height:100% computes to non-auto and opts the
            // card out of stretching, which causes variable heights.
            alignSelf: "stretch",
            height: "auto !important",
          },
        },
        sx,
      ]}
    >
      {children}
    </Box>
  );
}
