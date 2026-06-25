"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";

import { getTodayVisitors, updateStatus } from "@/services/registrationService";
import { useMessage } from "@/contexts/MessageContext";
import { useColorMode } from "@/contexts/ThemeContext";
import ICONS from "@/utils/iconUtil";
import { formatDate, formatTime } from "@/utils/dateUtils";
import ConfirmationDialog from "@/components/modals/ConfirmationDialog";

const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    color: "warning",
    icon: <ICONS.time fontSize="small" />,
  },
  admin_approved: {
    label: "Dept. Approved",
    color: "info",
    icon: <ICONS.checkCircleOutline fontSize="small" />,
  },
  approved: {
    label: "Approved",
    color: "success",
    icon: <ICONS.checkCircle fontSize="small" />,
  },
  checked_in: {
    label: "Checked In",
    color: "info",
    icon: <ICONS.login fontSize="small" />,
  },
};

export default function GateTodayView({ onBack, canCheckout = true }) {
  const theme = useTheme();
  const { showMessage } = useMessage();
  const { mode } = useColorMode();
  const isDark = mode === "dark";

  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkOutTarget, setCheckOutTarget] = useState(null);
  const [signingOut, setSigningOut] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTodayVisitors();
      setVisitors(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSignOut = async () => {
    if (!checkOutTarget) return;
    setSigningOut(true);
    try {
      const updated = await updateStatus(checkOutTarget.id, {
        status: "checked_out",
        clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      if (!updated?.error) {
        showMessage(
          `${checkOutTarget.visitor?.fullName || "Visitor"} signed out`,
          "success",
        );
        setVisitors((prev) =>
          prev.map((v) =>
            v.id === checkOutTarget.id ? { ...v, status: "checked_out" } : v,
          ),
        );
      }
    } finally {
      setSigningOut(false);
      setCheckOutTarget(null);
    }
  };

  const todayStr = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const filtered = visitors.filter((v) => {
    if (v.status === "checked_in") return true;
    const from = new Date(v.approved_from || v.approvedFrom);
    const to = new Date(v.approved_to || v.approvedTo);
    if (isNaN(from.getTime()) || isNaN(to.getTime())) return false;
    return from <= todayEnd && to >= todayStart;
  });
  const onSite = filtered.filter((v) => v.status === "checked_in");
  const expected = filtered.filter((v) => v.status !== "checked_in");

  return (
    <Box
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1300,
        bgcolor: "background.default",
        overflow: "auto",
        px: { xs: 1.5, sm: 3 },
        py: { xs: 1.5, sm: 3 },
      }}
    >
      <Box sx={{ maxWidth: 1400, mx: "auto" }}>
        <Button
          variant="text"
          startIcon={<ICONS.back />}
          onClick={onBack}
          sx={{ mb: { xs: 1.5, sm: 2 }, borderRadius: 2 }}
        >
          Back to Gate Check-in
        </Button>

        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, sm: 3 },
            borderRadius: 4,
            mb: { xs: 2, sm: 3 },
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Stack
            direction={{ xs: "column", sm: "row" }}
            alignItems={{ xs: "flex-start", sm: "center" }}
            justifyContent="space-between"
            spacing={{ xs: 1.5, sm: 0 }}
          >
            <Box>
              <Typography variant="h5" fontWeight={800}>
                <ICONS.event
                  fontSize="inherit"
                  sx={{ mr: 1, verticalAlign: "middle", opacity: 0.7 }}
                />
                Today&apos;s Visitors
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.5 }}
              >
                {todayStr}
              </Typography>
            </Box>
            <Stack
              direction="row"
              spacing={{ xs: 3, sm: 2 }}
              alignItems="center"
              sx={{ alignSelf: { xs: "stretch", sm: "auto" } }}
            >
              <Box sx={{ textAlign: "center", flex: { xs: 1, sm: "none" } }}>
                <Typography variant="h4" fontWeight={800} color="info.main">
                  {onSite.length}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  On-Site
                </Typography>
              </Box>
              <Divider orientation="vertical" flexItem sx={{ height: 40 }} />
              <Box sx={{ textAlign: "center", flex: { xs: 1, sm: "none" } }}>
                <Typography
                  variant="h4"
                  fontWeight={800}
                  color="text.secondary"
                >
                  {expected.length}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Expected
                </Typography>
              </Box>
              <Divider orientation="vertical" flexItem sx={{ height: 40 }} />
              <Box sx={{ textAlign: "center", flex: { xs: 1, sm: "none" } }}>
                <Typography variant="h4" fontWeight={800} color="success.main">
                  {filtered.length}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Total
                </Typography>
              </Box>
            </Stack>
          </Stack>
        </Paper>

        {loading ? (
          <Box sx={{ textAlign: "center", py: 6 }}>
            <CircularProgress />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Loading today&apos;s visitors…
            </Typography>
          </Box>
        ) : filtered.length === 0 ? (
          <Paper
            elevation={0}
            sx={{
              p: 4,
              borderRadius: 4,
              textAlign: "center",
              bgcolor: "background.paper",
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <ICONS.checkCircle
              sx={{ fontSize: 48, color: "success.main", mb: 1 }}
            />
            <Typography fontWeight={700} color="success.main">
              No visitors expected today
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              All clear for {todayStr}
            </Typography>
          </Paper>
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(auto-fill, minmax(260px, 1fr))",
              },
              gap: { xs: 1.5, sm: 2 },
            }}
          >
            {filtered.map((v) => {
              const sc = STATUS_CONFIG[v.status] || {
                label: v.status,
                color: "default",
                icon: null,
              };
              const name = v.visitor?.fullName || "Visitor";
              const company =
                v.visitor?.organisation || v.visitor?.companyName || null;
              const dept = v.visitor?.department || v.department?.name || null;
              const subtitle =
                [company, dept].filter(Boolean).join("  ·  ") || null;
              const isCheckedIn = v.status === "checked_in";

              return (
                <Paper
                  key={v.id}
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: 3,
                    border: "1px solid",
                    borderColor: isCheckedIn
                      ? isDark
                        ? "rgba(144,202,249,0.3)"
                        : "rgba(25,118,210,0.2)"
                      : "divider",
                    bgcolor: "background.paper",
                    transition: "all 0.2s",
                    "&:hover": {
                      borderColor: isCheckedIn
                        ? "info.main"
                        : theme.palette.action.hover,
                    },
                  }}
                >
                  <Stack spacing={1.5}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Avatar
                        sx={{
                          width: 40,
                          height: 40,
                          bgcolor: isDark ? "#fff" : "#000",
                          color: isDark ? "#000" : "#fff",
                          fontSize: "0.9rem",
                          fontWeight: 800,
                        }}
                      >
                        {name
                          .split(" ")
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("") || "?"}
                      </Avatar>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography fontWeight={700} noWrap>
                          {name}
                        </Typography>
                        {subtitle && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: "block", lineHeight: 1.3 }}
                          >
                            {subtitle}
                          </Typography>
                        )}
                      </Box>
                    </Stack>

                    <Stack
                      direction="row"
                      spacing={0.6}
                      flexWrap="wrap"
                      useFlexGap
                    >
                      <Chip
                        label={sc.label}
                        color={sc.color}
                        size="small"
                        icon={sc.icon}
                        sx={{ fontWeight: 800, borderRadius: 1.5, height: 24 }}
                      />
                      {v.overstay && (
                        <Chip
                          label="Overstay"
                          color="error"
                          size="small"
                          sx={{
                            fontWeight: 800,
                            borderRadius: 1.5,
                            height: 24,
                          }}
                        />
                      )}
                      {(v.isVipFastTrack || v.is_vip_fast_track) && (
                        <Chip
                          icon={<ICONS.star style={{ fontSize: 14 }} />}
                          label="VIP Fast Track"
                          color="warning"
                          size="small"
                          sx={{
                            fontWeight: 800,
                            borderRadius: 1.5,
                            height: 24,
                          }}
                        />
                      )}
                      {(v.isVip || v.is_vip) && (
                        <Chip
                          icon={<ICONS.star style={{ fontSize: 14 }} />}
                          label="VIP"
                          size="small"
                          sx={{
                            fontWeight: 800,
                            borderRadius: 1.5,
                            height: 24,
                            bgcolor: "success.main",
                            color: isDark ? "#000" : "#fff",
                            "& .MuiChip-icon": {
                              color: isDark ? "#000" : "#fff",
                            },
                          }}
                        />
                      )}
                      {(v.allowParking || v.allow_parking) && (
                        <Chip
                          icon={<ICONS.parking style={{ fontSize: 14 }} />}
                          label="Parking"
                          size="small"
                          sx={{
                            fontWeight: 800,
                            borderRadius: 1.5,
                            height: 24,
                            bgcolor: isDark ? "#CE93D8" : "#6A0DAD",
                            color: isDark ? "#000" : "#fff",
                            "& .MuiChip-icon": {
                              color: isDark ? "#000" : "#fff",
                            },
                          }}
                        />
                      )}
                      {(v.escort_required ?? v.escortRequired ?? true) && (
                        <Chip
                          icon={<ICONS.security style={{ fontSize: 14 }} />}
                          label="Escort Required"
                          size="small"
                          sx={{
                            fontWeight: 800,
                            borderRadius: 1.5,
                            height: 24,
                            bgcolor: isDark ? "#FF8A65" : "#E64A19",
                            color: "#fff",
                            "& .MuiChip-icon": { color: "#fff" },
                          }}
                        />
                      )}
                    </Stack>

                    {(() => {
                      const from = v.approved_from || v.approvedFrom || v.requestedFrom || v.requested_from;
                      const to = v.approved_to || v.approvedTo || v.requestedTo || v.requested_to;
                      if (!from || !to) return null;
                      const sameDay =
                        new Date(from).toDateString() ===
                        new Date(to).toDateString();
                      const label = sameDay
                        ? `${formatTime(from)} – ${formatTime(to)}`
                        : `${formatDate(from)} ${formatTime(from)} – ${formatDate(to)} ${formatTime(to)}`;
                      return (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
                        >
                          <ICONS.time fontSize="inherit" sx={{ opacity: 0.6 }} />
                          {label}
                        </Typography>
                      );
                    })()}

                    {isCheckedIn && canCheckout && (
                      <Button
                        fullWidth
                        variant="outlined"
                        color="error"
                        size="small"
                        startIcon={<ICONS.logout />}
                        onClick={() => setCheckOutTarget(v)}
                        sx={{ borderRadius: 2, mt: 0.5 }}
                      >
                        Sign Out
                      </Button>
                    )}
                  </Stack>
                </Paper>
              );
            })}
          </Box>
        )}
      </Box>

      <ConfirmationDialog
        open={Boolean(checkOutTarget)}
        onClose={() => !signingOut && setCheckOutTarget(null)}
        onConfirm={handleSignOut}
        title="Sign Out Visitor"
        message={`Sign out ${checkOutTarget?.visitor?.fullName || "this visitor"}?`}
        confirmButtonText={signingOut ? "Signing Out…" : "Sign Out"}
        confirmButtonIcon={
          signingOut ? (
            <CircularProgress size={16} color="inherit" />
          ) : (
            <ICONS.logout fontSize="small" />
          )
        }
      />
    </Box>
  );
}
