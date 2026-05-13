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
import { useLanguage } from "@/contexts/LanguageContext";

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

// Map from English option value to translation key
const PURPOSE_KEY_MAP = {
  "Meeting": "purposeMeeting",
  "Vendor Visit": "purposeVendorVisit",
  "Contractor Work": "purposeContractorWork",
  "Audit / Inspection": "purposeAuditInspection",
  "Delivery": "purposeDelivery",
  "Interview": "purposeInterview",
  "Training": "purposeTraining",
  "Maintenance": "purposeMaintenance",
  "Government Visit": "purposeGovernmentVisit",
  "VIP Visit": "purposeVipVisit",
  "Other": "purposeOther",
};

const PRESET_VALUES = PURPOSE_OPTIONS.filter((o) => o !== "Other");

function resolveSelect(value) {
  if (!value) return "";
  return PRESET_VALUES.includes(value) ? value : "Other";
}

function resolveCustom(value) {
  if (!value || value === "Other" || PRESET_VALUES.includes(value)) return "";
  return value;
}

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
  const { t } = useLanguage();

  const [select, setSelect] = useState(() => resolveSelect(value));
  const [custom, setCustom] = useState(() => resolveCustom(value));

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
        <InputLabel>{t("purposeOfVisit")}</InputLabel>
        <Select
          value={select}
          label={t("purposeOfVisit")}
          onChange={(e) => handleSelectChange(e.target.value)}
          disabled={disabled}
          sx={{ borderRadius: radius }}
        >
          {PURPOSE_OPTIONS.map((opt) => (
            <MenuItem key={opt} value={opt}>
              {t(PURPOSE_KEY_MAP[opt]) || opt}
            </MenuItem>
          ))}
        </Select>
        {selectError && <FormHelperText>{helperText}</FormHelperText>}
      </FormControl>

      {select === "Other" && (
        <TextField
          label={t("pleaseSpecify")}
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
