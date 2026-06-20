"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Button,
  TextField,
  Typography,
  Stack,
  Box,
  Divider,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  FormLabel,
  RadioGroup,
  Radio,
  FormControlLabel,
  FormGroup,
  Checkbox,
  Chip,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import ICONS from "@/utils/iconUtil";
import CountryPicker from "@/components/CountryPicker";
import { getVipFastTrackFields, createVipRegistration, updateStatus } from "@/services/registrationService";
import { useMessage } from "@/contexts/MessageContext";
import { useColorMode } from "@/contexts/ThemeContext";

// ── Dependent field visibility (mirrors backend logic) ────────────────────────

function computeVisibleFieldIds(fields, fieldValues) {
  const allChildIds = new Set();
  fields.forEach((f) => {
    const deps = f.dependentsJson || f.dependents_json;
    if (deps) {
      Object.values(deps).forEach((config) => {
        const ids = Array.isArray(config) ? config : (config?.fieldIds || []);
        ids.forEach((id) => allChildIds.add(id));
      });
    }
  });

  const visible = new Set();
  const fieldById = Object.fromEntries(fields.map((f) => [f.id, f]));
  const queue = [];

  fields.forEach((f) => {
    if (!allChildIds.has(f.id)) {
      visible.add(f.id);
      queue.push(f);
    }
  });

  while (queue.length > 0) {
    const current = queue.shift();
    const deps = current.dependentsJson || current.dependents_json;
    if (!deps) continue;
    const key = current.fieldKey || current.field_key;
    const val = fieldValues[key];
    if (val && deps[val]) {
      const ids = Array.isArray(deps[val]) ? deps[val] : (deps[val]?.fieldIds || []);
      ids.forEach((childId) => {
        if (!visible.has(childId)) {
          visible.add(childId);
          const child = fieldById[childId];
          if (child) queue.push(child);
        }
      });
    }
  }

  return visible;
}

// ── Icon picker for field labels / keys ──────────────────────────────────────

function iconForField(fieldKey, label) {
  const n = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const t = n(fieldKey) + " " + n(label);
  if (/name|fullname|visitorname/.test(t))          return ICONS.person;
  if (/company|organisation|organization|employer|firm/.test(t)) return ICONS.business;
  if (/purpose|visit|reason/.test(t))               return ICONS.info;
  if (/department|dept|division|unit|section|team/.test(t)) return ICONS.business;
  if (/omanid|nationalid|civilid|idnumber|idno|identif|documentnumber/.test(t)) return ICONS.vpnKey;
  if (/idtype|documenttype|doctype/.test(t))        return ICONS.badge;
  if (/passport/.test(t))                           return ICONS.badge;
  if (/accesslevel|access|clearance|zone/.test(t))  return ICONS.security;
  if (/email/.test(t))                              return ICONS.emailOutline;
  if (/phone|mobile|contact/.test(t))               return ICONS.phone;
  if (/country|nationality/.test(t))                return ICONS.info;
  if (/date/.test(t))                               return ICONS.event;
  if (/time/.test(t))                               return ICONS.time;
  return ICONS.info;
}

// ── Field renderer ────────────────────────────────────────────────────────────

function DynamicField({ field, value, error, isForcedRequired, onChange }) {
  const fieldKey = field.fieldKey || field.field_key;
  const inputType = (field.inputType || field.input_type || "text").toLowerCase();
  const isRequired = field.isVipRequired || field.is_vip_required || isForcedRequired;
  const options = field.optionsJson || field.options_json || [];

  if (inputType === "select") {
    return (
      <FormControl fullWidth error={Boolean(error)} required={isRequired} size="small">
        <InputLabel>{field.label}</InputLabel>
        <Select value={value ?? ""} label={field.label} onChange={(e) => onChange(fieldKey, e.target.value)}>
          {options.map((opt) => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
        </Select>
        {error && <FormHelperText>{error}</FormHelperText>}
      </FormControl>
    );
  }

  if (inputType === "radio") {
    return (
      <FormControl error={Boolean(error)} required={isRequired}>
        <FormLabel>{field.label}</FormLabel>
        <RadioGroup row value={value ?? ""} onChange={(e) => onChange(fieldKey, e.target.value)}>
          {options.map((opt) => (
            <FormControlLabel key={opt} value={opt} control={<Radio size="small" />} label={opt} />
          ))}
        </RadioGroup>
        {error && <FormHelperText>{error}</FormHelperText>}
      </FormControl>
    );
  }

  if (inputType === "checkbox") {
    const checkVals = Array.isArray(value) ? value : (value ? [value] : []);
    return (
      <FormControl error={Boolean(error)} required={isRequired}>
        <FormLabel>{field.label}</FormLabel>
        <FormGroup row>
          {options.map((opt) => (
            <FormControlLabel
              key={opt}
              control={
                <Checkbox
                  size="small"
                  checked={checkVals.includes(opt)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...checkVals, opt]
                      : checkVals.filter((v) => v !== opt);
                    onChange(fieldKey, next);
                  }}
                />
              }
              label={opt}
            />
          ))}
        </FormGroup>
        {error && <FormHelperText>{error}</FormHelperText>}
      </FormControl>
    );
  }

  if (inputType === "country") {
    return (
      <CountryPicker
        label={field.label}
        value={value || ""}
        onChange={(iso) => onChange(fieldKey, iso)}
        required={isRequired}
        error={Boolean(error)}
        helperText={error}
        size="small"
      />
    );
  }

  let htmlType = ["number", "email", "date", "time"].includes(inputType) ? inputType : "text";
  const labelLower = (field.label || "").toLowerCase();
  const keyLower = fieldKey.toLowerCase();
  if (labelLower.includes("passport") || keyLower.includes("passport")) {
    htmlType = "text";
  }

  return (
    <TextField
      fullWidth
      size="small"
      label={field.label}
      type={htmlType}
      value={value ?? ""}
      onChange={(e) => onChange(fieldKey, e.target.value)}
      required={isRequired}
      error={Boolean(error)}
      helperText={error}
      autoComplete="off"
      InputLabelProps={["date", "time"].includes(htmlType) ? { shrink: true } : {}}
    />
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

export default function VipFastTrackModal({ open, onClose, onCheckedIn }) {
  const { showMessage } = useMessage();
  const { mode } = useColorMode();
  const isDark = mode === "dark";

  const [fields, setFields] = useState([]);
  const [loadingFields, setLoadingFields] = useState(true);
  const [fieldValues, setFieldValues] = useState({});
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);

  // After successful registration
  const [registered, setRegistered] = useState(null);

  // Load VIP fields when modal opens
  useEffect(() => {
    if (!open) return;
    setLoadingFields(true);
    setFieldValues({});
    setErrors({});
    setRegistered(null);
    getVipFastTrackFields()
      .then((f) => setFields(Array.isArray(f) ? f : []))
      .catch(() => showMessage("Failed to load VIP fields", "error"))
      .finally(() => setLoadingFields(false));
  }, [open]);

  const visibleFieldIds = useMemo(
    () => computeVisibleFieldIds(fields, fieldValues),
    [fields, fieldValues]
  );

  const forcedRequiredIds = useMemo(() => {
    const forced = new Set();
    fields.filter(f => visibleFieldIds.has(f.id)).forEach(parent => {
      const deps = parent.dependentsJson || parent.dependents_json;
      if (!deps) return;
      const val = fieldValues[parent.fieldKey || parent.field_key];
      if (val && deps[val]) {
        const config = deps[val];
        if (config.areAllRequired) {
          const ids = Array.isArray(config) ? config : (config?.fieldIds || []);
          ids.forEach(id => forced.add(id));
        }
      }
    });
    return forced;
  }, [fields, visibleFieldIds, fieldValues]);

  const handleChange = (key, value) => {
    setFieldValues((prev) => {
      const next = { ...prev, [key]: value };
      // Clear children that are no longer triggered
      const field = fields.find((f) => (f.fieldKey || f.field_key) === key);
      const deps = field?.dependentsJson || field?.dependents_json;
      if (deps) {
        Object.entries(deps).forEach(([triggerVal, config]) => {
          if (triggerVal !== value) {
            const ids = Array.isArray(config) ? config : (config?.fieldIds || []);
            ids.forEach((childId) => {
              const childField = fields.find((f) => f.id === childId);
              if (childField) delete next[childField.fieldKey || childField.field_key];
            });
          }
        });
      }
      return next;
    });
    if (errors[key]) setErrors((p) => { const n = { ...p }; delete n[key]; return n; });
  };

  const validate = () => {
    const newErrors = {};
    fields
      .filter((f) => visibleFieldIds.has(f.id) && (f.isVipRequired || f.is_vip_required || forcedRequiredIds.has(f.id)))
      .forEach((f) => {
        const key = f.fieldKey || f.field_key;
        const val = fieldValues[key];
        const isEmpty = val == null || (typeof val === "string" && !val.trim()) || (Array.isArray(val) && !val.length);
        if (isEmpty) newErrors[key] = `${f.label} is required`;
      });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      // Only send values for visible fields
      const visibleValues = {};
      fields.filter((f) => visibleFieldIds.has(f.id)).forEach((f) => {
        const key = f.fieldKey || f.field_key;
        if (fieldValues[key] != null && fieldValues[key] !== "") {
          visibleValues[key] = fieldValues[key];
        }
      });

      const result = await createVipRegistration(visibleValues);
      if (result?.id) {
        setRegistered(result);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckIn = async () => {
    if (!registered?.id) return;
    setCheckingIn(true);
    try {
      await updateStatus(registered.id, { status: "checked_in" });
      showMessage("VIP visitor checked in successfully", "success");
      if (onCheckedIn) onCheckedIn(registered);
      onClose();
    } finally {
      setCheckingIn(false);
    }
  };

  const handleClose = () => {
    if (submitting || checkingIn) return;
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 4 } }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
        <Typography variant="h6" fontWeight={700} component="span">VIP Fast Track</Typography>
        <IconButton onClick={handleClose} disabled={submitting || checkingIn} size="small">
          <ICONS.close />
        </IconButton>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2 }}>
        {!registered ? (
          <>
            {loadingFields ? (
              <Box display="flex" justifyContent="center" py={4}>
                <CircularProgress />
              </Box>
            ) : fields.length === 0 ? (
              <Alert severity="warning" sx={{ borderRadius: 2 }}>
                No VIP Fast Track fields configured. Please ask the admin to mark fields as VIP Fast Track in the CMS.
              </Alert>
            ) : (
              <Stack spacing={2.5}>
                {fields
                  .filter((f) => visibleFieldIds.has(f.id))
                  .map((f) => (
                    <DynamicField
                      key={f.id}
                      field={f}
                      value={fieldValues[f.fieldKey || f.field_key]}
                      error={errors[f.fieldKey || f.field_key]}
                      isForcedRequired={forcedRequiredIds.has(f.id)}
                      onChange={handleChange}
                    />
                  ))}
              </Stack>
            )}
          </>
        ) : (
          <Box>
            {/* Header — mirrors gate verify result card */}
            <Stack direction="row" alignItems="center" spacing={2} mb={2.5}>
              <Box
                sx={{
                  bgcolor: "success.main", color: "#fff",
                  p: 1, borderRadius: 2, display: "flex",
                  alignItems: "center", justifyContent: "center",
                }}
              >
                <ICONS.checkCircle />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" fontWeight={700}>
                  VIP Registered Successfully
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap mt={0.5}>
                  <Chip label="Approved" color="success" size="small" icon={<ICONS.checkCircle style={{ fontSize: 14 }} />} sx={{ fontWeight: 600, color: isDark ? "#000" : "#fff", "& .MuiChip-icon": { color: isDark ? "#000" : "#fff" } }} />
                  <Chip label="VIP Fast Track" color="warning" size="small" icon={<ICONS.star />} sx={{ fontWeight: 800 }} />
                </Stack>
              </Box>
            </Stack>

            <Divider sx={{ mb: 2 }} />

            <List dense disablePadding>
              {fields
                .filter((f) => visibleFieldIds.has(f.id))
                .map((f) => {
                  const key = f.fieldKey || f.field_key;
                  const raw = fieldValues[key];
                  if (raw == null || raw === "" || (Array.isArray(raw) && !raw.length)) return null;
                  const display = Array.isArray(raw) ? raw.join(", ") : String(raw);
                  const Icon = iconForField(key, f.label);
                  return (
                    <ListItem key={f.id} disablePadding sx={{ py: 0.8 }}>
                      <ListItemIcon sx={{ minWidth: 36, color: "primary.main" }}>
                        <Icon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary={f.label}
                        secondary={display}
                        primaryTypographyProps={{ variant: "caption", color: "text.secondary", fontWeight: 600 }}
                        secondaryTypographyProps={{ variant: "body1", color: "text.primary", fontWeight: 500 }}
                      />
                    </ListItem>
                  );
                })}
            </List>

            <Box
              sx={{
                mt: 2.5,
                px: 2.5,
                py: 1.5,
                borderRadius: 3,
                bgcolor: "warning.main",
                textAlign: "center",
              }}
            >
              <Typography variant="body1" fontWeight={700} sx={{ color: "#fff" }}>
                Would you like to check this visitor in now?
              </Typography>
            </Box>
          </Box>
        )}
      </DialogContent>

      <Divider />
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        {!registered ? (
          <>
            <Button variant="outlined" onClick={handleClose} disabled={submitting} startIcon={<ICONS.cancel />} sx={{ borderRadius: 30 }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={submitting || loadingFields || fields.length === 0}
              startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <ICONS.register />}
              sx={{ borderRadius: 30 }}
            >
              Register VIP
            </Button>
          </>
        ) : (
          <>
            <Button variant="outlined" onClick={handleClose} disabled={checkingIn} startIcon={<ICONS.close />} sx={{ borderRadius: 30 }}>
              Close
            </Button>
            <Button
              variant="contained"
              color="success"
              onClick={handleCheckIn}
              disabled={checkingIn}
              startIcon={checkingIn ? <CircularProgress size={18} color="inherit" /> : <ICONS.checkCircle />}
              sx={{ borderRadius: 30 }}
            >
              Check In
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
