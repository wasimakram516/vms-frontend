"use client";

import { useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Paper,
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
  Tooltip,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";
import { useRouter } from "next/navigation";
import { useVisitor } from "@/contexts/VisitorContext";
import { createRegistration } from "@/services/registrationService";
import { getDepartments } from "@/services/departmentService";
import { motion } from "framer-motion";
import dayjs from "dayjs";
import ICONS from "@/utils/iconUtil";
import VisitorLayout from "@/components/layout/VisitorLayout";
import PurposeOfVisitInput from "@/components/PurposeOfVisitInput";
import { useColorMode } from "@/contexts/ThemeContext";
import { formatTime, parse24To12, convert12To24, formatDate } from "@/utils/dateUtils";
import { validateRequired } from "@/utils/validationUtils";
import { QRCodeCanvas } from "qrcode.react";
 
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
const PERIODS = ["AM", "PM"];

export default function BookingPage() {
  const router = useRouter();
  const { visitorData, setVisitorData, bookingData, setBookingData, resetVisitorFlow, flowState } = useVisitor();
  const { mode } = useColorMode();
  const isDark = mode === "dark";
  const isReturning = flowState?.isReturning === true;
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const qrCanvasRef = useRef(null);

  const [bookingType, setBookingType] = useState("custom");
  const [selectedPreset, setSelectedPreset] = useState("fullDay");

  useEffect(() => {
    if (isReturning) {
      getDepartments(true).then((res) => {
        if (Array.isArray(res)) setDepartments(res);
      });
    }
  }, [isReturning]);

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
    if (!bookingData.date) return;

    if (isReturning) {
      const errs = {};
      if (!visitorData.departmentId) errs.departmentId = "Department is required";
      const purposeErr = validateRequired(visitorData.purposeOfVisit, "Purpose of Visit");
      if (purposeErr) errs.purposeOfVisit = purposeErr;
      if (Object.keys(errs).length) { setFieldErrors(errs); return; }
    }

    setSubmitting(true);
    try {
      let fromDate, toDate;
      if (bookingType === "preset") {
        const date = bookingData.date;
        let from = date.clone();
        let to = date.clone();

        if (selectedPreset === "fullDay") {
          const fromParts = bookingData.timeFrom.split(":");
          from = from.startOf("day").hour(parseInt(fromParts[0])).minute(parseInt(fromParts[1]));
          to = to.add(1, "day").startOf("day").hour(parseInt(fromParts[0])).minute(parseInt(fromParts[1]));
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
        fromDate = bookingData.date.format("YYYY-MM-DD");
        toDate = bookingData.date.format("YYYY-MM-DD");
      }
      
      const payload = {
        userId: visitorData.userId,
        ndaAccepted: flowState?.ndaAccepted === true,
        requestedFrom: dayjs(`${fromDate}T${bookingData.timeFrom}`).toISOString(),
        requestedTo: dayjs(`${toDate}T${bookingData.timeTo}`).toISOString(),
        phoneIsoCode: visitorData.phoneIsoCode,
        purposeOfVisit: visitorData.purposeOfVisit,
        departmentId: visitorData.departmentId || undefined,
        fieldValues: {
          ...visitorData.dynamicFields,
          full_name: visitorData.fullName || visitorData.dynamicFields.full_name,
        },
      };

      console.log("Submitting Registration Payload:", payload);
      const res = await createRegistration(payload);
      if (!res.error) {
        setSuccess(res);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadQr = () => {
    const canvas = document.getElementById("visitor-qr-canvas");
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `visit-qr-${success?.qrToken || "code"}.png`;
    a.click();
  };

  if (success) {
    const fullName =
      success?.visitor?.fullName ||
      success?.user?.fullName ||
      visitorData?.fullName ||
      visitorData?.dynamicFields?.full_name ||
      "Visitor";
    const purposeOfVisit = success?.purposeOfVisit || visitorData?.purposeOfVisit;
    const departmentName = success?.department?.name;
    const requestedFrom = success?.requestedFrom ? dayjs(success.requestedFrom) : null;
    const requestedTo = success?.requestedTo ? dayjs(success.requestedTo) : null;
    const dateRange = requestedFrom
      ? requestedFrom.format("ddd, D MMM YYYY") +
        (requestedTo && !requestedFrom.isSame(requestedTo, "day")
          ? " – " + requestedTo.format("ddd, D MMM YYYY")
          : "")
      : null;
    const timeRange = requestedFrom
      ? requestedFrom.format("h:mm A") + " – " + (requestedTo?.format("h:mm A") ?? "")
      : null;

    const summaryRows = [
      { label: "Full Name", value: fullName },
      ...(purposeOfVisit ? [{ label: "Purpose of Visit", value: purposeOfVisit }] : []),
      ...(departmentName ? [{ label: "Department", value: departmentName }] : []),
      ...(dateRange ? [{ label: "Date", value: dateRange }] : []),
      ...(timeRange ? [{ label: "Time Window", value: timeRange }] : []),
    ];

    return (
      <VisitorLayout justifyContent="center" maxWidth={480}>
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <Stack spacing={3} alignItems="center" sx={{ py: 2 }}>
            {/* Header */}
            <Stack alignItems="center" spacing={1}>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: "50%",
                  bgcolor: (theme) => alpha(theme.palette.success.main, 0.12),
                  color: "success.main",
                  display: "inline-flex",
                }}
              >
                <ICONS.checkCircle sx={{ fontSize: 36 }} />
              </Box>
              <Typography variant="h5" fontWeight={800} sx={{ fontFamily: "'Comfortaa', cursive", textAlign: "center" }}>
                Application Sent!
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", maxWidth: 340 }}>
                Your registration is pending approval. Check your email for your QR code — you may be asked to show it on arrival.
              </Typography>
            </Stack>

            {/* QR Code Card */}
            {success?.qrToken && (
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: 4,
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: "background.paper",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 2,
                  width: "100%",
                }}
              >
                <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 1 }}>
                  Your QR Code
                </Typography>

                <Box
                  sx={{
                    p: 1.5,
                    bgcolor: "#ffffff",
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "divider",
                    display: "inline-flex",
                  }}
                >
                  <QRCodeCanvas
                    id="visitor-qr-canvas"
                    value={success.qrToken}
                    size={240}
                    bgColor="#ffffff"
                    fgColor="#0d1117"
                    level="M"
                    includeMargin={false}
                  />
                </Box>

                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace", letterSpacing: 2 }}>
                  {success.qrToken}
                </Typography>

                <Tooltip title="Save the QR code as an image">
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<ICONS.download />}
                    onClick={handleDownloadQr}
                    sx={{ borderRadius: 30, textTransform: "none", fontWeight: 700 }}
                  >
                    Download QR
                  </Button>
                </Tooltip>
              </Paper>
            )}

            {/* Visit Summary */}
            <Paper
              elevation={0}
              sx={{
                borderRadius: 4,
                border: "1px solid",
                borderColor: "divider",
                overflow: "hidden",
                width: "100%",
              }}
            >
              <Box
                sx={{
                  px: 2.5,
                  py: 1.5,
                  bgcolor: (theme) => alpha(theme.palette.text.primary, isDark ? 0.06 : 0.03),
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 1 }}>
                  Visit Summary
                </Typography>
                <Chip
                  label="Pending Approval"
                  size="small"
                  sx={{
                    bgcolor: (theme) => alpha(theme.palette.warning.main, 0.12),
                    color: "warning.main",
                    fontWeight: 700,
                    fontSize: "0.68rem",
                    height: 22,
                  }}
                />
              </Box>
              <Stack divider={<Divider />}>
                {summaryRows.map(({ label, value }) => (
                  <Stack
                    key={label}
                    direction="row"
                    sx={{ px: 2.5, py: 1.25 }}
                    alignItems="flex-start"
                    spacing={1}
                  >
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ minWidth: 110, fontWeight: 600, pt: 0.2 }}
                    >
                      {label}
                    </Typography>
                    <Typography variant="body2" fontWeight={500} sx={{ flex: 1 }}>
                      {value}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Paper>

            {/* Home Button */}
            <Button
              variant="contained"
              fullWidth
              startIcon={<ICONS.home />}
              onClick={() => {
                resetVisitorFlow();
                router.push("/");
              }}
              sx={{ py: 1.5, borderRadius: 30, fontWeight: 700 }}
            >
              Back to Home
            </Button>
          </Stack>
        </motion.div>
      </VisitorLayout>
    );
  }

  return (
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
                value={bookingData.date}
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
                  // Ensure timeTo is synced when switching to Full Day preset
                  if (value === "preset" && selectedPreset === "fullDay") {
                    setBookingData(prev => ({ ...prev, timeTo: prev.timeFrom }));
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
                  {bookingData.date && (
                    <Box sx={{ p: 1.5, bgcolor: "background.paper", borderRadius: 2, border: "1px solid", borderColor: "divider", mb: 2.5 }}>
                      <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: "block", mb: 0.5, textTransform: "uppercase", fontSize: "0.65rem" }}>
                        Date Range
                      </Typography>
                      <Typography variant="body2" fontWeight={600} color="text.primary">
                        {(() => {
                          const date = bookingData.date;
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

                          return `${formatDate(from.toDate())} to ${formatDate(to.toDate())}`;
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
            disabled={submitting || !bookingData.date}
            startIcon={submitting ? <CircularProgress size={24} color="inherit" /> : <ICONS.send />}
            onClick={handleSubmit}
            sx={{ py: 1.5, borderRadius: 30 }}
          >
            {submitting ? "Sending..." : "Submit"}
          </Button>
        </Stack>
      </Stack>
    </VisitorLayout>
  );
}
