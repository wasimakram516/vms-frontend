"use client";

import { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  TextField,
  Divider,
  CircularProgress,
  Box,
  IconButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import TodayIcon from "@mui/icons-material/Today";
import DateRangeIcon from "@mui/icons-material/DateRange";
import ViewWeekIcon from "@mui/icons-material/ViewWeek";
import { useColorMode } from "@/contexts/ThemeContext";
import { exportVisitorReport } from "@/services/dashboardService";

const PERIODS = [
  { value: "daily",   label: "Daily",   icon: TodayIcon },
  { value: "weekly",  label: "Weekly",  icon: ViewWeekIcon },
  { value: "monthly", label: "Monthly", icon: CalendarMonthIcon },
  { value: "custom",  label: "Custom",  icon: DateRangeIcon },
];

// Returns today's date as YYYY-MM-DD
function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function ExportDialog({ open, onClose }) {
  const { mode } = useColorMode();
  const isDark = mode === "dark";

  const [period, setPeriod] = useState("monthly");
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleExport = async () => {
    if (period === "custom" && from > to) {
      setError("'From' date must be before or equal to 'To' date.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await exportVisitorReport({ period, from: period === "custom" ? from : undefined, to: period === "custom" ? to : undefined });
      onClose();
    } catch {
      setError("Export failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 4,
          bgcolor: isDark ? "#0f1117" : "#fff",
          backgroundImage: "none",
          border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.06)",
        },
      }}
    >
      <DialogTitle sx={{ pb: 0 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" alignItems="center" spacing={1}>
            <FileDownloadIcon fontSize="small" />
            <Typography variant="h6" fontWeight={700}>Export Report</Typography>
          </Stack>
          <IconButton onClick={onClose} size="small" disabled={loading}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      </DialogTitle>

      <Divider sx={{ mt: 2, opacity: 0.5 }} />

      <DialogContent sx={{ pt: 2.5 }}>
        {/* Period selector */}
        <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" mb={1}>
          SELECT PERIOD
        </Typography>

        <ToggleButtonGroup
          value={period}
          exclusive
          onChange={(_, val) => val && setPeriod(val)}
          fullWidth
          size="small"
          sx={{ mb: 2.5 }}
        >
          {PERIODS.map(({ value, label, icon: Icon }) => (
            <ToggleButton
              key={value}
              value={value}
              sx={{
                flex: 1,
                fontWeight: 700,
                fontSize: "0.72rem",
                flexDirection: "column",
                gap: 0.3,
                py: 1,
              }}
            >
              <Icon sx={{ fontSize: 16 }} />
              {label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        {/* Custom date range — shown only when period=custom */}
        {period === "custom" && (
          <Stack spacing={2} mb={1}>
            <TextField
              label="From"
              type="date"
              size="small"
              fullWidth
              value={from}
              onChange={(e) => { setFrom(e.target.value); setError(""); }}
              inputProps={{ max: today() }}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="To"
              type="date"
              size="small"
              fullWidth
              value={to}
              onChange={(e) => { setTo(e.target.value); setError(""); }}
              inputProps={{ min: from, max: today() }}
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
        )}

        {error && (
          <Typography variant="caption" color="error" display="block" mt={1.5} fontWeight={600}>
            {error}
          </Typography>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, pt: 0 }}>
        <Button
          onClick={onClose}
          disabled={loading}
          sx={{ borderRadius: 3, fontWeight: 700 }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleExport}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <FileDownloadIcon />}
          sx={{
            borderRadius: 3,
            fontWeight: 700,
            bgcolor: isDark ? "#fff" : "#000",
            color: isDark ? "#000" : "#fff",
            "&:hover": { bgcolor: isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.85)" },
          }}
        >
          {loading ? "Exporting…" : "Export Excel"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
