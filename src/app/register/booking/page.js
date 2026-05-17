"use client";

import { useEffect, useRef, useState } from "react";
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
import { createRegistration, visitorEditRegistration } from "@/services/registrationService";
import { getDepartments } from "@/services/departmentService";
import { getPublicActiveNdaTemplate } from "@/services/ndaTemplateService";
import NdaTemplateContent from "@/components/NdaTemplateContent";
import { motion } from "framer-motion";
import dayjs from "dayjs";
import ICONS from "@/utils/iconUtil";
import VisitorLayout from "@/components/layout/VisitorLayout";
import PurposeOfVisitInput from "@/components/PurposeOfVisitInput";
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
  const { t, isRtl } = useLanguage();
  const isDark = mode === "dark";
  const dir = isRtl ? "rtl" : "ltr";

  // Scoped RTL — same pattern as details page
  useEffect(() => {
    document.documentElement.dir = isRtl ? "rtl" : "ltr";
    return () => { document.documentElement.dir = "ltr"; };
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
  const bookingDate = bookingData.date ? dayjs(bookingData.date) : null;
  const hasValidBookingDate = bookingDate?.isValid?.() === true;

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
    if (activeRegistration.purposeOfVisit) {
      setVisitorData((prev) => ({ ...prev, purposeOfVisit: activeRegistration.purposeOfVisit }));
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
              {PERIODS.map((p) => <MenuItem key={p} value={p} sx={{ fontSize: "0.75rem" }}>{p}</MenuItem>)}
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
      if (!visitorData.purposeOfVisit) errs.purposeOfVisit = t("purposeRequired");
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
        purposeOfVisit: visitorData.purposeOfVisit,
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
          purposeOfVisit: visitorData.purposeOfVisit,
          departmentId: visitorData.departmentId || undefined,
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
        title="Appointment Booking"
        subtitle="Select your preferred visit date and arrival time."
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

              <PurposeOfVisitInput
                value={visitorData.purposeOfVisit || ""}
                onChange={(val) => {
                  setVisitorData((prev) => ({ ...prev, purposeOfVisit: val }));
                  if (fieldErrors.purposeOfVisit) setFieldErrors((p) => { const n = { ...p }; delete n.purposeOfVisit; return n; });
                }}
                required
                error={Boolean(fieldErrors.purposeOfVisit)}
                helperText={fieldErrors.purposeOfVisit}
                rounded
              />

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
              <Box dir="ltr" sx={{ border: "1px solid", borderColor: "divider", borderRadius: 4, bgcolor: "action.hover", "& .MuiDateCalendar-root": { width: "100%", height: "auto", transform: "scale(0.95)", transformOrigin: "top" } }}>
                <DateCalendar value={hasValidBookingDate ? bookingDate : null} onChange={handleDateChange} disablePast />
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
                              const fmtDate = (d) => formatDate(d.toDate());
                              const fmtTime = (d) => formatTime(d.format("HH:mm"));
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
