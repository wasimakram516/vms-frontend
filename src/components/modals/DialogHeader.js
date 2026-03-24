"use client";

import { Box, DialogTitle, IconButton, Typography } from "@mui/material";
import ICONS from "@/utils/iconUtil";

export default function DialogHeader({
  title,
  onClose,
  disableClose = false,
  align = "left",
  sx = {},
  titleSx = {},
  children,
}) {
  return (
    <DialogTitle sx={{ px: 3, py: 2.25, ...sx }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1.5,
        }}
      >
        <Typography
          variant="h6"
          fontWeight={800}
          component="span"
          sx={{
            flex: 1,
            textAlign: align,
            ...titleSx,
          }}
        >
          {children ?? title}
        </Typography>

        {onClose && !disableClose ? (
          <IconButton onClick={onClose} size="small" sx={{ flexShrink: 0 }}>
            <ICONS.close fontSize="small" />
          </IconButton>
        ) : null}
      </Box>
    </DialogTitle>
  );
}
