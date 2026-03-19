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
} from "@mui/material";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";
import { useRouter } from "next/navigation";
import { useVisitor } from "@/contexts/VisitorContext";
import { useMessage } from "@/contexts/MessageContext";
import { createRegistration } from "@/services/registrationService";
import { motion } from "framer-motion";
import dayjs from "dayjs";
import ICONS from "@/utils/iconUtil";

const transition = { duration: 0.5, ease: [0.43, 0.13, 0.23, 0.96] };

const TIME_SLOTS = [
  "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"
];

export default function BookingPage() {
  const router = useRouter();
  const { showMessage } = useMessage();
  const { visitorData, bookingData, setBookingData, resetVisitorFlow } = useVisitor();
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);

  const handleDateChange = (newDate) => {
    setBookingData((prev) => ({ ...prev, date: newDate }));
  };

  const handleTimeChange = (type, value) => {
    setBookingData((prev) => {
      const newData = { ...prev, [type]: value };
      
      if (type === "timeFrom" && newData.timeTo <= value) {
        const fromIndex = TIME_SLOTS.indexOf(value);
        if (fromIndex !== -1 && fromIndex + 1 < TIME_SLOTS.length) {
          newData.timeTo = TIME_SLOTS[fromIndex + 1];
        }
      }
      
      return newData;
    });
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
      <Box sx={{ maxWidth: 500, mx: "auto", py: 8, textAlign: "center" }}>
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <Paper elevation={0} sx={{ p: 5, borderRadius: 6, border: "1px solid rgba(0,0,0,0.06)" }}>
            <Box sx={{ p: 2, borderRadius: "50%", bgcolor: "success.light", color: "success.main", display: "inline-flex", mb: 3 }}>
              <ICONS.checkCircle fontSize="large" />
            </Box>
            <Typography variant="h5" fontWeight={800} gutterBottom>Application Sent!</Typography>
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
              sx={{ py: 1.5, borderRadius: 3 }}
            >
              Back to Home
            </Button>
          </Paper>
        </motion.div>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", px: 2, py: { xs: 4, md: 6 } }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={transition}>
        <Paper elevation={0} sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 5, border: "1px solid rgba(0,0,0,0.06)" }}>
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
                    border: "1px solid rgba(0,0,0,0.05)",
                    borderRadius: 4,
                    bgcolor: "rgba(0,0,0,0.01)",
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
                <Stack spacing={2}>
                  <TextField
                    select
                    fullWidth
                    label="From"
                    value={bookingData.timeFrom}
                    onChange={(e) => handleTimeChange("timeFrom", e.target.value)}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 3 } }}
                  >
                    {TIME_SLOTS.slice(0, -1).map((slot) => (
                      <MenuItem key={slot} value={slot}>{slot}</MenuItem>
                    ))}
                  </TextField>

                  <TextField
                    select
                    fullWidth
                    label="To"
                    value={bookingData.timeTo}
                    onChange={(e) => handleTimeChange("timeTo", e.target.value)}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 3 } }}
                  >
                    {TIME_SLOTS.map((slot) => (
                      <MenuItem 
                        key={slot} 
                        value={slot} 
                        disabled={slot <= bookingData.timeFrom}
                      >
                        {slot}
                      </MenuItem>
                    ))}
                  </TextField>

                  <Box sx={{ mt: 1, p: 1.5, bgcolor: "primary.main", borderRadius: 2, color: "white", boxShadow: "0 4px 12px rgba(18,129,153,0.15)" }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <ICONS.info sx={{ fontSize: 16 }} />
                      <Typography variant="caption" fontWeight={600} sx={{ fontSize: 12 }}>
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
                sx={{ py: 0.8, borderRadius: 3 }}
              >
                Go Back
              </Button>
              <Button
                variant="contained"
                fullWidth
                disabled={submitting || !bookingData.date}
                onClick={handleSubmit}
                sx={{ py: 0.8, borderRadius: 3 }}
              >
                {submitting ? <CircularProgress size={24} color="inherit" /> : "Confirm & Send Request"}
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </motion.div>
    </Box>
  );
}
