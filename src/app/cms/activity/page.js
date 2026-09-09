"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Pagination,
  Select,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import dayjs from "dayjs";
import { useRouter } from "next/navigation";
import { COUNTRY_CODES, getFlagImageUrl } from "@/utils/countryCodes";
import AppCard from "@/components/cards/AppCard";
import ResponsiveCardGrid from "@/components/ResponsiveCardGrid";
import ListToolbar from "@/components/ListToolbar";
import NoDataAvailable from "@/components/NoDataAvailable";
import LoadingState from "@/components/LoadingState";
import PermissionRouteGuard from "@/components/auth/PermissionRouteGuard";
import DateTimeFieldFlatpickr from "@/components/forms/DateTimeFieldFlatpickr";
import { useColorMode } from "@/contexts/ThemeContext";
import { useTheme } from "@mui/material/styles";
import { useSocket } from "@/contexts/SocketContext";
import { useAuth } from "@/contexts/AuthContext";
import { canAccessResource } from "@/utils/permissions";
import {
  workingHoursToUserLocal,
  userTimeZone,
  PREMISE_TZ,
} from "@/utils/premiseTime";
import { getActivityLogs } from "@/services/activityService";
import {
  ACTIVITY_TYPES,
  getActivityIcon,
  getActivityLabel,
  getActivityStatus,
} from "@/utils/activityMeta";
import ICONS from "@/utils/iconUtil";
import ExpandableNote from "@/components/ExpandableNote";

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const DATE_PRESETS = [
  { key: "all", label: "All Time" },
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "year", label: "This Year" },
  { key: "custom", label: "Custom" },
];

const pad = (n) => String(n ?? 0).padStart(2, "0");

// Render a duration in whole days/hrs/mins
const fmtDuration = (totalMins) => {
  if (totalMins == null || Number.isNaN(totalMins)) return null;
  const m = Math.floor(totalMins);
  if (m < 0) return null;
  const days = Math.floor(m / (24 * 60));
  const hours = Math.floor((m % (24 * 60)) / 60);
  const mins = m % 60;
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (mins || parts.length === 0) parts.push(`${mins}m`);
  return parts.join(" ");
};

const fmtMoment = (v) => {
  if (!v) return null;
  const d = dayjs(v);
  return d.isValid() ? d.format("DD MMM YYYY, hh:mm A") : String(v);
};

// Compact range: same day → "05 Sep 2026 · 09:00 AM – 10:00 AM",
// multi day  → "05 Sep 2026, 09:00 AM → 06 Sep 2026, 10:00 AM".
// Missing sides return null (dayjs(undefined) would silently mean "now").
const fmtRange = (from, to) => {
  if (!from || !to) return null;
  const fd = dayjs(from);
  const td = dayjs(to);
  if (!fd.isValid() || !td.isValid()) return null;
  const dateOnly = (d) => d.format("DD MMM YYYY");
  const timeOnly = (d) => d.format("hh:mm A");
  if (fd.isSame(td, "day")) {
    return `${dateOnly(fd)} · ${timeOnly(fd)} – ${timeOnly(td)}`;
  }
  return `${dateOnly(fd)}, ${timeOnly(fd)} → ${dateOnly(td)}, ${timeOnly(td)}`;
};

// keep metadata to the 1-2 most useful values per type.
// userTz converts premise-clock values (e.g. working hours) into the viewer's timezone.
function buildMetadataLines(activityType, metadata, userTz = PREMISE_TZ) {
  if (!metadata || typeof metadata !== "object") return [];
  const out = [];
  const add = (label, value) => {
    if (value === null || value === undefined || value === "") return;
    out.push({ label, value });
  };
  const plate = (v) => (typeof v === "string" ? v.trim() : "");

  switch (activityType) {
    case "checked_in":
      add("Arrival", fmtMoment(metadata.checkedInAt));
      break;
    case "checked_out":
      add("Departure", fmtMoment(metadata.checkedOutAt));
      break;
    case "visit_ended":
      add("Ended", fmtMoment(metadata.endedAt));
      break;
    case "submitted":
    case "admin_approved":
    case "approved": {
      const from = metadata.approvedFrom ?? metadata.requestedFrom;
      const to = metadata.approvedTo ?? metadata.requestedTo;
      const range = fmtRange(from, to);
      if (range) {
        out.push({ label: "Window", value: range });
      } else {
        add("From", fmtMoment(from));
        add("To", fmtMoment(to));
      }
      break;
    }
    case "rejected":
      add("Reason", metadata.rejectionReason);
      break;
    case "status_override":
      if (metadata.from && metadata.to)
        out.push({ label: "Status", value: `${metadata.from} → ${metadata.to}` });
      break;
    case "parking_granted":
      add("Plate", plate(metadata.vehiclePlate));
      break;
    case "parking_revoked":
      add("Previous Plate", plate(metadata.previousPlate));
      break;
    case "plate_updated":
      add("New Plate", plate(metadata.newPlate));
      break;
    case "overstay_detected":
    case "exit_timeout_alert":
      add(
        "Overdue",
        fmtDuration(
          metadata.overstayMinutes ?? metadata.minutesOverdue ?? null,
        ),
      );
      break;
    case "outside_hours": {
      if (metadata.workingHoursStart == null) break;
      const wh = workingHoursToUserLocal(
        {
          startH: metadata.workingHoursStart,
          startM: metadata.workingHoursStartMinute ?? 0,
          endH: metadata.workingHoursEnd,
          endM: metadata.workingHoursEndMinute ?? 0,
        },
        userTz,
      );
      add(
        "Working Hours",
        `${pad(wh.startH)}:${pad(wh.startM)} – ${pad(wh.endH)}:${pad(wh.endM)}`,
      );
      break;
    }
    case "qr_generated":
      add("Token", metadata.qrToken);
      break;
    case "sla_escalation": {
      let waitingMins = metadata.hoursWaiting != null
        ? Number(metadata.hoursWaiting) * 60
        : null;
      if (waitingMins == null && metadata.escalationSentAt) {
        const d = dayjs(metadata.escalationSentAt);
        if (d.isValid()) waitingMins = Math.floor((Date.now() - d.valueOf()) / 60000);
      }
      const waiting = fmtDuration(waitingMins) ?? fmtDuration(24 * 60);
      add("Waiting for Approval", waiting);
      add("Emailed At", fmtMoment(metadata.escalationSentAt));
      break;
    }
    default:
      break;
  }

  return out.slice(0, 2);
}

// Load the first 50 on page load, stream newer records in
// via the socket. No unbounded HTTP paging.
const INITIAL_BATCH_SIZE = 50;

// Table columns — headings render once, every row's values align beneath them.
const LOG_COLUMNS = ["Activity", "Visitor", "By", "Details", "Time", ""];
const LOG_GRID =
  "minmax(150px, 0.9fr) minmax(170px, 1.2fr) minmax(110px, 0.8fr) minmax(180px, 1.5fr) auto 44px";

// Account-level document bucket (idNo + idType + idCountry) into a
// displayable "Oman ID: 1234" / "Passport 🇮🇳 ABC123" snippet.
function resolveVisitorId(act) {
  const no = act?.visitorIdNo;
  if (!no) return null;
  const type = String(act?.visitorIdType || "").trim();
  if (type === "passport") {
    const countryRaw = String(act?.visitorIdCountry || "").trim().toLowerCase();
    const country = countryRaw
      ? COUNTRY_CODES.find((c) => c.isoCode === countryRaw) ||
        COUNTRY_CODES.find((c) => c.country.toLowerCase() === countryRaw)
      : null;
    return {
      label: "Passport",
      value: no,
      flagUrl: country ? getFlagImageUrl(country.isoCode) : "",
    };
  }
  if (type === "civilid") return { label: "Oman ID", value: no, flagUrl: "" };
  return { label: "ID", value: no, flagUrl: "" };
}

export default function ActivityPage() {
  const { mode } = useColorMode();
  const theme = useTheme();
  const isDark = mode === "dark";
  const { on } = useSocket();
  const router = useRouter();
  const { user } = useAuth();
  const canReadVisits = canAccessResource(user, "visits", {
    action: "read",
  });
  const canReadVisitors = canAccessResource(user, "visitors", {
    action: "read",
  });
  const canReadInternalNote = canAccessResource(user, "internal-notes", {
    action: "read",
  });
  // Cards below 1100px wide; aligned table at 1100px and above.
  const isDesktop = useMediaQuery("(min-width:1100px)");

  // Shared per-log derived values used by the desktop table AND mobile cards.
  const buildRowMeta = (act) => {
    const statusKey = getActivityStatus(act.activityType);
    const statusColor =
      ["success", "info", "warning", "error", "primary", "secondary"].includes(
        statusKey,
      )
        ? theme.palette[statusKey]
        : theme.palette.grey;
    const statusMain =
      (typeof statusColor?.main === "string" && statusColor.main) ||
      statusColor?.["500"] ||
      "#9e9e9e";
    return {
      statusMain,
      ActivityIcon: getActivityIcon(act.activityType),
      metaLines: buildMetadataLines(act.activityType, act.metadata, userTimeZone()),
      actor: act.actorName,
      idInfo: resolveVisitorId(act),
    };
  };

  const [activityType, setActivityType] = useState("");
  const [datePreset, setDatePreset] = useState("all");
  const [customFrom, setCustomFrom] = useState(null);
  const [customTo, setCustomTo] = useState(null);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(12);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const loadSeqRef = useRef(0);

  const load = useCallback(async (opts = {}) => {
    const silent = opts.silent === true;
    const seq = ++loadSeqRef.current;
    if (!silent) {
      setLoading(true);
    }
    const res = await getActivityLogs({ page: 1, limit: INITIAL_BATCH_SIZE });
    const batch = Array.isArray(res.data) ? res.data : [];
    if (loadSeqRef.current === seq) {
      setRows(batch);
      if (!silent) setHasLoadedOnce(true);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!on) return undefined;
    return on("activity:new", () => {
      load({ silent: true });
    });
  }, [on, load]);

  const getDateRangeFromPreset = useCallback((preset, cf, ct) => {
    const fmt = (d) => (d ? dayjs(d).format("YYYY-MM-DDTHH:mm") : null);
    if (preset === "custom") {
      return { from: fmt(cf), to: fmt(ct) };
    }
    const now = dayjs();
    switch (preset) {
      case "today":
        return { from: now.format("YYYY-MM-DD"), to: now.format("YYYY-MM-DD") };
      case "week":
        return {
          from: now.startOf("week").format("YYYY-MM-DD"),
          to: now.endOf("week").format("YYYY-MM-DD"),
        };
      case "month":
        return {
          from: now.startOf("month").format("YYYY-MM-DD"),
          to: now.endOf("month").format("YYYY-MM-DD"),
        };
      case "year":
        return {
          from: now.startOf("year").format("YYYY-MM-DD"),
          to: now.endOf("year").format("YYYY-MM-DD"),
        };
      default:
        return { from: null, to: null };
    }
  }, []);

  const instantOf = useCallback((value, isTo) => {
    if (!value) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return isTo ? dayjs(value).endOf("day") : dayjs(value).startOf("day");
    }
    return dayjs(value);
  }, []);

  const filtered = useMemo(() => {
    const { from, to } = getDateRangeFromPreset(datePreset, customFrom, customTo);
    const fromT = instantOf(from, false);
    const toT = instantOf(to, true);
    return rows.filter((act) => {
      if (activityType && act.activityType !== activityType) return false;
      const t = dayjs(act.createdAt);
      if (!t.isValid()) return !activityType && !fromT && !toT;
      if (fromT && t.isBefore(fromT)) return false;
      if (toT && t.isAfter(toT)) return false;
      return true;
    });
  }, [rows, activityType, datePreset, customFrom, customTo, getDateRangeFromPreset, instantOf]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, page, rowsPerPage]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / rowsPerPage));
  const showingCount = pagedRows.length;
  const hasActiveFilters = Boolean(activityType || datePreset !== "all");

  const handleChangeRowsPerPage = (e) => {
    setRowsPerPage(Number(e.target.value));
    setPage(1);
  };

  const handleFilterReset = () => {
    setActivityType("");
    setDatePreset("all");
    setCustomFrom(null);
    setCustomTo(null);
    setPage(1);
  };

  if (loading && !hasLoadedOnce) {
  return (
    <PermissionRouteGuard resource="activity" hardcodeAllowed>
      <LoadingState cardMaxWidth={400} skeletonLines={3} />
    </PermissionRouteGuard>
  );
}

  return (
    <PermissionRouteGuard resource="activity" hardcodeAllowed>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h5" fontWeight={800}>
            Recent Activity
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Complete audit trail of every registration event across the platform.
          </Typography>
        </Box>

        <ListToolbar
          showingCount={showingCount}
          totalCount={total}
          itemLabel="activities"
          sx={{ mb: 1 }}
          actionsSlot={
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ gap: 1 }}>
              <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 200 } }}>
                <InputLabel id="activity-type-filter-label">Activity Type</InputLabel>
                <Select
                  labelId="activity-type-filter-label"
                  label="Activity Type"
                  value={activityType}
                  onChange={(e) => {
                    setActivityType(e.target.value);
                    setPage(1);
                  }}
                >
                  <MenuItem value="">
                    <em>All types</em>
                  </MenuItem>
                  {ACTIVITY_TYPES.map((type) => (
                    <MenuItem key={type} value={type}>
                      {getActivityLabel(type)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 180 } }}>
                <InputLabel>Records per page</InputLabel>
                <Select
                  value={rowsPerPage}
                  onChange={handleChangeRowsPerPage}
                  label="Records per page"
                >
                  {[6, 12, 24, 48].map((n) => (
                    <MenuItem key={n} value={n}>
                      {n}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          }
        />

        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          justifyContent="flex-start"
          flexWrap="wrap"
          useFlexGap
          sx={{ gap: 1 }}
        >
          {DATE_PRESETS.map(({ key, label }) => (
            <Chip
              key={key}
              label={label}
              size="small"
              clickable
              color={datePreset === key ? "primary" : "default"}
              variant={datePreset === key ? "filled" : "outlined"}
              onClick={() => {
                setDatePreset(key);
                setPage(1);
              }}
              sx={{ fontWeight: 700, borderRadius: 2 }}
            />
          ))}
          {datePreset === "custom" && (
            <>
              <Box sx={{ width: { xs: "100%", sm: 210 } }}>
                <DateTimeFieldFlatpickr
                  label="From"
                  value={customFrom}
                  maxDate={customTo}
                  onChange={(val) => {
                    setCustomFrom(val);
                    if (customTo && val && dayjs(val).isAfter(dayjs(customTo))) {
                      setCustomTo(null);
                    }
                    setPage(1);
                  }}
                />
              </Box>
              <Box sx={{ width: { xs: "100%", sm: 210 } }}>
                <DateTimeFieldFlatpickr
                  label="To"
                  value={customTo}
                  minDate={customFrom}
                  onChange={(val) => {
                    setCustomTo(val);
                    setPage(1);
                  }}
                />
              </Box>
            </>
          )}
          {hasActiveFilters && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<ICONS.clear />}
              onClick={handleFilterReset}
              sx={{ borderRadius: 30, width: { xs: "100%", sm: "auto" } }}
            >
              Clear
            </Button>
          )}
        </Stack>

        {pagedRows.length === 0 ? (
          <NoDataAvailable
            title="No activity found"
            description={
              hasActiveFilters
                ? "Try adjusting the date range or activity type filter."
                : "There is no registration activity to show yet."
            }
          />
        ) : (
          <>
            {/* ── Desktop: aligned table ─────────────────────────────── */}
            {isDesktop && (
            <AppCard variant="frosted" sx={{ p: 0, overflow: "hidden" }}>
              {/* Column header */}
              <Box
                sx={{
                  px: { xs: 2, md: 3 },
                  py: 2.75,
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  bgcolor: theme.palette.background.highlight,
                  display: "grid",
                  gridTemplateColumns: LOG_GRID,
                  gap: 1.5,
                  alignItems: "center",
                }}
              >
                {LOG_COLUMNS.map((h) => (
                  <Typography
                    key={h}
                    component="div"
                    sx={{
                      fontSize: "0.75rem",
                      lineHeight: 1.4,
                      color: "text.primary",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      fontWeight: 700,
                      textAlign: h === "Time" ? "right" : "left",
                    }}
                  >
                    {h}
                  </Typography>
                ))}
              </Box>

              {pagedRows.map((act, idx) => {
                const { statusMain, ActivityIcon, metaLines, actor, idInfo } =
                  buildRowMeta(act);
                return (
                  <Box
                    key={act.id}
                    sx={{
                      px: { xs: 2, md: 3 },
                      py: 1.5,
                      borderBottom:
                        idx < pagedRows.length - 1 ? "1px solid" : "none",
                      borderColor: "divider",
                      display: "grid",
                      gridTemplateColumns: LOG_GRID,
                      gap: 1.5,
                      alignItems: "center",
                      "&:hover": {
                        bgcolor: theme.palette.background.subtle,
                      },
                    }}
                  >
                    {/* Activity */}
                    <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: 2,
                          flexShrink: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          bgcolor: `rgba(${parseInt(
                            statusMain.slice(1, 3),
                            16,
                          )}, ${parseInt(statusMain.slice(3, 5), 16)}, ${parseInt(
                            statusMain.slice(5, 7),
                            16,
                          )}, ${isDark ? 0.16 : 0.1})`,
                          color: statusMain,
                        }}
                      >
                        {ActivityIcon && (
                          <ActivityIcon sx={{ fontSize: 18, opacity: 0.9 }} />
                        )}
                      </Box>
                      <Typography variant="subtitle2" fontWeight={800}>
                        {getActivityLabel(act.activityType)}
                      </Typography>
                    </Stack>

                    {/* Visitor + document (or group members) */}
                    <Box sx={{ minWidth: 0, overflowWrap: "anywhere", wordBreak: "break-word" }}>
                      {Array.isArray(act.groupMembers) &&
                      act.groupMembers.length > 0 ? (
                        <Typography
                          variant="body2"
                          fontWeight={700}
                          sx={{ lineHeight: 1.4, overflowWrap: "anywhere", wordBreak: "break-word" }}
                        >
                          {act.meetingName?.trim() || "Group Meeting"} (
                          {act.groupMembers
                            .map(
                              (m) =>
                                `${m.name}${m.idNo ? ` - ${m.idNo}` : ""}`,
                            )
                            .join(", ")})
                        </Typography>
                      ) : (
                        <>
                          <Typography
                            variant="body2"
                            fontWeight={700}
                            sx={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
                          >
                            {act.visitorName || "—"}
                          </Typography>
                          {idInfo && (
                            <Stack
                              direction="row"
                              spacing={0.5}
                              alignItems="center"
                              useFlexGap
                              sx={{ mt: 0.25, minWidth: 0, flexWrap: "wrap" }}
                            >
                              {idInfo.flagUrl && (
                                <Box
                                  component="img"
                                  src={idInfo.flagUrl}
                                  alt=""
                                  sx={{
                                    width: 16,
                                    height: 11,
                                    borderRadius: 0.5,
                                    flexShrink: 0,
                                    objectFit: "cover",
                                  }}
                                />
                              )}
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ fontSize: "0.68rem", flexShrink: 0 }}
                              >
                                {idInfo.label}:
                              </Typography>
                              <Typography
                                variant="caption"
                                fontWeight={700}
                                sx={{ fontSize: "0.68rem" }}
                              >
                                {idInfo.value}
                              </Typography>
                            </Stack>
                          )}
                        </>
                      )}
                    </Box>

                    {/* By */}
                    <Box sx={{ minWidth: 0 }}>
                      {actor ? (
                        <Typography variant="body2" color="text.secondary">
                          {actor}
                        </Typography>
                      ) : (
                        <Typography variant="caption" color="text.disabled">
                          —
                        </Typography>
                      )}
                    </Box>

                    {/* Details — the log message is the star */}
                    <Box sx={{ minWidth: 0 }}>
                      {act.activityType === "internal_note" &&
                      canReadInternalNote &&
                      act.metadata?.internalNote ? (
                        <ExpandableNote text={act.metadata.internalNote} />
                      ) : act.notes ? (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ lineHeight: 1.4 }}
                        >
                          {act.notes}
                        </Typography>
                      ) : (
                        metaLines.length === 0 && (
                          <Typography variant="body2" color="text.disabled">
                            —
                          </Typography>
                        )
                      )}
                      {metaLines.length > 0 && (
                        <Stack
                          direction="row"
                          spacing={1.5}
                          flexWrap="wrap"
                          useFlexGap
                          sx={{ mt: act.notes ? 0.35 : 0, gap: 0.5 }}
                        >
                          {metaLines.map((m) => (
                            <Box key={m.label} sx={{ minWidth: 56 }}>
                              <Typography
                                variant="overline"
                                sx={{
                                  display: "block",
                                  fontSize: "0.52rem",
                                  lineHeight: 1,
                                  color: "text.secondary",
                                  textTransform: "uppercase",
                                  letterSpacing: 0.4,
                                }}
                              >
                                {m.label}
                              </Typography>
                              <Typography variant="caption" fontWeight={700}>
                                {m.value}
                              </Typography>
                            </Box>
                          ))}
                        </Stack>
                      )}
                    </Box>

                    {/* Time */}
                    <Box sx={{ textAlign: "right", minWidth: 0 }}>
                      <Typography variant="caption" fontWeight={700} display="block">
                        {timeAgo(act.createdAt)}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block"
                        sx={{ fontSize: "0.68rem" }}
                      >
                        {dayjs(act.createdAt).format("DD MMM, hh:mm A")}
                      </Typography>
                    </Box>

                    {/* Actions */}
                    <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                      {act.activityType === "visit_history_exported" &&
                      act.metadata?.visitorId &&
                      canReadVisitors ? (
                        <Tooltip title="Open visitor">
                          <IconButton
                            size="small"
                            aria-label="Open visitor"
                            onClick={() =>
                              router.push(
                                `/cms/visitors?visitor=${act.metadata.visitorId}`,
                              )
                            }
                            sx={{ color: "text.secondary" }}
                          >
                            <ICONS.chevronRight sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                      ) : act.registrationId && canReadVisits ? (
                        <Tooltip title="Open visit">
                          <IconButton
                            size="small"
                            aria-label="Open visit"
                            onClick={() =>
                              router.push(
                                `/cms/visits?visit=${act.registrationId}`,
                              )
                            }
                            sx={{ color: "text.secondary" }}
                          >
                            <ICONS.chevronRight sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                      ) : null}
                    </Box>
                  </Box>
                );
              })}
            </AppCard>
            )}

            {/* ── Small Screens: AppCard cards ─────────── */}
            {!isDesktop && (
            <ResponsiveCardGrid sx={{ mt: 1 }}>
              {pagedRows.map((act) => {
                const { statusMain, ActivityIcon, metaLines, actor, idInfo } =
                  buildRowMeta(act);
                return (
                  <AppCard key={act.id} interactive={false} sx={{ p: 0 }}>
                    {/* Card header */}
                    <Box
                      sx={{
                        px: 1.75,
                        py: 1.25,
                        display: "flex",
                        alignItems: "center",
                        gap: 1.25,
                        borderBottom: "1px solid",
                        borderColor: "divider",
                        bgcolor: theme.palette.background.highlight,
                      }}
                    >
                      <Box
                        sx={{
                          width: 38,
                          height: 38,
                          borderRadius: 2,
                          flexShrink: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          bgcolor: `rgba(${parseInt(
                            statusMain.slice(1, 3),
                            16,
                          )}, ${parseInt(statusMain.slice(3, 5), 16)}, ${parseInt(
                            statusMain.slice(5, 7),
                            16,
                          )}, ${isDark ? 0.16 : 0.1})`,
                          color: statusMain,
                        }}
                      >
                        {ActivityIcon && (
                          <ActivityIcon sx={{ fontSize: 19, opacity: 0.9 }} />
                        )}
                      </Box>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="subtitle2" fontWeight={800}>
                          {getActivityLabel(act.activityType)}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          display="block"
                          sx={{ fontSize: "0.68rem" }}
                        >
                          {timeAgo(act.createdAt)} ·{" "}
                          {dayjs(act.createdAt).format("DD MMM, hh:mm A")}
                        </Typography>
                      </Box>
                      {act.activityType === "visit_history_exported" &&
                        act.metadata?.visitorId &&
                        canReadVisitors ? (
                        <Tooltip title="Open visitor">
                          <IconButton
                            size="small"
                            aria-label="Open visitor"
                            onClick={() =>
                              router.push(
                                `/cms/visitors?visitor=${act.metadata.visitorId}`,
                              )
                            }
                            sx={{ color: "text.secondary" }}
                          >
                            <ICONS.chevronRight sx={{ fontSize: 20 }} />
                          </IconButton>
                        </Tooltip>
                      ) : act.registrationId && canReadVisits ? (
                        <Tooltip title="Open visit">
                          <IconButton
                            size="small"
                            aria-label="Open visit"
                            onClick={() =>
                              router.push(
                                `/cms/visits?visit=${act.registrationId}`,
                              )
                            }
                            sx={{ color: "text.secondary" }}
                          >
                            <ICONS.chevronRight sx={{ fontSize: 20 }} />
                          </IconButton>
                        </Tooltip>
                      ) : null}
                    </Box>

                    {/* Card body */}
                    <Box
                      sx={{
                        px: 1.75,
                        py: 0.5,
                        display: "flex",
                        flexDirection: "column",
                        "& > :not(:last-child)": {
                          borderBottom: "1px solid",
                          borderColor: "divider",
                        },
                      }}
                    >
                      {/* Field heading */}
                      {(() => {
                        const FieldLabel = ({ children }) => (
                          <Typography
                            variant="overline"
                            sx={{
                              display: "block",
                              fontSize: "0.55rem",
                              lineHeight: 1,
                              color: "text.secondary",
                              textTransform: "uppercase",
                              letterSpacing: 0.5,
                              mb: 0.3,
                            }}
                          >
                            {children}
                          </Typography>
                        );

                        const Row = ({ children }) => (
                          <Box sx={{ py: 0.9, minWidth: 0 }}>{children}</Box>
                        );

                        return (
                          <>
                            {/* Visitor */}
                            <Row>
                              <FieldLabel>Visitor</FieldLabel>
                              {Array.isArray(act.groupMembers) &&
                              act.groupMembers.length > 0 ? (
                                <Typography
                                  variant="body2"
                                  fontWeight={700}
                                  sx={{ lineHeight: 1.4, overflowWrap: "anywhere", wordBreak: "break-word" }}
                                >
                                  {act.meetingName?.trim() || "Group Meeting"} (
                                  {act.groupMembers
                                    .map(
                                      (m) =>
                                        `${m.name}${m.idNo ? ` - ${m.idNo}` : ""}`,
                                    )
                                    .join(", ")})
                                </Typography>
                              ) : (
                                <>
                                  <Typography variant="body2" fontWeight={700}>
{act.visitorName || "—"}
                                  </Typography>
                                  {idInfo && (
                                    <Stack
                                      direction="row"
                                      spacing={0.5}
                                      alignItems="center"
                                      useFlexGap
                                      sx={{ mt: 0.25, minWidth: 0, flexWrap: "wrap" }}
                                    >
                                      {idInfo.flagUrl && (
                                        <Box
                                          component="img"
                                          src={idInfo.flagUrl}
                                          alt=""
                                          sx={{
                                            width: 16,
                                            height: 11,
                                            borderRadius: 0.5,
                                            flexShrink: 0,
                                            objectFit: "cover",
                                          }}
                                        />
                                      )}
                                      <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        sx={{ fontSize: "0.7rem", flexShrink: 0 }}
                                      >
                                        {idInfo.label}:
                                      </Typography>
                                      <Typography
                                        variant="caption"
                                        fontWeight={700}
                                        sx={{ fontSize: "0.7rem" }}
                                      >
                                        {idInfo.value}
                                      </Typography>
                                    </Stack>
                                  )}
                                </>
                              )}
                            </Row>

                            {/* By */}
                            {actor && (
                              <Row>
                                <FieldLabel>By</FieldLabel>
                                <Stack
                                  direction="row"
                                  spacing={0.5}
                                  alignItems="center"
                                  sx={{ minWidth: 0 }}
                                >
                                  <ICONS.person
                                    sx={{ fontSize: 14, color: "text.secondary", flexShrink: 0 }}
                                  />
                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ fontWeight: 600 }}
                                  >
                                    {actor}
                                  </Typography>
                                </Stack>
                              </Row>
                            )}

                            {/* Details */}
                            {(act.notes || metaLines.length > 0) && (
                              <Row>
                                <FieldLabel>Details</FieldLabel>
                                {act.activityType === "internal_note" &&
                                canReadInternalNote &&
                                act.metadata?.internalNote ? (
                                  <ExpandableNote text={act.metadata.internalNote} />
                                ) : act.notes ? (
                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ lineHeight: 1.45, wordBreak: "break-word" }}
                                  >
                                    {act.notes}
                                  </Typography>
                                ) : null}
                                {metaLines.length > 0 && (
                                  <Stack
                                    direction="row"
                                    spacing={2}
                                    flexWrap="wrap"
                                    useFlexGap
                                    sx={{ mt: act.notes ? 0.7 : 0, gap: 0.75 }}
                                  >
                                    {metaLines.map((m) => (
                                      <Box key={m.label} sx={{ minWidth: 72 }}>
                                        <Typography
                                          variant="overline"
                                          sx={{
                                            display: "block",
                                            fontSize: "0.55rem",
                                            lineHeight: 1,
                                            color: "text.secondary",
                                            textTransform: "uppercase",
                                            letterSpacing: 0.4,
                                          }}
                                        >
                                          {m.label}
                                        </Typography>
                                        <Typography
                                          variant="caption"
                                          fontWeight={700}
                                          sx={{ wordBreak: "break-word" }}
                                        >
                                          {m.value}
                                        </Typography>
                                      </Box>
                                    ))}
                                  </Stack>
                                )}
                              </Row>
                            )}
                          </>
                        );
                      })()}
                    </Box>
                  </AppCard>
                );
              })}
            </ResponsiveCardGrid>
            )}
          </>
        )}

        {!loading && total > rowsPerPage && (
          <Box display="flex" justifyContent="center" mt={4}>
            <Pagination
              count={totalPages}
              page={page}
              onChange={(e, v) => setPage(v)}
              color="primary"
            />
          </Box>
        )}
      </Stack>
    </PermissionRouteGuard>
  );
}