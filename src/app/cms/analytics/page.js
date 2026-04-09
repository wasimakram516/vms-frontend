"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  ButtonGroup,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import { useMessage } from "@/contexts/MessageContext";
import { motion } from "framer-motion";
import { io } from "socket.io-client";
import RoleGuard from "@/components/auth/RoleGuard";
import AppCard from "@/components/cards/AppCard";
import DateTimeFieldFlatpickr from "@/components/forms/DateTimeFieldFlatpickr";
import ICONS from "@/utils/iconUtil";
import { exportExcel } from "@/services/analyticsService";
import { exportAnalyticsPdf } from "@/utils/exportAnalyticsPdf";
import VolumeSection    from "./sections/VolumeSection";
import PeakHoursSection from "./sections/PeakHoursSection";
import FunnelSection    from "./sections/FunnelSection";
import ApprovalSection  from "./sections/ApprovalSection";
import DurationSection  from "./sections/DurationSection";

// ── Socket URL (strip /api/v1 from the API base) ─────────────────────────────
const SOCKET_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") ||
  "http://localhost:4000";

// ── Date helpers (local timezone) ─────────────────────────────────────────────
function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function subtractDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d;
}

function subtractMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() - months);
  return d;
}

function subtractYears(date, years) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() - years);
  return d;
}

// ── Preset definitions ────────────────────────────────────────────────────────
const PRESETS = [
  { key: "today",  label: "Today" },
  { key: "7d",     label: "Last 7d" },
  { key: "30d",    label: "Last 30d" },
  { key: "3m",     label: "Last 3m" },
  { key: "12m",    label: "Last 12m" },
  { key: "custom", label: "Custom" },
];

function computePresetRange(key) {
  const today = new Date();
  const todayStr = toDateStr(today);
  switch (key) {
    case "today": return { from: todayStr, to: todayStr };
    case "7d":    return { from: toDateStr(subtractDays(today, 6)),    to: todayStr };
    case "30d":   return { from: toDateStr(subtractDays(today, 29)),   to: todayStr };
    case "3m":    return { from: toDateStr(subtractMonths(today, 3)),  to: todayStr };
    case "12m":   return { from: toDateStr(subtractYears(today, 1)),   to: todayStr };
    default:      return { from: todayStr, to: todayStr };
  }
}

// ── Analytics page label for the date range ───────────────────────────────────
function RangeLabel({ from, to }) {
  if (!from || !to) return null;
  const fmt = (str) =>
    new Date(str + "T00:00:00").toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  return (
    <Typography variant="body2" color="text.secondary" sx={{ ml: "auto", whiteSpace: "nowrap" }}>
      {from === to ? fmt(from) : `${fmt(from)} — ${fmt(to)}`}
    </Typography>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  return (
    <RoleGuard allowedRoles={["superadmin"]}>
      <AnalyticsContent />
    </RoleGuard>
  );
}

function AnalyticsContent() {
  const { showMessage } = useMessage();

  // ── Date range state ────────────────────────────────────────────────────────
  const [activePreset, setActivePreset] = useState("30d");
  const [dateRange, setDateRange] = useState(() => computePresetRange("30d"));

  // Custom pickers (only used when activePreset === "custom")
  const [customFrom, setCustomFrom] = useState(null); // Date | null
  const [customTo, setCustomTo] = useState(null);     // Date | null
  const customValid = customFrom && customTo && customFrom <= customTo;

  // ── Real-time trigger ───────────────────────────────────────────────────────
  // { type: "new_registration" | "check_in" | "check_out" | "status_change", ts: number }
  const [lastTrigger, setLastTrigger] = useState(null);

  // ── Export loading states ───────────────────────────────────────────────────
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf,   setExportingPdf]   = useState(false);

  // ── Section refs for PDF capture ────────────────────────────────────────────
  const volumeRef        = useRef(null);
  const peakRef          = useRef(null);
  const funnelCardRef    = useRef(null);
  const funnelBreakdownRef = useRef(null);
  const approvalRef      = useRef(null);
  const durationRef      = useRef(null);

  // ── Socket subscription ─────────────────────────────────────────────────────
  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ["websocket", "polling"] });
    socket.on("analytics:update", ({ trigger }) => {
      setLastTrigger({ type: trigger, ts: Date.now() });
    });
    return () => socket.disconnect();
  }, []);

  // ── Preset selection ────────────────────────────────────────────────────────
  const handlePreset = useCallback((key) => {
    setActivePreset(key);
    if (key !== "custom") {
      setDateRange(computePresetRange(key));
    }
  }, []);

  // ── Apply custom range ──────────────────────────────────────────────────────
  const applyCustom = useCallback(() => {
    if (!customValid) return;
    setDateRange({ from: toDateStr(customFrom), to: toDateStr(customTo) });
  }, [customFrom, customTo, customValid]);

  // ── Export handlers ─────────────────────────────────────────────────────────
  const handleExcelExport = useCallback(async () => {
    setExportingExcel(true);
    try {
      await exportExcel(dateRange.from, dateRange.to);
    } catch {
      showMessage("Failed to export Excel. Please try again.", "error");
    } finally {
      setExportingExcel(false);
    }
  }, [dateRange, showMessage]);

  const handlePdfExport = useCallback(async () => {
    setExportingPdf(true);
    try {
      await exportAnalyticsPdf(
        [
          { ref: volumeRef },
          { ref: peakRef },
          { ref: funnelCardRef },
          { ref: funnelBreakdownRef },
          { ref: approvalRef },
          { ref: durationRef },
        ],
        { from: dateRange.from, to: dateRange.to }
      );
    } catch (err) {
      console.error("PDF export error:", err);
      showMessage("Failed to export PDF. Please try again.", "error");
    } finally {
      setExportingPdf(false);
    }
  }, [dateRange, showMessage]);

  // ── Chart props shared across all sections ──────────────────────────────────
  // Future sub-tasks receive: { from, to, lastTrigger }
  const sectionProps = { from: dateRange.from, to: dateRange.to, lastTrigger };

  return (
    <Box sx={{ maxWidth: 1400, mx: "auto" }}>

      {/* ── Page header ────────────────────────────────────────────────────── */}
      <Box mb={4}>
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45 }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={2}>
            <Box>
              <Typography
                variant="h3"
                fontWeight={800}
                sx={{ fontFamily: "'Comfortaa', cursive", mb: 0.5 }}
              >
                Analytics
              </Typography>
              <Typography color="text.secondary" variant="body1">
                Deep insights into visitor activity across all departments.
              </Typography>
            </Box>

            {/* Export buttons */}
            <Stack direction="row" spacing={1.5} flexShrink={0} alignItems="center">
              <Button
                variant="outlined"
                startIcon={
                  exportingExcel
                    ? <CircularProgress size={16} color="inherit" />
                    : <ICONS.description />
                }
                disabled={exportingExcel || !dateRange.from}
                onClick={handleExcelExport}
                sx={{ borderRadius: 3, px: 2.5, py: 1, fontWeight: 700 }}
              >
                {exportingExcel ? "Exporting…" : "Export Excel"}
              </Button>
              <Button
                variant="outlined"
                startIcon={
                  exportingPdf
                    ? <CircularProgress size={16} color="inherit" />
                    : <ICONS.pdf />
                }
                disabled={exportingPdf || !dateRange.from}
                onClick={handlePdfExport}
                sx={{ borderRadius: 3, px: 2.5, py: 1, fontWeight: 700 }}
              >
                {exportingPdf ? "Exporting…" : "Export PDF"}
              </Button>
            </Stack>
          </Stack>
        </motion.div>
      </Box>

      {/* ── Global date range picker ────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
      >
        <AppCard interactive={false} sx={{ p: 2.5, mb: 4 }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            alignItems={{ xs: "stretch", sm: "center" }}
            spacing={2}
            flexWrap="wrap"
          >
            {/* Preset buttons */}
            <ButtonGroup variant="outlined" size="small" sx={{ flexShrink: 0 }}>
              {PRESETS.map(({ key, label }) => (
                <Button
                  key={key}
                  variant={activePreset === key ? "contained" : "outlined"}
                  disableElevation
                  onClick={() => handlePreset(key)}
                  sx={{
                    fontWeight: 700,
                    borderRadius: key === PRESETS[0].key
                      ? "8px 0 0 8px"
                      : key === PRESETS[PRESETS.length - 1].key
                      ? "0 8px 8px 0"
                      : 0,
                    px: 1.5,
                    fontSize: "0.78rem",
                  }}
                >
                  {label}
                </Button>
              ))}
            </ButtonGroup>

            {/* Active range label (non-custom) */}
            {activePreset !== "custom" && (
              <RangeLabel from={dateRange.from} to={dateRange.to} />
            )}
          </Stack>

          {/* Custom date pickers */}
          {activePreset === "custom" && (
            <>
              <Divider sx={{ my: 2 }} />
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                alignItems={{ xs: "stretch", sm: "center" }}
              >
                <Box sx={{ flex: 1, minWidth: 160 }}>
                  <DateTimeFieldFlatpickr
                    label="From"
                    value={customFrom}
                    onChange={setCustomFrom}
                    enableTime={false}
                  />
                </Box>
                <Box sx={{ flex: 1, minWidth: 160 }}>
                  <DateTimeFieldFlatpickr
                    label="To"
                    value={customTo}
                    onChange={setCustomTo}
                    enableTime={false}
                    minDate={customFrom ?? undefined}
                  />
                </Box>
                <Button
                  variant="contained"
                  disableElevation
                  disabled={!customValid}
                  onClick={applyCustom}
                  sx={{ borderRadius: 3, px: 3, fontWeight: 700, flexShrink: 0, height: 56 }}
                >
                  Apply
                </Button>
                {dateRange.from && (
                  <RangeLabel from={dateRange.from} to={dateRange.to} />
                )}
              </Stack>
            </>
          )}
        </AppCard>
      </motion.div>

      {/* ── Chart sections ──────────────────────────────────────────────────── */}
      <Stack spacing={4}>

        <div ref={volumeRef}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.10 }}>
            <VolumeSection {...sectionProps} />
          </motion.div>
        </div>

        <div ref={peakRef}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <PeakHoursSection {...sectionProps} />
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.20 }}>
          <FunnelSection {...sectionProps} funnelCardRef={funnelCardRef} breakdownRef={funnelBreakdownRef} />
        </motion.div>

        <div ref={approvalRef}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <ApprovalSection {...sectionProps} />
          </motion.div>
        </div>

        <div ref={durationRef}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.30 }}>
            <DurationSection {...sectionProps} />
          </motion.div>
        </div>

      </Stack>
    </Box>
  );
}
