"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Grid,
  Paper,
  Typography,
  Stack,
  Button,
  Chip,
  Avatar,
  Divider,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import { BarChart, PieChart } from "@mui/x-charts";
import ICONS from "@/utils/iconUtil";

const STAT_CARDS = [
  {
    title: "Total Registrations",
    value: "1,280",
    trend: "+12.5%",
    icon: ICONS.appRegister,
    color: "#128199",
  },
  {
    title: "Pending Approvals",
    value: "14",
    trend: "High Priority",
    icon: ICONS.time,
    color: "#ed6c02",
  },
  {
    title: "Checked In Today",
    value: "86",
    trend: "+5.2%",
    icon: ICONS.checkin,
    color: "#2e7d32",
  },
  {
    title: "Active Fields",
    value: "8",
    trend: "Optimized",
    icon: ICONS.form,
    color: "#0077b6",
  },
];

const RECENT_ACTIVITY = [
  { id: 1, name: "Sara Ajaz", action: "Registration Approved", time: "10 mins ago", status: "success" },
  { id: 2, name: "Omar Ali", action: "Checked In at Gate A", time: "25 mins ago", status: "info" },
  { id: 3, name: "Ali Hassan", action: "New Registration", time: "45 mins ago", status: "warning" },
];

export default function CmsDashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [greeting, setGreeting] = useState("Welcome");

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good Morning");
    else if (hour < 17) setGreeting("Good Afternoon");
    else setGreeting("Good Evening");
  }, []);

  return (
    <Box sx={{ maxWidth: 1400, mx: "auto" }}>
      {/* Header Section */}
      <Box sx={{ mb: 5 }}>
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Typography variant="h3" fontWeight={800} sx={{ fontFamily: "'Comfortaa', cursive", mb: 1 }}>
            {greeting}, {user?.name?.split(" ")[0] || "Admin"}
          </Typography>
          <Typography color="text.secondary" variant="body1">
            Explore your visitor analytics and operational insights for today.
          </Typography>
        </motion.div>
      </Box>

      {/* Primary Stats Grid */}
      <Grid container spacing={3} mb={5}>
        {STAT_CARDS.map((card, index) => (
          <Grid item xs={12} sm={6} md={3} key={card.title}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: 4,
                  border: "1px solid rgba(0,0,0,0.06)",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
                  position: "relative",
                  overflow: "hidden",
                  "&:hover": { boxShadow: "0 12px 32px rgba(0,0,0,0.08)", borderColor: card.color },
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 2.5,
                      bgcolor: `${card.color}15`,
                      color: card.color,
                      display: "flex",
                    }}
                  >
                    <card.icon />
                  </Box>
                  <Chip
                    label={card.trend}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      bgcolor: card.trend.includes("+") ? "success.light" : "grey.100",
                      color: card.trend.includes("+") ? "success.dark" : "text.secondary",
                      border: "none",
                    }}
                  />
                </Stack>
                <Typography variant="h4" fontWeight={800} mb={0.5}>
                  {card.value}
                </Typography>
                <Typography variant="body2" color="text.secondary" fontWeight={600}>
                  {card.title}
                </Typography>
              </Paper>
            </motion.div>
          </Grid>
        ))}
      </Grid>

      {/* Charts & Activity Section */}
      <Grid container spacing={3}>
        {/* Registration Volume Chart */}
        <Grid item xs={12} md={8}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 4,
              border: "1px solid rgba(0,0,0,0.06)",
              minHeight: 400,
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
              <Typography variant="h6" fontWeight={700}>Registration Volume</Typography>
              <Button size="small" variant="text" sx={{ fontWeight: 700 }}>Export CSV</Button>
            </Stack>
            <Box sx={{ width: "100%", height: 300 }}>
              <BarChart
                series={[
                  { data: [35, 44, 24, 34, 48, 22, 19, 30, 40, 50, 45, 60], label: "Approved", color: "#128199" },
                  { data: [51, 6, 49, 30, 15, 20, 25, 30, 35, 40, 30, 20], label: "Rejected", color: "rgba(0,0,0,0.1)" },
                ]}
                xAxis={[{ data: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], scaleType: "band" }]}
                height={300}
                slotProps={{ legend: { direction: 'row', position: { vertical: 'top', horizontal: 'middle' }, padding: 0 } }}
              />
            </Box>
          </Paper>
        </Grid>

        {/* Recent Activity */}
        <Grid item xs={12} md={4}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 4,
              border: "1px solid rgba(0,0,0,0.06)",
              height: "100%",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Typography variant="h6" fontWeight={700} mb={3}>Recent Activity</Typography>
            <Stack spacing={3} flexGrow={1}>
              {RECENT_ACTIVITY.map((act) => (
                <Stack key={act.id} direction="row" spacing={2} alignItems="center">
                  <Avatar sx={{ width: 40, height: 40, bgcolor: `${act.status}.light`, color: `${act.status}.dark`, fontWeight: 800, fontSize: "0.8rem" }}>
                    {act.name.charAt(0)}
                  </Avatar>
                  <Box>
                    <Typography variant="body2" fontWeight={700}>{act.name}</Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {act.action} • {act.time}
                    </Typography>
                  </Box>
                </Stack>
              ))}
            </Stack>
            <Button
              fullWidth
              variant="outlined"
              sx={{ mt: 4, borderRadius: 2, fontWeight: 700 }}
              onClick={() => router.push("/cms/registrations")}
            >
              View All Registrations
            </Button>
          </Paper>
        </Grid>

        {/* Status Distribution Pie Chart */}
        <Grid item xs={12} md={6}>
            <Paper
                elevation={0}
                sx={{
                    p: 3,
                    borderRadius: 4,
                    border: "1px solid rgba(0,0,0,0.06)",
                    minHeight: 320,
                }}
            >
                <Typography variant="h6" fontWeight={700} mb={2}>Status Distribution</Typography>
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                    <PieChart
                        series={[
                        {
                            data: [
                            { id: 0, value: 45, label: 'Approved', color: '#128199' },
                            { id: 1, value: 25, label: 'Pending', color: '#ed6c02' },
                            { id: 2, value: 15, label: 'Checked In', color: '#2e7d32' },
                            { id: 3, value: 15, label: 'Rejected', color: '#d32f2f' },
                            ],
                            innerRadius: 80,
                            paddingAngle: 5,
                            cornerRadius: 5,
                        },
                        ]}
                        height={240}
                    />
                </Box>
            </Paper>
        </Grid>

      </Grid>
    </Box>
  );
}
