"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Stack,
  Button,
  Chip,
  Avatar,
  Skeleton,
  ToggleButton,
  ToggleButtonGroup,
  LinearProgress,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useColorMode } from "@/contexts/ThemeContext";
import { motion } from "framer-motion";
import { BarChart, PieChart } from "@mui/x-charts";
import { io } from "socket.io-client";
import ICONS from "@/utils/iconUtil";
import AppCard from "@/components/cards/AppCard";
import LiveVisitorsCard from "@/components/dashboard/LiveVisitorsCard";
import ExportDialog from "@/components/dashboard/ExportDialog";
import { getDashboardStats } from "@/services/dashboardService";

const SOCKET_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") ||
  "http://localhost:4000";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// All possible statuses in display order
const ALL_STATUSES = [
  { key: "pending",        label: "Pending",        dark: "rgba(255,200,0,0.8)",   light: "#F59E0B" },
  { key: "admin_approved", label: "Dept. Approved", dark: "rgba(100,180,255,0.8)", light: "#3B82F6" },
  { key: "approved",       label: "Approved",       dark: "#ffffff",               light: "#000000" },
  { key: "checked_in",     label: "Checked In",     dark: "rgba(76,175,80,0.9)",   light: "#16A34A" },
  { key: "checked_out",    label: "Checked Out",    dark: "rgba(160,160,160,0.7)", light: "#6B7280" },
  { key: "rejected",       label: "Rejected",       dark: "rgba(239,68,68,0.8)",   light: "#DC2626" },
  { key: "cancelled",      label: "Cancelled",      dark: "rgba(251,146,60,0.8)",  light: "#EA580C" },
  { key: "visit_ended",    label: "Visit Ended",    dark: "rgba(148,163,184,0.6)", light: "#94A3B8" },
  { key: "expired",        label: "Expired",        dark: "rgba(100,100,100,0.5)", light: "#9CA3AF" },
];

const ACTIVITY_LABELS = {
  submitted:      "New Registration",
  admin_approved: "Admin Approved",
  approved:       "Registration Approved",
  rejected:       "Registration Rejected",
  cancelled:      "Registration Cancelled",
  nda_signed:     "NDA Signed",
  qr_generated:   "QR Generated",
  scanned:        "QR Scanned",
  badge_printed:  "Badge Printed",
  checked_in:     "Checked In",
  checked_out:    "Checked Out",
  visit_ended:    "Visit Ended",
};

const ACTIVITY_STATUS = {
  submitted:      "warning",
  admin_approved: "info",
  approved:       "success",
  rejected:       "error",
  cancelled:      "error",
  checked_in:     "success",
  checked_out:    "info",
  visit_ended:    "default",
};

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function StatCardSkeleton() {
  return (
    <AppCard variant="frosted" sx={{ p: 3, height: "100%" }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
        <Skeleton variant="rounded" width={44} height={44} sx={{ borderRadius: 2.5 }} />
        <Skeleton variant="rounded" width={70} height={20} sx={{ borderRadius: 10 }} />
      </Stack>
      <Skeleton variant="text" width={80} height={48} />
      <Skeleton variant="text" width={120} height={20} />
    </AppCard>
  );
}

export default function CmsDashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { mode } = useColorMode();
  const isDark = mode === "dark";
  const [greeting, setGreeting] = useState("Welcome");
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [period, setPeriod] = useState("today"); // "today" | "week" | "month" | "year" | "all"
  const socketRef = useRef(null);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good Morning");
    else if (hour < 17) setGreeting("Good Afternoon");
    else setGreeting("Good Evening");
  }, []);

  const fetchStats = useCallback(async (p, { silent = false } = {}) => {
    const showInitialLoading = !hasLoadedOnce && !silent;
    if (showInitialLoading) {
      setLoading(true);
    } else if (!silent) {
      setIsRefreshing(true);
    }

    const result = await getDashboardStats(p ?? period);
    if (result && !result.error) {
      setStats(result);
      setHasLoadedOnce(true);
    }
    if (showInitialLoading) setLoading(false);
    if (!silent) setIsRefreshing(false);
  }, [period, hasLoadedOnce]);

  useEffect(() => {
    fetchStats(period);
  }, [period]);

  const handlePeriodChange = (_, newPeriod) => {
    if (newPeriod !== null) setPeriod(newPeriod);
  };

  // Refresh on any registration socket event
  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    const refresh = () => fetchStats(period, { silent: true });
    socket.on("registration:new", refresh);
    socket.on("registration:updated", refresh);
    socket.on("dashboard:live-update", refresh);
    socket.on("dashboard:stats-update", refresh);

    return () => socket.disconnect();
  }, [fetchStats, period]);

  // Build stat cards from live data
  const statCards = [
    {
      title: "Total Registrations",
      value: stats?.totalRegistrations ?? 0,
      trend: null,
      icon: ICONS.appRegister,
    },
    {
      title: "Pending Approvals",
      value: stats?.pendingApprovals ?? 0,
      trend: (stats?.pendingApprovals ?? 0) > 0 ? "Needs Attention" : "All Clear",
      trendPositive: (stats?.pendingApprovals ?? 0) === 0,
      icon: ICONS.time,
    },
    {
      title: "Checked In Today",
      value: stats?.checkedInToday ?? 0,
      trend: null,
      icon: ICONS.checkin,
    },
    {
      title: "Active Fields",
      value: stats?.activeFields ?? 0,
      trend: "Configured",
      trendPositive: null,
      icon: ICONS.form,
    },
  ];

  // Build pie chart data
  const distMap = Object.fromEntries(
    (stats?.statusDistribution ?? []).map((s) => [s.status, s.count])
  );
  const pieData = ALL_STATUSES
    .map((s, i) => ({
      id: i,
      value: distMap[s.key] ?? 0,
      label: s.label,
      color: s[isDark ? "dark" : "light"],
    }))
    .filter((s) => s.value > 0);

  // Build bar chart data from monthlyVolume
  const isMonthlyView = !period || period === "year" || period === "all";
  const volumeData = stats?.monthlyVolume ?? (isMonthlyView
    ? Array.from({ length: 12 }, (_, i) => ({ month: i + 1, approved: 0, rejected: 0 }))
    : []);
  const approvedSeries = volumeData.map((m) => m.approved);
  const rejectedSeries = volumeData.map((m) => m.rejected);
  const volumeXLabels = isMonthlyView
    ? MONTH_LABELS
    : volumeData.map((m) => m.label ?? `Day ${m.month}`);

  return (
    <Box sx={{ maxWidth: 1400, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ mb: 5 }}>
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "flex-start" }}>
            <Box>
              <Typography variant="h3" fontWeight={800} sx={{ fontFamily: "'Comfortaa', cursive", mb: 1 }}>
                {greeting}, {user?.name?.split(" ")[0] || "Admin"}
              </Typography>
              <Typography color="text.secondary" variant="body1">
                Explore your visitor analytics and operational insights for today.
              </Typography>
            </Box>
            <Button
              variant="outlined"
              startIcon={<ICONS.download />}
              onClick={() => setExportOpen(true)}
              sx={{ borderRadius: 3, px: 3, py: 1, fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0, mt: { xs: 2, sm: 0 } }}
            >
              Export Report
            </Button>
          </Stack>
        </motion.div>
      </Box>

      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />

      {/* Period filter toggle */}
      <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between" sx={{ mb: 4 }} spacing={2}>
        <ToggleButtonGroup
          value={period}
          exclusive
          onChange={handlePeriodChange}
          size="small"
          sx={{
            bgcolor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
            borderRadius: 3,
            p: 0.5,
            "& .MuiToggleButton-root": {
              border: "none",
              borderRadius: "10px !important",
              px: 2,
              py: 0.6,
              fontWeight: 700,
              fontSize: "0.78rem",
              textTransform: "none",
              "&.Mui-selected": {
                bgcolor: isDark ? "rgba(255,255,255,0.15)" : "background.paper",
                boxShadow: isDark ? "0 4px 12px rgba(0,0,0,0.3)" : "0 2px 8px rgba(0,0,0,0.1)",
                color: "text.primary",
              },
            },
          }}
        >
          {[
            { value: "today", label: "Today" },
            { value: "week", label: "This Week" },
            { value: "month", label: "This Month" },
            { value: "year", label: "This Year" },
            { value: "all", label: "All Time" },
          ].map(({ value, label }) => (
            <ToggleButton key={value} value={value}>{label}</ToggleButton>
          ))}
        </ToggleButtonGroup>
        {stats?.period && (
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            Showing: {stats.period}
          </Typography>
        )}
      </Stack>

      {isRefreshing && !loading && (
        <LinearProgress sx={{ mb: 3, height: 4, borderRadius: 2 }} />
      )}

      {/* Primary Stats Grid */}
      <Grid container spacing={3} mb={5}>
        {statCards.map((card, index) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={card.title}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              {loading ? (
                <StatCardSkeleton />
              ) : (
                <AppCard
                  variant="frosted"
                  sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: 2.5,
                        bgcolor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
                        color: isDark ? "#ffffff" : "#000000",
                        display: "flex",
                      }}
                    >
                      <card.icon />
                    </Box>
                    {card.trend && (
                      <Chip
                        label={card.trend}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          bgcolor:
                            card.trendPositive === true
                              ? isDark ? "rgba(46,125,50,0.2)" : "success.light"
                              : card.trendPositive === false
                              ? isDark ? "rgba(211,47,47,0.2)" : "error.light"
                              : isDark ? "rgba(255,255,255,0.1)" : "grey.100",
                          color:
                            card.trendPositive === true
                              ? isDark ? "#81c784" : "success.dark"
                              : card.trendPositive === false
                              ? "#ffffff"
                              : isDark ? "rgba(255,255,255,0.7)" : "text.secondary",
                          border: "none",
                        }}
                      />
                    )}
                  </Stack>
                  <Typography variant="h4" fontWeight={800} mb={0.5}>
                    {card.value.toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" fontWeight={600}>
                    {card.title}
                  </Typography>
                </AppCard>
              )}
            </motion.div>
          </Grid>
        ))}
      </Grid>

      {/* Charts & Activity Section */}
      <Grid container spacing={3}>
        {/* Registration Volume Bar Chart */}
        <Grid size={{ xs: 12, md: 8 }}>
          <AppCard variant="frosted" sx={{ p: 3, minHeight: 400 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
              <Typography variant="h6" fontWeight={700}>Registration Volume</Typography>
              {stats?.period && <Typography variant="caption" color="text.secondary" fontWeight={600}>{stats.period}</Typography>}
            </Stack>
            {loading ? (
              <Skeleton variant="rounded" width="100%" height={300} />
            ) : (
              <Box sx={{ width: "100%", height: 300 }}>
                <BarChart
                  series={[
                    {
                      data: approvedSeries,
                      label: "Approved",
                      color: isDark ? "#ffffff" : "#000000",
                    },
                    {
                      data: rejectedSeries,
                      label: "Rejected",
                      color: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)",
                    },
                  ]}
                  xAxis={[{ data: volumeXLabels, scaleType: "band" }]}
                  height={300}
                  slotProps={{
                    legend: {
                      direction: "row",
                      position: { vertical: "top", horizontal: "middle" },
                      padding: 0,
                    },
                  }}
                />
              </Box>
            )}
          </AppCard>
        </Grid>

        {/* Recent Activity */}
        <Grid size={{ xs: 12, md: 4 }}>
          <AppCard
            variant="frosted"
            sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column" }}
          >
            <Typography variant="h6" fontWeight={700} mb={3}>Recent Activity</Typography>
            {loading ? (
              <Stack spacing={3}>
                {[1, 2, 3].map((i) => (
                  <Stack key={i} direction="row" spacing={2} alignItems="center">
                    <Skeleton variant="circular" width={40} height={40} />
                    <Box sx={{ flex: 1 }}>
                      <Skeleton variant="text" width="60%" />
                      <Skeleton variant="text" width="80%" />
                    </Box>
                  </Stack>
                ))}
              </Stack>
            ) : (
              <Stack spacing={3} flexGrow={1}>
                {(stats?.recentActivity ?? []).length === 0 ? (
                  <Typography variant="body2" color="text.disabled">No recent activity</Typography>
                ) : (
                  (stats?.recentActivity ?? []).map((act) => {
                    const statusKey = ACTIVITY_STATUS[act.activityType] ?? "default";
                    const label = ACTIVITY_LABELS[act.activityType] ?? act.activityType;
                    return (
                      <Stack key={act.id} direction="row" spacing={2} alignItems="center">
                        <Avatar
                          sx={{
                            width: 40,
                            height: 40,
                            bgcolor: `${statusKey}.light`,
                            color: `${statusKey}.dark`,
                            fontWeight: 800,
                            fontSize: "0.8rem",
                          }}
                        >
                          {act.visitorName.charAt(0).toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight={700}>
                            {act.visitorName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block">
                            {label} • {timeAgo(act.createdAt)}
                          </Typography>
                        </Box>
                      </Stack>
                    );
                  })
                )}
              </Stack>
            )}
            <Button
              fullWidth
              variant="outlined"
              startIcon={<ICONS.list />}
              sx={{ mt: 4, borderRadius: 3, px: 3, py: 1, fontWeight: 700 }}
              onClick={() => router.push("/cms/visitors")}
            >
              View All Visitors
            </Button>
          </AppCard>
        </Grid>

        {/* Status Distribution Pie Chart */}
        <Grid size={{ xs: 12, md: 6 }}>
          <AppCard variant="frosted" sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={700} mb={1}>Status Distribution</Typography>
            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center" }}>
                <Skeleton variant="circular" width={170} height={170} />
              </Box>
            ) : pieData.length === 0 ? (
              <Typography variant="body2" color="text.disabled" sx={{ mt: 2 }}>
                No registration data yet
              </Typography>
            ) : (
              <Box sx={{ display: "flex", justifyContent: "center" }}>
                <PieChart
                  series={[
                    {
                      data: pieData,
                      innerRadius: 55,
                      paddingAngle: 5,
                      cornerRadius: 5,
                    },
                  ]}
                  height={170}
                />
              </Box>
            )}
          </AppCard>
        </Grid>

        {/* Live Visitors Card */}
        <Grid size={{ xs: 12, md: 6 }}>
          <LiveVisitorsCard />
        </Grid>
      </Grid>
    </Box>
  );
}
