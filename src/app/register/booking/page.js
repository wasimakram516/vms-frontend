"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Button,
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
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";
import { useRouter } from "next/navigation";
import { useVisitor } from "@/contexts/VisitorContext";
import { useMessage } from "@/contexts/MessageContext";
import { createRegistration } from "@/services/registrationService";
import { motion } from "framer-motion";
import dayjs from "dayjs";
import ICONS from "@/utils/iconUtil";
import VisitorLayout from "@/components/layout/VisitorLayout";
import { useColorMode } from "@/contexts/ThemeContext";
import { formatTime, parse24To12, convert12To24 } from "@/utils/dateUtils";
 
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
const PERIODS = ["AM", "PM"];

const transition = { duration: 0.5, ease: [0.43, 0.13, 0.23, 0.96] };

const TIME_SLOTS = [
  "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"
];

export default function BookingPage() {
  const router = useRouter();
  const { visitorData, setVisitorData, bookingData, setBookingData, resetVisitorFlow, flowState } = useVisitor();
  const { mode } = useColorMode();
  const isDark = mode === "dark";
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);

  const [bookingType, setBookingType] = useState("custom"); // "custom" or "preset"
  const [selectedPreset, setSelectedPreset] = useState("fullDay"); // "fullDay", "fullWeek", "fullMonth"

  const handleDateChange = (newDate) => {
    setBookingData((prev) => ({ ...prev, date: newDate }));
  };

  const handleTimePartChange = (type, part, value) => {
    const current = parse24To12(bookingData[type]);
    const next = { ...current, [part]: value };
    const time24 = convert12To24(next.hour12, next.minute, next.ampm);
    
    setBookingData((prev) => {
      const newData = { ...prev, [type]: time24 };
      
      if (bookingType === "custom" && type === "timeFrom" && newData.timeTo <= time24) {
         let [h, m] = time24.split(":").map(Number);
         h = (h + 1) % 24;
         newData.timeTo = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
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
    if (!bookingData.date) {
      return;
    }

    setSubmitting(true);
    try {
      let fromDate, toDate;
      if (bookingType === "preset") {
        const date = bookingData.date;
        let from = date.clone();
        let to = date.clone();

        if (selectedPreset === "fullDay") {
          from = from.startOf("day");
          to = to.endOf("day");
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
        requestedDateFrom: fromDate,
        requestedDateTo: toDate,
        requestedTimeFrom: bookingData.timeFrom,
        requestedTimeTo: bookingData.timeTo,
        purposeOfVisit: visitorData.purposeOfVisit,
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

  if (success) {
    return (
      <VisitorLayout justifyContent="center">
        <Box sx={{ py: 4, textAlign: "center" }}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <Box sx={{ p: 2, borderRadius: "50%", bgcolor: (theme) => alpha(theme.palette.success.main, 0.1), color: "success.main", display: "inline-flex", mb: 3 }}>
              <ICONS.checkCircle fontSize="large" />
            </Box>
            <Typography variant="h5" fontWeight={800} gutterBottom sx={{ fontFamily: "'Comfortaa', cursive" }}>Application Sent!</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
              Your registration request is pending approval. You will receive an email once it is processed.
            </Typography>
            <Button
              variant="contained"
              fullWidth
              startIcon={<ICONS.home />}
              onClick={() => {
                resetVisitorFlow();
                router.push("/");
              }}
              sx={{ py: 1.5, borderRadius: 30 }}
            >
              Home
            </Button>
          </motion.div>
        </Box>
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
                onChange={(_, value) => setBookingType(value)}
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
                            timeFrom: "00:00",
                            timeTo: "00:00",
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
                            from = from.startOf("day");
                            to = to.endOf("day");
                          } else if (selectedPreset === "fullWeek") {
                            from = from.startOf("day");
                            to = to.add(6, "days").endOf("day");
                          } else if (selectedPreset === "fullMonth") {
                            from = from.startOf("day");
                            to = to.add(30, "days").endOf("day");
                          }

                          return `${from.format("DD MMMM YYYY")} to ${to.format("DD MMMM YYYY")}`;
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