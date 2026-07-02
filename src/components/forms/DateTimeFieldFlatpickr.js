"use client";

import { GlobalStyles } from "@mui/material";
import { DateTimePicker, DatePicker } from "@mui/x-date-pickers";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";

const DIGITAL_CLOCK_GLOBAL_STYLES = {
  ".MuiMultiSectionDigitalClock-root .MuiMultiSectionDigitalClockSection-root:first-of-type": {
    display: "flex !important",
    flexDirection: "column !important",
    maxHeight: "290px !important",
  },
  ".MuiMultiSectionDigitalClock-root .MuiMultiSectionDigitalClockSection-root": {
    maxHeight: "290px !important",
  },
  ".MuiMultiSectionDigitalClock-root .MuiMultiSectionDigitalClockSection-item": {
    minHeight: "22px !important",
    paddingTop: "1px !important",
    paddingBottom: "1px !important",
  },
  ".MuiMultiSectionDigitalClock-root .MuiMultiSectionDigitalClockSection-root:first-of-type .MuiButtonBase-root:nth-of-type(1)": { order: 12 },
  ".MuiMultiSectionDigitalClock-root .MuiMultiSectionDigitalClockSection-root:first-of-type .MuiButtonBase-root:nth-of-type(2)": { order: 1 },
  ".MuiMultiSectionDigitalClock-root .MuiMultiSectionDigitalClockSection-root:first-of-type .MuiButtonBase-root:nth-of-type(3)": { order: 2 },
  ".MuiMultiSectionDigitalClock-root .MuiMultiSectionDigitalClockSection-root:first-of-type .MuiButtonBase-root:nth-of-type(4)": { order: 3 },
  ".MuiMultiSectionDigitalClock-root .MuiMultiSectionDigitalClockSection-root:first-of-type .MuiButtonBase-root:nth-of-type(5)": { order: 4 },
  ".MuiMultiSectionDigitalClock-root .MuiMultiSectionDigitalClockSection-root:first-of-type .MuiButtonBase-root:nth-of-type(6)": { order: 5 },
  ".MuiMultiSectionDigitalClock-root .MuiMultiSectionDigitalClockSection-root:first-of-type .MuiButtonBase-root:nth-of-type(7)": { order: 6 },
  ".MuiMultiSectionDigitalClock-root .MuiMultiSectionDigitalClockSection-root:first-of-type .MuiButtonBase-root:nth-of-type(8)": { order: 7 },
  ".MuiMultiSectionDigitalClock-root .MuiMultiSectionDigitalClockSection-root:first-of-type .MuiButtonBase-root:nth-of-type(9)": { order: 8 },
  ".MuiMultiSectionDigitalClock-root .MuiMultiSectionDigitalClockSection-root:first-of-type .MuiButtonBase-root:nth-of-type(10)": { order: 9 },
  ".MuiMultiSectionDigitalClock-root .MuiMultiSectionDigitalClockSection-root:first-of-type .MuiButtonBase-root:nth-of-type(11)": { order: 10 },
  ".MuiMultiSectionDigitalClock-root .MuiMultiSectionDigitalClockSection-root:first-of-type .MuiButtonBase-root:nth-of-type(12)": { order: 11 },
};

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

  const handleChange = (val) => {
    if (!val) { onChange?.(null); return; }
    try {
      const d = val.toDate();
      onChange?.(Number.isFinite(d.getTime()) ? d : null);
    } catch {
      onChange?.(null);
    }
  };

  return (
    <>
      <GlobalStyles styles={DIGITAL_CLOCK_GLOBAL_STYLES} />
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        {enableTime ? (
          <DateTimePicker
            label={label}
            value={dayjsValue}
            onChange={handleChange}
            minDateTime={dayjsMin}
            format="DD MMM YYYY, hh:mm A"
            ampm
            slotProps={slotProps}
          />
        ) : (
          <DatePicker
            label={label}
            value={dayjsValue}
            onChange={(val) => {
              if (!val) { onChange?.(null); return; }
              try {
                const d = val.toDate();
                onChange?.(Number.isFinite(d.getTime()) ? d : null);
              } catch {
                onChange?.(null);
              }
            }}
            minDate={dayjsMin}
            format="DD MMM YYYY"
            slotProps={slotProps}
          />
        )}
      </LocalizationProvider>
    </>
  );
}
