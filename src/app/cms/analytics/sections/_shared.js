"use client";

import { Box, Button, ButtonGroup, Skeleton, Stack, Typography } from "@mui/material";

// ── Color palette (readable in dark + light) ──────────────────────────────────
export const PALETTE = [
  "#6366f1", "#22d3ee", "#a3e635", "#fb923c", "#f472b6",
  "#4ade80", "#facc15", "#f87171", "#818cf8", "#34d399",
  "#e879f9", "#2dd4bf", "#60a5fa", "#fbbf24", "#a78bfa",
];

// ── Format minutes → "1h 23m" ─────────────────────────────────────────────────
export function formatMinutes(minutes) {
  if (minutes == null) return "—";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ── Recharts style helpers ────────────────────────────────────────────────────
export function tooltipProps(isDark) {
  const textColor = isDark ? "#ffffff" : "#000000";
  return {
    contentStyle: {
      background:   isDark ? "#1a1a2e" : "#ffffff",
      border:       `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)"}`,
      borderRadius: 8,
      fontSize:     12,
      color:        textColor,
      boxShadow:    isDark ? "0 4px 16px rgba(0,0,0,0.5)" : "0 4px 16px rgba(0,0,0,0.1)",
    },
    labelStyle: { color: textColor, fontWeight: 600 },
    itemStyle:  { color: textColor },
    cursor: { fill: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" },
  };
}

export function axisStyle(isDark) {
  const color = isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.38)";
  return {
    tick:     { fontSize: 11, fill: color },
    axisLine: { stroke: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" },
    tickLine: { stroke: "transparent" },
  };
}

export function cartesianGridProps(isDark) {
  return {
    strokeDasharray: "3 3",
    stroke: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
    vertical: false,
  };
}

// ── Chart type toggle ─────────────────────────────────────────────────────────
export function ChartTypeToggle({ options, value, onChange }) {
  return (
    <ButtonGroup size="small" variant="outlined" disableElevation>
      {options.map((opt, i) => (
        <Button
          key={opt}
          variant={value === opt ? "contained" : "outlined"}
          disableElevation
          onClick={() => onChange(opt)}
          sx={{
            px: 1.4,
            py: 0.35,
            fontSize: "0.7rem",
            fontWeight: 700,
            minWidth: "auto",
            borderRadius:
              i === 0
                ? "6px 0 0 6px"
                : i === options.length - 1
                ? "0 6px 6px 0"
                : 0,
          }}
        >
          {opt}
        </Button>
      ))}
    </ButtonGroup>
  );
}

// ── Loading skeleton ───────────────────────────────────────────────────────────
export function ChartSkeleton({ height = 300 }) {
  return (
    <Skeleton
      variant="rounded"
      width="100%"
      height={height}
      sx={{ borderRadius: 2 }}
    />
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
export function EmptyState({ message = "No data for the selected date range", height = 220 }) {
  return (
    <Stack
      alignItems="center"
      justifyContent="center"
      sx={{ height, width: "100%" }}
      spacing={1}
    >
      <Typography variant="body2" color="text.disabled" fontWeight={500}>
        {message}
      </Typography>
    </Stack>
  );
}

// ── Section header row (title + toggle) ──────────────────────────────────────
export function SectionHeader({ title, toggle }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2.5}>
      <Typography variant="h6" fontWeight={700}>
        {title}
      </Typography>
      {toggle}
    </Stack>
  );
}

// ── KPI metric card ───────────────────────────────────────────────────────────
export function KpiCard({ label, value, isDark }) {
  return (
    <Box
      style={{
        backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
        border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}`,
      }}
      sx={{
        p: 2,
        borderRadius: 3,
        minWidth: 140,
      }}
    >
      <Typography variant="h5" fontWeight={800} mb={0.3}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary" fontWeight={500}>
        {label}
      </Typography>
    </Box>
  );
}

// ── Treemap custom cell renderer ──────────────────────────────────────────────
export function TreemapCell({ x, y, width, height, name, value, index }) {
  const fill = PALETTE[index % PALETTE.length];
  return (
    <g>
      <rect
        x={x + 1}
        y={y + 1}
        width={width - 2}
        height={height - 2}
        fill={fill}
        fillOpacity={0.88}
        rx={4}
      />
      {width > 44 && height > 22 && (
        <text
          x={x + width / 2}
          y={y + height / 2 - (height > 40 ? 8 : 0)}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#ffffff"
          fontSize={Math.min(12, width / 6)}
          fontWeight={600}
        >
          {name}
        </text>
      )}
      {width > 60 && height > 44 && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 12}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="rgba(255,255,255,0.75)"
          fontSize={10}
        >
          {value}
        </text>
      )}
    </g>
  );
}
