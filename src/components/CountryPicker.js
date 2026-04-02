"use client";

import { useState, useMemo } from "react";
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  TextField,
  InputAdornment,
  ListSubheader,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { COUNTRY_CODES, getFlagImageUrl } from "@/utils/countryCodes";

// Deduplicate by isoCode — COUNTRY_CODES may have entries with the same country listed multiple times
const UNIQUE_COUNTRIES = Object.values(
  Object.fromEntries(COUNTRY_CODES.map((cc) => [cc.isoCode, cc]))
).sort((a, b) => a.country.localeCompare(b.country));

export default function CountryPicker({
  label = "Country",
  value,
  onChange,
  required = false,
  error = false,
  helperText,
  disabled = false,
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return UNIQUE_COUNTRIES;
    const q = search.toLowerCase();
    return UNIQUE_COUNTRIES.filter((cc) => cc.country.toLowerCase().includes(q));
  }, [search]);

  const selected = UNIQUE_COUNTRIES.find((cc) => cc.isoCode === value?.toLowerCase());

  return (
    <FormControl fullWidth required={required} error={error} disabled={disabled}>
      <InputLabel>{label}</InputLabel>
      <Select
        value={value || ""}
        label={label}
        onChange={(e) => onChange?.(e.target.value)}
        onClose={() => setSearch("")}
        renderValue={() =>
          selected ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <img
                src={getFlagImageUrl(selected.isoCode)}
                alt={selected.country}
                style={{ width: 20, height: 14, objectFit: "cover", borderRadius: 2 }}
              />
              <Typography variant="body2">{selected.country}</Typography>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">{label}</Typography>
          )
        }
        sx={{ borderRadius: 30 }}
        MenuProps={{ autoFocus: false, PaperProps: { sx: { maxHeight: 320 } } }}
      >
        {/* Sticky search inside the dropdown */}
        <ListSubheader sx={{ bgcolor: "background.paper", pt: 1, pb: 0.5 }}>
          <TextField
            size="small"
            fullWidth
            placeholder="Search country…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            autoFocus
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
        </ListSubheader>

        {filtered.length === 0 && (
          <MenuItem disabled>
            <Typography variant="body2" color="text.secondary">No countries found</Typography>
          </MenuItem>
        )}

        {filtered.map((cc) => (
          <MenuItem key={cc.isoCode} value={cc.isoCode}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <img
                src={getFlagImageUrl(cc.isoCode)}
                alt={cc.country}
                style={{ width: 20, height: 14, objectFit: "cover", borderRadius: 2 }}
              />
              <Typography variant="body2">{cc.country}</Typography>
            </Box>
          </MenuItem>
        ))}
      </Select>
      {helperText && (
        <Typography variant="caption" color={error ? "error" : "text.secondary"} sx={{ mt: 0.5, ml: 1.5 }}>
          {helperText}
        </Typography>
      )}
    </FormControl>
  );
}
