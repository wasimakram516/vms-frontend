"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Stack,
  Typography,
  Divider,
  MenuItem,
  TextField,
  CircularProgress,
  alpha,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  FormHelperText,
  Checkbox,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";
import { useRouter } from "next/navigation";
import { useVisitor } from "@/contexts/VisitorContext";
import { createRegistration, visitorEditRegistration, getFields } from "@/services/registrationService";
import { getDepartments } from "@/services/departmentService";
import { getPublicActiveNdaTemplate } from "@/services/ndaTemplateService";
import NdaTemplateContent from "@/components/NdaTemplateContent";
import { motion } from "framer-motion";
import dayjs from "dayjs";
import ICONS from "@/utils/iconUtil";
import VisitorLayout from "@/components/layout/VisitorLayout";
import { useColorMode } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { parse24To12, convert12To24, formatDate, formatTime } from "@/utils/dateUtils";
import { translateBatch } from "@/services/translationService";
import { ndaDocToHtml } from "@/utils/ndaDocUtils";
import getStartIconSpacing from "@/utils/getStartIconSpacing";

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
const PERIODS = ["AM", "PM"];

export default function BookingPage() {
  const router = useRouter();
  const { visitorData, setVisitorData, bookingData, setBookingData, resetVisitorFlow, flowState, setFlowState } = useVisitor();
  const { mode } = useColorMode();
  const { t, isRtl, lang } = useLanguage();
  const isDark = mode === "dark";
  const dir = isRtl ? "rtl" : "ltr";

  // Scoped RTL — same pattern as details page
  useEffect(() => {
    document.documentElement.dir = isRtl ? "rtl" : "ltr";
  }, [isRtl]);

  const isReturning = flowState?.isReturning === true;
  const isEditMode = isReturning && flowState?.isEditMode === true;
  const activeRegistration = flowState?.activeRegistration ?? null;
  const ndaRequired = isReturning && flowState?.ndaAccepted === false;
  const [submitting, setSubmitting] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [translatedDeptNames, setTranslatedDeptNames] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [ndaOpen, setNdaOpen] = useState(false);
  const [ndaAccepted, setNdaAccepted] = useState(false);
  const ndaWasRequired = useRef(ndaRequired);
  const showNdaCheckbox = ndaWasRequired.current;
  const [ndaTemplate, setNdaTemplate] = useState(null);
  const [ndaLoading, setNdaLoading] = useState(false);
  const [translatedNda, setTranslatedNda] = useState(null);

  const [bookingType, setBookingType] = useState("preset");
  const [selectedPreset, setSelectedPreset] = useState("fullDay");

  // ── Custom fields for purpose of visit (returning visitor flow) ───────────
  const [purposeCustomFields, setPurposeCustomFields] = useState([]);

  const getChildFieldIds = (config) => {
    if (!config) return [];
    if (Array.isArray(config)) return config;
    return config.fieldIds || [];
  };

  // Collect purpose field + all its transitive dependents
  const purposeRelatedIds = useMemo(() => {
    const normKey = (s = '') => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const purposeField = purposeCustomFields.find((f) => {
      const k = normKey(f.field_key || f.fieldKey);
      const l = (f.label || '').toLowerCase();
      return k.includes('purposeofvisit') || k === 'purpose' || l.includes('purpose of visit');
    });
    if (!purposeField) return new Set();
    const ids = new Set([purposeField.id]);
    const queue = [purposeField];
    const byId = Object.fromEntries(purposeCustomFields.map((f) => [f.id, f]));
    while (queue.length > 0) {
      const cur = queue.shift();
      const deps = cur.dependents_json || cur.dependentsJson;
      if (!deps) continue;
      Object.values(deps).forEach((cfg) => {
        getChildFieldIds(cfg).forEach((id) => {
          if (!ids.has(id)) { ids.add(id); if (byId[id]) queue.push(byId[id]); }
        });
      });
    }
    return ids;
  }, [purposeCustomFields]);

  // BFS visibility for the purpose field subset
  const purposeVisibleIds = useMemo(() => {
    const allChildIds = new Set();
    purposeCustomFields.forEach((f) => {
      const deps = f.dependents_json || f.dependentsJson;
      if (deps) Object.values(deps).forEach((cfg) => getChildFieldIds(cfg).forEach((id) => allChildIds.add(id)));
    });
    const visible = new Set();
    const byId = Object.fromEntries(purposeCustomFields.map((f) => [f.id, f]));
    const queue = purposeCustomFields.filter((f) => !allChildIds.has(f.id) && purposeRelatedIds.has(f.id));
    queue.forEach((f) => visible.add(f.id));
    const bfsQueue = [...queue];
    while (bfsQueue.length > 0) {
      const cur = bfsQueue.shift();
      const deps = cur.dependents_json || cur.dependentsJson;
      if (!deps) continue;
      const curVal = visitorData.dynamicFields?.[cur.field_key || cur.fieldKey];
      if (curVal && deps[curVal]) {
        getChildFieldIds(deps[curVal]).forEach((id) => {
          if (!visible.has(id) && purposeRelatedIds.has(id)) {
            visible.add(id);
            if (byId[id]) bfsQueue.push(byId[id]);
          }
        });
      }
    }
    return visible;
  }, [purposeCustomFields, purposeRelatedIds, visitorData.dynamicFields]);

  const handlePurposeFieldChange = (key, value) => {
    setVisitorData((prev) => {
      const updated = { ...prev.dynamicFields, [key]: value };
      // Clear hidden dependents when parent value changes
      const parentField = purposeCustomFields.find((f) => (f.field_key || f.fieldKey) === key);
      const deps = parentField?.dependents_json || parentField?.dependentsJson;
      if (deps) {
        Object.entries(deps).forEach(([triggerVal, cfg]) => {
          if (triggerVal !== value) {
            getChildFieldIds(cfg).forEach((childId) => {
              const childField = purposeCustomFields.find((f) => f.id === childId);
              if (childField) delete updated[childField.field_key || childField.fieldKey];
            });
          }
        });
      }
      return { ...prev, dynamicFields: updated };
    });
    if (fieldErrors[key]) setFieldErrors((p) => { const n = { ...p }; delete n[key]; return n; });
  };
  const bookingDate = bookingData.date ? dayjs(bookingData.date) : null;
  const hasValidBookingDate = bookingDate?.isValid?.() === true;

  // Fetch custom fields and pre-fill purpose from activeRegistration for returning visitors
  useEffect(() => {
    if (!isReturning) return;
    getFields().then((res) => {
      if (!Array.isArray(res)) return;
      setPurposeCustomFields(res);

      if (!isEditMode || !activeRegistration) return;

      // Find the purpose field to know its key
      const normKey = (s = '') => s.toLowerCase().replace(/[^a-z0-9]/g, '');
      const purposeField = res.find((f) => {
        const k = normKey(f.field_key || f.fieldKey);
        const l = (f.label || '').toLowerCase();
        return k.includes('purposeofvisit') || k === 'purpose' || l.includes('purpose of visit');
      });

      // Merge field values from activeRegistration (prefer fieldValues, bridge purposeOfVisit for old records)
      const preFill = { ...(activeRegistration.fieldValues || {}) };
      if (purposeField) {
        const pk = purposeField.field_key || purposeField.fieldKey;
        if (!preFill[pk] && activeRegistration.purposeOfVisit) {
          preFill[pk] = activeRegistration.purposeOfVisit;
        }
      }
      if (Object.keys(preFill).length > 0) {
        setVisitorData((prev) => ({ ...prev, dynamicFields: { ...prev.dynamicFields, ...preFill } }));
      }
    });
  }, [isReturning]);

  useEffect(() => {
    if (!isReturning) return;
    getDepartments(true).then((res) => {
      if (!Array.isArray(res)) return;
      setDepartments(res);
      const names = res.map((d) => d.name || "");
      translateBatch(names, "ar").then((results) => {
        const map = {};
        res.forEach((d, i) => { map[d.id] = results[i] || d.name; });
        setTranslatedDeptNames(map);
      });
    });
  }, [isReturning]);

  useEffect(() => {
    if (!isEditMode || !activeRegistration) return;
    if (activeRegistration.requestedFrom) {
      const from = dayjs(activeRegistration.requestedFrom);
      setBookingData((prev) => ({
        ...prev,
        date: from.format("YYYY-MM-DD"),
        timeFrom: from.format("HH:mm"),
        timeTo: activeRegistration.requestedTo ? dayjs(activeRegistration.requestedTo).format("HH:mm") : prev.timeTo,
      }));
    }
    if (activeRegistration.departmentId) {
      setVisitorData((prev) => ({ ...prev, departmentId: activeRegistration.departmentId }));
    }
  }, [isEditMode]);

  useEffect(() => {
    if (!ndaRequired) return;
    setNdaLoading(true);
    getPublicActiveNdaTemplate()
      .then(async (res) => {
        const resolved = res || null;
        setNdaTemplate(resolved);
        if (resolved) {
          const preambleHtml = Array.isArray(resolved.preamble) ? ndaDocToHtml(resolved.preamble) : (resolved.preamble || "");
          const bodyHtml = Array.isArray(resolved.body) ? ndaDocToHtml(resolved.body) : (resolved.body || "");
          const [arName, arPreamble, arBody] = await translateBatch([resolved.name || "", preambleHtml, bodyHtml], "ar", "html");
          setTranslatedNda({ ...resolved, name: arName, preamble: arPreamble, body: arBody });
        }
      })
      .catch(() => setNdaTemplate(null))
      .finally(() => setNdaLoading(false));
  }, [ndaRequired]);

  const handleDateChange = (newDate) => {
    setBookingData((prev) => ({ ...prev, date: newDate }));
  };

  const handleTimePartChange = (type, part, value) => {
    const current = parse24To12(bookingData[type]);
    const next = { ...current, [part]: value };
    const time24 = convert12To24(next.hour12, next.minute, next.ampm);

    setBookingData((prev) => {
      let newData = { ...prev, [type]: time24 };

      if (bookingType === "custom") {
        if (type === "timeFrom" && newData.timeTo <= time24) {
          let [h, m] = time24.split(":").map(Number);
          h = (h + 1) % 24;
          newData.timeTo = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        } else if (type === "timeTo" && newData.timeFrom >= time24) {
          let [h, m] = time24.split(":").map(Number);
          newData.timeFrom = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        }
      } else if (bookingType === "preset" && selectedPreset === "fullDay") {
        if (type === "timeFrom") newData.timeTo = time24;
        else if (type === "timeTo") newData.timeFrom = time24;
      }

      return newData;
    });
  };

  const renderTimeDropdowns = (type, label) => {
    const { hour12, minute, ampm } = parse24To12(bookingData[type]);
    return (
      <Box>
        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ ml: 1, mb: 0.5, display: "block" }}>
          {label}
        </Typography>
        <Stack direction="row" sx={{ gap: 0.5 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" sx={{ fontSize: "0.6rem", fontWeight: 700, ml: 1, color: "text.secondary", textTransform: "uppercase" }}>{t("bookingHr")}</Typography>
            <TextField select size="small" value={hour12} onChange={(e) => handleTimePartChange(type, "hour12", e.target.value)} sx={{ width: "100%", "& .MuiOutlinedInput-root": { borderRadius: 30 }, "& .MuiSelect-select": { fontSize: "0.75rem", py: 1, px: 1 } }}>
              {HOURS.map((h) => <MenuItem key={h} value={h} sx={{ fontSize: "0.75rem" }}>{h}</MenuItem>)}
            </TextField>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" sx={{ fontSize: "0.6rem", fontWeight: 700, ml: 1, color: "text.secondary", textTransform: "uppercase" }}>{t("bookingMin")}</Typography>
            <TextField select size="small" value={minute} onChange={(e) => handleTimePartChange(type, "minute", e.target.value)} sx={{ width: "100%", "& .MuiOutlinedInput-root": { borderRadius: 30 }, "& .MuiSelect-select": { fontSize: "0.75rem", py: 1, px: 1 } }}>
              {MINUTES.map((m) => <MenuItem key={m} value={m} sx={{ fontSize: "0.75rem" }}>{m}</MenuItem>)}
            </TextField>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" sx={{ fontSize: "0.6rem", fontWeight: 700, ml: 1, color: "text.secondary", textTransform: "uppercase" }}>{t("bookingAmPm")}</Typography>
            <TextField select size="small" value={ampm} onChange={(e) => handleTimePartChange(type, "ampm", e.target.value)} sx={{ width: "100%", "& .MuiOutlinedInput-root": { borderRadius: 30 }, "& .MuiSelect-select": { fontSize: "0.75rem", py: 1, px: 1 } }}>
              {PERIODS.map((p) => <MenuItem key={p} value={p} sx={{ fontSize: "0.75rem" }}>{lang === "ar" ? (p === "AM" ? "ص" : "م") : p}</MenuItem>)}
            </TextField>
          </Box>
        </Stack>
      </Box>
    );
  };

  const handleSubmit = async () => {
    if (!hasValidBookingDate) return;

    if (isReturning) {
      const errs = {};
      if (!visitorData.departmentId) errs.departmentId = t("departmentRequired");
      if (showNdaCheckbox && !ndaAccepted) errs.nda = t("ndaMustAccept");
      if (Object.keys(errs).length) { setFieldErrors(errs); return; }
    }

    setSubmitting(true);
    try {
      let fromDate, toDate;
      if (bookingType === "preset") {
        const date = bookingDate;
        let from = date.clone();
        let to = date.clone();

        if (selectedPreset === "fullDay") {
          const fromParts = bookingData.timeFrom.split(":");
          const toParts = bookingData.timeTo.split(":");
          from = from.startOf("day").hour(parseInt(fromParts[0])).minute(parseInt(fromParts[1]));
          to = to.add(1, "day").startOf("day").hour(parseInt(toParts[0])).minute(parseInt(toParts[1]));
        } else if (selectedPreset === "fullWeek") {
          from = from.startOf("day");
          to = to.add(6, "days").endOf("day");
        } else if (selectedPreset === "fullMonth") {
          from = from.startOf("day");
          to = to.add(30, "days").endOf("day");
        }

        fromDate = from.format("YYYY-MM-DD");
        toDate = to.format("YYYY-MM-DD");
      } else {
        fromDate = bookingDate.format("YYYY-MM-DD");
        toDate = bookingDate.format("YYYY-MM-DD");
      }

      const payload = {
        userId: visitorData.userId,
        ndaAccepted: flowState?.ndaAccepted === true || ndaAccepted,
        requestedFrom: dayjs(`${fromDate}T${bookingData.timeFrom}`).toISOString(),
        requestedTo: dayjs(`${toDate}T${bookingData.timeTo}`).toISOString(),
        phoneIsoCode: visitorData.phoneIsoCode,
        departmentId: visitorData.departmentId || undefined,
        fieldValues: {
          ...visitorData.dynamicFields,
          full_name: visitorData.fullName || visitorData.dynamicFields.full_name,
        },
        tzOffset: new Date().getTimezoneOffset(),
      };

      let res;
      if (isEditMode && activeRegistration?.id) {
        res = await visitorEditRegistration(activeRegistration.id, {
          userId: visitorData.userId,
          requestedFrom: dayjs(`${fromDate}T${bookingData.timeFrom}`).toISOString(),
          requestedTo: dayjs(`${toDate}T${bookingData.timeTo}`).toISOString(),
          departmentId: visitorData.departmentId || undefined,
          fieldValues: {
            ...visitorData.dynamicFields,
            full_name: visitorData.fullName || visitorData.dynamicFields?.full_name,
          },
        });
      } else {
        res = await createRegistration(payload);
      }
      if (!res.error) {
        sessionStorage.setItem("vms_summary", JSON.stringify({ registration: res, visitorData }));
        resetVisitorFlow();
        router.push("/register/booking/summary");
        return;
      }
      setSubmitting(false);
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <>
      <VisitorLayout
        title={t("bookingLayoutTitle")}
        subtitle={t("bookingLayoutSubtitle")}
        mobileSubheading={t("bookingMobileSubheading")}
        maxWidth={900}
      >
        <Stack spacing={2}>
          <Box sx={{ textAlign: "center", display: { xs: "none", md: "block" } }}>
            <Typography variant="h5" fontWeight={800} sx={{ fontFamily: "'Comfortaa', cursive" }}>
              {t("bookingHeading")}
            </Typography>
            <Typography variant="body2" color="text.secondary" mt={1}>
              {t("bookingSubheading")}
            </Typography>
          </Box>

          <Divider />

          {isEditMode && activeRegistration && (
            <Box sx={{ p: 2, borderRadius: 3, bgcolor: "warning.main", color: "warning.contrastText", display: "flex", alignItems: "flex-start", gap: 1.5 }}>
              <ICONS.edit sx={{ mt: 0.2, fontSize: 20, flexShrink: 0 }} />
              <Box>
                <Typography variant="body2" fontWeight={700}>{t("activeRequestTitle")}</Typography>
                <Typography variant="caption">{t("activeRequestDesc")}</Typography>
              </Box>
            </Box>
          )}

          {isReturning && (
            <Stack spacing={2}>
              <FormControl fullWidth required error={Boolean(fieldErrors.departmentId)}>
                <InputLabel>{t("department")}</InputLabel>
                <Select
                  value={visitorData.departmentId || ""}
                  label={t("department")}
                  onChange={(e) => {
                    setVisitorData((prev) => ({ ...prev, departmentId: e.target.value }));
                    if (fieldErrors.departmentId) setFieldErrors((p) => { const n = { ...p }; delete n.departmentId; return n; });
                  }}
                  sx={{ borderRadius: 30 }}
                >
                  {departments.map((dept) => (
                    <MenuItem key={dept.id} value={dept.id}>
                      {(isRtl && translatedDeptNames[dept.id]) ? translatedDeptNames[dept.id] : dept.name}
                    </MenuItem>
                  ))}
                </Select>
                {fieldErrors.departmentId && <FormHelperText>{fieldErrors.departmentId}</FormHelperText>}
              </FormControl>

              {purposeCustomFields
                .filter((f) => purposeVisibleIds.has(f.id))
                .map((f) => {
                  const fieldKey = f.field_key || f.fieldKey;
                  const isRequired = f.is_required || f.isRequired;
                  const inputType = (f.input_type || f.inputType || 'text').toLowerCase();
                  const options = f.options_json || f.optionsJson || [];
                  const val = visitorData.dynamicFields?.[fieldKey] ?? '';
                  const err = fieldErrors[fieldKey];
                  if (inputType === 'select') {
                    return (
                      <FormControl key={f.id} fullWidth required={isRequired} error={Boolean(err)}>
                        <InputLabel>{f.label}</InputLabel>
                        <Select value={val} label={f.label} onChange={(e) => handlePurposeFieldChange(fieldKey, e.target.value)} sx={{ borderRadius: 30 }}>
                          {options.map((opt) => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
                        </Select>
                        {err && <FormHelperText>{err}</FormHelperText>}
                      </FormControl>
                    );
                  }
                  return (
                    <TextField
                      key={f.id}
                      fullWidth
                      label={f.label}
                      value={val}
                      required={isRequired}
                      onChange={(e) => handlePurposeFieldChange(fieldKey, e.target.value)}
                      error={Boolean(err)}
                      helperText={err}
                      multiline={inputType === 'textarea'}
                      minRows={inputType === 'textarea' ? 2 : undefined}
                      InputProps={{ sx: { borderRadius: 30 } }}
                    />
                  );
                })}

              {showNdaCheckbox && (
                <Stack spacing={0.75}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={ndaAccepted}
                        onChange={() => {
                          if (!ndaAccepted) setNdaOpen(true);
                          else setNdaAccepted(false);
                        }}
                        color="primary"
                      />
                    }
                    label={
                      <Typography component="span" variant="body2" fontWeight={600}>
                        {t("ndaAgreeLabel")}
                      </Typography>
                    }
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ pl: 4 }}>
                    {ndaAccepted ? t("ndaAcceptedHint") : t("ndaExpiredHint")}
                  </Typography>
                  {fieldErrors.nda && (
                    <Typography variant="caption" color="error.main" sx={{ pl: 4 }}>
                      {fieldErrors.nda}
                    </Typography>
                  )}
                </Stack>
              )}

              <Divider />
            </Stack>
          )}

          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, px: 2 }}>
                {t("bookingSelectDate")}
              </Typography>
              <Box
                dir="ltr"
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 4,
                  overflow: "hidden",
                  bgcolor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                  "& .MuiDateCalendar-root": { width: "100%", height: "auto", maxHeight: "none" },
                  "& .MuiPickersArrowSwitcher-button": {
                    width: 32, height: 32, borderRadius: 1,
                    color: "text.primary",
                    "&:hover": { bgcolor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)" },
                  },
                  "& .MuiPickersCalendarHeader-switchViewButton": {
                    width: 32, height: 32, borderRadius: 1,
                    "&:hover": { bgcolor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)" },
                  },
                  "& .MuiPickersDay-root.Mui-selected": {
                    bgcolor: isDark ? "#ffffff" : "#000000",
                    color: isDark ? "#000000" : "#ffffff",
                    fontWeight: 800,
                    "&:hover": { bgcolor: isDark ? "#e0e0e0" : "#333333" },
                    "&:focus": { bgcolor: isDark ? "#ffffff" : "#000000" },
                  },
                  "& .MuiPickersDay-root.MuiPickersDay-today:not(.Mui-selected)": {
                    borderColor: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.35)",
                  },
                  "& .MuiDayCalendar-weekDayLabel": {
                    fontWeight: 700,
                    color: "text.secondary",
                    fontSize: "0.75rem",
                  },
                  "& .MuiPickersCalendarHeader-label": { fontWeight: 700 },
                }}
              >
                <DateCalendar
                  value={hasValidBookingDate ? bookingDate : null}
                  onChange={handleDateChange}
                  disablePast
                  slots={{
                    leftArrowIcon: () => (
                      <span style={{ fontSize: 15, fontWeight: 700, lineHeight: 1, fontFamily: "monospace" }}>{">"}</span>
                    ),
                    rightArrowIcon: () => (
                      <span style={{ fontSize: 15, fontWeight: 700, lineHeight: 1, fontFamily: "monospace" }}>{"<"}</span>
                    ),
                  }}
                />
              </Box>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                {t("bookingSelectTime")}
              </Typography>
              <Box sx={{ mt: 0 }}>
                <Stack spacing={2}>
                  <Tabs
                    value={bookingType}
                    onChange={(_, value) => {
                      setBookingType(value);
                      if (value === "preset") {
                        if (selectedPreset === "fullDay") {
                          setBookingData((prev) => ({ ...prev, timeTo: prev.timeFrom }));
                        } else {
                          setBookingData((prev) => ({ ...prev, timeFrom: "00:00", timeTo: "23:59" }));
                        }
                      }
                    }}
                    variant="fullWidth"
                    sx={{ minHeight: 46, bgcolor: (theme) => alpha(theme.palette.text.primary, isDark ? 0.06 : 0.04), borderRadius: 999, p: 0.5, "& .MuiTabs-indicator": { display: "none" }, "& .MuiTab-iconWrapper": { marginRight: isRtl ? 0 : "8px", marginLeft: isRtl ? "8px" : 0 } }}
                  >
                    <Tab value="preset" icon={<ICONS.event fontSize="small" />} iconPosition="start" label={t("bookingPresetTab")} sx={{ minHeight: 38, borderRadius: 999, fontWeight: 800, textTransform: "none", "&.Mui-selected": { bgcolor: "background.paper", color: "text.primary", boxShadow: "0 6px 14px rgba(0,0,0,0.08)" } }} />
                    <Tab value="custom" icon={<ICONS.time fontSize="small" />} iconPosition="start" label={t("bookingCustomTab")} sx={{ minHeight: 38, borderRadius: 999, fontWeight: 800, textTransform: "none", "&.Mui-selected": { bgcolor: "background.paper", color: "text.primary", boxShadow: "0 6px 14px rgba(0,0,0,0.08)" } }} />
                  </Tabs>

                  {bookingType === "custom" && (
                    <Box sx={{ p: 2, bgcolor: "action.hover", borderRadius: 2, border: "1px solid", borderColor: "divider", minHeight: 320 }}>
                      <Stack spacing={2} sx={{ mb: 2 }}>
                        {renderTimeDropdowns("timeFrom", t("bookingArrival"))}
                        {renderTimeDropdowns("timeTo", t("bookingDeparture"))}
                      </Stack>
                      <Box sx={{ p: 1.5, bgcolor: "background.paper", borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
                        <Stack direction="row" sx={{ gap: 1 }} alignItems="center">
                          <ICONS.info sx={{ fontSize: 16, color: "text.secondary" }} />
                          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ fontSize: 12 }}>
                            {t("bookingDuration").replace("{{min}}", dayjs(`2000-01-01 ${bookingData.timeTo}`).diff(dayjs(`2000-01-01 ${bookingData.timeFrom}`), "minute"))}
                          </Typography>
                        </Stack>
                      </Box>
                    </Box>
                  )}

                  {bookingType === "preset" && (
                    <Box sx={{ p: 2, bgcolor: "action.hover", borderRadius: 2, border: "1px solid", borderColor: "divider", minHeight: 320 }}>
                      <Box sx={{ mb: 2.5 }}>
                        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: "block", mb: 1, textTransform: "uppercase", fontSize: "0.65rem" }}>
                          {t("bookingPresetType")}
                        </Typography>
                        <TextField
                          fullWidth select size="small"
                          value={selectedPreset || "fullDay"}
                          onChange={(e) => {
                            const preset = e.target.value;
                            setSelectedPreset(preset);
                            if (preset === "fullDay") {
                              setBookingData((prev) => ({ ...prev, timeTo: prev.timeFrom }));
                            } else {
                              setBookingData((prev) => ({ ...prev, timeFrom: "00:00", timeTo: "23:59" }));
                            }
                          }}
                          sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                        >
                          <MenuItem value="fullDay">{t("bookingFullDay")}</MenuItem>
                          <MenuItem value="fullWeek">{t("bookingFullWeek")}</MenuItem>
                          <MenuItem value="fullMonth">{t("bookingFullMonth")}</MenuItem>
                        </TextField>
                      </Box>

                      {hasValidBookingDate && (
                        <Box sx={{ p: 1.5, bgcolor: "background.paper", borderRadius: 2, border: "1px solid", borderColor: "divider", mb: 2.5 }}>
                          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: "block", mb: 0.5, textTransform: "uppercase", fontSize: "0.65rem" }}>
                            {t("bookingDateRange")}
                          </Typography>
                          <Typography variant="body2" fontWeight={600} color="text.primary">
                            {(() => {
                              const date = bookingDate;
                              let from = date.clone();
                              let to = date.clone();
                              if (selectedPreset === "fullDay") {
                                const fromParts = bookingData.timeFrom.split(":");
                                const toParts = bookingData.timeTo.split(":");
                                from = from.startOf("day").hour(parseInt(fromParts[0])).minute(parseInt(fromParts[1]));
                                to = to.add(1, "day").startOf("day").hour(parseInt(toParts[0])).minute(parseInt(toParts[1]));
                              } else if (selectedPreset === "fullWeek") {
                                from = from.startOf("day").hour(0).minute(0);
                                to = to.add(6, "days").hour(23).minute(59);
                              } else if (selectedPreset === "fullMonth") {
                                from = from.startOf("day").hour(0).minute(0);
                                to = to.add(30, "days").hour(23).minute(59);
                              }
                              const locale = lang === "ar" ? "ar-u-nu-latn" : "en-GB";
                              const fmtDate = (d) => new Intl.DateTimeFormat(locale, { day: "2-digit", month: "long", year: "numeric" }).format(d.toDate());
                              const fmtTime = (d) => d.toDate().toLocaleString(locale, { hour: "2-digit", minute: "2-digit", hour12: true });
                              return `${fmtDate(from)}, ${fmtTime(from)} → ${fmtDate(to)}, ${fmtTime(to)}`;
                            })()}
                          </Typography>
                        </Box>
                      )}

                      <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: "block", mb: 2, textTransform: "uppercase", fontSize: "0.65rem" }}>
                        {t("bookingTimeLabel")}
                      </Typography>
                      <Stack spacing={2}>
                        {renderTimeDropdowns("timeFrom", selectedPreset === "fullDay" ? t("bookingFullDayStart") : t("bookingStartTime"))}
                        {selectedPreset !== "fullDay" && renderTimeDropdowns("timeTo", t("bookingEndTime"))}
                        {selectedPreset === "fullDay" && (
                          <Box sx={{ p: 1.5, bgcolor: "background.paper", borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
                            <Stack direction="row" sx={{ gap: 1 }} alignItems="center">
                              <ICONS.info sx={{ fontSize: 16, color: "text.secondary" }} />
                              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ fontSize: 12 }}>
                                {t("bookingFullDayNote")}
                              </Typography>
                            </Stack>
                          </Box>
                        )}
                      </Stack>
                    </Box>
                  )}
                </Stack>
              </Box>
            </Grid>
          </Grid>

          <Divider />

          <Stack direction="row" sx={{ gap: 2 }}>
            {!isReturning && !isEditMode && (
              <Button
                variant="outlined"
                fullWidth
                disabled={submitting}
                startIcon={isRtl ? <ICONS.next /> : <ICONS.back />}
                onClick={() => router.back()}
                sx={{ py: 1.5, borderRadius: 30, ...getStartIconSpacing(dir) }}
              >
                {t("back")}
              </Button>
            )}
            <Button
              variant="contained"
              fullWidth
              disabled={submitting || !hasValidBookingDate}
              startIcon={submitting ? <CircularProgress size={24} color="inherit" /> : <ICONS.send />}
              onClick={handleSubmit}
              sx={{ py: 1.5, borderRadius: 30, ...getStartIconSpacing(dir) }}
            >
              {submitting ? t("bookingSending") : isEditMode ? t("bookingSaveChanges") : t("submit")}
            </Button>
          </Stack>
        </Stack>
      </VisitorLayout>

      <Dialog open={ndaOpen} onClose={() => setNdaOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 4, p: 1 } }}>
        <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="h6" fontWeight={800} component="span" sx={{ fontFamily: "'Comfortaa', cursive" }}>
            {(isRtl && translatedNda?.name) ? translatedNda.name : (ndaTemplate?.name || t("ndaTitle"))}
          </Typography>
          <IconButton onClick={() => setNdaOpen(false)}>
            <ICONS.close />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ borderColor: "rgba(0,0,0,0.05)" }}>
          {ndaLoading ? (
            <Stack spacing={2} alignItems="center" sx={{ py: 4 }}>
              <CircularProgress size={28} />
              <Typography variant="body2" color="text.secondary">{t("ndaLoading")}</Typography>
            </Stack>
          ) : (
            <NdaTemplateContent template={(isRtl && translatedNda) ? translatedNda : ndaTemplate} />
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button variant="outlined" onClick={() => setNdaOpen(false)} sx={{ borderRadius: 30, ...getStartIconSpacing(dir) }}>
            {t("close")}
          </Button>
          <Button
            variant="contained"
            color="success"
            startIcon={<ICONS.check />}
            onClick={() => {
              setNdaAccepted(true);
              setFlowState((prev) => ({ ...prev, ndaAccepted: true }));
              setNdaOpen(false);
              if (fieldErrors.nda) setFieldErrors((p) => { const n = { ...p }; delete n.nda; return n; });
            }}
            sx={{ borderRadius: 30, ...getStartIconSpacing(dir) }}
          >
            {t("agree")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
