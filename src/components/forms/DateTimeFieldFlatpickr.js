"use client";

import { DateTimePicker, DatePicker } from "@mui/x-date-pickers";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";

export default function DateTimeFieldFlatpickr({
  label,
  value,
  onChange,
  enableTime = true,
  required = false,
  helperText,
  minDate,
  placeholder,
}) {
  const dayjsValue = value ? dayjs(value) : null;
  const dayjsMin = minDate ? dayjs(minDate) : undefined;

  const slotProps = {
    textField: {
      fullWidth: true,
      required,
      helperText,
      size: "medium",
      placeholder: placeholder || (enableTime ? "dd MMM yyyy, hh:mm AM/PM" : "dd MMM yyyy"),
      InputProps: { sx: { borderRadius: 3 } },
    },
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      {enableTime ? (
        <DateTimePicker
          label={label}
          value={dayjsValue}
          onChange={(val) => onChange?.(val ? val.toDate() : null)}
          minDateTime={dayjsMin}
          format="DD MMM YYYY, hh:mm A"
          ampm
          slotProps={slotProps}
        />
      ) : (
        <DatePicker
          label={label}
          value={dayjsValue}
          onChange={(val) => onChange?.(val ? val.toDate() : null)}
          minDate={dayjsMin}
          format="DD MMM YYYY"
          slotProps={slotProps}
        />
      )}
    </LocalizationProvider>
  );
}
