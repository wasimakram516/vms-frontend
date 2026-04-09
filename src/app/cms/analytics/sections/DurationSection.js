"use client";

import { useCallback, useEffect, useState } from "react";
import { Box, Stack } from "@mui/material";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend,
} from "recharts";
import { useColorMode } from "@/contexts/ThemeContext";
import AppCard from "@/components/cards/AppCard";
import { getVisitDuration } from "@/services/analyticsService";
import {
  PALETTE, axisStyle, cartesianGridProps, tooltipProps, formatMinutes,
  ChartTypeToggle, ChartSkeleton, EmptyState, SectionHeader, KpiCard,
} from "./_shared";

const CHART_TYPES = ["Bar", "Pie", "Donut"];

export default function DurationSection({ from, to, lastTrigger }) {
  const { mode } = useColorMode();
  const isDark   = mode === "dark";

  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [chartType, setChartType] = useState("Bar");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const result = await getVisitDuration(from, to);
    if (result && !result.error) setData(result);
    setLoading(false);
  }, [from, to]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (lastTrigger?.type === "check_out") fetchData();
  }, [lastTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  const histogram = data?.histogram ?? [];
  const tip       = tooltipProps(isDark);
  const ax        = axisStyle(isDark);
  const grid      = cartesianGridProps(isDark);

  // ── Histogram chart ──────────────────────────────────────────────────────
  const renderHistogram = () => {
    if (histogram.length === 0 || histogram.every((b) => b.count === 0))
      return <EmptyState message="No visit sessions with both check-in and check-out recorded" height={220} />;

    if (chartType === "Bar") {
      return (
        <Box sx={{ width: "100%", height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={histogram}
              margin={{ top: 4, right: 12, left: -12, bottom: 28 }}
            >
              <CartesianGrid {...grid} />
              <XAxis
                dataKey="label"
                {...ax}
                angle={-20}
                textAnchor="end"
                height={46}
                interval={0}
              />
              <YAxis {...ax} />
              <Tooltip {...tip} formatter={(v) => [v, "Sessions"]} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40}>
                {histogram.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Box>
      );
    }

    return (
      <Box sx={{ width: "100%", height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={histogram}
              dataKey="count"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={chartType === "Donut" ? "42%" : 0}
              outerRadius="70%"
              paddingAngle={chartType === "Donut" ? 3 : 1}
              label={({ x, y, percent }) => {
                const fill = isDark ? "#ffffff" : "#222222";
                return percent > 0.04 ? (
                  <text x={x} y={y} fill={fill} textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
                    {`${(percent * 100).toFixed(0)}%`}
                  </text>
                ) : null;
              }}
              labelLine={false}
            >
              {histogram.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip {...tip} formatter={(v, n) => [v, n]} />
            <Legend
              iconType="circle"
              iconSize={8}
              formatter={(value) => (
                <span style={{ fontSize: 11, color: isDark ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.55)" }}>
                  {value}
                </span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </Box>
    );
  };

  return (
    <AppCard interactive={false} sx={{ p: 3 }}>
      <SectionHeader title="Visit Duration" />

      {loading ? (
        <ChartSkeleton height={300} />
      ) : (
        <Stack spacing={3}>
          {/* KPI card */}
          <Stack direction="row">
            <KpiCard
              label="Avg Visit Duration"
              value={formatMinutes(data?.avgDurationMinutes)}
              isDark={isDark}
            />
          </Stack>

          {/* Histogram */}
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
              <Box sx={{ fontSize: "0.9rem", fontWeight: 700 }}>
                Duration Distribution
              </Box>
              <ChartTypeToggle
                options={CHART_TYPES}
                value={chartType}
                onChange={setChartType}
              />
            </Stack>
            {renderHistogram()}
          </Box>
        </Stack>
      )}
    </AppCard>
  );
}
