import "flatpickr/dist/themes/material_blue.css";
import { Box, TextField, InputAdornment } from "@mui/material";
import Flatpickr from "react-flatpickr";
import ICONS from "@/utils/iconUtil";

export default function DateTimeFieldFlatpickr({
  label,
  value,
  onChange,
  enableTime = true,
  required = false,
  helperText,
  minDate,
  placeholder,
  dateFormat,
}) {
  return (
    <Box sx={{ width: "100%" }}>
      <Flatpickr
        value={value}
        options={{
          enableTime,
          dateFormat: dateFormat || (enableTime ? "Y-m-d H:i" : "Y-m-d"),
          altInput: true,
          altFormat: dateFormat || (enableTime ? "d M Y, h:i K" : "d M Y"),
          minDate,
          time_24hr: false,
          allowInput: true,
        }}
        onChange={(selectedDates) => onChange?.(selectedDates?.[0] || null)}
        render={({ defaultValue, value, render, ...props }, ref) => (
          <TextField
            {...props}
            defaultValue={defaultValue}
            inputRef={ref}
            label={label}
            placeholder={placeholder || (enableTime ? "Select Date & Time" : "Select Date")}
            fullWidth
            required={required}
            helperText={helperText}
            error={false}
            size="medium"
            InputProps={{
              sx: { borderRadius: 3 },
              startAdornment: (
                <InputAdornment position="start">
                  <ICONS.event fontSize="small" sx={{ opacity: 0.6 }} />
                </InputAdornment>
              ),
            }}
          />
        )}
      />
    </Box>
  );
}
