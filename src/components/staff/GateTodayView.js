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
import useI18nLayout from "@/hooks/useI18nLayout";
import gateStaffTranslations from "@/locales/gateStaff";
import ICONS from "@/utils/iconUtil";
import { formatDate, formatTime } from "@/utils/dateUtils";
import getStartIconSpacing from "@/utils/getStartIconSpacing";
import getChipIconSpacing from "@/utils/getChipIconSpacing";
import ConfirmationDialog from "@/components/modals/ConfirmationDialog";

const STATUS_CONFIG = {
  pending: {
    labelKey: "statusPending",
    color: "warning",
    icon: <ICONS.time fontSize="small" />,
  },
  admin_approved: {
    labelKey: "statusAdminApproved",
    color: "info",
    icon: <ICONS.checkCircleOutline fontSize="small" />,
  },
  approved: {
    labelKey: "statusApproved",
    color: "success",
    icon: <ICONS.checkCircle fontSize="small" />,
  },
  checked_in: {
    labelKey: "statusCheckedIn",
    color: "info",
    icon: <ICONS.login fontSize="small" />,
  },
};

export default function GateTodayView({
  onBack,
  canCheckin = false,
  canCheckout = true,
}) {
  const theme = useTheme();
  const { showMessage } = useMessage();
  const { mode } = useColorMode();
  const { t, dir, language: lang } = useI18nLayout(gateStaffTranslations);
  const isDark = mode === "dark";

  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkOutTarget, setCheckOutTarget] = useState(null);
  const [signingOut, setSigningOut] = useState(false);
  const [checkInTarget, setCheckInTarget] = useState(null);
  const [checkingIn, setCheckingIn] = useState(false);

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
          t.todaySignedOut.replace(
            "{{name}}",
            checkOutTarget.visitor?.fullName || t.gateVisitor,
          ),
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

  const handleCheckIn = async () => {
    if (!checkInTarget) return;
    setCheckingIn(true);
    try {
      const updated = await updateStatus(checkInTarget.id, {
        status: "checked_in",
        clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      // withApiHandler surfaces backend errors (e.g. outside the approved
      // window) as a toast; only handle the success path here.
      if (!updated?.error) {
        showMessage(
          t.todayCheckedIn.replace(
            "{{name}}",
            checkInTarget.visitor?.fullName || t.gateVisitor,
          ),
          "success",
        );
        setVisitors((prev) =>
          prev.map((v) =>
            v.id === checkInTarget.id ? { ...v, status: "checked_in" } : v,
          ),
        );
      }
    } finally {
      setCheckingIn(false);
      setCheckInTarget(null);
    }
  };

  const todayStr = new Date().toLocaleDateString(lang === "ar" ? "ar" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // The backend (/registrations/today) already scopes the list to today's
  // relevant visitors — checked-in visitors plus pending/approved whose window
  // overlaps today, respecting recurring days — so trust that set directly
  // rather than re-filtering here (the gate payload has no approved window).
  const filtered = visitors;
  const onSite = filtered.filter((v) => v.status === "checked_in");
  const expected = filtered.filter((v) => v.status !== "checked_in");

  return (
    <Box
      sx={{
        px: { xs: 2, sm: 3 },
        py: 3,
        ...getStartIconSpacing(dir),
        ...getChipIconSpacing(dir),
      }}
    >
        <Button
          variant="text"
          startIcon={<ICONS.back />}
          onClick={onBack}
          sx={{ mb: { xs: 1.5, sm: 2 }, borderRadius: 2 }}
        >
          {t.todayBackToGate}
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
                {t.gateTodaysVisitors}
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
                  {t.todayOnSite}
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
                  {t.todayExpected}
                </Typography>
              </Box>
              <Divider orientation="vertical" flexItem sx={{ height: 40 }} />
              <Box sx={{ textAlign: "center", flex: { xs: 1, sm: "none" } }}>
                <Typography variant="h4" fontWeight={800} color="success.main">
                  {filtered.length}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t.todayTotal}
                </Typography>
              </Box>
            </Stack>
          </Stack>
        </Paper>

        {loading ? (
          <Box sx={{ textAlign: "center", py: 6 }}>
            <CircularProgress />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              {t.todayLoading}
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
              {t.todayNoVisitors}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {t.todayAllClear.replace("{{date}}", todayStr)}
            </Typography>
          </Paper>
        ) : (
          <>
            {[
              {
                key: "onsite",
                items: onSite,
                label: t.todayOnSite,
                icon: <ICONS.login sx={{ fontSize: 18, color: "info.main" }} />,
              },
              {
                key: "expected",
                items: expected,
                label: t.todayExpected,
                icon: (
                  <ICONS.time sx={{ fontSize: 18, color: "text.secondary" }} />
                ),
              },
            ]
              .filter((section) => section.items.length > 0)
              .map((section) => (
                <Box key={section.key} sx={{ mb: 3 }}>
                  <Stack
                    direction="row"
                    alignItems="center"
                    spacing={1}
                    sx={{ mb: 1.5 }}
                  >
                    {section.icon}
                    <Typography variant="subtitle1" fontWeight={800}>
                      {section.label}
                    </Typography>
                    <Chip
                      label={section.items.length}
                      size="small"
                      sx={{ height: 20, fontWeight: 800 }}
                    />
                  </Stack>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: {
                        xs: "1fr",
                        sm: "repeat(auto-fill, minmax(280px, 1fr))",
                      },
                      gap: { xs: 1.5, sm: 2 },
                    }}
                  >
                    {section.items.map((v) => {
              const sc = STATUS_CONFIG[v.status] || {
                color: "default",
                icon: null,
              };
              const scLabel = sc.labelKey ? t[sc.labelKey] : v.status;
              const name = v.visitor?.fullName || t.gateVisitor;
              const company =
                v.visitor?.organisation || v.visitor?.companyName || null;
              const dept = v.visitor?.department || v.department?.name || null;
              const subtitle =
                [company, dept].filter(Boolean).join("  ·  ") || null;
              const isCheckedIn = v.status === "checked_in";
              const isApproved = v.status === "approved";

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
                          bgcolor: isCheckedIn ? "info.main" : "action.selected",
                          color: isCheckedIn ? "#fff" : "text.primary",
                          fontSize: "0.9rem",
                          fontWeight: 800,
                        }}
                      >
                        {name
                          .split(" ")
                          .map((n) => n[0]?.toUpperCase())
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
                        label={scLabel}
                        color={sc.color}
                        size="small"
                        icon={sc.icon}
                        sx={{ fontWeight: 800, borderRadius: 1.5, height: 24 }}
                      />
                      {v.overstay && (
                        <Chip
                          label={t.gateOverstay}
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
                          label={t.gateVipFastTrack}
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
                          label={t.gateVip}
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
                          label={t.gateParking}
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
                          label={t.gateEscortRequired}
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

                    {isApproved && canCheckin && (
                      <Button
                        fullWidth
                        variant="contained"
                        color="success"
                        size="small"
                        startIcon={<ICONS.login />}
                        onClick={() => setCheckInTarget(v)}
                        sx={{ borderRadius: 2, mt: 0.5 }}
                      >
                        {t.gateCheckIn}
                      </Button>
                    )}

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
                        {t.todaySignOut}
                      </Button>
                    )}
                  </Stack>
                </Paper>
              );
                    })}
                  </Box>
                </Box>
              ))}
          </>
        )}

      <ConfirmationDialog
        open={Boolean(checkInTarget)}
        onClose={() => !checkingIn && setCheckInTarget(null)}
        onConfirm={handleCheckIn}
        title={t.todayCheckInTitle}
        message={t.todayCheckInMessage.replace(
          "{{name}}",
          checkInTarget?.visitor?.fullName || t.gateVisitor,
        )}
        confirmButtonColor="success"
        confirmButtonText={checkingIn ? t.todayCheckingIn : t.gateCheckIn}
        confirmButtonIcon={
          checkingIn ? (
            <CircularProgress size={16} color="inherit" />
          ) : (
            <ICONS.login fontSize="small" />
          )
        }
      />

      <ConfirmationDialog
        open={Boolean(checkOutTarget)}
        onClose={() => !signingOut && setCheckOutTarget(null)}
        onConfirm={handleSignOut}
        title={t.todaySignOutTitle}
        message={t.todaySignOutMessage.replace(
          "{{name}}",
          checkOutTarget?.visitor?.fullName || t.gateVisitor,
        )}
        confirmButtonColor="error"
        confirmButtonText={signingOut ? t.todaySigningOut : t.todaySignOut}
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
