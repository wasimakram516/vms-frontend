"use client";

import { useCallback, useEffect, useState } from "react";
import { Box, Chip, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend, Treemap,
  FunnelChart, Funnel, LabelList,
} from "recharts";
import { useColorMode } from "@/contexts/ThemeContext";
import AppCard from "@/components/cards/AppCard";
import { getFunnel, getBreakdown } from "@/services/analyticsService";
import {
  PALETTE, axisStyle, cartesianGridProps, tooltipProps,
  ChartTypeToggle, ChartSkeleton, EmptyState, SectionHeader, TreemapCell,
} from "./_shared";

const FUNNEL_TYPES    = ["Funnel", "Horizontal Bar"];
const CATEGORY_TYPES  = ["Bar", "Pie", "Donut"];
const DEPT_TYPES      = ["Bar", "Pie", "Donut", "Treemap"];
const TRIGGERS        = ["new_registration", "status_change", "check_in", "check_out"];

// ── Pie / Donut ───────────────────────────────────────────────────────────────
function PieDonut({ data, donut, isDark }) {
  const tip = tooltipProps(isDark);
  const labelFill = isDark ? "#ffffff" : "#222222";
  return (
    <Box sx={{ width: "100%", height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={donut ? "45%" : 0}
            outerRadius="72%"
            paddingAngle={donut ? 3 : 1}
            label={({ x, y, percent }) =>
              percent > 0.05 ? (
                <text x={x} y={y} fill={labelFill} textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
                  {`${(percent * 100).toFixed(0)}%`}
                </text>
              ) : null
            }
            labelLine={false}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip
            {...tip}
            formatter={(v, name) => [v, name]}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => (
              <span style={{ fontSize: 11, color: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.6)" }}>
                {value}
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </Box>
  );
}

// ── Horizontal bar ────────────────────────────────────────────────────────────
function HorizontalBar({ data, nameKey = "name", valueKey = "count", isDark }) {
  const tip  = tooltipProps(isDark);
  const ax   = axisStyle(isDark);
  const grid = cartesianGridProps(isDark);
  const labelWidth = Math.min(140, Math.max(80, ...data.map((d) => d[nameKey]?.length * 7)));

  return (
    <Box sx={{ width: "100%", height: Math.max(180, data.length * 36 + 40) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 4, right: 40, left: 0, bottom: 4 }}
        >
          <CartesianGrid {...grid} horizontal={false} vertical />
          <XAxis type="number" {...ax} />
          <YAxis type="category" dataKey={nameKey} width={labelWidth} {...ax} />
          <Tooltip {...tip} formatter={(v) => [v, "Count"]} />
          <Bar dataKey={valueKey} radius={[0, 4, 4, 0]} maxBarSize={22}>
            {data.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}

// ── Vertical bar ──────────────────────────────────────────────────────────────
function VerticalBar({ data, isDark }) {
  const tip  = tooltipProps(isDark);
  const ax   = axisStyle(isDark);
  const grid = cartesianGridProps(isDark);
  const barSz = data.length > 10 ? 14 : 22;

  return (
    <Box sx={{ width: "100%", height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 36 }}>
          <CartesianGrid {...grid} />
          <XAxis dataKey="name" {...ax} angle={-35} textAnchor="end" height={52} interval={0} />
          <YAxis {...ax} />
          <Tooltip {...tip} formatter={(v) => [v, "Count"]} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={barSz}>
            {data.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}

// ── Category sub-card ─────────────────────────────────────────────────────────
function CategoryCard({ title, data, typeOptions }) {
  const { mode } = useColorMode();
  const isDark   = mode === "dark";
  const [chartType, setChartType] = useState(typeOptions[0]);

  const renderChart = () => {
    if (!data || data.length === 0) return <EmptyState height={240} />;

    if (chartType === "Bar")     return <VerticalBar data={data} isDark={isDark} />;
    if (chartType === "Pie")     return <PieDonut data={data} donut={false} isDark={isDark} />;
    if (chartType === "Donut")   return <PieDonut data={data} donut isDark={isDark} />;
    if (chartType === "Treemap") {
      return (
        <Box sx={{ width: "100%", height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <Treemap
              data={data.map((d) => ({ name: d.name, size: d.count }))}
              dataKey="size"
              aspectRatio={4 / 3}
              stroke="transparent"
              content={<TreemapCell />}
            />
          </ResponsiveContainer>
        </Box>
      );
    }
    return null;
  };

  return (
    <AppCard interactive={false} sx={{ p: 2.5, height: "100%" }}>
      <SectionHeader
        title={title}
        toggle={
          <ChartTypeToggle
            options={typeOptions}
            value={chartType}
            onChange={setChartType}
          />
        }
      />
      {renderChart()}
    </AppCard>
  );
}

// ── Funnel chart ──────────────────────────────────────────────────────────────
function FunnelView({ stages, isDark }) {
  const funnelData = stages.map((s, i) => ({
    value: s.count,
    name:  s.label,
    fill:  PALETTE[i % PALETTE.length],
  }));
  const tip = tooltipProps(isDark);

  return (
    <Box sx={{ width: "100%", height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <FunnelChart margin={{ top: 4, right: 100, bottom: 4, left: 0 }}>
          <Tooltip
            {...tip}
            formatter={(v, name) => [v, name]}
          />
          <Funnel dataKey="value" data={funnelData} isAnimationActive lastShapeType="rectangle">
            <LabelList
              position="center"
              dataKey="value"
              fill="#ffffff"
              style={{ fontSize: 13, fontWeight: 700 }}
            />
            <LabelList
              position="right"
              dataKey="name"
              fill={isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.6)"}
              style={{ fontSize: 12 }}
            />
          </Funnel>
        </FunnelChart>
      </ResponsiveContainer>
    </Box>
  );
}

// ── Drop-off annotation row ───────────────────────────────────────────────────
function DropOffRow({ stages }) {
  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" mt={1.5} gap={1}>
      {stages.slice(1).map((s, i) => (
        s.dropOffPercent > 0 && (
          <Chip
            key={i}
            label={`↓ ${s.dropOffPercent}% drop-off before ${s.label}`}
            size="small"
            variant="outlined"
            sx={{ fontSize: "0.7rem", fontWeight: 600, borderRadius: 2 }}
          />
        )
      ))}
    </Stack>
  );
}

// ── Main section ──────────────────────────────────────────────────────────────
export default function FunnelSection({ from, to, lastTrigger, funnelCardRef, breakdownRef }) {
  const { mode } = useColorMode();
  const isDark   = mode === "dark";

  const [funnelData,    setFunnelData]    = useState(null);
  const [breakdownData, setBreakdownData] = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [funnelType,    setFunnelType]    = useState("Funnel");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [f, b] = await Promise.all([getFunnel(from, to), getBreakdown(from, to)]);
    if (f && !f.error) setFunnelData(f);
    if (b && !b.error) setBreakdownData(b);
    setLoading(false);
  }, [from, to]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (lastTrigger && TRIGGERS.includes(lastTrigger.type)) fetchData();
  }, [lastTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  const stages = funnelData?.stages ?? [];

  return (
    <Stack spacing={3}>

      {/* ── Funnel card ─────────────────────────────────────────────────── */}
      <div ref={funnelCardRef}>
      <AppCard interactive={false} sx={{ p: 3 }}>
        <SectionHeader
          title="Visitor Funnel"
          toggle={
            <ChartTypeToggle
              options={FUNNEL_TYPES}
              value={funnelType}
              onChange={setFunnelType}
            />
          }
        />

        {loading ? (
          <ChartSkeleton height={280} />
        ) : stages.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {funnelType === "Funnel" ? (
              <FunnelView stages={stages} isDark={isDark} />
            ) : (
              <HorizontalBar
                data={stages.map((s) => ({ name: s.label, count: s.count }))}
                isDark={isDark}
              />
            )}

            <DropOffRow stages={stages} />

            {/* KPI chips */}
            <Stack direction="row" spacing={1.5} mt={2} flexWrap="wrap" gap={1}>
              <Chip
                label={`Rejection Rate: ${funnelData?.rejectionRate ?? 0}%`}
                size="small"
                color="error"
                variant="outlined"
                sx={{ fontWeight: 700, fontSize: "0.75rem" }}
              />
              <Chip
                label={`Cancellation Rate: ${funnelData?.cancellationRate ?? 0}%`}
                size="small"
                color="warning"
                variant="outlined"
                sx={{ fontWeight: 700, fontSize: "0.75rem" }}
              />
            </Stack>
          </>
        )}
      </AppCard>
      </div>

      {/* ── Category breakdown ──────────────────────────────────────────── */}
      <div ref={breakdownRef}>
      {loading ? (
        <Grid container spacing={3}>
          {[0, 1, 2].map((i) => (
            <Grid key={i} size={{ xs: 12, md: 4 }}>
              <ChartSkeleton height={300} />
            </Grid>
          ))}
        </Grid>
      ) : (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 4 }}>
            <CategoryCard
              title="By Department"
              data={breakdownData?.byDepartment ?? []}
              typeOptions={DEPT_TYPES}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <CategoryCard
              title="By Purpose of Visit"
              data={breakdownData?.byPurpose ?? []}
              typeOptions={CATEGORY_TYPES}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <CategoryCard
              title="By Access Level"
              data={breakdownData?.byAccessLevel ?? []}
              typeOptions={CATEGORY_TYPES}
            />
          </Grid>
        </Grid>
      )}
      </div>

    </Stack>
  );
}
