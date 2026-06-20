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
import { getWorkingHours } from "@/services/hostService";
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
// 5-minute steps: 00, 05, 10 … 55
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));
const PERIODS = ["AM", "PM"];

/** Round a minute value to the nearest 5-min step (for prefilling from DB) */
const snapTo5 = (minute) => {
  const n = Math.round(Number(minute) / 5) * 5;
  return String(n >= 60 ? 0 : n).padStart(2, "0");
};

/** Build all 24 hour slots as { h24, h12, ampm }. */
const buildAllHours = () => {
  const all = [];
  for (let h24 = 0; h24 < 24; h24++) {
    const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
    const ampm = h24 < 12 ? "AM" : "PM";
    all.push({ h24, h12, ampm });
  }
  return all;
};

/**
 * Return hour slots allowed for the given tab.
 * Working tab: constrained to the configured bracket.
 * Outside tab (and no config): all 24 hours — backend flags the truth.
 */
const getAllowedHours12 = (hostConfig, timeTypeTab) => {
  if (!hostConfig || timeTypeTab !== "working") return buildAllHours();
  const startMoD = hostConfig.start * 60 + (hostConfig.startMinute ?? 0);
  const endMoD   = hostConfig.end   * 60 + (hostConfig.endMinute   ?? 0);
  // Use hour END (h24*60+59) for lower-bound so boundary hours (e.g. 07 when
  // startMoD=450) are included — getAllowedMinutes clips their minute options.
  return buildAllHours().filter(({ h24 }) => {
    const moD = h24 * 60;
    return (h24 * 60 + 59) >= startMoD && moD <= endMoD;
  });
};

/**
 * Given a selected 24-hour value and config, return the allowed minutes (5-step)
 * for that hour.  Working tab: boundary hours are clipped to the bracket edge.
 * Outside tab: all minutes — backend flags the truth.
 */
const getAllowedMinutes = (h24, hostConfig, timeTypeTab) => {
  if (!hostConfig || timeTypeTab !== "working") return MINUTES;
  const startMoD = hostConfig.start * 60 + (hostConfig.startMinute ?? 0);
  const endMoD   = hostConfig.end   * 60 + (hostConfig.endMinute   ?? 0);
  return MINUTES.filter((mStr) => {
    const moD = h24 * 60 + Number(mStr);
    return moD >= startMoD && moD <= endMoD;
  });
};

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
  const [specificDays, setSpecificDays] = useState([]); // day indices [0=Sun..6=Sat]
  const [specificEndDate, setSpecificEndDate] = useState(null); // dayjs end date for specificDays preset

  // "working" | "weekend" — which day category the visitor is booking for
  const [dayTypeTab, setDayTypeTab] = useState("working");
  // "working" | "outside" — which time bracket the visitor chooses
  const [timeTypeTab, setTimeTypeTab] = useState("working");

  // Host working-hours/days config loaded on mount
  const [hostConfig, setHostConfig] = useState(null);

  const DAY_LABELS = [t("daySun"), t("dayMon"), t("dayTue"), t("dayWed"), t("dayThu"), t("dayFri"), t("daySat")];

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
      const fromH = from.format("HH");
      const fromM = snapTo5(from.minute());
      const toRaw = activeRegistration.requestedTo ? dayjs(activeRegistration.requestedTo) : null;
      const toH = toRaw ? toRaw.format("HH") : from.format("HH");
      const toM = toRaw ? snapTo5(toRaw.minute()) : snapTo5(from.minute());
      setBookingData((prev) => ({
        ...prev,
        date: from.format("YYYY-MM-DD"),
        timeFrom: `${fromH}:${fromM}`,
        timeTo: `${toH}:${toM}`,
      }));
    }
    // Restore recurring preset when editing
    if (activeRegistration.recurringType) {
      const typeMap = { full_week: "fullWeek", full_month: "fullMonth", specific_days: "specificDays" };
      const preset = typeMap[activeRegistration.recurringType] || "fullDay";
      setSelectedPreset(preset);
      if (preset === "specificDays" && Array.isArray(activeRegistration.recurringDays)) {
        setSpecificDays(activeRegistration.recurringDays);
      }
    }
    if (activeRegistration.departmentId) {
      setVisitorData((prev) => ({ ...prev, departmentId: activeRegistration.departmentId }));
    }
  }, [isEditMode]);

  // Load host working-hours config (best-effort; gracefully falls back to defaults)
  useEffect(() => {
    getWorkingHours().then((cfg) => { if (cfg) setHostConfig(cfg); }).catch(() => {});
  }, []);

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

  // Updates bookingData[type] to newTime24 ("HH:MM") and enforces from<to.
  const handleTimeChange = (type, newTime24) => {
    setBookingData((prev) => {
      let newData = { ...prev, [type]: newTime24 };
      if (type === "timeFrom" && newData.timeTo <= newTime24) {
        let [h, m] = newTime24.split(":").map(Number);
        h = (h + 1) % 24;
        newData.timeTo = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      } else if (type === "timeTo" && newData.timeFrom >= newTime24) {
        let [h, m] = newTime24.split(":").map(Number);
        h = (h - 1 + 24) % 24;
        newData.timeFrom = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      }
      return newData;
    });
  };

  // Hour + Minute + AM/PM selectors, all filtered to the allowed bracket.
  // unrestricted=true → bypass working-hours bracket (used by custom mode and outside tab)
  const renderTimeDropdowns = (type, label, unrestricted = false) => {
    const parts = (bookingData[type] || "08:00").split(":");
    const h24 = Number(parts[0] ?? 8);
    const minute = parts[1] ?? "00";
    const curAmPm = h24 < 12 ? "AM" : "PM";

    const effectiveTab = unrestricted ? "outside" : timeTypeTab;
    const allowedHours = getAllowedHours12(hostConfig, effectiveTab);
    // Only show AM/PM values that have at least one allowed hour
    const allowedPeriods = [...new Set(allowedHours.map((s) => s.ampm))];
    const resolvedAmPm = allowedPeriods.includes(curAmPm) ? curAmPm : (allowedPeriods[0] ?? "AM");
    // Hours within the resolved period, sorted 1→12 (12 at end)
    const hoursInPeriod = allowedHours
      .filter((s) => s.ampm === resolvedAmPm)
      .sort((a, b) => (a.h12 === 12 ? 13 : a.h12) - (b.h12 === 12 ? 13 : b.h12));
    const resolvedH24 = hoursInPeriod.some((s) => s.h24 === h24) ? h24 : (hoursInPeriod[0]?.h24 ?? 8);
    const allowedMinutes = getAllowedMinutes(resolvedH24, hostConfig, effectiveTab);
    const resolvedMinute = allowedMinutes.includes(minute) ? minute : (allowedMinutes[0] ?? "00");

    return (
      <Box>
        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ ml: 1, mb: 0.5, display: "block" }}>
          {label}
        </Typography>
        <Stack direction="row" sx={{ gap: 0.5 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" sx={{ fontSize: "0.6rem", fontWeight: 700, ml: 1, color: "text.secondary", textTransform: "uppercase" }}>{t("bookingHr")}</Typography>
            <TextField
              select size="small"
              value={resolvedH24}
              onChange={(e) => {
                const newH24 = Number(e.target.value);
                const newMins = getAllowedMinutes(newH24, hostConfig, effectiveTab);
                const snapMin = newMins.includes(resolvedMinute) ? resolvedMinute : (newMins[0] ?? "00");
                handleTimeChange(type, `${String(newH24).padStart(2, "0")}:${snapMin}`);
              }}
              sx={{ width: "100%", "& .MuiOutlinedInput-root": { borderRadius: 30 }, "& .MuiSelect-select": { fontSize: "0.75rem", py: 1, px: 1 } }}
            >
              {hoursInPeriod.map((slot) => (
                <MenuItem key={slot.h24} value={slot.h24} sx={{ fontSize: "0.75rem" }}>{slot.h12}</MenuItem>
              ))}
            </TextField>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" sx={{ fontSize: "0.6rem", fontWeight: 700, ml: 1, color: "text.secondary", textTransform: "uppercase" }}>{t("bookingMin")}</Typography>
            <TextField
              select size="small"
              value={resolvedMinute}
              onChange={(e) => handleTimeChange(type, `${String(resolvedH24).padStart(2, "0")}:${e.target.value}`)}
              sx={{ width: "100%", "& .MuiOutlinedInput-root": { borderRadius: 30 }, "& .MuiSelect-select": { fontSize: "0.75rem", py: 1, px: 1 } }}
            >
              {allowedMinutes.map((m) => <MenuItem key={m} value={m} sx={{ fontSize: "0.75rem" }}>{m}</MenuItem>)}
            </TextField>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" sx={{ fontSize: "0.6rem", fontWeight: 700, ml: 1, color: "text.secondary", textTransform: "uppercase" }}>{t("bookingAmPm")}</Typography>
            <TextField
              select size="small"
              value={resolvedAmPm}
              onChange={(e) => {
                const newAmPm = e.target.value;
                const newPeriodHours = allowedHours.filter((s) => s.ampm === newAmPm);
                const newH24 = newPeriodHours.some((s) => s.h24 === resolvedH24)
                  ? resolvedH24
                  : (newPeriodHours[0]?.h24 ?? 8);
                const newMins = getAllowedMinutes(newH24, hostConfig, effectiveTab);
                const snapMin = newMins.includes(resolvedMinute) ? resolvedMinute : (newMins[0] ?? "00");
                handleTimeChange(type, `${String(newH24).padStart(2, "0")}:${snapMin}`);
              }}
              sx={{ width: "100%", "& .MuiOutlinedInput-root": { borderRadius: 30 }, "& .MuiSelect-select": { fontSize: "0.75rem", py: 1, px: 1 } }}
            >
              {allowedPeriods.map((p) => (
                <MenuItem key={p} value={p} sx={{ fontSize: "0.75rem" }}>
                  {lang === "ar" ? (p === "AM" ? "ص" : "م") : p}
                </MenuItem>
              ))}
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

    // Validate specific days
    if (bookingType === "preset" && selectedPreset === "specificDays") {
      if (!specificDays.length) {
        setFieldErrors((p) => ({ ...p, specificDays: "Please select at least one day" }));
        return;
      }
      if (!specificEndDate || !specificEndDate.isValid()) {
        setFieldErrors((p) => ({ ...p, specificEndDate: "Please select an end date" }));
        return;
      }
      if (specificEndDate.isBefore(bookingDate, "day")) {
        setFieldErrors((p) => ({ ...p, specificEndDate: "End date must be on or after the start date" }));
        return;
      }
    }

    setSubmitting(true);
    try {
      let fromDate, toDate;
      // For Full Day preset, we build exact ISO strings from the working-hours config
      // so the payload doesn't rely on bookingData.timeFrom/timeTo (which the user never
      // touches for Full Day since no time picker is shown).
      let fullDayFromIso = null;
      let fullDayToIso   = null;
      let recurringType = null;
      let recurringDays = null;
      let recurringTimeFrom = null;
      let recurringTimeTo = null;

      if (bookingType === "preset") {
        const date = bookingDate;
        let from = date.clone();
        let to = date.clone();

        if (selectedPreset === "fullDay") {
          // Full Day = the selected date's working window on the SAME calendar day (no next-day)
          const startH = hostConfig?.start ?? 8;
          const startM = hostConfig?.startMinute ?? 0;
          const endH   = hostConfig?.end   ?? 17;
          const endM   = hostConfig?.endMinute   ?? 0;
          from = from.startOf("day").hour(startH).minute(startM);
          to   = date.clone().startOf("day").hour(endH).minute(endM);
          fullDayFromIso = from.toISOString();
          fullDayToIso   = to.toISOString();
          // recurringType stays null for a single full-day slot
        } else if (selectedPreset === "fullWeek") {
          from = from.startOf("day");
          to = from.add(6, "days").endOf("day");
          recurringType = "full_week";
          recurringDays = dayTypeTab === "weekend"
            ? (hostConfig?.weekendDays ?? [5, 6])
            : (hostConfig?.workingDays ?? [0, 1, 2, 3, 4]);
          recurringTimeFrom = bookingData.timeFrom;
          recurringTimeTo = bookingData.timeTo;
        } else if (selectedPreset === "fullMonth") {
          from = from.startOf("day");
          to = from.endOf("month");
          recurringType = "full_month";
          recurringDays = dayTypeTab === "weekend"
            ? (hostConfig?.weekendDays ?? [5, 6])
            : (hostConfig?.workingDays ?? [0, 1, 2, 3, 4]);
          recurringTimeFrom = bookingData.timeFrom;
          recurringTimeTo = bookingData.timeTo;
        } else if (selectedPreset === "specificDays") {
          from = from.startOf("day");
          to = specificEndDate.clone().endOf("day");
          recurringType = "specific_days";
          recurringDays = [...specificDays].sort((a, b) => a - b);
          recurringTimeFrom = bookingData.timeFrom;
          recurringTimeTo = bookingData.timeTo;
        }

        fromDate = from.format("YYYY-MM-DD");
        toDate = to.format("YYYY-MM-DD");
      } else {
        fromDate = bookingDate.format("YYYY-MM-DD");
        toDate = bookingDate.format("YYYY-MM-DD");
      }

      // Full Day uses exact ISO from working-hours config; all other presets and custom
      // reconstruct from the user-selected date + timeFrom/timeTo dropdowns.
      const resolvedFrom = fullDayFromIso ?? dayjs(`${fromDate}T${bookingData.timeFrom}`).toISOString();
      const resolvedTo   = fullDayToIso   ?? dayjs(`${toDate}T${bookingData.timeTo}`).toISOString();

      const payload = {
        userId: visitorData.userId,
        ndaAccepted: flowState?.ndaAccepted === true || ndaAccepted,
        requestedFrom: resolvedFrom,
        requestedTo: resolvedTo,
        phoneIsoCode: visitorData.phoneIsoCode,
        departmentId: visitorData.departmentId || undefined,
        fieldValues: {
          ...visitorData.dynamicFields,
          full_name: visitorData.fullName || visitorData.dynamicFields.full_name,
        },
        tzOffset: new Date().getTimezoneOffset(),
        ...(recurringType && { recurringType, recurringDays, recurringTimeFrom, recurringTimeTo }),
      };

      let res;
      if (isEditMode && activeRegistration?.id) {
        res = await visitorEditRegistration(activeRegistration.id, {
          userId: visitorData.userId,
          requestedFrom: resolvedFrom,
          requestedTo: resolvedTo,
          departmentId: visitorData.departmentId || undefined,
          fieldValues: {
            ...visitorData.dynamicFields,
            full_name: visitorData.fullName || visitorData.dynamicFields?.full_name,
          },
          tzOffset: new Date().getTimezoneOffset(),
          ...(recurringType && { recurringType, recurringDays, recurringTimeFrom, recurringTimeTo }),
        });
      } else {
        res = await createRegistration(payload);
      }
      if (!res.error) {
        // sessionStorage can throw SecurityError in private browsing; guard it so
        // the navigation still proceeds even if storage is unavailable.
        try {
          sessionStorage.setItem("vms_summary", JSON.stringify({ registration: res, visitorData }));
        } catch {
          // storage unavailable — summary page will fall back to a blank/redirect state
        }
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
                        {renderTimeDropdowns("timeFrom", t("bookingArrival"), true)}
                        {renderTimeDropdowns("timeTo", t("bookingDeparture"), true)}
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
                            setSpecificDays([]);
                            setSpecificEndDate(null);
                            setFieldErrors((p) => { const n = { ...p }; delete n.specificDays; delete n.specificEndDate; return n; });
                            if (preset === "fullDay") {
                              setBookingData((prev) => ({ ...prev, timeTo: prev.timeFrom }));
                            } else {
                              setBookingData((prev) => ({ ...prev, timeFrom: "08:00", timeTo: "17:00" }));
                            }
                          }}
                          sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                        >
                          <MenuItem value="fullDay">{t("bookingFullDay")}</MenuItem>
                          <MenuItem value="fullWeek">{t("bookingFullWeek")}</MenuItem>
                          <MenuItem value="fullMonth">{t("bookingFullMonth")}</MenuItem>
                          <MenuItem value="specificDays">{t("bookingSpecificDays")}</MenuItem>
                        </TextField>
                      </Box>

                      {hasValidBookingDate && selectedPreset !== "specificDays" && (
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
                                const startH = hostConfig?.start ?? 8;
                                const startM = hostConfig?.startMinute ?? 0;
                                const endH   = hostConfig?.end ?? 17;
                                const endM   = hostConfig?.endMinute ?? 0;
                                from = from.startOf("day").hour(startH).minute(startM);
                                to   = date.clone().startOf("day").hour(endH).minute(endM);
                              } else if (selectedPreset === "fullWeek") {
                                from = from.startOf("day").hour(0).minute(0);
                                to = from.add(6, "days").hour(23).minute(59);
                              } else if (selectedPreset === "fullMonth") {
                                from = from.startOf("day").hour(0).minute(0);
                                to = from.endOf("month");
                              }
                              const locale = lang === "ar" ? "ar-u-nu-latn" : "en-GB";
                              const fmtDate = (d) => new Intl.DateTimeFormat(locale, { day: "2-digit", month: "long", year: "numeric" }).format(d.toDate());
                              const fmtTime = (d) => d.toDate().toLocaleString(locale, { hour: "2-digit", minute: "2-digit", hour12: true });
                              return `${fmtDate(from)}, ${fmtTime(from)} → ${fmtDate(to)}, ${fmtTime(to)}`;
                            })()}
                          </Typography>
                        </Box>
                      )}

                      {/* ── Day-type tabs (fullWeek/fullMonth only) ── */}
                      {(selectedPreset === "fullWeek" || selectedPreset === "fullMonth") && (
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: "block", mb: 0.75, textTransform: "uppercase", fontSize: "0.65rem" }}>
                            {t("bookingDayType")}
                          </Typography>
                          <Tabs
                            value={dayTypeTab}
                            onChange={(_, v) => {
                              setDayTypeTab(v);
                              if (fieldErrors.specificDays) setFieldErrors((p) => { const n = { ...p }; delete n.specificDays; return n; });
                            }}
                            TabIndicatorProps={{ sx: { height: 3, borderRadius: 1 } }}
                            sx={{ minHeight: 32, "& .MuiTab-root": { minHeight: 32, py: 0.5, fontSize: "0.72rem", fontWeight: 700 } }}
                          >
                            <Tab value="working" label={t("bookingWorkingDays")} />
                            <Tab value="weekend" label={t("bookingWeekendDays")} />
                          </Tabs>
                        </Box>
                      )}

                      {/* ── Specific Days UI — shows all days with working/weekend colors ── */}
                      {selectedPreset === "specificDays" && (() => {
                        const workSet = hostConfig?.workingDays ?? [0, 1, 2, 3, 4];
                        const offSet = hostConfig?.weekendDays ?? [5, 6];
                        const renderChip = (idx, label) => {
                          const selected = specificDays.includes(idx);
                          const isOff = offSet.includes(idx);
                          return (
                            <Box
                              key={idx}
                              onClick={() => {
                                setSpecificDays((prev) =>
                                  prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx]
                                );
                                if (fieldErrors.specificDays) setFieldErrors((p) => { const n = { ...p }; delete n.specificDays; return n; });
                              }}
                              sx={{
                                px: 1.5, py: 0.75, borderRadius: 2, cursor: "pointer", userSelect: "none",
                                border: "1px solid",
                                borderColor: selected ? (isOff ? "warning.main" : "primary.main") : "divider",
                                bgcolor: selected ? (isOff ? "warning.main" : "primary.main") : "background.paper",
                                color: selected ? (isOff ? "warning.contrastText" : "primary.contrastText") : (isOff ? "warning.main" : "text.primary"),
                                fontWeight: 700, fontSize: "0.75rem",
                                transition: "all 0.15s",
                              }}
                            >
                              {label}
                            </Box>
                          );
                        };
                        return (
                          <Box sx={{ mb: 2.5 }}>
                            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: "block", mb: 1, textTransform: "uppercase", fontSize: "0.65rem" }}>
                              {t("bookingSelectDays")}
                            </Typography>
                            <Typography variant="caption" fontWeight={600} color="info.main" sx={{ display: "block", mb: 0.5, fontSize: "0.68rem" }}>
                              {t("bookingWorkingDays")}
                            </Typography>
                            <Stack direction="row" flexWrap="wrap" sx={{ gap: 1, mb: 1.5 }}>
                              {workSet.map((idx) => renderChip(idx, DAY_LABELS[idx]))}
                            </Stack>
                            <Typography variant="caption" fontWeight={600} color="warning.main" sx={{ display: "block", mb: 0.5, fontSize: "0.68rem" }}>
                              {t("bookingWeekendDays")}
                            </Typography>
                            <Stack direction="row" flexWrap="wrap" sx={{ gap: 1, mb: 1 }}>
                              {offSet.map((idx) => renderChip(idx, DAY_LABELS[idx]))}
                            </Stack>
                            {fieldErrors.specificDays && (
                              <Typography variant="caption" color="error.main">{fieldErrors.specificDays}</Typography>
                            )}

                            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: "block", mt: 2, mb: 0.5, textTransform: "uppercase", fontSize: "0.65rem" }}>
                              {t("bookingPeriod")}
                            </Typography>
                            <Stack direction="row" sx={{ gap: 1 }} alignItems="center">
                              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 36, fontWeight: 600 }}>From</Typography>
                              <Typography variant="body2" fontWeight={700}>{hasValidBookingDate ? bookingDate.format("DD MMM YYYY") : "—"}</Typography>
                            </Stack>
                            <Stack direction="row" sx={{ gap: 1, mt: 0.5 }} alignItems="center">
                              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 36, fontWeight: 600 }}>To</Typography>
                              <TextField
                                type="date"
                                size="small"
                                value={specificEndDate ? specificEndDate.format("YYYY-MM-DD") : ""}
                                onChange={(e) => {
                                  const v = e.target.value ? dayjs(e.target.value) : null;
                                  setSpecificEndDate(v);
                                  if (fieldErrors.specificEndDate) setFieldErrors((p) => { const n = { ...p }; delete n.specificEndDate; return n; });
                                }}
                                inputProps={{ min: hasValidBookingDate ? bookingDate.format("YYYY-MM-DD") : undefined }}
                                error={Boolean(fieldErrors.specificEndDate)}
                                helperText={fieldErrors.specificEndDate}
                                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 }, width: 180 }}
                              />
                            </Stack>
                          </Box>
                        );
                      })()}

                      {/* ── Week / Month bracket-day preview ── */}
                      {(selectedPreset === "fullWeek" || selectedPreset === "fullMonth") && hasValidBookingDate && (() => {
                        const activeDaySet = dayTypeTab === "weekend"
                          ? (hostConfig?.weekendDays ?? [5, 6])
                          : (hostConfig?.workingDays  ?? [0, 1, 2, 3, 4]);
                        const weekendSet = hostConfig?.weekendDays ?? [5, 6];
                        const bracketStart = bookingDate;
                        const bracketEnd = selectedPreset === "fullWeek"
                          ? bookingDate.add(6, "day")
                          : bookingDate.endOf("month");
                        const days = [];
                        let cur = bracketStart;
                        while (!cur.isAfter(bracketEnd, "day")) {
                          if (activeDaySet.includes(cur.day())) days.push(cur);
                          cur = cur.add(1, "day");
                        }
                        const label = dayTypeTab === "weekend" ? t("bookingWeekendDays") : t("bookingWorkingDays");
                        return (
                          <Box sx={{ mb: 2, p: 1.5, bgcolor: "background.paper", borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
                            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: "block", mb: 0.75, textTransform: "uppercase", fontSize: "0.6rem" }}>
                              {label} {t("bookingInBracket")}
                            </Typography>
                            <Stack direction="row" flexWrap="wrap" sx={{ gap: 0.5 }}>
                              {days.length > 0 ? days.map((d) => {
                                const isOff = weekendSet.includes(d.day());
                                return (
                                  <Box key={d.format("YYYY-MM-DD")} sx={{
                                    px: 1, py: 0.4, borderRadius: 1, fontSize: "0.7rem", fontWeight: 700,
                                    bgcolor: isOff ? "warning.main" : "primary.main",
                                    color: isOff ? "warning.contrastText" : "primary.contrastText",
                                  }}>
                                    {DAY_LABELS[d.day()]} {d.format("D")}
                                  </Box>
                                );
                              }) : (
                                <Typography variant="caption" color="text.secondary">No {label.toLowerCase()} in this range.</Typography>
                              )}
                            </Stack>
                          </Box>
                        );
                      })()}

                      {/* ── Full Day: no time input, just show working hours info ── */}
                      {selectedPreset === "fullDay" ? (
                        <Box sx={{ p: 1.5, bgcolor: "background.paper", borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
                          <Stack direction="row" sx={{ gap: 1 }} alignItems="center">
                            <ICONS.info sx={{ fontSize: 16, color: "info.main" }} />
                            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ fontSize: 12 }}>
                              {t("bookingFullDayWorkingHoursInfo")
                                .replace("{{start}}", hostConfig
                                  ? `${String(hostConfig.start).padStart(2,"0")}:${String(hostConfig.startMinute??0).padStart(2,"0")}`
                                  : "08:00")
                                .replace("{{end}}", hostConfig
                                  ? `${String(hostConfig.end).padStart(2,"0")}:${String(hostConfig.endMinute??0).padStart(2,"0")}`
                                  : "17:00")}
                            </Typography>
                          </Stack>
                        </Box>
                      ) : (
                        /* ── Time-type tabs + dropdowns (for all presets except Full Day) ── */
                        <Box>
                          <Box sx={{ mb: 1.5 }}>
                            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: "block", mb: 0.75, textTransform: "uppercase", fontSize: "0.65rem" }}>
                              {t("bookingTimeType")}
                            </Typography>
                            <Tabs
                              value={timeTypeTab}
                              onChange={(_, v) => setTimeTypeTab(v)}
                              TabIndicatorProps={{ sx: { height: 3, borderRadius: 1 } }}
                              sx={{ minHeight: 32, "& .MuiTab-root": { minHeight: 32, py: 0.5, fontSize: "0.72rem", fontWeight: 700 } }}
                            >
                              <Tab value="working" label={t("bookingWorkingHours")} />
                              <Tab value="outside" label={t("bookingOutsideHours")} />
                            </Tabs>
                            {hostConfig && (() => {
                              const fmtH12 = (h24, min) => {
                                const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
                                const ampm = h24 < 12 ? "AM" : "PM";
                                return `${h12}:${String(min).padStart(2, "0")} ${ampm}`;
                              };
                              const s = fmtH12(hostConfig.start, hostConfig.startMinute ?? 0);
                              const e = fmtH12(hostConfig.end, hostConfig.endMinute ?? 0);
                              return timeTypeTab === "working" ? (
                                <Typography variant="caption" color="info.main" sx={{ display: "block", mt: 0.75, fontSize: "0.68rem" }}>
                                  {t("bookingWorkingHoursInfo").replace("{{start}}", s).replace("{{end}}", e)}
                                </Typography>
                              ) : (
                                <Typography variant="caption" color="info.main" sx={{ display: "block", mt: 0.75, fontSize: "0.68rem" }}>
                                  {t("bookingOutsideHoursInfo").replace("{{start}}", s).replace("{{end}}", e)}
                                </Typography>
                              );
                            })()}
                          </Box>
                          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: "block", mb: 1.5, textTransform: "uppercase", fontSize: "0.65rem" }}>
                            {t("bookingDailyVisitTime")}
                          </Typography>
                          <Stack spacing={2}>
                            {renderTimeDropdowns("timeFrom", t("bookingStartTime"))}
                            {renderTimeDropdowns("timeTo", t("bookingEndTime"))}
                          </Stack>
                          {(() => {
                            const mins = dayjs(`2000-01-01 ${bookingData.timeTo}`).diff(dayjs(`2000-01-01 ${bookingData.timeFrom}`), "minute");
                            if (mins <= 0) return null;
                            return (
                              <Box sx={{ mt: 1.5, p: 1.5, bgcolor: "background.paper", borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
                                <Stack direction="row" sx={{ gap: 1 }} alignItems="center">
                                  <ICONS.info sx={{ fontSize: 16, color: "text.secondary" }} />
                                  <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ fontSize: 12 }}>
                                    {t("bookingDuration").replace("{{min}}", mins)}
                                  </Typography>
                                </Stack>
                              </Box>
                            );
                          })()}
                        </Box>
                      )}
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
