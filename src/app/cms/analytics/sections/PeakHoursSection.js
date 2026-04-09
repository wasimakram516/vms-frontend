"use client";

import { useCallback, useEffect, useState } from "react";
import { Box, Stack, Tooltip as MuiTooltip, Typography } from "@mui/material";
import Grid from "@mui/material/Grid";
import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { useColorMode } from "@/contexts/ThemeContext";
import AppCard from "@/components/cards/AppCard";
import { getPeakHours } from "@/services/analyticsService";
import {
  axisStyle, cartesianGridProps, tooltipProps,
  ChartTypeToggle, ChartSkeleton, EmptyState, SectionHeader, PALETTE,
} from "./_shared";

const TYPES        = ["Bar", "Heatmap"];
const WEEKDAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_LABELS   = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS        = Array.from({ length: 24 }, (_, h) => h);

function fmtHour(h) {
  if (h === 0)  return "12 AM";
  if (h < 12)   return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
}

// ── 2-D hour × weekday heatmap ────────────────────────────────────────────────
function HeatGrid2D({ grid, isDark }) {
  // grid: Map<"dowIdx-hour" → count>, dowIdx 0=Mon … 6=Sun
  const max     = Math.max(...grid.values(), 1);
  const primary = isDark ? "#ffffff" : "#000000";

  // CSS grid: first column = day label, remaining 24 columns share equal width
  const gridCols = "44px repeat(24, 1fr)";

  return (
    <Box sx={{ mt: 1, width: "100%" }}>
      {/* Rows: one per weekday */}
      {DAY_LABELS.map((day, dayIdx) => (
        <Box
          key={day}
          sx={{ display: "grid", gridTemplateColumns: gridCols, alignItems: "center", mb: 0.5 }}
        >
          {/* Day label */}
          <Box
            sx={{
              fontSize: "0.7rem",
              fontWeight: 700,
              color: "text.secondary",
              textAlign: "right",
              pr: 1,
            }}
          >
            {day}
          </Box>

          {/* Hour cells */}
          {HOURS.map((h) => {
            const count     = grid.get(`${dayIdx}-${h}`) ?? 0;
            const intensity = count / max;
            return (
              <MuiTooltip
                key={h}
                title={`${day} ${fmtHour(h)}: ${count} check-in${count !== 1 ? "s" : ""}`}
                placement="top"
                arrow
              >
                <Box
                  sx={{
                    height: 28,
                    mx: 0.2,
                    borderRadius: 1,
                    bgcolor: primary,
                    opacity: 0.05 + intensity * 0.95,
                    cursor: "default",
                    transition: "opacity 0.15s",
                    "&:hover": { opacity: Math.min(1, 0.05 + intensity * 0.95 + 0.12) },
                  }}
                />
              </MuiTooltip>
            );
          })}
        </Box>
      ))}

      {/* Hour footer row */}
      <Box sx={{ display: "grid", gridTemplateColumns: gridCols, mt: 0.5 }}>
        <Box /> {/* empty label cell */}
        {HOURS.map((h) => (
          <Box
            key={h}
            sx={{
              fontSize: "0.58rem",
              color: "text.secondary",
              textAlign: "center",
              lineHeight: 1,
              overflow: "hidden",
            }}
          >
            {h % 3 === 0 ? fmtHour(h) : ""}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// ── 1-D bar sub-card ──────────────────────────────────────────────────────────
function BarSubCard({ title, data, keyField, labelFn, isDark }) {
  if (!data || data.length === 0) return (
    <AppCard interactive={false} sx={{ p: 2.5, height: "100%" }}>
      <SectionHeader title={title} />
      <EmptyState height={220} />
    </AppCard>
  );

  const peakItem  = [...data].sort((a, b) => b.count - a.count)[0];
  const peakKey   = peakItem?.[keyField];
  const tip       = tooltipProps(isDark);
  const ax        = axisStyle(isDark);
  const grid      = cartesianGridProps(isDark);
  const mainColor = isDark ? "#ffffff" : "#000000";
  const chartData = data.map((d) => ({
    ...d,
    label:  labelFn(d[keyField]),
    isPeak: d[keyField] === peakKey,
  }));

  return (
    <AppCard interactive={false} sx={{ p: 2.5, height: "100%" }}>
      <SectionHeader title={title} />
      {peakItem && (
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: "block" }}>
          Peak: <strong>{labelFn(peakKey)}</strong> ({peakItem.count} check-ins)
        </Typography>
      )}
      <Box sx={{ width: "100%", height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 4, right: 8, left: -18, bottom: keyField === "hour" ? 28 : 4 }}
          >
            <CartesianGrid {...grid} />
            <XAxis
              dataKey="label"
              {...ax}
              interval={keyField === "hour" ? 2 : 0}
              angle={keyField === "hour" ? -35 : 0}
              textAnchor={keyField === "hour" ? "end" : "middle"}
              height={keyField === "hour" ? 50 : 24}
            />
            <YAxis {...ax} />
            <Tooltip {...tip} formatter={(v) => [v, "Check-ins"]} />
            <Bar dataKey="count" radius={[3, 3, 0, 0]} maxBarSize={24}>
              {chartData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.isPeak ? PALETTE[0] : mainColor}
                  fillOpacity={entry.isPeak ? 1 : isDark ? 0.75 : 0.7}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </AppCard>
  );
}

// ── Main section ──────────────────────────────────────────────────────────────
export default function PeakHoursSection({ from, to, lastTrigger }) {
  const { mode } = useColorMode();
  const isDark   = mode === "dark";

  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [chartType, setChartType] = useState("Bar");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const result = await getPeakHours(from, to);
    if (result && !result.error) setData(result);
    setLoading(false);
  }, [from, to]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    if (lastTrigger?.type === "check_in") fetchData();
  }, [lastTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  // Client UTC offset in whole hours (e.g. +4 for Asia/Muscat, -5 for EST)
  const clientOffsetHours = Math.round(-new Date().getTimezoneOffset() / 60);

  // ── Shift UTC hour buckets → client local ─────────────────────────────────
  const byHour = (() => {
    const local = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
    (data?.byHour ?? []).forEach(({ hour: utcH, count }) => {
      const localH = ((utcH + clientOffsetHours) % 24 + 24) % 24;
      local[localH].count += count;
    });
    return local;
  })();

  // ── Shift UTC weekday buckets → client local ──────────────────────────────
  const byWeekday = (() => {
    const local = new Map(WEEKDAY_ORDER.map((d) => [d, 0]));
    (data?.byWeekday ?? []).forEach(({ day, count }) => {
      const utcIdx   = WEEKDAY_ORDER.indexOf(day);
      const localIdx = ((utcIdx + Math.floor(clientOffsetHours / 24)) % 7 + 7) % 7;
      const localDay = WEEKDAY_ORDER[localIdx];
      local.set(localDay, (local.get(localDay) ?? 0) + count);
    });
    return WEEKDAY_ORDER.map((d) => ({ day: d, count: local.get(d) ?? 0 }));
  })();

  // ── Build 2D grid: shift each UTC (dow, hour) cell to client local ─────────
  // Properly handles midnight crossings — a check-in at UTC 23:00 Mon for UTC+2
  // becomes local 01:00 Tue, so it shifts to Tuesday in the grid.
  const heatGrid = (() => {
    const map = new Map();
    (data?.byHourWeekday ?? []).forEach(({ dow: utcDow, hour: utcHour, count }) => {
      const rawLocalHour = utcHour + clientOffsetHours;
      const localHour    = ((rawLocalHour % 24) + 24) % 24;
      const dayShift     = rawLocalHour >= 24 ? 1 : rawLocalHour < 0 ? -1 : 0;
      // ISODOW: 1=Mon…7=Sun → convert to 0-based index
      const utcDowIdx    = utcDow - 1;
      const localDowIdx  = ((utcDowIdx + dayShift) % 7 + 7) % 7;
      const key          = `${localDowIdx}-${localHour}`;
      map.set(key, (map.get(key) ?? 0) + count);
    });
    return map;
  })();

  const hasData = (data?.byHourWeekday ?? []).length > 0;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2.5}>
        <Typography variant="h6" fontWeight={700}>
          Peak Hours Analysis
        </Typography>
        <ChartTypeToggle options={TYPES} value={chartType} onChange={setChartType} />
      </Stack>

      {loading ? (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}><ChartSkeleton height={320} /></Grid>
          <Grid size={{ xs: 12, md: 6 }}><ChartSkeleton height={320} /></Grid>
        </Grid>
      ) : chartType === "Heatmap" ? (
        <AppCard interactive={false} sx={{ p: 3 }}>
          <SectionHeader title="Check-ins by Hour × Day of Week" />
          {!hasData ? (
            <EmptyState height={200} />
          ) : (
            <HeatGrid2D grid={heatGrid} isDark={isDark} />
          )}
        </AppCard>
      ) : (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <BarSubCard
              title="By Hour of Day"
              data={byHour}
              keyField="hour"
              labelFn={fmtHour}
              isDark={isDark}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <BarSubCard
              title="By Day of Week"
              data={byWeekday}
              keyField="day"
              labelFn={(d) => d.slice(0, 3)}
              isDark={isDark}
            />
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
