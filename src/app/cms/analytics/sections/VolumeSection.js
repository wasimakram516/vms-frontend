"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Chip, Stack } from "@mui/material";
import {
  AreaChart, Area,
  BarChart,  Bar,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { useColorMode } from "@/contexts/ThemeContext";
import AppCard from "@/components/cards/AppCard";
import { getVolume } from "@/services/analyticsService";
import {
  axisStyle, cartesianGridProps, tooltipProps,
  ChartTypeToggle, ChartSkeleton, EmptyState, SectionHeader,
} from "./_shared";

const TYPES         = ["Line", "Area", "Bar"];
const TRIGGERS      = ["new_registration", "check_in"];
const ANOMALY_COLOR = "#ef4444";
const ANOMALY_THRESHOLD = 1.5; // 50% above mean

function fmtDate(dateStr, total) {
  const d = new Date(dateStr + "T00:00:00");
  if (total > 90)
    return d.toLocaleDateString(undefined, { month: "short" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Returns a Set of date strings where count > mean × ANOMALY_THRESHOLD.
// Requires ≥5 data points — fewer points make the mean unstable.
function detectAnomalies(data) {
  if (data.length < 5) return new Set();
  const mean = data.reduce((s, d) => s + d.count, 0) / data.length;
  if (mean === 0) return new Set();
  return new Set(
    data.filter((d) => d.count > mean * ANOMALY_THRESHOLD).map((d) => d.date)
  );
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
function VolumeTooltip({ active, payload, label, isDark, anomalies }) {
  if (!active || !payload?.length) return null;
  const tip     = tooltipProps(isDark);
  const entry   = payload[0];
  const isSpike = anomalies.has(entry?.payload?.date);
  return (
    <div style={{ ...tip.contentStyle, padding: "8px 12px", minWidth: 130 }}>
      <div style={{ ...tip.labelStyle, marginBottom: 4 }}>{label}</div>
      <div style={{ ...tip.itemStyle }}>
        Visitors: <strong>{entry.value}</strong>
      </div>
      {isSpike && (
        <div style={{ color: ANOMALY_COLOR, fontWeight: 700, marginTop: 6, fontSize: 11 }}>
          ⚠ Unusual spike
        </div>
      )}
    </div>
  );
}

// ── Gradient defs (Area chart) ────────────────────────────────────────────────
function AreaGradient({ id, color }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%"  stopColor={color} stopOpacity={0.22} />
        <stop offset="95%" stopColor={color} stopOpacity={0}    />
      </linearGradient>
    </defs>
  );
}

export default function VolumeSection({ from, to, lastTrigger }) {
  const { mode }  = useColorMode();
  const isDark    = mode === "dark";
  const mainColor = isDark ? "#ffffff" : "#000000";

  const [chartType, setChartType] = useState("Area");
  const [data,      setData]      = useState([]);
  const [loading,   setLoading]   = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const result = await getVolume(from, to);
    if (result && !result.error) {
      setData(
        (result ?? []).map((d) => ({
          ...d,
          label: fmtDate(d.date, result.length),
        }))
      );
    }
    setLoading(false);
  }, [from, to]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (lastTrigger && TRIGGERS.includes(lastTrigger.type)) fetchData();
  }, [lastTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Anomaly detection ─────────────────────────────────────────────────────
  const anomalies = useMemo(() => detectAnomalies(data), [data]);

  // ── Shared chart props ────────────────────────────────────────────────────
  const ax       = axisStyle(isDark);
  const grid     = cartesianGridProps(isDark);
  const xInterval = data.length > 60 ? Math.floor(data.length / 12) : "preserveStartEnd";
  const barSize   = data.length > 60 ? 4 : data.length > 30 ? 8 : 16;

  const commonProps = {
    data,
    margin: { top: 6, right: 12, left: -10, bottom: data.length > 30 ? 28 : 4 },
  };
  const xAxisProps = {
    dataKey:    "label",
    interval:   xInterval,
    angle:      data.length > 30 ? -35 : 0,
    textAnchor: data.length > 30 ? "end" : "middle",
    height:     data.length > 30 ? 52 : 24,
    ...ax,
  };

  const tooltipEl = (
    <Tooltip
      content={(props) => (
        <VolumeTooltip {...props} isDark={isDark} anomalies={anomalies} />
      )}
    />
  );

  // Custom dot: show red marker only on anomaly days
  const anomalyDot = (props) => {
    const { cx, cy, payload } = props;
    if (!anomalies.has(payload.date)) return <g key={payload.date} />;
    return (
      <circle
        key={payload.date}
        cx={cx}
        cy={cy}
        r={5}
        fill={ANOMALY_COLOR}
        stroke="#fff"
        strokeWidth={1.5}
      />
    );
  };

  const anomalyActiveDot = (props) => {
    const { cx, cy, payload } = props;
    const isSpike = anomalies.has(payload.date);
    return (
      <circle
        cx={cx}
        cy={cy}
        r={5}
        fill={isSpike ? ANOMALY_COLOR : mainColor}
        stroke="#fff"
        strokeWidth={1.5}
      />
    );
  };

  // ── Render chart by type ──────────────────────────────────────────────────
  const renderChart = () => {
    if (chartType === "Line") {
      return (
        <LineChart {...commonProps}>
          <CartesianGrid {...grid} />
          <XAxis {...xAxisProps} />
          <YAxis {...ax} />
          {tooltipEl}
          <Line
            type="monotone"
            dataKey="count"
            stroke={mainColor}
            strokeWidth={2}
            dot={anomalyDot}
            activeDot={anomalyActiveDot}
          />
        </LineChart>
      );
    }

    if (chartType === "Area") {
      return (
        <AreaChart {...commonProps}>
          <AreaGradient id="vol" color={mainColor} />
          <CartesianGrid {...grid} />
          <XAxis {...xAxisProps} />
          <YAxis {...ax} />
          {tooltipEl}
          <Area
            type="monotone"
            dataKey="count"
            stroke={mainColor}
            fill="url(#vol)"
            strokeWidth={2}
            dot={anomalyDot}
            activeDot={anomalyActiveDot}
          />
        </AreaChart>
      );
    }

    return (
      <BarChart {...commonProps}>
        <CartesianGrid {...grid} />
        <XAxis {...xAxisProps} />
        <YAxis {...ax} />
        {tooltipEl}
        <Bar
          dataKey="count"
          radius={[3, 3, 0, 0]}
          maxBarSize={barSize}
        >
          {data.map((entry) => (
            <Cell
              key={entry.date}
              fill={anomalies.has(entry.date) ? ANOMALY_COLOR : mainColor}
              fillOpacity={isDark ? 0.9 : 0.85}
            />
          ))}
        </Bar>
      </BarChart>
    );
  };

  return (
    <AppCard interactive={false} sx={{ p: 3 }}>
      <SectionHeader
        title="Visitor Volume Trends"
        toggle={
          <Stack direction="row" alignItems="center" gap={1.5}>
            {anomalies.size > 0 && (
              <Chip
                size="small"
                label={`${anomalies.size} spike${anomalies.size > 1 ? "s" : ""} detected`}
                sx={{
                  bgcolor: ANOMALY_COLOR,
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: "0.68rem",
                  height: 22,
                  borderRadius: 1,
                }}
              />
            )}
            <ChartTypeToggle options={TYPES} value={chartType} onChange={setChartType} />
          </Stack>
        }
      />

      {loading ? (
        <ChartSkeleton height={300} />
      ) : data.length === 0 ? (
        <EmptyState />
      ) : (
        <Box sx={{ width: "100%", height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </Box>
      )}
    </AppCard>
  );
}
