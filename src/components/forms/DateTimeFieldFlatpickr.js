"use client";

import "flatpickr/dist/themes/material_blue.css";
import { Box, FormHelperText, Typography } from "@mui/material";
import Flatpickr from "react-flatpickr";

export default function DateTimeFieldFlatpickr({
  label,
  value,
  onChange,
  enableTime = true,
  required = false,
  helperText,
  minDate,
}) {
  return (
    <Box>
      {label && (
        <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 500 }}>
          {label}
          {required ? " *" : ""}
        </Typography>
      )}
      <Flatpickr
        value={value}
        options={{
          enableTime,
          dateFormat: enableTime ? "Y-m-d H:i" : "Y-m-d",
          minDate,
          time_24hr: true,
        }}
        onChange={(selectedDates) => onChange?.(selectedDates?.[0] || null)}
      />
      {helperText ? <FormHelperText>{helperText}</FormHelperText> : null}
    </Box>
  );
}
