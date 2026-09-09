"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Chip,
  Stack,
  Dialog,
  DialogContent,
  Button,
  Divider,
  Avatar,
  Tabs,
  Tab,
  CircularProgress,
  alpha,
} from "@mui/material";
import { useColorMode } from "@/contexts/ThemeContext";
import {
  formatPhoneNumberForDisplay,
} from "@/utils/countryCodes";
import ICONS from "@/utils/iconUtil";
import api from "@/services/api";
import DialogHeader from "@/components/modals/DialogHeader";
import NoDataAvailable from "@/components/NoDataAvailable";
import { getRegistrations, getRegistrationActivityLogs, exportVisitorHistoryCsv } from "@/services/registrationService";
import { logVisitHistoryExported } from "@/services/activityService";
import { formatDateTimeWithLocale } from "@/utils/dateUtils";
import { formatActorLabel } from "@/utils/actorLabel";
import HistoryVisitCard from "@/components/visitors/HistoryVisitCard";

const ACTIVITY_LABELS = {
  submitted: "New Registration",
  admin_approved: "Admin Approved",
  approved: "Registration Approved",
  rejected: "Registration Rejected",
  cancelled: "Registration Cancelled",
  nda_signed: "NDA Signed",
  qr_generated: "QR Generated",
  scanned: "QR Scanned",
  badge_printed: "Badge Printed",
  checked_in: "Checked In",
  checked_out: "Checked Out",
  visit_ended: "Visit Ended",
  status_override: "Status Override",
};

const ACTIVITY_COLORS = {
  submitted: "warning",
  admin_approved: "info",
  approved: "success",
  rejected: "error",
  cancelled: "error",
  nda_signed: "info",
  qr_generated: "info",
  scanned: "info",
  badge_printed: "info",
  checked_in: "success",
  checked_out: "info",
  visit_ended: "grey",
  status_override: "warning",
};

function toTitleCase(str) {
  if (!str) return "";
  return str.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getVisibleFieldValues(registration) {
  const raw = registration?.fieldValues || registration?.field_values || [];
  const map = {};
  const nk = (s = "") => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (Array.isArray(raw)) {
    raw.forEach((fv) => {
      const key = fv.customField?.fieldKey || fv.custom_field?.field_key;
      if (!key) return;
      const k = nk(key);
      const l = nk(fv.customField?.label);
      if (
        k.includes("purposeofvisit") ||
        k === "purpose" ||
        l.includes("purposeofvisit") ||
        l === "purpose"
      )
        return;
      if (
        k.includes("pleasespecify") ||
        k.includes("otherspecify") ||
        k.includes("otherpurpose") ||
        l.includes("pleasespecify") ||
        (l.includes("other") && l.includes("specify"))
      )
        return;
      if (
        k === "other" ||
        k.includes("otherdetails") ||
        l === "other" ||
        l.includes("otherdetails")
      )
        return;
      map[key] = fv.value;
    });
  }
  return map;
}

function mergeFieldValuesAcrossHistory(registrations) {
  const merged = {};
  [...(registrations || [])].reverse().forEach((reg) => {
    const visible = getVisibleFieldValues(reg);
    Object.entries(visible).forEach(([key, val]) => {
      if (val != null && String(val).trim() !== "") {
        merged[key] = val;
      }
    });
  });
  return merged;
}

const INITIAL_TIMELINE = { open: false, visitId: null, visitorName: "" };

export default function VisitorDetailsDialog({ open, visitorId, seed, onClose }) {
  const { mode } = useColorMode();
  const isDark = mode === "dark";
  const [visitor, setVisitor] = useState(null);
  const [tab, setTab] = useState("details");
  const [loading, setLoading] = useState(false);
  const [csvExportLoading, setCsvExportLoading] = useState(false);
  const [timelineModal, setTimelineModal] = useState(INITIAL_TIMELINE);
  const [timelineLogs, setTimelineLogs] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [memberDialog, setMemberDialog] = useState({ open: false, member: null });

  const fetchVisitor = useCallback(async () => {
    if (!open || !visitorId) {
      setVisitor(null);
      setTab("details");
      return;
    }
    setLoading(true);
    setTab("details");
    setTimelineModal(INITIAL_TIMELINE);
    setMemberDialog({ open: false, member: null });
    let account = null;
    try {
      const res = await api.get(`/users/for-visitors/${visitorId}`);
      const raw = res.data?.data || res.data;
      if (raw) account = raw;
    } catch {
      account = null;
    }
    let history = [];
    try {
      const regs = await getRegistrations(null, {}, visitorId);
      history = Array.isArray(regs) ? regs : [];
    } catch {
      history = [];
    }
    const s = seed || {};
    const idNo = account?.idNo || s.idNo || s.id_no || null;
    const idType = account?.idType || s.idType || null;
    const idCountry = account?.idCountry || s.idCountry || null;
    setVisitor({
      id: visitorId,
      fullName:
        account?.fullName || account?.full_name || s.fullName || s.full_name || "—",
      email: account?.email || s.email || null,
      phone: account?.phone || s.phone || null,
      iso_code: account?.iso_code || account?.phoneIsoCode || s.iso_code || s.isoCode || null,
      idNo,
      idType,
      idCountry,
      _idValue: idNo,
      _idLabel: idType || "ID",
      history,
      fields: mergeFieldValuesAcrossHistory(history),
    });
    setLoading(false);
  }, [open, visitorId, seed]);

  useEffect(() => {
    fetchVisitor();
  }, [fetchVisitor]);

  const openTimeline = async (visitId, visitorName) => {
    setTimelineLoading(true);
    setTimelineModal({ open: true, visitId, visitorName });
    try {
      const logs = await getRegistrationActivityLogs(visitId);
      setTimelineLogs(Array.isArray(logs) ? logs : []);
    } catch {
      setTimelineLogs([]);
    } finally {
      setTimelineLoading(false);
    }
  };

  const handleExportCsv = async () => {
    const regId = visitor?.history?.[0]?.id;
    if (!regId) return;
    setCsvExportLoading(true);
    try {
      await exportVisitorHistoryCsv(regId);
      logVisitHistoryExported({
        registrationId: regId,
        visitorId: visitor?.id,
        visitorName: visitor?.fullName,
        visitorIdNo: visitor?.idNo,
        visitorIdType: visitor?.idType,
        visitorIdCountry: visitor?.idCountry,
      });
    } catch {
      // silent — export is best-effort
    } finally {
      setCsvExportLoading(false);
    }
  };

  const closeAll = () => {
    if (timelineModal.open) setTimelineModal(INITIAL_TIMELINE);
    else onClose?.();
  };

  return (
    <Dialog
      open={open}
      onClose={closeAll}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { borderRadius: 4, overflow: "hidden" } }}
    >
      <DialogHeader title="Visitor Details" onClose={onClose}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          alignItems={{ xs: "flex-start", sm: "center" }}
          justifyContent="space-between"
          sx={{ flex: 1, gap: 1 }}
        >
          <Typography variant="h6" fontWeight={800}>
            Visitor Details
          </Typography>
<Button
                size="small"
                variant="outlined"
                startIcon={
                  csvExportLoading ? (
                    <CircularProgress size={13} color="inherit" />
                  ) : (
                    <ICONS.download fontSize="small" />
                  )
                }
                onClick={handleExportCsv}
                disabled={csvExportLoading || !visitor?.history?.[0]}
                sx={{
                  borderRadius: 30,
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                  width: { xs: "100%", sm: "auto" },
                }}
              >
                Export Visit History
              </Button>
            </Stack>
      </DialogHeader>
      <Divider />
      <DialogContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          visitor &&
          (() => (
            <Stack spacing={3}>
              {/* Visitor header */}
              <Box
                sx={{
                  p: { xs: 2, sm: 2.5 },
                  borderRadius: 3,
                  bgcolor: isDark
                    ? "rgba(255,255,255,0.03)"
                    : "rgba(0,0,0,0.02)",
                  border: "1px solid",
                  borderColor: "divider",
                }}
              >
                <Stack direction="row" spacing={2} alignItems="center">
                  <Avatar
                    sx={{
                      width: 56,
                      height: 56,
                      bgcolor: isDark ? "#fff" : "#000",
                      color: isDark ? "#000" : "#fff",
                      fontSize: "1.2rem",
                      fontWeight: 700,
                    }}
                  >
                    {(visitor.fullName || "")
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")}
                  </Avatar>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="h6" fontWeight={800}>
                      {visitor.fullName}
                    </Typography>
                    <Stack
                      direction="row"
                      spacing={2}
                      sx={{ mt: 0.4, flexWrap: "wrap", gap: 1 }}
                    >
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 0.5,
                          wordBreak: "break-all",
                        }}
                      >
                        <ICONS.emailOutline fontSize="inherit" />{" "}
                        {visitor.email || "No email"}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 0.5,
                        }}
                      >
                        <ICONS.phone fontSize="inherit" />{" "}
                        {visitor.phone
                          ? formatPhoneNumberForDisplay(
                              visitor.phone,
                              visitor.iso_code,
                            )
                          : "No phone"}
                      </Typography>
                      {visitor._idValue && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 0.5,
                          }}
                        >
                          <ICONS.key fontSize="inherit" /> {visitor._idLabel || "ID"}:{" "}
                          {visitor._idValue}
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                </Stack>
              </Box>

              {/* Tabs */}
              <Tabs
                value={tab}
                onChange={(_, v) => setTab(v)}
                variant="fullWidth"
                sx={{
                  minHeight: 46,
                  bgcolor: (theme) =>
                    alpha(theme.palette.text.primary, isDark ? 0.06 : 0.04),
                  borderRadius: 999,
                  p: 0.5,
                  "& .MuiTabs-indicator": { display: "none" },
                }}
              >
                {[
                  {
                    value: "details",
                    icon: <ICONS.info fontSize="small" />,
                    label: "Details",
                  },
                  {
                    value: "history",
                    icon: <ICONS.history fontSize="small" />,
                    label: `History (${(visitor.history || []).length})`,
                  },
                ].map(({ value, icon, label }) => (
                  <Tab
                    key={value}
                    value={value}
                    icon={icon}
                    iconPosition="start"
                    label={label}
                    sx={{
                      minHeight: 38,
                      borderRadius: 999,
                      fontWeight: 800,
                      textTransform: "none",
                      "&.Mui-selected": {
                        bgcolor: "background.paper",
                        color: "text.primary",
                        boxShadow: isDark
                          ? "0 8px 20px rgba(0,0,0,0.24)"
                          : "0 6px 14px rgba(0,0,0,0.08)",
                      },
                    }}
                  />
                ))}
              </Tabs>

              {/* Details tab */}
              {tab === "details" ? (
                <Box>
                  {visitor.fields && Object.keys(visitor.fields).length > 0 ? (
                    <Box sx={{ px: { xs: 0, sm: 1 } }}>
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                          gap: { xs: 1.5, md: "16px 32px" },
                        }}
                      >
                        {Object.entries(visitor.fields).map(([key, val]) => (
                          <Box
                            key={key}
                            sx={{
                              p: 1.75,
                              borderRadius: 2.5,
                              border: "1px solid",
                              borderColor: "divider",
                              bgcolor: isDark
                                ? "rgba(255,255,255,0.01)"
                                : "rgba(0,0,0,0.01)",
                            }}
                          >
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{
                                fontWeight: 800,
                                textTransform: "uppercase",
                                fontSize: "0.6rem",
                              }}
                            >
                              {key}
                            </Typography>
                            <Typography
                              variant="body2"
                              fontWeight={600}
                              sx={{ mt: 0.4 }}
                            >
                              {String(val ?? "—")}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  ) : (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ textAlign: "center", py: 3 }}
                    >
                      No additional information available
                    </Typography>
                  )}
                </Box>
              ) : (
                /* History tab */
                <Stack spacing={2}>
                  {!visitor.history || visitor.history.length === 0 ? (
                    <NoDataAvailable
                      title="No visit history"
                      description="This visitor has not made any visits yet."
                      compact
                      minHeight={220}
                    />
                  ) : (
                    visitor.history.map((visit) => (
                      <HistoryVisitCard
                        key={visit.id}
                        visit={visit}
                        visitorName={visitor.fullName}
                        isDark={isDark}
                        onViewTimeline={openTimeline}
                        onOpenMember={(m) =>
                          setMemberDialog({ open: true, member: m })
                        }
                      />
                    ))
                  )}
                </Stack>
              )}
            </Stack>
          ))()
        )}
      </DialogContent>

      {/* ── Member Info Dialog ── */}
      <Dialog
        open={memberDialog.open}
        onClose={() => setMemberDialog({ open: false, member: null })}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 4, overflow: "hidden" } }}
      >
        <DialogHeader
          title="Member Details"
          onClose={() => setMemberDialog({ open: false, member: null })}
        />
        <Divider />
        <DialogContent sx={{ p: 2.5 }}>
          {memberDialog.member && (
            <Stack spacing={2}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06),
                }}
              >
                <Avatar
                  sx={{
                    width: 44,
                    height: 44,
                    bgcolor: isDark ? "#fff" : "#000",
                    color: isDark ? "#000" : "#fff",
                    fontWeight: 800,
                  }}
                >
                  {(memberDialog.member.fullName || "")
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase() || "?"}
                </Avatar>
                <Typography variant="subtitle1" fontWeight={800}>
                  {memberDialog.member.fullName}
                </Typography>
              </Box>
              <Box
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  overflow: "hidden",
                  bgcolor: isDark
                    ? "rgba(255,255,255,0.02)"
                    : "rgba(0,0,0,0.015)",
                }}
              >
                {[
                  {
                    label: "Email",
                    value: memberDialog.member.email,
                    icon: <ICONS.emailOutline fontSize="small" />,
                  },
                  {
                    label: "Phone",
                    value: memberDialog.member.phone
                      ? formatPhoneNumberForDisplay(
                          memberDialog.member.phone,
                          memberDialog.member.iso_code,
                        )
                      : null,
                    icon: <ICONS.phone fontSize="small" />,
                  },
                  {
                    label: memberDialog.member.idType || "ID Number",
                    value: memberDialog.member.idNo,
                    icon: <ICONS.key fontSize="small" />,
                  },
                  {
                    label: "Company",
                    value: memberDialog.member.companyName,
                    icon: <ICONS.business fontSize="small" />,
                  },
                ]
                  .filter((r) => r.value)
                  .map((r, idx, arr) => (
                    <Box
                      key={r.label}
                      sx={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 1.5,
                        px: 1.75,
                        py: 1.25,
                        borderBottom:
                          idx < arr.length - 1 ? "1px solid" : "none",
                        borderColor: "divider",
                      }}
                    >
                      <Box
                        sx={{
                          color: "text.secondary",
                          display: "flex",
                          alignItems: "center",
                          mt: 0.2,
                          minWidth: 22,
                        }}
                      >
                        {r.icon}
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            fontWeight: 800,
                            textTransform: "uppercase",
                            fontSize: "0.6rem",
                          }}
                        >
                          {r.label}
                        </Typography>
                        <Typography
                          variant="body2"
                          fontWeight={600}
                          sx={{ wordBreak: "break-all", mt: 0.15 }}
                        >
                          {r.value}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
              </Box>
            </Stack>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Timeline Modal ── */}
      <Dialog
        open={timelineModal.open}
        onClose={() => setTimelineModal(INITIAL_TIMELINE)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 4, overflow: "hidden" } }}
      >
        <DialogHeader
          title={`Activity Timeline${
            timelineModal.visitorName ? ` — ${timelineModal.visitorName}` : ""
          }`}
          onClose={() => setTimelineModal(INITIAL_TIMELINE)}
        />
        <Divider />
        <DialogContent sx={{ p: 3, minHeight: 200 }}>
          {timelineLoading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : timelineLogs.length === 0 ? (
            <NoDataAvailable
              title="No activity yet"
              description="No activity logs found for this visit."
              compact
              minHeight={120}
            />
          ) : (
            <Box>
              {timelineLogs.map((log, index) => {
                const color = ACTIVITY_COLORS[log.activityType] || "grey";
                return (
                  <Box
                    key={log.id}
                    sx={{
                      display: "flex",
                      gap: 2,
                      mb: index < timelineLogs.length - 1 ? 0 : 0,
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        pt: 0.5,
                        minWidth: 24,
                      }}
                    >
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: "50%",
                          flexShrink: 0,
                          bgcolor:
                            color === "grey"
                              ? "text.disabled"
                              : color === "error"
                                ? "error.main"
                                : color === "success"
                                  ? "success.main"
                                  : color === "warning"
                                    ? "warning.main"
                                    : color === "info"
                                      ? "info.main"
                                      : "primary.main",
                        }}
                      />
                      {index < timelineLogs.length - 1 && (
                        <Box
                          sx={{
                            width: 1,
                            flex: 1,
                            minHeight: 24,
                            bgcolor: "divider",
                            mt: 0.5,
                          }}
                        />
                      )}
                    </Box>
                    <Box sx={{ pb: 2.5, flex: 1, minWidth: 0 }}>
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        flexWrap="wrap"
                      >
                        <Typography variant="body2" fontWeight={700}>
                          {ACTIVITY_LABELS[log.activityType] ||
                            toTitleCase(log.activityType)}
                        </Typography>
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {formatDateTimeWithLocale(
                          log.metadata?.checkedInAt ||
                            log.metadata?.checkedOutAt ||
                            log.createdAt,
                        )}
                      </Typography>
                      {(() => {
                        const actor = formatActorLabel(log);
                        if (!actor) return null;
                        const displayName = actor.name || "System";
                        return (
                          <Box sx={{ mt: 0.25 }}>
                            {actor.roleLabel ? (
                              <Chip
                                size="small"
                                label={`${displayName} · ${actor.roleLabel}`}
                                variant="outlined"
                                sx={{
                                  fontWeight: 600,
                                  fontSize: "0.62rem",
                                  height: 18,
                                }}
                              />
                            ) : (
                              <Typography variant="caption" color="text.secondary">
                                by {displayName}
                              </Typography>
                            )}
                          </Box>
                        );
                      })()}
                      {log.notes && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mt: 0.5, fontStyle: "italic" }}
                        >
                          {log.notes}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}