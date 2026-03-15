"use client";

import { Box, Typography } from "@mui/material";
import ICONS from "@/utils/iconUtil";

const translations = {
  en: {
    noData: "No data available to display.",
  },
  ,
};

export default function NoDataAvailable({color = "#ccc"}) {
  const t = translations.en || {};

  return (
    <Box
      sx={{
        mt: 8,
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <ICONS.empty sx={{ fontSize: 72, mb: 2, color }} />
      <Typography sx={{ color }} variant="h6">
        {t.noData}
      </Typography>
    </Box>
  );
}
