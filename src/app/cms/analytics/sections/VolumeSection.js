"use client";

import { useCallback, useEffect, useState } from "react";
import { Box, Stack } from "@mui/material";
import {
  AreaChart, Area,
  BarChart,  Bar,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useColorMode } from "@/contexts/ThemeContext";
import AppCard from "@/components/cards/AppCard";
import { getVolume } from "@/services/analyticsService";
import {
  axisStyle, cartesianGridProps, tooltipProps,
  ChartTypeToggle, ChartSkeleton, EmptyState, SectionHeader,
} from "./_shared";

const TYPES    = ["Line", "Area", "Bar"];
const TRIGGERS = ["new_registration", "check_in"];

function fmtDate(dateStr, total) {
  const d = new Date(dateStr + "T00:00:00");
  if (total > 90)
    return d.toLocaleDateString(undefined, { month: "short" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ── Gradient defs (shared for Area) ──────────────────────────────────────────
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

  // ── Shared chart props ────────────────────────────────────────────────────
  const tip  = tooltipProps(isDark);
  const ax   = axisStyle(isDark);
  const grid = cartesianGridProps(isDark);
  const xInterval = data.length > 60 ? Math.floor(data.length / 12) : "preserveStartEnd";
  const barSize   = data.length > 60 ? 4 : data.length > 30 ? 8 : 16;

  const commonProps = {
    data,
    margin: { top: 6, right: 12, left: -10, bottom: data.length > 30 ? 28 : 4 },
  };
  const xAxisProps = {
    dataKey:     "label",
    interval:    xInterval,
    angle:       data.length > 30 ? -35 : 0,
    textAnchor:  data.length > 30 ? "end" : "middle",
    height:      data.length > 30 ? 52 : 24,
    ...ax,
  };

  // ── Render chart by type ──────────────────────────────────────────────────
  const renderChart = () => {
    if (chartType === "Line") {
      return (
        <LineChart {...commonProps}>
          <CartesianGrid {...grid} />
          <XAxis {...xAxisProps} />
          <YAxis {...ax} />
          <Tooltip {...tip} formatter={(v) => [v, "Visitors"]} />
          <Line
            type="monotone"
            dataKey="count"
            stroke={mainColor}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
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
          <Tooltip {...tip} formatter={(v) => [v, "Visitors"]} />
          <Area
            type="monotone"
            dataKey="count"
            stroke={mainColor}
            fill="url(#vol)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </AreaChart>
      );
    }

    return (
      <BarChart {...commonProps}>
        <CartesianGrid {...grid} />
        <XAxis {...xAxisProps} />
        <YAxis {...ax} />
        <Tooltip {...tip} formatter={(v) => [v, "Visitors"]} />
        <Bar
          dataKey="count"
          fill={mainColor}
          fillOpacity={isDark ? 0.9 : 0.85}
          radius={[3, 3, 0, 0]}
          maxBarSize={barSize}
        />
      </BarChart>
    );
  };

  return (
    <AppCard interactive={false} sx={{ p: 3 }}>
      <SectionHeader
        title="Visitor Volume Trends"
        toggle={
          <ChartTypeToggle options={TYPES} value={chartType} onChange={setChartType} />
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
