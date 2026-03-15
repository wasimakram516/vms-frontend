"use client";

import { Box, CircularProgress } from "@mui/material";

/**
 * Displays a fullscreen loading spinner.
 * Can be used as a loading state placeholder for full-page content.
 */
export default function LoadingState({ size }) {
  if (size) {
    return <CircularProgress size={size} color="inherit" />;// For smaller loading size
  }
  return (
    <Box
      sx={{
        bgcolor: "background.default",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 4,
        textAlign: "center",
      }}
    >
      <CircularProgress />
    </Box>
  );
}
