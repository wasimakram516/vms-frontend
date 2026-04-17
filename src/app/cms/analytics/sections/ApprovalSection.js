"use client";

import { useCallback, useEffect, useState } from "react";
import { Box, Stack } from "@mui/material";
import Grid from "@mui/material/Grid";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend,
} from "recharts";
import { useColorMode } from "@/contexts/ThemeContext";
import AppCard from "@/components/cards/AppCard";
import { getApprovalTime } from "@/services/analyticsService";
import {
  PALETTE, axisStyle, cartesianGridProps, tooltipProps, formatMinutes,
  ChartTypeToggle, ChartSkeleton, EmptyState, SectionHeader, KpiCard,
} from "./_shared";

const CHART_TYPES = ["Bar", "Pie", "Donut"];

export default function ApprovalSection({ from, to, lastTrigger }) {
  const { mode } = useColorMode();
  const isDark   = mode === "dark";

  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [chartType, setChartType] = useState("Bar");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const result = await getApprovalTime(from, to);
    if (result && !result.error) setData(result);
    setLoading(false);
  }, [from, to]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (lastTrigger?.type === "status_change") fetchData();
  }, [lastTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  const reasons = data?.rejectionReasons ?? [];
  const tip     = tooltipProps(isDark);
  const ax      = axisStyle(isDark);
  const grid    = cartesianGridProps(isDark);

  // ── Rejection reasons chart ────────────────────────────────────────────────
  const renderReasonsChart = () => {
    if (reasons.length === 0) return <EmptyState message="No rejection data" height={220} />;

    if (chartType === "Bar") {
      const labelW = Math.min(180, Math.max(80, ...reasons.map((r) => r.reason.length * 7)));
      return (
        <Box sx={{ width: "100%", height: Math.max(200, reasons.length * 38 + 40) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={reasons}
              margin={{ top: 4, right: 32, left: 0, bottom: 4 }}
            >
              <CartesianGrid {...grid} horizontal={false} vertical />
              <XAxis type="number" {...ax} />
              <YAxis type="category" dataKey="reason" width={labelW} {...ax} />
              <Tooltip {...tip} formatter={(v) => [v, "Rejections"]} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={20}>
                {reasons.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Box>
      );
    }

    const pieData = reasons.map((r) => ({ name: r.reason, count: r.count }));
    const labelFill = isDark ? "#ffffff" : "#222222";
    return (
      <Box sx={{ width: "100%", height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 20, right: 10, bottom: 5, left: 10 }}>
            <Pie
              data={pieData}
              dataKey="count"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={chartType === "Donut" ? "42%" : 0}
              outerRadius="63%"
              paddingAngle={chartType === "Donut" ? 3 : 1}
              label={({ x, y, percent }) =>
                percent > 0.08 ? (
                  <text x={x} y={y} fill={labelFill} textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
                    {`${(percent * 100).toFixed(0)}%`}
                  </text>
                ) : null
              }
              labelLine={false}
            >
              {pieData.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip {...tip} formatter={(v, n) => [v, n]} />
            <Legend
              iconType="circle"
              iconSize={8}
              formatter={(value) => (
                <span style={{ fontSize: 11, color: isDark ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.55)" }}>
                  {value.length > 32 ? value.slice(0, 32) + "…" : value}
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
      <SectionHeader title="Approval Performance" />

      {loading ? (
        <ChartSkeleton height={300} />
      ) : (
        <Stack spacing={3}>
          {/* KPI cards */}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <KpiCard
              label="Avg Submission → Admin Approval"
              value={formatMinutes(data?.avgSubmissionToAdminApproval)}
              isDark={isDark}
            />
            <KpiCard
              label="Avg Admin → SuperAdmin Approval"
              value={formatMinutes(data?.avgAdminToSuperAdminApproval)}
              isDark={isDark}
            />
          </Stack>

          {/* Rejection reasons */}
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
              <Box sx={{ fontSize: "0.9rem", fontWeight: 700 }}>
                Top Rejection Reasons
              </Box>
              <ChartTypeToggle
                options={CHART_TYPES}
                value={chartType}
                onChange={setChartType}
              />
            </Stack>
            {renderReasonsChart()}
          </Box>
        </Stack>
      )}
    </AppCard>
  );
}
