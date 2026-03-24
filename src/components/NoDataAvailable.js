"use client";

import { Box, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import AppCard from "@/components/cards/AppCard";
import ICONS from "@/utils/iconUtil";

export default function NoDataAvailable({
  title = "No data available",
  description = "There is nothing to display right now.",
  minHeight = 280,
  compact = false,
  sx = {},
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const EmptyIcon = ICONS.empty;

  return (
    <AppCard
      interactive={false}
      role="status"
      sx={{
        minHeight,
        px: { xs: 2.5, sm: 3.5 },
        py: compact ? 4 : 6,
        borderRadius: 4,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        ...sx,
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          mb: compact ? 2 : 3,
        }}
      >
        <EmptyIcon
          sx={{
            fontSize: compact ? 42 : 52,
            color: isDark
              ? alpha(theme.palette.common.white, 0.78)
              : alpha(theme.palette.text.primary, 0.5),
          }}
        />
      </Box>

      <Typography
        variant={compact ? "h6" : "h5"}
        fontWeight={800}
        sx={{
          mb: 1,
          fontSize: compact ? "1.05rem" : { xs: "1.2rem", sm: "1.35rem" },
        }}
      >
        {title}
      </Typography>

      {description ? (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            maxWidth: 380,
            lineHeight: 1.65,
          }}
        >
          {description}
        </Typography>
      ) : null}
    </AppCard>
  );
}
