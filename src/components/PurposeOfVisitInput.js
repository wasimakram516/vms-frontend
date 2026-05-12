"use client";

import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Stack,
  FormHelperText,
} from "@mui/material";
import { useEffect, useState } from "react";

export const PURPOSE_OPTIONS = [
  "Vendor Visit",
  "Contractor Work",
  "Audit / Inspection",
  "Delivery",
  "Interview",
  "Training",
  "Maintenance",
  "Government Visit",
  "VIP Visit",
  "Other",
];

const PRESET_VALUES = PURPOSE_OPTIONS.filter((o) => o !== "Other");

function resolveSelect(value) {
  if (!value) return "";
  return PRESET_VALUES.includes(value) ? value : "Other";
}

function resolveCustom(value) {
  if (!value || value === "Other" || PRESET_VALUES.includes(value)) return "";
  return value;
}

/**
 * PurposeOfVisitInput
 *
 * Props:
 *   value      – the resolved purpose string (e.g. "Meeting" or a custom text)
 *   onChange   – called with the resolved string whenever the user changes anything
 *   error      – boolean (show error state)
 *   helperText – error message to display
 *   disabled   – disable all inputs
 *   required   – mark fields required
 *   rounded    – use borderRadius: 30 (visitor form style) instead of 2
 */
export default function PurposeOfVisitInput({
  value = "",
  onChange,
  error = false,
  helperText,
  disabled = false,
  required = false,
  rounded = false,
}) {
  const radius = rounded ? 30 : 2;

  const [select, setSelect] = useState(() => resolveSelect(value));
  const [custom, setCustom] = useState(() => resolveCustom(value));

  // Sync when parent resets or pre-fills the value (e.g. edit mode, returning visitor)
  useEffect(() => {
    setSelect(resolveSelect(value));
    setCustom(resolveCustom(value));
  }, [value]);

  const handleSelectChange = (newSelect) => {
    setSelect(newSelect);
    if (newSelect !== "Other") {
      setCustom("");
      onChange(newSelect);
    } else {
      onChange(custom || "Other");
    }
  };

  const handleCustomChange = (newCustom) => {
    setCustom(newCustom);
    onChange(newCustom);
  };

  const selectError = error && select !== "Other";
  const textError = error && select === "Other";

  return (
    <Stack spacing={1.5}>
      <FormControl fullWidth required={required} error={selectError}>
        <InputLabel>Purpose of Visit</InputLabel>
        <Select
          value={select}
          label="Purpose of Visit"
          onChange={(e) => handleSelectChange(e.target.value)}
          disabled={disabled}
          sx={{ borderRadius: radius }}
        >
          {PURPOSE_OPTIONS.map((opt) => (
            <MenuItem key={opt} value={opt}>
              {opt}
            </MenuItem>
          ))}
        </Select>
        {selectError && <FormHelperText>{helperText}</FormHelperText>}
      </FormControl>

      {select === "Other" && (
        <TextField
          label="Please specify"
          fullWidth
          required={required}
          value={custom}
          onChange={(e) => handleCustomChange(e.target.value)}
          disabled={disabled}
          error={textError}
          helperText={textError ? helperText : undefined}
          multiline
          minRows={2}
          InputProps={{ sx: { borderRadius: radius } }}
        />
      )}
    </Stack>
  );
}
