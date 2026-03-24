"use client";

import { useState } from "react";
import {
  Box,
  Button,
  Paper,
  Stack,
  Typography,
  Divider,
  Grid,
  MenuItem,
  TextField,
  CircularProgress,
  alpha 
} from "@mui/material";
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
  const { showMessage } = useMessage();
  const { visitorData, bookingData, setBookingData, resetVisitorFlow } = useVisitor();
  const { mode } = useColorMode();
  const isDark = mode === "dark";
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);

  const handleDateChange = (newDate) => {
    setBookingData((prev) => ({ ...prev, date: newDate }));
  };

  const handleTimePartChange = (type, part, value) => {
    const current = parse24To12(bookingData[type]);
    const next = { ...current, [part]: value };
    const time24 = convert12To24(next.hour12, next.minute, next.ampm);
    
    setBookingData((prev) => {
      const newData = { ...prev, [type]: time24 };
      
      if (type === "timeFrom" && newData.timeTo <= time24) {
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
      showMessage("Please select a date for your visit.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        user_id: visitorData.userId,
        field_values: visitorData.dynamicFields,
        requested_date: bookingData.date.format("YYYY-MM-DD"),
        requested_time_from: `${bookingData.timeFrom}:00`,
        requested_time_to: `${bookingData.timeTo}:00`,
        purpose_of_visit: visitorData.purposeOfVisit || "General Visit",
      };

      const res = await createRegistration(payload);
      setSuccess(res);
      showMessage("Registration submitted successfully!", "success");
    } catch (err) {
      showMessage(err.response?.data?.message || "Failed to submit registration", "error");
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
              onClick={() => {
                resetVisitorFlow();
                router.push("/");
              }}
              sx={{ py: 1.5, borderRadius: 30 }}
            >
              Back to Home
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
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, px: 2 }}>
              1. Select Date
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

          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
              2. Select Time Range
            </Typography>
            <Stack spacing={3}>
              {renderTimeDropdowns("timeFrom", "Expected Arrival (From)")}
              {renderTimeDropdowns("timeTo", "Expected Departure (To)")}

              <Box sx={{ mt: 1, p: 1.5, bgcolor: "action.hover", borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <ICONS.info sx={{ fontSize: 16, color: "text.secondary" }} />
                  <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ fontSize: 12 }}>
                    Visit duration: {dayjs(`2000-01-01 ${bookingData.timeTo}`).diff(dayjs(`2000-01-01 ${bookingData.timeFrom}`), 'minute')} min
                  </Typography>
                </Stack>
              </Box>
            </Stack>
          </Grid>
        </Grid>

        <Divider />

        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            fullWidth
            disabled={submitting}
            onClick={() => router.back()}
            sx={{ py: 1.5, borderRadius: 30 }}
          >
            Go Back
          </Button>
          <Button
            variant="contained"
            fullWidth
            disabled={submitting || !bookingData.date}
            onClick={handleSubmit}
            sx={{ py: 1.5, borderRadius: 30 }}
          >
            {submitting ? <CircularProgress size={24} color="inherit" /> : "Confirm & Send Request"}
          </Button>
        </Stack>
      </Stack>
    </VisitorLayout>
  );
}
