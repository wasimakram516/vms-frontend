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
import { createRegistration } from "@/services/registrationService";
import { getDepartments } from "@/services/departmentService";
import { getPublicActiveNdaTemplate } from "@/services/ndaTemplateService";
import NdaTemplateContent from "@/components/NdaTemplateContent";
import { motion } from "framer-motion";
import dayjs from "dayjs";
import ICONS from "@/utils/iconUtil";
import VisitorLayout from "@/components/layout/VisitorLayout";
import PurposeOfVisitInput from "@/components/PurposeOfVisitInput";
import { useColorMode } from "@/contexts/ThemeContext";
import { parse24To12, convert12To24, formatDate, formatTime } from "@/utils/dateUtils";
import { validateRequired } from "@/utils/validationUtils";
 
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
const PERIODS = ["AM", "PM"];
export default function BookingPage() {
  const router = useRouter();
  const { visitorData, setVisitorData, bookingData, setBookingData, resetVisitorFlow, flowState, setFlowState } = useVisitor();
  const { mode } = useColorMode();
  const isDark = mode === "dark";
  const isReturning = flowState?.isReturning === true;
  const ndaRequired = isReturning && flowState?.ndaAccepted === false;
  const [submitting, setSubmitting] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [ndaOpen, setNdaOpen] = useState(false);
  const [ndaAccepted, setNdaAccepted] = useState(false);
  const ndaWasRequired = useRef(ndaRequired);
  const showNdaCheckbox = ndaWasRequired.current;
  const [ndaTemplate, setNdaTemplate] = useState(null);
  const [ndaLoading, setNdaLoading] = useState(false);

  const [bookingType, setBookingType] = useState("custom");
  const [selectedPreset, setSelectedPreset] = useState("fullDay");
  const bookingDate = bookingData.date ? dayjs(bookingData.date) : null;
  const hasValidBookingDate = bookingDate?.isValid?.() === true;

  useEffect(() => {
    if (isReturning) {
      getDepartments(true).then((res) => {
        if (Array.isArray(res)) setDepartments(res);
      });
    }
  }, [isReturning]);

  useEffect(() => {
    if (ndaRequired) {
      setNdaLoading(true);
      getPublicActiveNdaTemplate()
        .then((res) => setNdaTemplate(res))
        .catch(() => setNdaTemplate(null))
        .finally(() => setNdaLoading(false));
    }
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
        if (type === "timeFrom") {
          newData.timeTo = time24;
        } else if (type === "timeTo") {
          newData.timeFrom = time24;
        }
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
        <Stack direction="row" spacing={0.5}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" sx={{ fontSize: "0.6rem", fontWeight: 700, ml: 1, color: "text.secondary", textTransform: "uppercase" }}>Hr</Typography>
            <TextField
              select
              size="small"
              value={hour12}
              onChange={(e) => handleTimePartChange(type, "hour12", e.target.value)}
              sx={{ 
                width: "100%",
                "& .MuiOutlinedInput-root": { borderRadius: 30 },
                "& .MuiSelect-select": { fontSize: "0.75rem", py: 1, px: 1 }
              }}
            >
              {HOURS.map((h) => (
                <MenuItem key={h} value={h} sx={{ fontSize: "0.75rem" }}>{h}</MenuItem>
              ))}
            </TextField>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" sx={{ fontSize: "0.6rem", fontWeight: 700, ml: 1, color: "text.secondary", textTransform: "uppercase" }}>Min</Typography>
            <TextField
              select
              size="small"
              value={minute}
              onChange={(e) => handleTimePartChange(type, "minute", e.target.value)}
              sx={{ 
                width: "100%",
                "& .MuiOutlinedInput-root": { borderRadius: 30 },
                "& .MuiSelect-select": { fontSize: "0.75rem", py: 1, px: 1 }
              }}
            >
              {MINUTES.map((m) => (
                <MenuItem key={m} value={m} sx={{ fontSize: "0.75rem" }}>{m}</MenuItem>
              ))}
            </TextField>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" sx={{ fontSize: "0.6rem", fontWeight: 700, ml: 1, color: "text.secondary", textTransform: "uppercase" }}>AM/PM</Typography>
            <TextField
              select
              size="small"
              value={ampm}
              onChange={(e) => handleTimePartChange(type, "ampm", e.target.value)}
              sx={{ 
                width: "100%",
                "& .MuiOutlinedInput-root": { borderRadius: 30 },
                "& .MuiSelect-select": { fontSize: "0.75rem", py: 1, px: 1 }
              }}
            >
              {PERIODS.map((p) => (
                <MenuItem key={p} value={p} sx={{ fontSize: "0.75rem" }}>{p}</MenuItem>
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
      if (!visitorData.departmentId) errs.departmentId = "Department is required";
      const purposeErr = validateRequired(visitorData.purposeOfVisit, "Purpose of Visit");
      if (purposeErr) errs.purposeOfVisit = purposeErr;
      if (showNdaCheckbox && !ndaAccepted) errs.nda = "You must accept the NDA before submitting";
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

      const res = await createRegistration(payload);
      if (!res.error) {
        sessionStorage.setItem("vms_summary", JSON.stringify({ registration: res, visitorData }));
        resetVisitorFlow();
        router.push("/register/booking/summary");
        // intentionally do NOT reset submitting — loading screen persists until navigation
        return;
      }
      setSubmitting(false);
    } catch (e) {
      setSubmitting(false);
    }
  };


  return (
    <>
    <VisitorLayout
      title="Appointment Booking"
      subtitle="Select your preferred visit date and arrival time."
      maxWidth={900}
    >
      <Stack spacing={2}>
        <Box sx={{ textAlign: "center" }}>
          <Typography variant="h5" fontWeight={800} sx={{ fontFamily: "'Comfortaa', cursive" }}>
            Schedule Your Visit
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={1}>
            Select a convenient date and time to visit our premises.
          </Typography>
        </Box>

        <Divider />

        {isReturning && (
          <Stack spacing={2}>
            <FormControl fullWidth required error={Boolean(fieldErrors.departmentId)}>
              <InputLabel>Department</InputLabel>
              <Select
                value={visitorData.departmentId || ""}
                label="Department"
                onChange={(e) => {
                  setVisitorData((prev) => ({ ...prev, departmentId: e.target.value }));
                  if (fieldErrors.departmentId) setFieldErrors((p) => { const n = { ...p }; delete n.departmentId; return n; });
                }}
                sx={{ borderRadius: 30 }}
              >
                {departments.map((dept) => (
                  <MenuItem key={dept.id} value={dept.id}>{dept.name}</MenuItem>
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
                      I have read and agree to the Non-Disclosure Agreement
                    </Typography>
                  }
                />
                <Typography variant="caption" color="text.secondary" sx={{ pl: 4 }}>
                  {ndaAccepted
                    ? "NDA accepted. You may proceed."
                    : "Your previous NDA has expired. Please review and accept the NDA before submitting."}
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
              Select Date
            </Typography>
            <Box
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 4,
                bgcolor: "action.hover",
                "& .MuiDateCalendar-root": { width: "100%", height: "auto", transform: "scale(0.95)", transformOrigin: "top" },
              }}
            >
              <DateCalendar
                value={hasValidBookingDate ? bookingDate : null}
                onChange={handleDateChange}
                disablePast
              />
            </Box>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
              Select Time
            </Typography>
            <Box sx={{ mt: 0 }}>
              <Stack spacing={2}>
                {/* Toggle between Custom and Preset using Tabs */}
                <Tabs
                value={bookingType}
                onChange={(_, value) => {
                  setBookingType(value);
                  // When switching to preset, ensure timeTo is synced for the active preset
                  if (value === "preset") {
                    if (selectedPreset === "fullDay") {
                      setBookingData((prev) => ({ ...prev, timeTo: prev.timeFrom }));
                    } else {
                      setBookingData((prev) => ({ ...prev, timeFrom: "00:00", timeTo: "23:59" }));
                    }
                  }
                }}
                variant="fullWidth"
                sx={{
                  minHeight: 46,
                  bgcolor: (theme) => alpha(theme.palette.text.primary, isDark ? 0.06 : 0.04),
                  borderRadius: 999,
                  p: 0.5,
                  "& .MuiTabs-indicator": { display: "none" },
                }}
              >
                <Tab
                  value="custom"
                  icon={<ICONS.time fontSize="small" />}
                  iconPosition="start"
                  label="Custom"
                  sx={{
                    minHeight: 38,
                    borderRadius: 999,
                    fontWeight: 800,
                    textTransform: "none",
                    "&.Mui-selected": {
                      bgcolor: "background.paper",
                      color: "text.primary",
                      boxShadow: "0 6px 14px rgba(0,0,0,0.08)",
                    },
                  }}
                />
                <Tab
                  value="preset"
                  icon={<ICONS.event fontSize="small" />}
                  iconPosition="start"
                  label="Preset"
                  sx={{
                    minHeight: 38,
                    borderRadius: 999,
                    fontWeight: 800,
                    textTransform: "none",
                    "&.Mui-selected": {
                      bgcolor: "background.paper",
                      color: "text.primary",
                      boxShadow: "0 6px 14px rgba(0,0,0,0.08)",
                    },
                  }}
                />
              </Tabs>

              {/* Custom Time Section */}
              {bookingType === "custom" && (
                <Box sx={{ p: 2, bgcolor: "action.hover", borderRadius: 2, border: "1px solid", borderColor: "divider", minHeight: 320 }}>
                  <Stack spacing={2} sx={{ mb: 2 }}>
                    {renderTimeDropdowns("timeFrom", "Expected Arrival (From)")}
                    {renderTimeDropdowns("timeTo", "Expected Departure (To)")}
                  </Stack>

                  <Box sx={{ p: 1.5, bgcolor: "background.paper", borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <ICONS.info sx={{ fontSize: 16, color: "text.secondary" }} />
                      <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ fontSize: 12 }}>
                        Visit duration: {dayjs(`2000-01-01 ${bookingData.timeTo}`).diff(dayjs(`2000-01-01 ${bookingData.timeFrom}`), 'minute')} min
                      </Typography>
                    </Stack>
                  </Box>
                </Box>
              )}

              {/* Preset Options Section */}
              {bookingType === "preset" && (
                <Box sx={{ p: 2, bgcolor: "action.hover", borderRadius: 2, border: "1px solid", borderColor: "divider", minHeight: 320 }}>
                  {/* Preset Type Selector */}
                  <Box sx={{ mb: 2.5 }}>
                    <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: "block", mb: 1, textTransform: "uppercase", fontSize: "0.65rem" }}>
                      Preset Type
                    </Typography>
                    <TextField
                      fullWidth
                      select
                      size="small"
                      value={selectedPreset || "fullDay"}
                      onChange={(e) => {
                        const preset = e.target.value;
                        setSelectedPreset(preset);
                        
                        if (preset === "fullDay") {
                          setBookingData((prev) => ({
                            ...prev,
                            timeTo: prev.timeFrom,
                          }));
                        } else {
                          setBookingData((prev) => ({
                            ...prev,
                            timeFrom: "00:00",
                            timeTo: "23:59",
                          }));
                        }
                      }}
                      sx={{
                        "& .MuiOutlinedInput-root": { borderRadius: 2 },
                      }}
                    >
                      <MenuItem value="fullDay">Full Day</MenuItem>
                      <MenuItem value="fullWeek">Full Week</MenuItem>
                      <MenuItem value="fullMonth">Full Month</MenuItem>
                    </TextField>
                  </Box>

                  {/* Date Range Display */}
                  {hasValidBookingDate && (
                    <Box sx={{ p: 1.5, bgcolor: "background.paper", borderRadius: 2, border: "1px solid", borderColor: "divider", mb: 2.5 }}>
                      <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: "block", mb: 0.5, textTransform: "uppercase", fontSize: "0.65rem" }}>
                        Date Range
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

                  {/* Time inputs for preset */}
                  <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: "block", mb: 2, textTransform: "uppercase", fontSize: "0.65rem" }}>
                    Time
                  </Typography>
                  <Stack spacing={2}>
                    {renderTimeDropdowns("timeFrom", selectedPreset === "fullDay" ? "Full Day Start Time" : "Start Time")}
                    {selectedPreset !== "fullDay" && renderTimeDropdowns("timeTo", "End Time")}
                    {selectedPreset === "fullDay" && (
                      <Box sx={{ p: 1.5, bgcolor: "background.paper", borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <ICONS.info sx={{ fontSize: 16, color: "text.secondary" }} />
                          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ fontSize: 12 }}>
                            Full day booking: Same time for start and end
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

        <Stack direction="row" spacing={2}>
          {!isReturning && (
            <Button
              variant="outlined"
              fullWidth
              disabled={submitting}
              startIcon={<ICONS.back />}
              onClick={() => router.back()}
              sx={{ py: 1.5, borderRadius: 30 }}
            >
              Back
            </Button>
          )}
          <Button
            variant="contained"
            fullWidth
            disabled={submitting || !hasValidBookingDate}
            startIcon={submitting ? <CircularProgress size={24} color="inherit" /> : <ICONS.send />}
            onClick={handleSubmit}
            sx={{ py: 1.5, borderRadius: 30 }}
          >
            {submitting ? "Sending..." : "Submit"}
          </Button>
        </Stack>
      </Stack>
    </VisitorLayout>

    {/* NDA Modal — must re-sign expired NDA */}
    <Dialog open={ndaOpen} onClose={() => setNdaOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 4, p: 1 } }}>
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="h6" fontWeight={800} component="span" sx={{ fontFamily: "'Comfortaa', cursive" }}>
          {ndaTemplate?.name || "Non-Disclosure Agreement"}
        </Typography>
        <IconButton onClick={() => setNdaOpen(false)}>
          <ICONS.close />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ borderColor: "rgba(0,0,0,0.05)" }}>
        {ndaLoading ? (
          <Stack spacing={2} alignItems="center" sx={{ py: 4 }}>
            <CircularProgress size={28} />
            <Typography variant="body2" color="text.secondary">Loading NDA...</Typography>
          </Stack>
        ) : (
          <NdaTemplateContent template={ndaTemplate} />
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button variant="outlined" onClick={() => setNdaOpen(false)} sx={{ borderRadius: 30 }}>
          Close
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
          sx={{ borderRadius: 30 }}
        >
          I Agree
        </Button>
      </DialogActions>
    </Dialog>
    </>
  );
}
