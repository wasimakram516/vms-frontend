"use client";

import { Box, Stack, Typography } from "@mui/material";

export default function ListToolbar({
  showingCount = 0,
  totalCount = 0,
  itemLabel = "records",
  searchSlot = null,
  actionsSlot = null,
  sx = {},
}) {
  const summary = `Showing ${showingCount} of ${totalCount} ${itemLabel}`;

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          md: searchSlot
            ? "minmax(0, 1fr) minmax(280px, 420px) minmax(0, 1fr)"
            : "minmax(0, 1fr) auto",
        },
        alignItems: "center",
        gap: 2,
        mb: 4,
        ...sx,
      }}
    >
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{
          fontWeight: 700,
          textAlign: { xs: "center", md: "left" },
        }}
      >
        {summary}
      </Typography>

      {searchSlot ? (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            width: "100%",
          }}
        >
          {searchSlot}
        </Box>
      ) : null}

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{
          width: { xs: "100%", md: "auto" },
          justifySelf: { md: "end" },
          alignItems: { xs: "stretch", md: "center" },
        }}
      >
        {actionsSlot}
      </Stack>
    </Box>
  );
}
