"use client";

import { useState, useMemo, useEffect, useCallback, useRef, Fragment } from "react";
import dayjs from "dayjs";
import {
  Box,
  Typography,
  Chip,
  IconButton,
  TextField,
  Stack,
  Tooltip,
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Divider,
  Avatar,
  MenuItem,
  Menu,
  Pagination,
  Select,
  InputLabel,
  CircularProgress,
  LinearProgress,
  Alert,
  FormControl,
  Tabs,
  Tab,
  Switch,
  FormControlLabel,
  RadioGroup,
  Radio,
  useTheme,
  useMediaQuery,
  alpha,
  Grid,
  Autocomplete,
  Checkbox,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Collapse,
} from "@mui/material";
import { useSearchParams } from "next/navigation";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";
import { useColorMode } from "@/contexts/ThemeContext";
import { useMessage } from "@/contexts/MessageContext";
import { useSocket } from "@/contexts/SocketContext";
import { useAuth } from "@/contexts/AuthContext";
import useI18nLayout from "@/hooks/useI18nLayout";
import registrationTranslations from "@/locales/registration";
import { pdf, Document } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { exportAllBadges } from "@/utils/exportBadges";
import ICONS from "@/utils/iconUtil";
import DateTimeFieldFlatpickr from "@/components/forms/DateTimeFieldFlatpickr";
import CountryPicker from "@/components/CountryPicker";
import { formatPhoneNumberForDisplay, phoneMatchesQuery } from "@/utils/countryCodes";
import { getDefaultBadgeTemplate } from "@/services/badgeService";
import BadgePDF from "@/components/badges/BadgePDF";
import ExpandableNote from "@/components/ExpandableNote";

import {
  getRegistrations,
  getRegistrationById,
  updateStatus,
  getRegistrationActivityLogs,
  exportVisitorHistoryCsv,
  exportRegistrationsXlsx,
  updateRegistration,
  updateInternalNote,
  getEligibleVisitors,
  adminCreateVisits,
  checkNdaValidity,
  mapRegistration,
} from "@/services/registrationService";
import { getWorkingHours } from "@/services/hostService";
import { getAccessLevels } from "@/services/accessLevelService";
import { getDepartments } from "@/services/departmentService";
import { getCustomFields } from "@/services/customFieldService";
import {
  formatDate,
  formatTime,
  formatDateTimeWithLocale,
  getLocalDate,
  getLocalTime,
  parse24To12,
  convert12To24,
} from "@/utils/dateUtils";
import { getKitchenOrdersForRegistration as getKitchenOrders } from "@/services/kitchenService";
import { validateRequired } from "@/utils/validationUtils";
import { countPastVisits, resolvePastVisitBreakdown } from "@/utils/visitCount";
import { formatActorLabel } from "@/utils/actorLabel";
import { getRegistrationDisplayName, getRegistrationDisplayInitial } from "@/utils/registrationDisplay";
import { countScheduledDays } from "@/utils/scheduleDayCount";
import {
  markBadgesPrinted,
  markBadgesExported,
  logVisitsExported,
} from "@/services/activityService";

import AppCard from "@/components/cards/AppCard";
import DialogHeader from "@/components/modals/DialogHeader";
import FilterModal from "@/components/modals/FilterModal";
import ListToolbar from "@/components/ListToolbar";
import LoadingState from "@/components/LoadingState";
import NoDataAvailable from "@/components/NoDataAvailable";
import ResponsiveCardGrid from "@/components/ResponsiveCardGrid";
import RecordMetadata from "@/components/RecordMetadata";
import VisitorDetailsDialog from "@/components/visitors/VisitorDetailsDialog";
import ClickableVisitorName from "@/components/visitors/ClickableVisitorName";
import PermissionRouteGuard from "@/components/auth/PermissionRouteGuard";
import { canAccessResource } from "@/utils/permissions";
import { workingHoursToUserLocal, userTimeZone, rollOvernightEnd } from "@/utils/premiseTime";

// Format a working-hours boundary as a readable 12-hour AM/PM string (e.g. "8:00 AM").
const fmtHour12 = (h24, min = 0) => {
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  const ampm = h24 < 12 ? "AM" : "PM";
  return `${h12}:${String(min).padStart(2, "0")} ${ampm}`;
};

// Working hours are premise-time (GMT+4); show them in the viewer's timezone.
const fmtLocalWorkingHours = (cfg) => {
  const wh = workingHoursToUserLocal(
    {
      startH: cfg?.start ?? 8,
      startM: cfg?.startMinute ?? 0,
      endH: cfg?.end ?? 17,
      endM: cfg?.endMinute ?? 0,
    },
    userTimeZone(),
  );
  return {
    startH: wh.startH,
    startM: wh.startM,
    endH: wh.endH,
    endM: wh.endM,
    start: fmtHour12(wh.startH, wh.startM),
    end: fmtHour12(wh.endH, wh.endM),
  };
};

// True when an approved window ends before it starts (invalid legacy data).
const isInvertedWindow = (fromVal, toVal) => {
  if (!fromVal || !toVal) return false;
  const f = dayjs(fromVal);
  const t = dayjs(toVal);
  if (!f.isValid() || !t.isValid()) return false;
  return f.valueOf() >= t.valueOf();
};

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
  rejected: {
    label: "Rejected",
    color: "error",
    icon: <ICONS.close fontSize="small" />,
  },
  checked_in: {
    label: "Checked In",
    color: "info",
    icon: <ICONS.login fontSize="small" />,
  },
  checked_out: {
    label: "Checked Out",
    color: "default",
    icon: <ICONS.logout fontSize="small" />,
  },
  cancelled: {
    label: "Cancelled",
    color: "default",
    icon: <ICONS.cancel fontSize="small" />,
  },
  visit_ended: {
    label: "Visit Ended",
    color: "default",
    icon: <ICONS.stop fontSize="small" />,
  },
  expired: {
    label: "Expired",
    color: "default",
    icon: <ICONS.history fontSize="small" />,
  },
};
const TERMINAL_STATUSES = new Set(["visit_ended", "rejected", "expired"]);

const ACTION_LABELS = {
  admin_approved: "Dept Approve",
  approved: "Final Approve",
  rejected: "Reject",
  cancelled: "Cancel",
  checked_in: "Check In",
  checked_out: "Check Out",
  visit_ended: "End Visit",
};

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 12 }, (_, i) =>
  String(i * 5).padStart(2, "0"),
);
const PERIODS = ["AM", "PM"];

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
};

function toTitleCase(str) {
  if (!str) return "";
  return str.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const ALL_ACTIONABLE_STATUSES = [
  "admin_approved",
  "approved",
  "rejected",
  "cancelled",
  "checked_in",
  "checked_out",
  "visit_ended",
];

const canEditRegistration = (row, isSuperAdmin = false, userRole = null) => {
  if (!row) return false;
  // SuperAdmin and Admin (dept admin) can always override any status
  if (isSuperAdmin || userRole === "admin") return true;
  const terminal =
    row.status === "visit_ended" ||
    row.status === "rejected" ||
    row.status === "expired";
  return !terminal;
};

function getAllowedTransitions(currentStatus, role, allowMultiCheckin, adminType) {
  if (TERMINAL_STATUSES.has(currentStatus)) return [];
  const isSA = role === "superadmin";
  const isAdmin = role === "admin" || isSA;
  const isStaff = role === "staff" || isAdmin;
  // Department heads get a plain Approve as a primary action (dept-level only).
  const isDeptHead =
    role === "admin" && (adminType === "departmental" || !adminType);

  switch (currentStatus) {
    case "pending":
      return [
        ...(isSA ? ["approved"] : []),
        ...(isDeptHead ? ["admin_approved"] : []),
        ...(isAdmin ? ["rejected"] : []),
      ];
    case "admin_approved":
      return [
        ...(isSA ? ["approved"] : []),
        ...(isAdmin ? ["rejected"] : []),
      ];
    case "approved":
      return [...(isStaff ? ["checked_in"] : [])];
    case "checked_in":
      return [...(isStaff ? ["checked_out"] : [])];
    case "checked_out":
      return [
        ...(isStaff && allowMultiCheckin ? ["checked_in"] : []),
        ...(isAdmin ? ["visit_ended"] : []),
      ];
    default:
      return [];
  }
}

function getOverrideTargets(currentStatus, role, normalAllowed, canOverride) {
  if (!canOverride || !currentStatus) return [];
  // Start with non-normal statuses (the original override targets)
  const targets = ALL_ACTIONABLE_STATUSES.filter(
    (s) => s !== currentStatus && !normalAllowed.includes(s),
  );
  // Also expose checked_in in the override dropdown when it is already a normal
  // transition — it carries a time-window / recurring-schedule guard that the
  // user may need to bypass explicitly. The normal button enforces the constraint;
  // the override dropdown item bypasses it (and logs as Status Override).
  if (normalAllowed.includes("checked_in") && !targets.includes("checked_in")) {
    targets.push("checked_in");
  }
  // Always expose Cancel in the override dropdown so an override can cancel a
  // visit from any non-terminal status (it bypasses the flow guards).
  if (currentStatus !== "cancelled" && !targets.includes("cancelled")) {
    targets.push("cancelled");
  }
  // Only SuperAdmin may override to the final "approved" status
  return role === "superadmin"
    ? targets
    : targets.filter((s) => s !== "approved");
}

function InfoItem({ label, value, icon, sx = {} }) {
  return (
    <Box sx={sx}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
        <Box
          sx={{
            color: "primary.main",
            display: "flex",
            alignItems: "center",
            minWidth: 22,
            opacity: 0.8,
          }}
        >
          {icon}
        </Box>
        <Typography
          variant="caption"
          sx={{
            color: "text.secondary",
            fontWeight: 700,
            textTransform: "uppercase",
            fontSize: "0.65rem",
            letterSpacing: 0.5,
          }}
        >
          {label}
        </Typography>
      </Stack>
      <Box sx={{ pl: "30px" }}>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            fontSize: "0.85rem",
            color: "text.primary",
            lineHeight: 1.4,
          }}
        >
          {value || "—"}
        </Typography>
      </Box>
    </Box>
  );
}

function KitchenOrderList({ orders, loading, isDark }) {
  const [expandedIds, setExpandedIds] = useState(new Set());
  const theme = useTheme();

  const toggleExpand = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading)
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress size={30} />
      </Box>
    );
  if (!orders?.length)
    return (
      <NoDataAvailable
        title="No orders found"
        description="No kitchen orders have been placed for this visit yet."
        compact
        minHeight={150}
      />
    );

  return (
    <Stack spacing={2}>
      {orders.map((order) => {
        const sortedHistory = [...(order.status_history || [])].sort(
          (a, b) => new Date(a.changed_at) - new Date(b.changed_at),
        );
        return (
          <Box
            key={order.id}
            sx={{
              p: 2,
              borderRadius: 3,
              border: "1px solid",
              borderColor: "divider",
              bgcolor: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)",
            }}
          >
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="flex-start"
              sx={{ mb: 1.5 }}
            >
              <Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  fontWeight={800}
                  sx={{ textTransform: "uppercase" }}
                >
                  Order Date
                </Typography>
                <Typography variant="body2" fontWeight={700}>
                  {dayjs(order.created_at).format("MMM D, YYYY - h:mm A")}
                </Typography>
              </Box>
              <Chip
                label={order.status.replace("_", " ")}
                size="small"
                color={
                  order.status === "delivered"
                    ? "success"
                    : order.status === "cancelled"
                      ? "error"
                      : "primary"
                }
                sx={{
                  fontWeight: 800,
                  textTransform: "uppercase",
                  fontSize: "0.6rem",
                }}
              />
            </Stack>
            <Stack spacing={0.5} sx={{ mb: 1.5 }}>
              {order.items?.map((item, idx) => (
                <Typography
                  key={idx}
                  variant="body2"
                  fontWeight={600}
                  sx={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span>{item.name}</span>
                  <span style={{ opacity: 0.6 }}>×{item.quantity}</span>
                </Typography>
              ))}
            </Stack>

            <Box
              sx={{ pt: 1, borderTop: "1px dashed", borderColor: "divider" }}
            >
              <Button
                size="small"
                onClick={() => toggleExpand(order.id)}
                endIcon={
                  <ICONS.down
                    sx={{
                      transform: expandedIds.has(order.id)
                        ? "rotate(180deg)"
                        : "none",
                      transition: "0.2s",
                    }}
                  />
                }
                sx={{
                  textTransform: "none",
                  p: 0,
                  color: "text.secondary",
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  minHeight: 0,
                }}
              >
                View Timeline
              </Button>
              <Collapse in={expandedIds.has(order.id)}>
                <Box sx={{ pl: 0.5, pt: 2 }}>
                  {sortedHistory.map((h, i) => (
                    <Box
                      key={h.id}
                      sx={{
                        display: "flex",
                        gap: 1.5,
                        mb: i < sortedHistory.length - 1 ? 1.5 : 0,
                      }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          mt: 0.5,
                        }}
                      >
                        <Box
                          sx={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            bgcolor:
                              i === sortedHistory.length - 1
                                ? "primary.main"
                                : "text.disabled",
                          }}
                        />
                        {i < sortedHistory.length - 1 && (
                          <Box
                            sx={{
                              width: 1,
                              flex: 1,
                              bgcolor: "divider",
                              mt: 0.5,
                              minHeight: 8,
                            }}
                          />
                        )}
                      </Box>
                      <Box>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography
                            variant="caption"
                            fontWeight="700"
                            sx={{ textTransform: "capitalize" }}
                          >
                            {h.status.replace("_", " ")}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{ fontSize: "0.55rem", opacity: 0.5 }}
                          >
                            {dayjs(h.changed_at).format("MMM D, h:mm A")}
                          </Typography>
                          {h.changed_by && (
                            <Chip
                              label={h.changed_by}
                              size="small"
                              variant="outlined"
                              sx={{
                                height: 14,
                                fontSize: "0.5rem",
                                fontWeight: 700,
                                borderStyle: "dashed",
                                bgcolor: alpha(
                                  theme.palette.primary.main,
                                  0.05,
                                ),
                              }}
                            />
                          )}
                        </Stack>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Collapse>
            </Box>
          </Box>
        );
      })}
    </Stack>
  );
}

const buildScheduleText = (
  fromStr,
  toStr,
  emptyLabel = "Not scheduled yet",
) => {
  if (!fromStr && !toStr) return emptyLabel;
  const dateFromFormatted = formatDate(fromStr);
  const dateToFormatted = formatDate(toStr);
  let dateText = dateFromFormatted || "—";
  if (dateToFormatted && dateFromFormatted !== dateToFormatted) {
    dateText = `${dateFromFormatted} to ${dateToFormatted}`;
  }
  const timeFrom = formatTime(fromStr);
  const timeTo = formatTime(toStr);
  const timeParts = [timeFrom, timeTo].filter(Boolean);
  if (!timeParts.length) return dateText;
  return `${dateText}, ${timeParts.join(" - ")}`;
};

function getVisibleFieldValues(registration) {
  const raw = registration?.fieldValues || registration?.field_values || [];
  const map = {};
  if (Array.isArray(raw)) {
    raw.forEach((fv) => {
      const key = fv.customField?.fieldKey || fv.custom_field?.field_key;
      if (key) map[key] = fv.value;
    });
  }
  return map;
}

function resolveVisitName(row) {
  if (!row) return "";
  const participants =
    Array.isArray(row.participants) && row.participants.length > 1
      ? row.participants
      : [];
  if (participants.length > 1) {
    const stored = row.meetingName || row.meeting_name || "";
    if (typeof stored === "string" && stored.trim() !== "") return stored.trim();
    const names = participants
      .map((p) => p.fullName)
      .filter(Boolean)
      .join(", ");
    return names || `Group Meeting (${participants.length})`;
  }
  return row.full_name || row.fullName || "";
}

const buildEditForm = (reg, fields = []) => {
  const fvMap = {};
  if (Array.isArray(reg.fieldValues)) {
    reg.fieldValues.forEach((fv) => {
      const key = fv.customField?.fieldKey || fv.customField?.field_key;
      if (key) fvMap[key] = fv.value;
    });
  }
  const columnPurpose = reg.purpose_of_visit || reg.purposeOfVisit;
  if (columnPurpose && fields.length > 0) {
    const normKey = (s = "") => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const purposeField = fields.find((f) => {
      const k = normKey(f.fieldKey || f.field_key);
      const l = (f.label || "").toLowerCase();
      return (
        k.includes("purposeofvisit") ||
        k === "purpose" ||
        l.includes("purpose of visit")
      );
    });
    if (purposeField && !fvMap[purposeField.fieldKey]) {
      fvMap[purposeField.fieldKey] = columnPurpose;
    }
  }
  const hasApproved = !!(
    reg.approved_from ||
    reg.approved_to ||
    reg.approvedFrom ||
    reg.approvedTo
  );
  return {
    id: reg.id,
    hasApproved,
    scheduleFrom: hasApproved
      ? reg.approved_from || reg.approvedFrom || ""
      : reg.requested_from || reg.requestedFrom || "",
    scheduleTo: hasApproved
      ? reg.approved_to || reg.approvedTo || ""
      : reg.requested_to || reg.requestedTo || "",
    departmentId:
      reg.department_id || reg.departmentId || (reg.department?.id ?? ""),
    accessLevelIds: hasApproved
      ? reg.access_levels?.length
        ? reg.access_levels.map((al) => al.id)
        : reg.access_level_id || reg.accessLevelId
          ? [reg.access_level_id || reg.accessLevelId]
          : []
      : [],
    allowMultiCheckin: hasApproved
      ? (reg.allow_multi_checkin ?? reg.allowMultiCheckin ?? false)
      : false,
    allowParking: hasApproved
      ? (reg.allow_parking ?? reg.allowParking ?? false)
      : false,
    vehiclePlate: hasApproved
      ? (reg.vehicle_plate ?? reg.vehiclePlate ?? "")
      : "",
    isVip: hasApproved ? (reg.is_vip ?? reg.isVip ?? false) : false,
    vipReason: hasApproved ? (reg.vip_reason ?? reg.vipReason ?? "") : "",
    escortRequired: hasApproved
      ? (reg.escort_required ?? reg.escortRequired ?? true)
      : true,
    internalNote: reg.internal_note ?? reg.internalNote ?? "",
    meetingName: reg.meeting_name ?? reg.meetingName ?? "",
    isGroupMeeting: (reg.participants?.length ?? 0) > 1,
    fieldValues: fvMap,
  };
};

export default function CmsVisitsPage() {
  const { t, language: lang } = useI18nLayout(registrationTranslations);
  const DAY_LABELS = [
    t.daySun,
    t.dayMon,
    t.dayTue,
    t.dayWed,
    t.dayThu,
    t.dayFri,
    t.daySat,
  ];
  const theme = useTheme();
  const isMobileActions = useMediaQuery(theme.breakpoints.down("sm"));
  const { mode } = useColorMode();
  const isDark = mode === "dark";
  const { showMessage } = useMessage();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "superadmin";
  const isKitchenAdmin =
    user?.role === "admin" && user?.adminType === "kitchen";
  const userRole = user?.role;
  const canCreateVisit = canAccessResource(user, "visits", {
    hardcodeAllowed:
      user?.role === "superadmin" ||
      user?.role === "admin" ||
      user?.role === "dev",
    action: "create",
  });
  const canUpdate = canAccessResource(user, "visits", {
    hardcodeAllowed: !isKitchenAdmin,
    action: "update",
  });
  
  const canOverrideVisit = canAccessResource(user, "visits", {
    hardcodeAllowed: isSuperAdmin,
    action: "override",
  });
  const canReadInternalNote = canAccessResource(user, "internal-notes", {
    hardcodeAllowed: isSuperAdmin,
    action: "read",
  });
  const canWriteInternalNote = canAccessResource(user, "internal-notes", {
    hardcodeAllowed: isSuperAdmin,
    action: "update",
  });

  // ── Data ──
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isListRefreshing, setIsListRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ── Search / Pagination ──
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(12);
  const [isStreaming, setIsStreaming] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // ── Filters ──
  const [statusFilter, setStatusFilter] = useState("all");
  const [vipFastTrackOnly, setVipFastTrackOnly] = useState(false);
  const [groupMeetingOnly, setGroupMeetingOnly] = useState(false);
  const [datePreset, setDatePreset] = useState("all");
  const [customFrom, setCustomFrom] = useState(null);
  const [customTo, setCustomTo] = useState(null);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [requestDateFrom, setRequestDateFrom] = useState("");
  const [requestDateTo, setRequestDateTo] = useState("");
  const [requestTimeFilter, setRequestTimeFilter] = useState({
    hour12: "",
    minute: "00",
    ampm: "AM",
    enabled: false,
  });
  const [approvedDateFrom, setApprovedDateFrom] = useState("");
  const [approvedDateTo, setApprovedDateTo] = useState("");
  const [approvedTimeFilter, setApprovedTimeFilter] = useState({
    hour12: "",
    minute: "00",
    ampm: "AM",
    enabled: false,
  });

  // ── Detail / Edit / Status modals ──
  const [selected, setSelected] = useState(null);
  const [fetchingProfile, setFetchingProfile] = useState(false);
  const [detailTab, setDetailTab] = useState(0);
  const [editForm, setEditForm] = useState(null);
  // Which schedule picker popup is open in the edit dialog ('from' | 'to' | null).
  // The From/To pickers share this slot so both popups can never mount at once.
  const [openSchedulePicker, setOpenSchedulePicker] = useState(null);
  const [statusModal, setStatusModal] = useState(null);
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    targetStatus: null,
    message: "",
  });
  const [customTimestamp, setCustomTimestamp] = useState(null);
  const customTimestampRef = useRef(null);
  const batchTimestampRef = useRef(null);
  const [visitorDialog, setVisitorDialog] = useState({ open: false, visitorId: null, seed: null });
  const [actionsExpanded, setActionsExpanded] = useState(true);
  const [timelineModal, setTimelineModal] = useState({
    open: false,
    visitId: null,
    visitorName: "",
  });
  const [timelineLogs, setTimelineLogs] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const timelineVisitIdRef = useRef(null);
  // Keep ref in sync with modal state
  useEffect(() => {
    timelineVisitIdRef.current = timelineModal.open ? timelineModal.visitId : null;
  }, [timelineModal.open, timelineModal.visitId]);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // ── Approve dialog state (from approvals page) ──
  const [approveTarget, setApproveTarget] = useState(null);
  const [approvePastVisits, setApprovePastVisits] = useState(null);
  const [pastVisitsOpen, setPastVisitsOpen] = useState(false);
  const [detailPastVisits, setDetailPastVisits] = useState(null);
  const [detailPastVisitsOpen, setDetailPastVisitsOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [scheduledDate, setScheduledDate] = useState(null);
  const [scheduledFrom, setScheduledFrom] = useState("");
  const [scheduledTo, setScheduledTo] = useState("");
  const [scheduleType, setScheduleType] = useState("custom");
  const [selectedPreset, setSelectedPreset] = useState("fullDay");
  const [dayTypeTab, setDayTypeTab] = useState("working");
  const [internalNoteDraft, setInternalNoteDraft] = useState("");
  const [internalNoteDialogOpen, setInternalNoteDialogOpen] = useState(false);
  // Registration (row or selected visit) currently being edited by the
  // standalone internal-note dialog — not necessarily the open detail panel.
  const [internalNoteTarget, setInternalNoteTarget] = useState(null);
  const [internalNoteSaving, setInternalNoteSaving] = useState(false);
  const [specificDays, setSpecificDays] = useState([]);
  const [specificEndDate, setSpecificEndDate] = useState(null);
  const [selectedAccessLevelIds, setSelectedAccessLevelIds] = useState([]);
  const [allowMultiCheckin, setAllowMultiCheckin] = useState(false);
  const [allowParking, setAllowParking] = useState(false);
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [vehiclePlateError, setVehiclePlateError] = useState("");
  const [approvalNote, setApprovalNote] = useState("");
  const [approvalInternalNote, setApprovalInternalNote] = useState("");
  const [isVip, setIsVip] = useState(false);
  const [escortRequired, setEscortRequired] = useState(true);
  const [vipReason, setVipReason] = useState("");
  const [vipReasonError, setVipReasonError] = useState("");
  const [accessLevelError, setAccessLevelError] = useState("");
  const [hostConfig, setHostConfig] = useState(null);
  const [accessLevels, setAccessLevels] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [activeCustomFields, setActiveCustomFields] = useState([]);

  // Update the shared schedule state and auto-enable Allow Multiple Check-ins
  // whenever the resulting schedule spans more than one day (Full Week / Full
  // Month / Specific Days). Only ever turns it ON — staff can still toggle it
  // off after, and a single-day schedule keeps its current value.
  const computeDaySet = (mode, cfg) => {
    const wd = cfg?.workingDays ?? [0, 1, 2, 3, 4];
    const we = cfg?.weekendDays ?? [5, 6];
    return mode === "all" ? [...new Set([...wd, ...we])] : wd;
  };

  const applySchedule = (patch) => {
    const nextType = patch.scheduleType ?? scheduleType;
    const nextPreset = patch.selectedPreset ?? selectedPreset;
    const nextDays = patch.specificDays ?? specificDays;
    const nextTab = patch.dayTypeTab ?? dayTypeTab;
    const nextEnd = patch.specificEndDate ?? specificEndDate;
    const nextDate = patch.scheduledDate ?? scheduledDate;
    let weekdays = [];
    if (nextType === "preset" && (nextPreset === "fullWeek" || nextPreset === "fullMonth")) {
      weekdays = computeDaySet(nextTab, hostConfig);
    } else if (nextType === "preset" && nextPreset === "specificDays") {
      weekdays = nextDays;
    }
    const dayCount = countScheduledDays({
      isPreset: nextType === "preset",
      preset: nextPreset,
      startDate: nextDate,
      endDate: nextEnd,
      weekdays,
    });
    setScheduleType(nextType);
    setSelectedPreset(nextPreset);
    setSpecificDays(nextDays);
    setSpecificEndDate(nextEnd);
    setScheduledDate(nextDate);
    setDayTypeTab(nextTab);
    if (dayCount > 1) setAllowMultiCheckin(true);
  };

  // True when an edited From/To pair lies on different calendar days.
  const editScheduleSpansMultiple = (fromVal, toVal) => {
    if (!editForm?.hasApproved || !fromVal || !toVal) return false;
    const from = dayjs(fromVal);
    const to = dayjs(toVal);
    return from.isValid() && to.isValid() && !from.isSame(to, "day");
  };

  // ── Override status dropdown menu anchor ──
  const [overrideMenuAnchor, setOverrideMenuAnchor] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // ── New Request (admin-created visit) ──
  const [newVisitOpen, setNewVisitOpen] = useState(false);
  const [visitorSearchInput, setVisitorSearchInput] = useState("");
  const [visitorMenuOpen, setVisitorMenuOpen] = useState(false);
  const [visitorOptions, setVisitorOptions] = useState([]);
  const [visitorOptionsLoading, setVisitorOptionsLoading] = useState(false);
  const [selectedVisitors, setSelectedVisitors] = useState([]);
  const [newDepartmentId, setNewDepartmentId] = useState("");
  const [newPurpose, setNewPurpose] = useState("");
  const [newPurposeOther, setNewPurposeOther] = useState("");
  const [newNdaAccepted, setNewNdaAccepted] = useState(false);
  const [newGroupMeeting, setNewGroupMeeting] = useState(false);
  const [newMeetingName, setNewMeetingName] = useState("");
  // Map: visitorId → true (NDA needed) | false (NDA valid)
  const [ndaStatusMap, setNdaStatusMap] = useState({});
  const [newVisitSubmitting, setNewVisitSubmitting] = useState(false);
  const [newVisitAccessLevelError, setNewVisitAccessLevelError] = useState("");
  const [newRequestVisitCount, setNewRequestVisitCount] = useState(null);
  const [visitorVisitCounts, setVisitorVisitCounts] = useState({});

  // ── Batch Update ──
  const [selectMode, setSelectMode] = useState(false);
  const [selectedRowIds, setSelectedRowIds] = useState(new Set());
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchTargetStatus, setBatchTargetStatus] = useState("");
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [batchTimestamp, setBatchTimestamp] = useState(null);
  const [batchAccessLevelError, setBatchAccessLevelError] = useState("");
  const [batchVisitCount, setBatchVisitCount] = useState(null);
  const [batchVisitorVisitCounts, setBatchVisitorVisitCounts] = useState({});

  // ── Badge / Export ──
  const [badgeTemplate, setBadgeTemplate] = useState(null);
  const [exportingXlsx, setExportingXlsx] = useState(false);
  const [exportingBadges, setExportingBadges] = useState(false);

  // ── Fetch visits ──
  const fetchVisits = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setIsListRefreshing(true);
    try {
      const BATCH_SIZE = 50;
      const result = await getRegistrations(null, {}, undefined, { page: 1, limit: BATCH_SIZE });
      setRows(result.data || []);
      setTotalCount(result.total || 0);
      if (result.total > BATCH_SIZE) {
        setIsStreaming(true);
      }
      if (!quiet) setHasLoadedOnce(true);
    } catch {
      if (!quiet) setHasLoadedOnce(true);
    } finally {
      setLoading(false);
      setIsListRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchVisits();
  }, [fetchVisits]);

  // ── Load configs ──
  useEffect(() => {
    getAccessLevels()
      .then((d) => setAccessLevels(Array.isArray(d) ? d : []))
      .catch(() => {});
    getDepartments()
      .then((d) => setDepartments(Array.isArray(d) ? d : []))
      .catch(() => {});
    getCustomFields()
      .then((fields) =>
        setActiveCustomFields(
          Array.isArray(fields) ? fields.filter((f) => f.isActive) : [],
        ),
      )
      .catch(() => {});
    getDefaultBadgeTemplate()
      .then(setBadgeTemplate)
      .catch(() => {});
    getWorkingHours()
      .then((d) => setHostConfig(d ?? null))
      .catch(() => {});
  }, []);

  // ── Socket listeners (same pattern as registrations) ──
  const { on } = useSocket();
  const searchParams = useSearchParams();
  // Deep-link from the Recent Activity page (/?visit=<id>) — open that visit's profile.
  const deepVisitId = searchParams?.get("visit") || null;
  const openedDeepVisitRef = useRef(null);
  useEffect(() => {
    if (!deepVisitId || openedDeepVisitRef.current === deepVisitId) return;
    openedDeepVisitRef.current = deepVisitId;
    handleOpenProfile({ id: deepVisitId });
  }, [deepVisitId]);
  useEffect(() => {
    const unsubNew = on("registration:new", (newReg) => {
      if (!newReg?.id) {
        fetchVisits(true);
        return;
      }
      const mapped = mapRegistration(newReg);
      setRows((prev) => {
        const exists = prev.some((r) => r.id === mapped.id);
        if (exists) return prev;
        return [mapped, ...prev];
      });
    });

    const unsubUpdated = on("registration:updated", (updatedReg) => {
      if (!updatedReg?.id) return;
      const mapped = mapRegistration(updatedReg);
      setRows((prev) =>
        prev.map((r) => (r.id === mapped.id ? { ...r, ...mapped } : r)),
      );
      if (selected?.id === mapped.id) {
        setSelected((prev) => (prev ? { ...prev, ...mapped } : prev));
      }
      // Refresh activity logs if the timeline modal is open for this registration
      if (timelineVisitIdRef.current === mapped.id) {
        getRegistrationActivityLogs(mapped.id).then((logs) => {
          setTimelineLogs(Array.isArray(logs) ? logs : []);
        });
      }
    });

    const unsubOverstay = on("overstay:alert", (data) => {
      if (!data?.registrationId) return;
      // Update overstay flag on the registration in the list
      setRows((prev) =>
        prev.map((r) =>
          r.id === data.registrationId ? { ...r, overstay: true } : r,
        ),
      );
      // If the affected registration is currently selected, update it and refresh activity logs
      if (selected?.id === data.registrationId) {
        setSelected((prev) => (prev ? { ...prev, overstay: true } : prev));
        getRegistrationActivityLogs(data.registrationId).then((logs) => {
          setTimelineLogs(Array.isArray(logs) ? logs : []);
        });
      }
    });

    const unsubProgress = on("registrations:progress", (payload) => {
      if (payload.data?.length) {
        const mapped = payload.data.map(mapRegistration);
        setRows((prev) => {
          const existing = new Set(prev.map((r) => r.id));
          const fresh = mapped.filter((r) => !existing.has(r.id));
          return fresh.length ? [...prev, ...fresh] : prev;
        });
      }
      if (payload.loaded >= payload.total) {
        setIsStreaming(false);
      }
    });

    return () => {
      unsubNew?.();
      unsubUpdated?.();
      unsubOverstay?.();
      unsubProgress?.();
    };
  }, [on, fetchVisits, selected?.id]);

  // ── Filtering ──
  const getDateRangeFromPreset = useCallback((preset, cf, ct) => {
    if (preset === "custom") {
      return { from: cf || null, to: ct || null };
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

  const filtered = useMemo(() => {
    const { from, to } = getDateRangeFromPreset(
      datePreset,
      customFrom,
      customTo,
    );
    return Array.isArray(rows)
      ? rows.filter((r) => {
          if (search) {
            const q = search.toLowerCase();
            const fvText = Array.isArray(r.fieldValues)
              ? r.fieldValues.map((fv) => fv.value || "").join(" ")
              : "";
            const participantsText = Array.isArray(r.participants)
              ? r.participants
                  .map((p) =>
                    [p.fullName, p.email, p.phone, p.companyName]
                      .filter(Boolean)
                      .join(" "),
                  )
                  .join(" ")
              : "";
            const match = [
              r.id,
              r.full_name,
              r.email,
              r.purpose_of_visit,
              r.visitor?.idNumber,
              fvText,
              participantsText,
            ]
              .join(" ")
              .toLowerCase()
              .includes(q);
            const phoneMatch =
              phoneMatchesQuery(r.phone, search, r.phone_iso_code || r.visitor?.iso_code) ||
              phoneMatchesQuery(r.visitor?.phone, search, r.visitor?.iso_code);
            if (!match && !phoneMatch) return false;
          }
          if (statusFilter !== "all" && r.status !== statusFilter) return false;
          if (vipFastTrackOnly && !r.is_vip_fast_track) return false;
          if (
            groupMeetingOnly &&
            !(Array.isArray(r.participants) && r.participants.length > 1)
          )
            return false;
          if (from || to) {
            const createdAt = r.created_at || r.createdAt;
            if (createdAt) {
              const d = dayjs(createdAt);
              if (
                from &&
                d.isBefore(
                  /^\d{4}-\d{2}-\d{2}$/.test(from)
                    ? dayjs(from).startOf("day")
                    : dayjs(from),
                )
              )
                return false;
              if (
                to &&
                d.isAfter(
                  /^\d{4}-\d{2}-\d{2}$/.test(to)
                    ? dayjs(to).endOf("day")
                    : dayjs(to),
                )
              )
                return false;
            }
          }
          // ── Requested visit date range ──
          if (requestDateFrom || requestDateTo) {
            const rf = r.requested_from || r.requestedFrom;
            if (!rf) return false;
            const d = dayjs(rf);
            if (requestDateFrom && d.isBefore(dayjs(requestDateFrom)))
              return false;
            if (requestDateTo && d.isAfter(dayjs(requestDateTo).endOf("day")))
              return false;
          }
          // ── Requested visit time ──
          if (requestTimeFilter.enabled) {
            const rf = r.requested_from || r.requestedFrom;
            if (rf) {
              const t = dayjs(rf);
              const hours = requestTimeFilter.hour12
                ? parseInt(requestTimeFilter.hour12, 10)
                : null;
              if (hours) {
                const h24 =
                  requestTimeFilter.ampm === "PM" && hours < 12
                    ? hours + 12
                    : requestTimeFilter.ampm === "AM" && hours === 12
                      ? 0
                      : hours;
                const mins = parseInt(requestTimeFilter.minute, 10) || 0;
                if (t.hour() !== h24 || t.minute() !== mins) return false;
              }
            } else {
              return false;
            }
          }
          // ── Approved visit date range ──
          if (approvedDateFrom || approvedDateTo) {
            const af = r.approved_from || r.approvedFrom;
            if (!af) return false;
            const d = dayjs(af);
            if (approvedDateFrom && d.isBefore(dayjs(approvedDateFrom)))
              return false;
            if (approvedDateTo && d.isAfter(dayjs(approvedDateTo).endOf("day")))
              return false;
          }
          // ── Approved visit time ──
          if (approvedTimeFilter.enabled) {
            const af = r.approved_from || r.approvedFrom;
            if (af) {
              const t = dayjs(af);
              const hours = approvedTimeFilter.hour12
                ? parseInt(approvedTimeFilter.hour12, 10)
                : null;
              if (hours) {
                const h24 =
                  approvedTimeFilter.ampm === "PM" && hours < 12
                    ? hours + 12
                    : approvedTimeFilter.ampm === "AM" && hours === 12
                      ? 0
                      : hours;
                const mins = parseInt(approvedTimeFilter.minute, 10) || 0;
                if (t.hour() !== h24 || t.minute() !== mins) return false;
              }
            } else {
              return false;
            }
          }
          return true;
        })
      : [];
  }, [
    rows,
    search,
    statusFilter,
    vipFastTrackOnly,
    groupMeetingOnly,
    datePreset,
    customFrom,
    customTo,
    getDateRangeFromPreset,
    requestDateFrom,
    requestDateTo,
    requestTimeFilter,
    approvedDateFrom,
    approvedDateTo,
    approvedTimeFilter,
  ]);

  const pagedRows = useMemo(() => {
    const start = page * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, page, rowsPerPage]);

  const activeFiltersCount =
    (statusFilter !== "all" ? 1 : 0) +
    (vipFastTrackOnly ? 1 : 0) +
    (groupMeetingOnly ? 1 : 0) +
    (datePreset !== "all" ? 1 : 0) +
    (requestDateFrom || requestDateTo ? 1 : 0) +
    (requestTimeFilter.enabled ? 1 : 0) +
    (approvedDateFrom || approvedDateTo ? 1 : 0) +
    (approvedTimeFilter.enabled ? 1 : 0);

  // ── Helpers ──
  const getDateRangeForPreset = useCallback(() => {
    const { from, to } = getDateRangeFromPreset(
      datePreset,
      customFrom,
      customTo,
    );
    return { from, to };
  }, [datePreset, customFrom, customTo, getDateRangeFromPreset]);

  // ── Profile / Detail ──
  const handleOpenProfile = async (row) => {
    setFetchingProfile(true);
    setSelected(row);
    setDetailPastVisits(null);
    setDetailPastVisitsOpen(false);
    setDetailTab(0);
    setOrders([]);
    setOrdersLoading(true);
    try {
      const full = await getRegistrationById(row.id);
      if (full) {
        setSelected(full);
        setInternalNoteDraft(full?.internal_note ?? row?.internal_note ?? "");
        setInternalNoteDialogOpen(false);
      }
      // Past-visit breakdown for the detail header — the visit being viewed is
      // excluded from every member's count. Group meetings show each member's
      // history separately.
      try {
        setDetailPastVisits(
          await resolvePastVisitBreakdown(full ?? row, getRegistrations),
        );
      } catch {
        setDetailPastVisits(null);
      }
      getKitchenOrders(row.id)
        .then((res) => setOrders(Array.isArray(res) ? res : []))
        .catch(() => {})
        .finally(() => setOrdersLoading(false));
    } catch {
      setOrdersLoading(false);
    } finally {
      setFetchingProfile(false);
    }
  };

  const openVisitorDetails = (visitorId, seed) =>
    setVisitorDialog({ open: true, visitorId, seed: seed || null });

  const handleSaveInternalNote = async () => {
    const targetId = internalNoteTarget?.id;
    if (!targetId) return;
    setInternalNoteSaving(true);
    try {
      const res = await updateInternalNote(
        targetId,
        internalNoteDraft.trim() || "",
      );
      if (res?.error) return;
      const saved = (res?.internalNote ?? internalNoteDraft.trim()) || null;
      setSelected((prev) =>
        prev?.id === targetId
          ? { ...prev, internal_note: saved, internalNote: saved }
          : prev,
      );
      setRows((prev) =>
        prev.map((r) =>
          r.id === targetId
            ? { ...r, internal_note: saved, internalNote: saved }
            : r,
        ),
      );
      setInternalNoteDraft(saved || "");
      setInternalNoteDialogOpen(false);
      setInternalNoteTarget(null);
      showMessage("Internal note saved", "success");
    } catch (e) {
      showMessage(
        e?.response?.data?.message || e?.message || "Failed to save internal note",
        "error",
      );
    } finally {
      setInternalNoteSaving(false);
    }
  };

  // ── Status transition ──
  const handleStatusAction = async (targetStatus, isOverrideAction = false) => {
    const target = statusModal || selected;
    if (!target) return;
    const transitionConfig = STATUS_CONFIG[targetStatus];
    if (
      [
        "cancelled",
        "checked_in",
        "checked_out",
        "visit_ended",
        "expired",
      ].includes(targetStatus)
    ) {
      const messages = {
        cancelled: "Are you sure you want to cancel this visit?",
        checked_in: isOverrideAction
          ? "Force check-in? This will bypass time/schedule constraints."
          : "Confirm check-in for this visitor?",
        checked_out: "Confirm check-out for this visitor?",
        visit_ended: "Are you sure you want to mark this visit as ended?",
        expired: "Are you sure you want to mark this visit as expired?",
      };
      const message =
        messages[targetStatus] ??
        `Change status to "${STATUS_CONFIG[targetStatus]?.label || targetStatus}"?`;
      setConfirmModal({ open: true, targetStatus, message, isOverride: isOverrideAction });
      const now = new Date().toISOString();
      setCustomTimestamp(now);
      customTimestampRef.current = now;
      setStatusModal(null);
      return;
    }
    if (targetStatus === "admin_approved" || targetStatus === "approved") {
      openApprove(target, targetStatus, isOverrideAction);
      setStatusModal(null);
      return;
    }
    if (targetStatus === "rejected") {
      setRejectTarget({ ...target, _override: isOverrideAction });
      setRejectReason("");
      setStatusModal(null);
      return;
    }
  };

  const handleConfirm = async () => {
    if (!confirmModal.open) return;
    setActionLoading(true);
    try {
      const isOverride = confirmModal.isOverride ?? false;
      const clientTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const result = await updateStatus(selected?.id, {
        status: confirmModal.targetStatus,
        override: isOverride,
        timestamp: customTimestampRef.current,
        clientTimezone,
      });
      if (result?.error) return;
      showMessage(
        `Visit ${confirmModal.targetStatus.replace(/_/g, " ")} successfully`,
        "success",
      );
      setConfirmModal({ open: false, targetStatus: null, message: "" });
      setCustomTimestamp(null);
      setSelected(null);
      fetchVisits(true);
    } catch (e) {
      showMessage(
        e?.response?.data?.message || e?.response?.data?.error || e?.message || "Failed to update status",
        "error",
      );
    } finally {
      setActionLoading(false);
    }
  };

  // ── Time selection helpers (from approvals page) ──
  const buildAllHoursDetailed = () =>
    Array.from({ length: 24 }, (_, h24) => ({
      h24,
      h12: h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24,
      ampm: h24 < 12 ? "AM" : "PM",
    }));

  const getAllowedHours12 = () => buildAllHoursDetailed();

  const getAllowedMinutes = () => MINUTES;

  const handleTimePartChange = (type, part, value) => {
    const timeValue = type === "scheduledFrom" ? scheduledFrom : scheduledTo;
    const current = parse24To12(timeValue);
    const next = { ...current, [part]: value };
    const time24 = convert12To24(next.hour12, next.minute, next.ampm);

    const fmtHM = (mins) =>
      `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
    const minsOf = (str) => {
      const [h, m] = (str || "00:00").split(":").map(Number);
      return h * 60 + m;
    };
    if (type === "scheduledFrom") {
      const fromMin = minsOf(time24);
      if (scheduledTo <= time24) {
        const target = Math.min(fromMin + 60, 23 * 60 + 55);
        if (target > fromMin) {
          // Push the end after the new start, capped at 11:55 PM (never 12 AM).
          setScheduledFrom(time24);
          setScheduledTo(fmtHM(target));
        } else {
          // Start is at the last slot of the day: step it back so the end can stay strictly after it.
          setScheduledFrom(fmtHM(Math.max(fromMin - 5, 0)));
          setScheduledTo(fmtHM(23 * 60 + 55));
        }
      } else {
        setScheduledFrom(time24);
      }
    } else {
      const toMin = minsOf(time24);
      if (scheduledFrom >= time24) {
        const lowered = Math.max(toMin - 60, 0);
        if (lowered >= toMin) {
          // End is at the first slot of the day: nudge it forward instead.
          setScheduledTo(fmtHM(Math.min(toMin + 5, 23 * 60 + 55)));
        } else {
          // Pull the start before the new end, floored at 12:00 AM.
          setScheduledTo(time24);
          setScheduledFrom(fmtHM(lowered));
        }
      } else {
        setScheduledTo(time24);
      }
    }
  };

  const renderTimeDropdowns = (type, label) => {
    const timeValue = type === "scheduledFrom" ? scheduledFrom : scheduledTo;
    const { hour12, minute, ampm } = parse24To12(timeValue);
    const rawHours = getAllowedHours12();
    // Deduplicate by h12 value (AM/PM is a separate picker) and sort 1→12
    const allowedHours = [
      ...new Map(rawHours.map((h) => [h.h12, h])).values(),
    ].sort((a, b) => (a.h12 === 12 ? 13 : a.h12) - (b.h12 === 12 ? 13 : b.h12));
    const h24 = timeValue.split(":").map(Number)[0];
    const allowedMin = getAllowedMinutes();

    return (
      <Box>
        <Typography
          variant="caption"
          fontWeight={700}
          color="text.secondary"
          sx={{
            ml: 1,
            mb: 0.5,
            display: "block",
            textTransform: "uppercase",
            fontSize: "0.6rem",
          }}
        >
          {label}
        </Typography>
        <Stack direction="row" spacing={0.5}>
          <Box sx={{ flex: 1.2 }}>
            <Typography
              variant="caption"
              sx={{
                fontSize: "0.6rem",
                fontWeight: 700,
                ml: 1,
                color: "text.secondary",
                textTransform: "uppercase",
              }}
            >
              Hr
            </Typography>
            <TextField
              select
              size="small"
              value={hour12}
              onChange={(e) =>
                handleTimePartChange(type, "hour12", e.target.value)
              }
              sx={{
                width: "100%",
                "& .MuiOutlinedInput-root": { borderRadius: 30 },
                "& .MuiSelect-select": { fontSize: "0.75rem", py: 1, px: 1 },
              }}
            >
              {allowedHours.map(({ h12, ampm: a }) => (
                <MenuItem
                  key={`${h12}${a}`}
                  value={h12}
                  sx={{ fontSize: "0.75rem" }}
                >
                  {h12}
                </MenuItem>
              ))}
            </TextField>
          </Box>
          <Box sx={{ flex: 1.2 }}>
            <Typography
              variant="caption"
              sx={{
                fontSize: "0.6rem",
                fontWeight: 700,
                ml: 1,
                color: "text.secondary",
                textTransform: "uppercase",
              }}
            >
              Min
            </Typography>
            <TextField
              select
              size="small"
              value={minute}
              onChange={(e) =>
                handleTimePartChange(type, "minute", e.target.value)
              }
              sx={{
                width: "100%",
                "& .MuiOutlinedInput-root": { borderRadius: 30 },
                "& .MuiSelect-select": { fontSize: "0.75rem", py: 1, px: 1 },
              }}
            >
              {allowedMin.map((m) => (
                <MenuItem key={m} value={m} sx={{ fontSize: "0.75rem" }}>
                  {m}
                </MenuItem>
              ))}
            </TextField>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography
              variant="caption"
              sx={{
                fontSize: "0.6rem",
                fontWeight: 700,
                ml: 1,
                color: "text.secondary",
                textTransform: "uppercase",
              }}
            >
              AM/PM
            </Typography>
            <TextField
              select
              size="small"
              value={ampm}
              onChange={(e) =>
                handleTimePartChange(type, "ampm", e.target.value)
              }
              sx={{
                width: "100%",
                "& .MuiOutlinedInput-root": { borderRadius: 30 },
                "& .MuiSelect-select": { fontSize: "0.75rem", py: 1, px: 1 },
              }}
            >
              {PERIODS.map((p) => (
                <MenuItem key={p} value={p} sx={{ fontSize: "0.75rem" }}>
                  {p}
                </MenuItem>
              ))}
            </TextField>
          </Box>
        </Stack>
      </Box>
    );
  };

  const getDuration = () => {
    const [fromH, fromM] = scheduledFrom.split(":").map(Number);
    const [toH, toM] = scheduledTo.split(":").map(Number);

    const fromMinutes = fromH * 60 + fromM;
    const toMinutes = toH * 60 + toM;

    if (toMinutes <= fromMinutes) {
      return 0;
    }

    return toMinutes - fromMinutes;
  };

  // Mirror the backend's outside-working-hours / outside-working-days flags for the
  // schedule currently selected in the dialog, so the CMS warns the same way the
  // public booking page respects the host's working window and working days.
  const getScheduleOutsideInfo = () => {
    const startH = hostConfig?.start ?? 8;
    const startM = hostConfig?.startMinute ?? 0;
    const endH = hostConfig?.end ?? 17;
    const endM = hostConfig?.endMinute ?? 0;
    const startMoD = startH * 60 + startM;
    const endMoD = endH * 60 + endM;
    const workingDays = hostConfig?.workingDays ?? [0, 1, 2, 3, 4];
    const weekendDays = hostConfig?.weekendDays ?? [5, 6];
    const parseMoD = (val) => {
      const [h, m] = (val || "00:00").split(":").map(Number);
      return h * 60 + m;
    };

    // Effective time window. Full Day always snaps to the exact working window.
    let fromMoD;
    let toMoD;
    if (scheduleType === "preset" && selectedPreset === "fullDay") {
      fromMoD = startMoD;
      toMoD = endMoD;
    } else {
      fromMoD = parseMoD(scheduledFrom);
      toMoD = parseMoD(scheduledTo);
    }
    const outsideHours = !(
      fromMoD >= startMoD &&
      fromMoD <= endMoD &&
      toMoD >= startMoD &&
      toMoD <= endMoD
    );

    // Effective day(s) this schedule targets.
    let outsideDays = false;
    let offDays = [];
    if (
      scheduleType === "preset" &&
      (selectedPreset === "fullWeek" || selectedPreset === "fullMonth")
    ) {
      const days = computeDaySet(dayTypeTab, hostConfig);
      offDays = days.filter((d) => weekendDays.includes(d));
      outsideDays = offDays.length > 0;
    } else if (scheduleType === "preset" && selectedPreset === "specificDays") {
      offDays = specificDays.filter((d) => weekendDays.includes(d));
      outsideDays = offDays.length > 0;
    } else if (scheduledDate) {
      // custom or fullDay → single calendar day
      const dow = scheduledDate.day();
      if (!workingDays.includes(dow)) {
        outsideDays = true;
        offDays = [dow];
      }
    }

    return {
      outsideHours,
      outsideDays,
      offDays,
      startH,
      startM,
      endH,
      endM,
    };
  };

  const renderScheduleOutsideWarning = () => {
    const info = getScheduleOutsideInfo();
    if (!info.outsideHours && !info.outsideDays) return null;
    const parts = [];
    if (info.outsideDays) {
      parts.push(
        info.offDays.length
          ? t.outsideWorkingDays.replace(
              "{{days}}",
              info.offDays.map((d) => DAY_LABELS[d]).join(", "),
            )
          : "outside working days",
      );
    }
    if (info.outsideHours) {
      parts.push(t.outsideWorkingHours);
    }
    const joinedParts = parts.reduce(
      (acc, part, i) => (
        <Fragment key={i}>
          {acc}
          {i > 0 ? " and " : null}
          {part}
        </Fragment>
      ),
      null,
    );
    return (
      <Box sx={{ mt: 1.5, p: 1, bgcolor: "warning.main", borderRadius: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <ICONS.warning
            sx={{ fontSize: 14, color: "warning.contrastText" }}
          />
          <Typography
            variant="caption"
            fontWeight={700}
            color="warning.contrastText"
            sx={{ fontSize: 11 }}
          >
            This visit falls {joinedParts}.
          </Typography>
        </Stack>
      </Box>
    );
  };

  // ── Approve flow ──
  const openApprove = async (row, pendingStatus, isOverrideAction = false) => {
    setFetchingProfile(true);
    try {
      const fullReg = await getRegistrationById(row.id);

      // For admin_approved registrations (superadmin doing final approval),
      // prefill from what the dept admin already set; otherwise use visitor's requested slot.
      const isAdminApproved = fullReg.status === "admin_approved";
      const scheduleFrom = isAdminApproved
        ? fullReg.approved_from
        : fullReg.requested_from;
      const scheduleTo = isAdminApproved
        ? fullReg.approved_to
        : fullReg.requested_to;

      let detectedType = "custom";
      let detectedPreset = "fullDay";

      const rType = fullReg.recurring_type ?? fullReg.recurringType ?? null;
      if (rType === "specific_days") {
        detectedType = "preset";
        detectedPreset = "specificDays";
      } else if (rType === "full_week") {
        detectedType = "preset";
        detectedPreset = "fullWeek";
      } else if (rType === "full_month") {
        detectedType = "preset";
        detectedPreset = "fullMonth";
      } else if (scheduleFrom && scheduleTo) {
        const dateFrom = getLocalDate(scheduleFrom);
        const dateTo = getLocalDate(scheduleTo);
        const timeFrom = getLocalTime(scheduleFrom);
        const timeTo = getLocalTime(scheduleTo);

        if (dateFrom && dateTo) {
          const d1 = dayjs(dateFrom);
          const d2 = dayjs(dateTo);
          const daysDiff = d2.diff(d1, "days");

          // Full Day = same calendar day spanning exactly the host working window
          const startStr = hostConfig
            ? `${String(hostConfig.start).padStart(2, "0")}:${String(hostConfig.startMinute ?? 0).padStart(2, "0")}`
            : "08:00";
          const endStr = hostConfig
            ? `${String(hostConfig.end).padStart(2, "0")}:${String(hostConfig.endMinute ?? 0).padStart(2, "0")}`
            : "17:00";

          if (daysDiff === 0 && timeFrom === startStr && timeTo === endStr) {
            detectedType = "preset";
            detectedPreset = "fullDay";
          } else if (daysDiff === 6) {
            detectedType = "preset";
            detectedPreset = "fullWeek";
          } else if (daysDiff === 30) {
            detectedType = "preset";
            detectedPreset = "fullMonth";
          } else {
            detectedType = "custom";
          }
        }
      }

      setScheduleType(detectedType);
      if (detectedType === "preset") {
        setSelectedPreset(detectedPreset);
      }
      // Detect day type from recurring days or requested day-of-week
      let detectedDayType = "working";
      const rDays = fullReg.recurring_days ?? fullReg.recurringDays ?? null;
      if (hostConfig && Array.isArray(rDays) && rDays.length > 0) {
        const hasWeekend = rDays.some((d) =>
          (hostConfig.weekendDays ?? [5, 6]).includes(d),
        );
        if (hasWeekend) detectedDayType = "all";
      } else if (hostConfig && scheduleFrom) {
        const d = dayjs(scheduleFrom);
        const dow = d.day();
        if ((hostConfig.weekendDays ?? [5, 6]).includes(dow))
          detectedDayType = "all";
      }
      setDayTypeTab(detectedDayType);
      if (rType === "specific_days" && Array.isArray(rDays)) {
        setSpecificDays([...rDays]);
      } else {
        setSpecificDays([]);
      }
      setSpecificEndDate(null);

      if (scheduleFrom) {
        const dateFrom = getLocalDate(scheduleFrom);
        const timeFrom = getLocalTime(scheduleFrom) || "09:00";
        const timeTo = getLocalTime(scheduleTo) || "18:00";

        if (dateFrom) {
          setScheduledDate(dayjs(dateFrom));
          setScheduledFrom(timeFrom);
          setScheduledTo(timeTo);
        }
      } else {
        setScheduledDate(dayjs());
        setScheduledFrom("09:00");
        setScheduledTo("18:00");
      }
      // Prefill access zones from the existing multi or single selection
      const prefillIds = isAdminApproved
        ? fullReg.access_levels?.length
          ? fullReg.access_levels.map((al) => al.id)
          : fullReg.accessLevels?.length
            ? fullReg.accessLevels.map((al) => al.id)
            : fullReg.access_level_id || fullReg.accessLevelId
              ? [fullReg.access_level_id || fullReg.accessLevelId]
              : []
        : [];
      setSelectedAccessLevelIds(prefillIds);
      // When approving a pending registration, auto-enable Allow Multiple
      // Check-ins if the requested route already flags it or spans more than
      // one day. Already-approved visits keep their stored value.
      const seedStart = getLocalDate(scheduleFrom);
      const seedEnd = getLocalDate(scheduleTo);
      const seedMulti =
        detectedType === "preset" &&
        seedStart &&
        countScheduledDays({
          isPreset: true,
          preset: detectedPreset,
          startDate: seedStart,
          endDate: detectedPreset === "specificDays" ? seedEnd : null,
          weekdays:
            detectedPreset === "fullWeek" || detectedPreset === "fullMonth"
              ? detectedDayType === "working"
                ? (hostConfig?.workingDays ?? [0, 1, 2, 3, 4])
                : (hostConfig?.weekendDays ?? [5, 6])
              : detectedPreset === "specificDays"
                ? Array.isArray(rDays)
                  ? rDays
                  : []
                : [],
        }) > 1;
      setAllowMultiCheckin(
        isAdminApproved
          ? (fullReg.allow_multi_checkin ?? false)
          : (fullReg.allow_multi_checkin || seedMulti),
      );
      const prefillParking = isAdminApproved
        ? (fullReg.allow_parking ?? false)
        : false;
      setAllowParking(prefillParking);
      setVehiclePlate(prefillParking ? (fullReg.vehicle_plate ?? "") : "");
      setVehiclePlateError("");
      setApprovalNote(isAdminApproved ? (fullReg.approval_note ?? "") : "");
      setApprovalInternalNote(
        canReadInternalNote
          ? fullReg?.internal_note ?? fullReg?.internalNote ?? ""
          : "",
      );
      const prefillVip = isAdminApproved ? (fullReg.is_vip ?? false) : false;
      setIsVip(prefillVip);
      setEscortRequired(
        isAdminApproved ? (fullReg.escort_required ?? true) : true,
      );
      setVipReason(prefillVip ? (fullReg.vip_reason ?? "") : "");
      setVipReasonError("");
      setAccessLevelError("");

      setApproveTarget({ ...fullReg, _pendingStatus: pendingStatus, _override: isOverrideAction });
      // Fetch past-visit breakdown for returning visitor badge. The registration
      // being approved is excluded from every member's count. Group meetings
      // show each member's history separately, never a summed number.
      try {
        setApprovePastVisits(
          await resolvePastVisitBreakdown(fullReg, getRegistrations),
        );
        setPastVisitsOpen(false);
      } catch {
        setApprovePastVisits(null);
      }
    } catch {
    } finally {
      setFetchingProfile(false);
    }
  };

  const handleApprove = async () => {
    if (!approveTarget) return;
    if (!scheduledDate) {
      showMessage("Please select a date.", "warning");
      return;
    }
    const inlineErrors = [];
    if (!selectedAccessLevelIds.length) {
      const msg = "At least one access zone is required";
      setAccessLevelError(msg);
      inlineErrors.push(msg);
    }
    if (allowParking && !vehiclePlate.trim()) {
      const msg =
        "Vehicle plate number is required when parking is enabled";
      setVehiclePlateError(msg);
      inlineErrors.push(msg);
    }
    if (isVip && !vipReason.trim()) {
      const msg = "A reason is required when marking a visitor as VIP";
      setVipReasonError(msg);
      inlineErrors.push(msg);
    }
    if (inlineErrors.length > 0) {
      showMessage(inlineErrors.join(", "), "error");
      return;
    }
    setSubmitting(true);
    try {
      let fromDate, toDate;
      let fromTime = scheduledFrom;
      let toTime = scheduledTo;
      if (scheduleType === "preset") {
        const date = scheduledDate;
        let from = date.clone();
        let to = date.clone();

        if (selectedPreset === "fullDay") {
          const startH = hostConfig?.start ?? 8;
          const startM = hostConfig?.startMinute ?? 0;
          const endH = hostConfig?.end ?? 17;
          const endM = hostConfig?.endMinute ?? 0;
          fromTime = `${String(startH).padStart(2, "0")}:${String(startM).padStart(2, "0")}`;
          toTime = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
          // Full Day = same calendar day, working-hours window (mirrors public booking page)
          from = from.hour(startH).minute(startM);
          to = to.hour(endH).minute(endM);
        } else if (selectedPreset === "fullWeek") {
          to = from.clone().add(6, "days");
        } else if (selectedPreset === "fullMonth") {
          to = from.clone().endOf("month");
        } else if (selectedPreset === "specificDays") {
          to = specificEndDate
            ? specificEndDate.clone()
            : from.clone().add(30, "days");
        }

        fromDate = from.format("YYYY-MM-DD");
        toDate = to.format("YYYY-MM-DD");
      } else {
        fromDate = scheduledDate.format("YYYY-MM-DD");
        toDate = scheduledDate.format("YYYY-MM-DD");
      }

      // Overnight visits: end-before-start → roll the end to the next morning.
      toDate = rollOvernightEnd({
        fromDate,
        toDate,
        fromTime,
        toTime,
        isPreset: scheduleType === "preset",
      });

      const targetStatus =
        approveTarget._pendingStatus ||
        (isSuperAdmin ? "approved" : "admin_approved");

      const recurringFields = (() => {
        if (scheduleType !== "preset") return {};
        if (selectedPreset === "specificDays" && specificDays.length > 0) {
          return {
            recurringType: "specific_days",
            recurringDays: specificDays,
            recurringTimeFrom: scheduledFrom,
            recurringTimeTo: scheduledTo,
          };
        }
        if (selectedPreset === "fullWeek" || selectedPreset === "fullMonth") {
          const days = computeDaySet(dayTypeTab, hostConfig);
          return {
            recurringType:
              selectedPreset === "fullWeek" ? "full_week" : "full_month",
            recurringDays: days,
            recurringTimeFrom: scheduledFrom,
            recurringTimeTo: scheduledTo,
          };
        }
        return {};
      })();

      const payload = {
        status: targetStatus,
        override: approveTarget._override ?? false,
        approvedFrom: dayjs(`${fromDate}T${fromTime}`).toISOString(),
        approvedTo: dayjs(`${toDate}T${toTime}`).toISOString(),
        accessLevelIds: selectedAccessLevelIds,
        accessLevelId: selectedAccessLevelIds[0],
        allowMultiCheckin,
        allowParking,
        vehiclePlate: allowParking ? vehiclePlate.trim() : null,
        isVip,
        escortRequired,
        vipReason: isVip ? vipReason.trim() : undefined,
        approvalNote: approvalNote.trim() || undefined,
        ...recurringFields,
      };

      const approveResult = await updateStatus(approveTarget.id, payload);
      if (approveResult?.error) return;
      // Internal note is optional and separately permissioned — persist it only
      // when the current user may write it and supplied a value.
      if (canWriteInternalNote && approvalInternalNote.trim()) {
        const note = approvalInternalNote.trim();
        try {
          const res = await updateInternalNote(approveTarget.id, note);
          const saved = (res?.internalNote ?? note) || null;
          setSelected((prev) =>
            prev?.id === approveTarget.id
              ? { ...prev, internal_note: saved }
              : prev,
          );
          setRows((prev) =>
            prev.map((r) =>
              r.id === approveTarget.id
                ? { ...r, internal_note: saved }
                : r,
            ),
          );
        } catch {
          // best-effort — the approval itself succeeded
        }
      }
      showMessage(
        `Visit ${targetStatus === "approved" ? "approved" : "department approved"} successfully`,
        "success",
      );
      setApproveTarget(null);
      setApprovePastVisits(null);
      setEscortRequired(true);
      setSelected(null);
      fetchVisits(true);
    } catch (e) {
      showMessage(
        e?.response?.data?.message || e?.response?.data?.error || e?.message || "Approval failed",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ── Reject flow ──
  const handleReject = async () => {
    if (!rejectTarget) return;
    if (validateRequired(rejectReason)) {
      showMessage("Please provide a rejection reason", "warning");
      return;
    }
    setSubmitting(true);
    try {
      const rejectResult = await updateStatus(rejectTarget.id, {
        status: "rejected",
        override: rejectTarget._override ?? false,
        rejectionReason: rejectReason.trim(),
      });
      if (rejectResult?.error) return;
      showMessage("Visit rejected", "success");
      setRejectTarget(null);
      setSelected(null);
      fetchVisits(true);
    } catch (e) {
      showMessage(
        e?.response?.data?.message || e?.response?.data?.error || e?.message || "Rejection failed",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ── Edit ──
  const handleCardEdit = async (row) => {
    try {
      const full = await getRegistrationById(row.id);
      setEditForm(buildEditForm(full || row, activeCustomFields));
    } catch {
      setEditForm(buildEditForm(row, activeCustomFields));
    }
  };

  const handleSaveEdit = async () => {
    if (!editForm?.id) return;
    if (
      editForm.scheduleFrom &&
      editForm.scheduleTo &&
      dayjs(editForm.scheduleFrom).isValid() &&
      dayjs(editForm.scheduleTo).isValid() &&
      dayjs(editForm.scheduleFrom).isAfter(dayjs(editForm.scheduleTo))
    ) {
      showMessage("From date & time must be before the To date & time", "error");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        fieldValues: editForm.fieldValues,
      };
      if (editForm.isGroupMeeting) {
        payload.meetingName = editForm.meetingName?.trim() || null;
      }
      if (editForm.hasApproved) {
        if (editForm.scheduleFrom) payload.approvedFrom = editForm.scheduleFrom;
        if (editForm.scheduleTo) payload.approvedTo = editForm.scheduleTo;
        if (editForm.accessLevelIds?.length) {
          payload.accessLevelIds = editForm.accessLevelIds;
          payload.accessLevelId = editForm.accessLevelIds[0];
        }
        payload.allowMultiCheckin = editForm.allowMultiCheckin ?? false;
        payload.allowParking = editForm.allowParking ?? false;
        payload.vehiclePlate = editForm.allowParking
          ? editForm.vehiclePlate?.trim() || ""
          : "";
        payload.isVip = editForm.isVip ?? false;
        payload.vipReason = editForm.isVip
          ? editForm.vipReason?.trim() || ""
          : "";
        payload.escortRequired = editForm.escortRequired ?? true;
      } else {
        if (editForm.scheduleFrom)
          payload.requestedFrom = editForm.scheduleFrom;
        if (editForm.scheduleTo) payload.requestedTo = editForm.scheduleTo;
      }
      if (editForm.departmentId) payload.departmentId = editForm.departmentId;
      const editResult = await updateRegistration(editForm.id, payload);
      if (editResult?.error) return;
      // Internal note is a separately-permissioned field — persist it through
      // its own endpoint only when the user may write it.
      if (canWriteInternalNote) {
        const note =
          typeof editForm.internalNote === "string"
            ? editForm.internalNote.trim()
            : "";
        try {
          const res = await updateInternalNote(editForm.id, note);
          const saved =
            (res?.internalNote ?? note) || null;
          setSelected((prev) =>
            prev?.id === editForm.id ? { ...prev, internal_note: saved } : prev,
          );
          setRows((prev) =>
            prev.map((r) =>
              r.id === editForm.id ? { ...r, internal_note: saved } : r,
            ),
          );
        } catch {
          // best-effort — the visit update still succeeded
        }
      }
      showMessage("Visit updated", "success");
      setEditForm(null);
      fetchVisits(true);
    } catch (e) {
      showMessage(
        e?.response?.data?.message || e?.response?.data?.error || e?.message || "Update failed",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ── New Request ──
  const handleOpenNewRequest = async () => {
    setSelectedVisitors([]);
    setNewDepartmentId(isSuperAdmin ? "" : (user?.departments?.[0]?.id ?? ""));
    setNewPurpose("");
    setNewPurposeOther("");
    setNewNdaAccepted(false);
    setNewGroupMeeting(false);
    setNewMeetingName("");
    setNdaStatusMap({});
    setNewVisitAccessLevelError("");
    setVisitorSearchInput("");
    setVisitorMenuOpen(false);
    setSelectedAccessLevelIds([]);
    setAllowMultiCheckin(false);
    setAllowParking(false);
    setVehiclePlate("");
    setVehiclePlateError("");
    setIsVip(false);
    setEscortRequired(true);
    setVipReason("");
    setVipReasonError("");
    setApprovalNote("");
    setNewRequestVisitCount(null);
    setScheduledDate(dayjs());
    setScheduledFrom(
      hostConfig
        ? `${String(hostConfig.start).padStart(2, "0")}:${String(hostConfig.startMinute ?? 0).padStart(2, "0")}`
        : "09:00",
    );
    setScheduledTo(
      hostConfig
        ? `${String(hostConfig.end).padStart(2, "0")}:${String(hostConfig.endMinute ?? 0).padStart(2, "0")}`
        : "18:00",
    );
    setScheduleType("custom");
    setSelectedPreset("fullDay");
    setDayTypeTab("working");
    setSpecificDays([]);
    setSpecificEndDate(null);

    setVisitorOptionsLoading(true);
    setNewVisitOpen(true);
    setVisitorVisitCounts({});
    setNewRequestVisitCount(null);
    try {
      const visitors = await getEligibleVisitors();
      setVisitorOptions(Array.isArray(visitors) ? visitors : []);
      // Fetch visit counts for all eligible visitors in parallel
      if (Array.isArray(visitors) && visitors.length > 0) {
        const counts = {};
        await Promise.all(
          visitors.map(async (v) => {
            try {
              const regs = await getRegistrations(null, {}, v.id);
              counts[v.id] = Array.isArray(regs) ? regs.length : 0;
            } catch {
              counts[v.id] = 0;
            }
          }),
        );
        setVisitorVisitCounts(counts);
      }
    } catch {
      setVisitorOptions([]);
    } finally {
      setVisitorOptionsLoading(false);
    }
  };

  const handleNewVisitorChange = async (_, newValue) => {
    const prev = selectedVisitors;
    setSelectedVisitors(newValue);
    // For newly added visitors, check NDA validity
    const added = newValue.filter((v) => !prev.find((p) => p.id === v.id));
    for (const v of added) {
      if (!v.email || v.id in ndaStatusMap) continue;
      try {
        const result = await checkNdaValidity(v.email);
        setNdaStatusMap((m) => ({ ...m, [v.id]: result?.ndaRequired ?? true }));
      } catch {
        setNdaStatusMap((m) => ({ ...m, [v.id]: true }));
      }
    }
  };

  const handleSubmitNewRequest = async () => {
    if (!selectedVisitors.length) {
      showMessage("Select at least one visitor", "warning");
      return;
    }
    if (!newDepartmentId) {
      showMessage("Select a department", "warning");
      return;
    }
    if (!scheduledDate) {
      showMessage("Select a date", "warning");
      return;
    }
    const inlineErrors = [];
    if (!selectedAccessLevelIds.length) {
      const msg = "At least one access zone is required";
      setNewVisitAccessLevelError(msg);
      inlineErrors.push(msg);
    }
    if (isVip && !vipReason.trim()) {
      const msg = "A reason is required when marking as VIP";
      setVipReasonError(msg);
      inlineErrors.push(msg);
    }
    if (inlineErrors.length > 0) {
      showMessage(inlineErrors.join(", "), "error");
      return;
    }

    let fromDate, toDate;
    let fromTime = scheduledFrom;
    let toTime = scheduledTo;

    if (scheduleType === "preset") {
      const date = scheduledDate;
      let from = date.clone();
      let to = date.clone();
      if (selectedPreset === "fullDay") {
        const startH = hostConfig?.start ?? 8;
        const startM = hostConfig?.startMinute ?? 0;
        const endH = hostConfig?.end ?? 17;
        const endM = hostConfig?.endMinute ?? 0;
        fromTime = `${String(startH).padStart(2, "0")}:${String(startM).padStart(2, "0")}`;
        toTime = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
        // Full Day = same calendar day, working-hours window (mirrors public booking page)
        from = from.hour(startH).minute(startM);
        to = to.hour(endH).minute(endM);
      } else if (selectedPreset === "fullWeek") {
        to = from.clone().add(6, "days");
      } else if (selectedPreset === "fullMonth") {
        to = from.clone().endOf("month");
      } else if (selectedPreset === "specificDays") {
        to = specificEndDate
          ? specificEndDate.clone()
          : from.clone().add(30, "days");
      }
      fromDate = from.format("YYYY-MM-DD");
      toDate = to.format("YYYY-MM-DD");
    } else {
      fromDate = scheduledDate.format("YYYY-MM-DD");
      toDate = scheduledDate.format("YYYY-MM-DD");
    }

    const approvedFrom = dayjs(`${fromDate}T${fromTime}`).toISOString();
    const approvedTo = dayjs(`${toDate}T${toTime}`).toISOString();

    const purposeOfVisit =
      newPurpose === "Other" ? newPurposeOther.trim() || "Other" : newPurpose;

    // Build recurring metadata for multi-day presets with day-type filtering
    const recurringFields = (() => {
      if (scheduleType !== "preset") return {};
      if (selectedPreset === "specificDays" && specificDays.length > 0) {
        return {
          recurringType: "specific_days",
          recurringDays: specificDays,
          recurringTimeFrom: scheduledFrom,
          recurringTimeTo: scheduledTo,
        };
      }
      if (selectedPreset === "fullWeek" || selectedPreset === "fullMonth") {
        const days = computeDaySet(dayTypeTab, hostConfig);
        return {
          recurringType:
            selectedPreset === "fullWeek" ? "full_week" : "full_month",
          recurringDays: days,
          recurringTimeFrom: scheduledFrom,
          recurringTimeTo: scheduledTo,
        };
      }
      return {};
    })();

    const payload = {
      userIds: selectedVisitors.map((v) => v.id),
      groupAsMeeting: newGroupMeeting || undefined,
      meetingName: newMeetingName.trim() || undefined,
      departmentId: newDepartmentId,
      purposeOfVisit: purposeOfVisit || undefined,
      ndaAccepted: newNdaAccepted || undefined,
      approvedFrom,
      approvedTo,
      accessLevelIds: selectedAccessLevelIds,
      allowMultiCheckin,
      isVip,
      escortRequired,
      vipReason: isVip ? vipReason.trim() : undefined,
      approvalNote: approvalNote.trim() || undefined,
      ...recurringFields,
    };

    setNewVisitSubmitting(true);
    try {
      const result = await adminCreateVisits(payload);
      if (result?.error) return;
      const createdCount = result?.created?.length ?? 0;
      const skippedCount = result?.skipped?.length ?? 0;
      if (newGroupMeeting) {
        showMessage(
          skippedCount > 0
            ? "Group meeting could not be created. Some member may already have an active visit."
            : "Group meeting created successfully",
          skippedCount > 0 ? "error" : "success",
        );
      } else if (skippedCount > 0) {
        showMessage(
          `${createdCount} visit(s) created. ${skippedCount} skipped (e.g. visitor already has an active visit).`,
          "warning",
        );
      } else {
        showMessage(`${createdCount} visit(s) created successfully`, "success");
      }
      setNewVisitOpen(false);
      fetchVisits(true);
    } catch (e) {
      showMessage(
        e?.response?.data?.message || e?.response?.data?.error || e?.message || "Failed to create visits",
        "error",
      );
    } finally {
      setNewVisitSubmitting(false);
    }
  };

  // ── Batch Update helpers ──
  const toggleRow = (id) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedRowIds(new Set());

  const selectAllOnPage = () => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      pagedRows.forEach((r) => next.add(r.id));
      return next;
    });
  };

  const openBatchDialog = async () => {
    setBatchTargetStatus("");
    setRejectReason("");
    setBatchTimestamp(null);
    batchTimestampRef.current = null;
    setBatchAccessLevelError("");
    setAccessLevelError("");
    setVehiclePlateError("");
    setVipReasonError("");
    // Pre-fill approval state defaults
    setScheduledDate(dayjs());
    setScheduledFrom(
      hostConfig
        ? `${String(hostConfig.start).padStart(2, "0")}:${String(hostConfig.startMinute ?? 0).padStart(2, "0")}`
        : "09:00",
    );
    setScheduledTo(
      hostConfig
        ? `${String(hostConfig.end).padStart(2, "0")}:${String(hostConfig.endMinute ?? 0).padStart(2, "0")}`
        : "18:00",
    );
    setScheduleType("custom");
    setSelectedPreset("fullDay");
    setDayTypeTab("working");
    setSpecificDays([]);
    setSpecificEndDate(null);
    setSelectedAccessLevelIds([]);
    setAllowMultiCheckin(false);
    setAllowParking(false);
    setVehiclePlate("");
    setIsVip(false);
    setEscortRequired(true);
    setVipReason("");
    setApprovalNote("");
    setBatchOpen(true);
    // Fetch visit counts for all selected visitors
    const counts = {};
    const selectedArr = [...selectedRowIds];
    await Promise.all(
      selectedArr.map(async (id) => {
        const row = rows.find((r) => r.id === id);
        const userId = row?.user_id || row?.userId;
        if (!userId) {
          counts[id] = 0;
          return;
        }
        try {
          const allRegs = await getRegistrations(null, {}, userId);
          // Exclude the registrations currently being approved — they belong
          // to these visitors but are not past visits (single or co-selected).
          counts[id] = countPastVisits(allRegs, [...selectedRowIds]);
        } catch {
          counts[id] = 0;
        }
      }),
    );
    setBatchVisitorVisitCounts(counts);
  };

  const handleBatchApply = async () => {
    if (!batchTargetStatus) {
      showMessage("Please select a target status", "warning");
      return;
    }
    if (batchTargetStatus === "rejected" && !rejectReason.trim()) {
      showMessage("Please provide a rejection reason", "warning");
      return;
    }
    if (
      (batchTargetStatus === "admin_approved" ||
        batchTargetStatus === "approved") &&
      !scheduledDate
    ) {
      showMessage("Please select a date", "warning");
      return;
    }
    const isApproving =
      batchTargetStatus === "admin_approved" ||
      batchTargetStatus === "approved";
    const inlineErrors = [];
    if (isApproving && !selectedAccessLevelIds.length) {
      const msg = "At least one access zone is required";
      setBatchAccessLevelError(msg);
      inlineErrors.push(msg);
    }
    if (isApproving && allowParking && !vehiclePlate.trim()) {
      const msg =
        "Vehicle plate number is required when parking is enabled";
      setVehiclePlateError(msg);
      inlineErrors.push(msg);
    }
    if (isApproving && isVip && !vipReason.trim()) {
      const msg = "A reason is required when marking as VIP";
      setVipReasonError(msg);
      inlineErrors.push(msg);
    }
    if (inlineErrors.length > 0) {
      showMessage(inlineErrors.join(", "), "error");
      return;
    }

    // Build shared payload from the current shared approval/reject/confirm state
    let sharedPayload = {};
    if (batchTargetStatus === "rejected") {
      sharedPayload = { rejectionReason: rejectReason.trim() };
    } else if (
      batchTargetStatus === "admin_approved" ||
      batchTargetStatus === "approved"
    ) {
      let fromDate, toDate;
      let fromTime = scheduledFrom;
      let toTime = scheduledTo;
      if (scheduleType === "preset") {
        const date = scheduledDate;
        let from = date.clone();
        let to = date.clone();
        if (selectedPreset === "fullDay") {
          const startH = hostConfig?.start ?? 8;
          const startM = hostConfig?.startMinute ?? 0;
          const endH = hostConfig?.end ?? 17;
          const endM = hostConfig?.endMinute ?? 0;
          fromTime = `${String(startH).padStart(2, "0")}:${String(startM).padStart(2, "0")}`;
          toTime = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
          // Full Day = same calendar day, working-hours window (mirrors public booking page)
          from = from.hour(startH).minute(startM);
          to = to.hour(endH).minute(endM);
        } else if (selectedPreset === "fullWeek") {
          to = from.clone().add(6, "days");
        } else if (selectedPreset === "fullMonth") {
          to = from.clone().endOf("month");
        } else if (selectedPreset === "specificDays") {
          to = specificEndDate
            ? specificEndDate.clone()
            : from.clone().add(30, "days");
        }
        fromDate = from.format("YYYY-MM-DD");
        toDate = to.format("YYYY-MM-DD");
      } else {
        fromDate = scheduledDate.format("YYYY-MM-DD");
        toDate = scheduledDate.format("YYYY-MM-DD");
      }
      // Overnight visits: roll the end date forward to avoid inverted windows.
      toDate = rollOvernightEnd({
        fromDate,
        toDate,
        fromTime,
        toTime,
        isPreset: scheduleType === "preset",
      });
      sharedPayload = {
        approvedFrom: dayjs(`${fromDate}T${fromTime}`).toISOString(),
        approvedTo: dayjs(`${toDate}T${toTime}`).toISOString(),
        accessLevelIds: selectedAccessLevelIds,
        accessLevelId: selectedAccessLevelIds[0],
        allowMultiCheckin,
        allowParking,
        vehiclePlate: allowParking ? vehiclePlate.trim() : null,
        isVip,
        escortRequired,
        vipReason: isVip ? vipReason.trim() : undefined,
        approvalNote: approvalNote.trim() || undefined,
      };
      if (
        scheduleType === "preset" &&
        selectedPreset === "specificDays" &&
        specificDays.length > 0
      ) {
        sharedPayload.recurringType = "specific_days";
        sharedPayload.recurringDays = specificDays;
        sharedPayload.recurringTimeFrom = scheduledFrom;
        sharedPayload.recurringTimeTo = scheduledTo;
      } else if (
        scheduleType === "preset" &&
        (selectedPreset === "fullWeek" || selectedPreset === "fullMonth")
      ) {
        sharedPayload.recurringType =
          selectedPreset === "fullWeek" ? "full_week" : "full_month";
        sharedPayload.recurringDays = computeDaySet(dayTypeTab, hostConfig);
        sharedPayload.recurringTimeFrom = scheduledFrom;
        sharedPayload.recurringTimeTo = scheduledTo;
      }
    } else if (
      batchTargetStatus === "checked_in" ||
      batchTargetStatus === "checked_out"
    ) {
      sharedPayload = {
        timestamp: batchTimestampRef.current,
        clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
    }

    const canOverride = canOverrideVisit;
    const selectedCards = rows.filter((r) => selectedRowIds.has(r.id));
    const updated = [];
    const skipped = [];

    setBatchSubmitting(true);
    for (const card of selectedCards) {
      const normalAllowed = getAllowedTransitions(
        card.status,
        userRole,
        card.allow_multi_checkin ?? card.allowMultiCheckin,
        user?.adminType,
      );
      let isOverride = false;
      if (normalAllowed.includes(batchTargetStatus)) {
        isOverride = false;
      } else {
        const overrideTargets = getOverrideTargets(
          card.status,
          userRole,
          normalAllowed,
          canOverride,
        );
        if (overrideTargets.includes(batchTargetStatus)) {
          isOverride = true;
        } else {
          skipped.push({
            id: card.id,
            name: card.full_name,
            reason: "Transition not permitted for your role",
          });
          continue;
        }
      }
      try {
        await updateStatus(card.id, {
          status: batchTargetStatus,
          override: isOverride,
          ...sharedPayload,
        });
        updated.push(card);
      } catch (e) {
        skipped.push({
          id: card.id,
          name: card.full_name,
          reason: e?.response?.data?.error || e?.message || "Update failed",
        });
      }
    }
    setBatchSubmitting(false);

    const updatedCount = updated.length;
    const skippedCount = skipped.length;
    if (skippedCount > 0) {
      showMessage(
        `Updated ${updatedCount}, skipped ${skippedCount} (permission or flow issue)`,
        "warning",
      );
    } else {
      showMessage(
        `${updatedCount} visit(s) updated to ${STATUS_CONFIG[batchTargetStatus]?.label || batchTargetStatus}`,
        "success",
      );
    }
    setBatchOpen(false);
    setBatchVisitCount(null);
    setBatchVisitorVisitCounts({});
    setEscortRequired(true);
    setSelectMode(false);
    clearSelection();
    fetchVisits(true);
  };

  // ── Timeline ──
  const handleViewTimeline = async () => {
    if (!selected) return;
    setTimelineLoading(true);
    setTimelineModal({
      open: true,
      visitId: selected.id,
      visitorName: resolveVisitName(selected),
    });
    try {
      const logs = await getRegistrationActivityLogs(selected.id);
      setTimelineLogs(Array.isArray(logs) ? logs : []);
    } catch {
      setTimelineLogs([]);
    } finally {
      setTimelineLoading(false);
    }
  };

  // ── Badge printing ──
  const handlePrintBadge = async (row) => {
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(row.qr_token || "N/A", {
        width: 300,
        margin: 1,
      });
      const rawFieldValues = row.fieldValues || row.field_values || [];
      const fieldValues = {};
      if (Array.isArray(rawFieldValues)) {
        rawFieldValues.forEach((fv) => {
          const key = fv.customField?.fieldKey || fv.custom_field?.field_key;
          if (key) fieldValues[key] = fv.value;
        });
      }
      const participants =
        Array.isArray(row.participants) && row.participants.length > 1
          ? row.participants
          : null;
      const badgeData = (member) => ({
        fullName:
          member?.fullName ||
          fieldValues["full_name"] ||
          row.full_name ||
          "Unnamed",
        company:
          member?.companyName ||
          fieldValues["company_name"] ||
          row.organisation ||
          row.companyName ||
          "",
        email: member?.email || fieldValues["email"] || row.email || "",
        phone: member?.phone || fieldValues["phone"] || row.phone || "",
        purposeOfVisit: row.purpose_of_visit || "",
        requestedDate: getLocalDate(row.requested_from),
        requestedTimeFrom: getLocalTime(row.requested_from),
        requestedTimeTo: getLocalTime(row.requested_to),
        badgeIdentifier: row.badge_identifier || "",
        token: row.qr_token || "N/A",
        showQrOnBadge: true,
        fieldValues,
      });
      const doc = participants ? (
        <Document>
          {participants.map((m) => (
            <BadgePDF
              key={m.id}
              data={badgeData(m)}
              qrCodeDataUrl={qrCodeDataUrl}
              customizations={badgeTemplate?.layoutJson}
              single={false}
            />
          ))}
        </Document>
      ) : (
        <BadgePDF
          data={badgeData(null)}
          qrCodeDataUrl={qrCodeDataUrl}
          customizations={badgeTemplate?.layoutJson}
        />
      );
      const blob = await pdf(doc).toBlob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank", "width=800,height=600,scrollbars=yes");
      markBadgesPrinted([row?.id]);
    } catch {
      showMessage("Failed to generate badge", "error");
    }
  };

  // ── Export ──
  const handleExportCsvBulk = async () => {
    const ids = filtered.map((r) => r.id);
    if (!ids.length) {
      showMessage("No visits to export", "warning");
      return;
    }
    setExportingXlsx(true);
    try {
      const logRes = await logVisitsExported(ids, "xlsx");
      if (logRes?.error) {
        console.warn(
          "[Visits] visits-exported logging failed:",
          logRes?.message,
        );
      }
      await exportRegistrationsXlsx(ids);
      showMessage("Visits exported", "success");
    } catch {
      showMessage("Export failed", "error");
    } finally {
      setExportingXlsx(false);
    }
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // ── Computed transition values from registrations ──
  const allowedTransitions = useMemo(
    () =>
      getAllowedTransitions(
        selected?.status,
        userRole,
        selected?.allow_multi_checkin ?? selected?.allowMultiCheckin,
        user?.adminType,
      ),
    [
      selected?.status,
      userRole,
      selected?.allow_multi_checkin,
      selected?.allowMultiCheckin,
      user?.adminType,
    ],
  );

  const overrideTransitions = useMemo(
    () =>
      getOverrideTargets(
        selected?.status,
        userRole,
        allowedTransitions,
        canOverrideVisit && canEditRegistration(selected, isSuperAdmin, userRole),
      ),
    [
      selected?.status,
      userRole,
      allowedTransitions,
      selected,
      isSuperAdmin,
      canEditRegistration,
      canOverrideVisit,
    ],
  );

  const isAdminApprovedTarget =
    isSuperAdmin && approveTarget?.status === "admin_approved";
  const approvalTargetStatus =
    approveTarget?._pendingStatus ||
    (isSuperAdmin ? "approved" : "admin_approved");
  const approvalCfg = STATUS_CONFIG[approvalTargetStatus] || {
    label: "Approve",
    color: "success",
    icon: <ICONS.check />,
  };
  const approvalLabel = ACTION_LABELS[approvalTargetStatus] || approvalCfg.label;
  const slotLabel = isAdminApprovedTarget ? "Approved Slot" : "Requested Slot";
  const slotFrom = isAdminApprovedTarget
    ? approveTarget?.approved_from
    : approveTarget?.requested_from;
  const slotTo = isAdminApprovedTarget
    ? approveTarget?.approved_to
    : approveTarget?.requested_to;
  const slotDateText = (() => {
    const dateFrom = getLocalDate(slotFrom);
    const dateTo = getLocalDate(slotTo);

    if (!dateFrom) return "-";

    return dateTo && dateFrom !== dateTo
      ? `${formatDate(slotFrom)} to ${formatDate(slotTo)}`
      : formatDate(slotFrom);
  })();
  const slotTimeText =
    getLocalTime(slotFrom) || getLocalTime(slotTo)
      ? `${slotFrom ? formatTime(slotFrom) : "-"} - ${slotTo ? formatTime(slotTo) : "-"}`
      : "-";

  const rowActions = (
    <>
      <Button
        variant="outlined"
        startIcon={<ICONS.filter />}
        onClick={() => setFilterModalOpen(true)}
        sx={{ whiteSpace: "nowrap" }}
      >
        Filters {activeFiltersCount > 0 && `(${activeFiltersCount})`}
      </Button>
      <Button
        variant="outlined"
        color="success"
        startIcon={
          exportingXlsx ? (
            <CircularProgress size={18} />
          ) : (
            <ICONS.download />
          )
        }
        onClick={handleExportCsvBulk}
        disabled={filtered.length === 0 || exportingXlsx || selectMode}
        sx={{ whiteSpace: "nowrap", opacity: selectMode ? 0.5 : 1 }}
      >
        {exportingXlsx ? "Exporting…" : "Export All"}
      </Button>
      <Button
        variant="outlined"
        startIcon={
          exportingBadges ? (
            <CircularProgress size={18} />
          ) : (
            <ICONS.print />
          )
        }
        onClick={async () => {
          if (!filtered.length) {
            showMessage("No visits to export", "warning");
            return;
          }
          setExportingBadges(true);
          try {
            const ids = filtered.map((r) => r?.id).filter(Boolean);
            if (ids.length) {
              const logRes = await markBadgesExported(ids);
              if (logRes?.error) {
                console.warn(
                  "[Badges] bulk badge export logging failed:",
                  logRes?.message,
                );
              }
            }
            await exportAllBadges(
              filtered,
              badgeTemplate,
              `badges_${new Date().toISOString().split("T")[0]}.pdf`,
            );
            showMessage("Badges exported", "success");
          } catch {
            showMessage("Badge export failed", "error");
          } finally {
            setExportingBadges(false);
          }
        }}
        disabled={
          filtered.length === 0 || exportingBadges || selectMode
        }
      >
        {exportingBadges ? "Exporting…" : "Badges"}
      </Button>
    </>
  );

  if (loading && !hasLoadedOnce)
    return <LoadingState cardMaxWidth={400} skeletonLines={3} />;

  return (
    <PermissionRouteGuard resource="visits" hardcodeAllowed={!isKitchenAdmin}>
      <Box>
        {isListRefreshing && (
          <LinearProgress
            sx={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999 }}
          />
        )}

        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            justifyContent: "space-between",
            alignItems: { xs: "stretch", sm: "center" },
            mt: 2,
            mb: 1,
            gap: 2,
          }}
        >
          <Box>
            <Typography variant="h5" fontWeight="bold">
              Visits
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 0.5, opacity: 0.8 }}
            >
              View and manage all visitor visits across your system.
            </Typography>
          </Box>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            alignItems="center"
            spacing={1}
            sx={{
              justifyContent: { sm: "flex-end" },
              flexWrap: selectMode ? "wrap" : "nowrap",
              rowGap: 1,
            }}
          >
            {canUpdate && selectMode && (
              <>
                <Button
                  variant="contained"
                  color="warning"
                  disabled={selectedRowIds.size === 0}
                  startIcon={<ICONS.edit />}
                  onClick={openBatchDialog}
                  sx={{
                    whiteSpace: "nowrap",
                    height: 40,
                    borderRadius: 30,
                    fontWeight: 700,
                    px: 2,
                    width: { xs: "100%", sm: "auto" },
                  }}
                >
                  Update ({selectedRowIds.size})
                </Button>
                <Button
                  size="small"
                  onClick={selectAllOnPage}
                  sx={{
                    whiteSpace: "nowrap",
                    height: 40,
                    borderRadius: 30,
                    px: 2,
                    width: { xs: "100%", sm: "auto" },
                  }}
                >
                  Select Page
                </Button>
                <Button
                  size="small"
                  onClick={clearSelection}
                  sx={{
                    whiteSpace: "nowrap",
                    height: 40,
                    borderRadius: 30,
                    px: 2,
                    width: { xs: "100%", sm: "auto" },
                  }}
                >
                  Clear
                </Button>
              </>
            )}

            {canUpdate && (
              <Button
                variant={selectMode ? "contained" : "outlined"}
                color={selectMode ? "primary" : "inherit"}
                startIcon={selectMode ? <ICONS.checkCircle /> : <ICONS.edit />}
                onClick={() => {
                  if (selectMode) {
                    setSelectMode(false);
                    clearSelection();
                  } else {
                    setSelectMode(true);
                  }
                }}
                sx={{
                  whiteSpace: "nowrap",
                  height: 40,
                  borderRadius: 30,
                  fontWeight: 700,
                  px: 2,
                  width: { xs: "100%", sm: "auto" },
                }}
              >
                {selectMode
                  ? `Selecting (${selectedRowIds.size})`
                  : "Update Batch"}
              </Button>
            )}

            <Divider
              orientation="vertical"
              flexItem
              sx={{ mx: 0.5, display: { xs: "none", sm: "block" } }}
            />

            {canCreateVisit && (
              <Button
                variant="contained"
                startIcon={<ICONS.add />}
                onClick={handleOpenNewRequest}
                disabled={selectMode}
                sx={{
                  whiteSpace: "nowrap",
                  height: 40,
                  borderRadius: 30,
                  fontWeight: 700,
                  px: 2,
                  width: { xs: "100%", sm: "auto" },
                  opacity: selectMode ? 0.5 : 1,
                }}
              >
                New Request
              </Button>
            )}
          </Stack>
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* ── Preset date range filter bar ── */}
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          flexWrap="wrap"
          sx={{ mb: 2, gap: 1 }}
        >
          {[
            { key: "all", label: "All Time" },
            { key: "today", label: "Today" },
            { key: "week", label: "This Week" },
            { key: "month", label: "This Month" },
            { key: "year", label: "This Year" },
            { key: "custom", label: "Custom" },
          ].map(({ key, label }) => (
            <Chip
              key={key}
              label={label}
              size="small"
              clickable
              color={datePreset === key ? "primary" : "default"}
              variant={datePreset === key ? "filled" : "outlined"}
              onClick={() => {
                setDatePreset(key);
                setPage(0);
              }}
              sx={{ fontWeight: 700, borderRadius: 2 }}
            />
          ))}
          {datePreset === "custom" && (
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              alignItems={{ xs: "stretch", sm: "center" }}
              sx={{
                flexWrap: "wrap",
                gap: 1,
                width: { xs: "100%", md: "auto" },
              }}
            >
              <Box sx={{ width: { xs: "100%", sm: 180 } }}>
                <DateTimeFieldFlatpickr
                  label="From"
                  value={customFrom}
                  maxDate={customTo}
                  onChange={(val) => {
                    setCustomFrom(val || null);
                    if (customTo && val && dayjs(val).isAfter(dayjs(customTo))) {
                      setCustomTo(null);
                    }
                    setPage(0);
                  }}
                />
              </Box>
              <Box sx={{ width: { xs: "100%", sm: 180 } }}>
                <DateTimeFieldFlatpickr
                  label="To"
                  value={customTo}
                  minDate={customFrom}
                  onChange={(val) => {
                    setCustomTo(val || null);
                    setPage(0);
                  }}
                />
              </Box>
            </Stack>
          )}

          {/* Desktop: Filter / Export All / Badges sit on the right of the date filters */}
          <Box
            sx={{
              display: { xs: "none", md: "flex" },
              flex: 1,
              justifyContent: "flex-end",
              gap: 1,
              alignItems: "center",
            }}
          >
            {rowActions}
          </Box>
        </Stack>

        <ListToolbar
          showingCount={pagedRows.length}
          totalCount={totalCount || filtered.length}
          searchSlot={
            <TextField
              fullWidth
              size="small"
              variant="outlined"
              placeholder="Search name, email, ID, purpose..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              InputProps={{
                startAdornment: (
                  <ICONS.search fontSize="small" sx={{ mr: 1, opacity: 0.6 }} />
                ),
              }}
              sx={{ maxWidth: { md: 600 } }}
            />
          }
          actionsSlot={
            <>
              <Box
                sx={{
                  display: { xs: "flex", md: "none" },
                  flexDirection: { xs: "column", sm: "row" },
                  gap: { xs: 1.5, sm: 1 },
                  width: { xs: "100%", sm: "auto" },
                }}
              >
                {rowActions}
              </Box>
              <FormControl
                size="small"
                sx={{ minWidth: { xs: "100%", sm: 160 } }}
              >
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
            </>
          }
        />

        {filtered.length === 0 && !loading ? (
          <NoDataAvailable
            title="No visits found"
            description="Try adjusting your filters or search query."
          />
        ) : (
          <ResponsiveCardGrid>
            {pagedRows.map((row) => {
              const config = STATUS_CONFIG[row.status] || {
                label: row.status,
                color: "default",
                icon: <ICONS.info />,
              };
              const isSelected = selectedRowIds.has(row.id);

              // Extract ID from fieldValues
              const rawFvs = row.fieldValues || row.field_values || [];
              let resolvedId = null;
              if (Array.isArray(rawFvs)) {
                const idAliases = [
                  "civilid",
                  "omanid",
                  "omanidnumber",
                  "idnumber",
                  "idnumberoman",
                  "passport",
                  "passportnumber",
                  "nationalid",
                  "nationalidnumber",
                  "eid",
                  "idcard",
                  "idcardnumber",
                  "identificationnumber",
                  "documentnumber",
                ];
                const idLabels = {
                  civilid: "Civil ID",
                  omanid: "Oman ID",
                  omanidnumber: "Oman ID",
                  idnumber: "ID Number",
                  idnumberoman: "Oman ID",
                  passport: "Passport",
                  passportnumber: "Passport No",
                  nationalid: "National ID",
                  nationalidnumber: "National ID",
                  eid: "E-ID",
                  idcard: "ID Card",
                  idcardnumber: "ID Card No",
                  identificationnumber: "ID Number",
                  documentnumber: "Document No",
                };
                for (const fv of rawFvs) {
                  const k = (
                    fv.customField?.fieldKey ||
                    fv.custom_field?.field_key ||
                    ""
                  )
                    .toLowerCase()
                    .replace(/[^a-z0-9]/g, "");
                  if (idAliases.includes(k) && fv.value) {
                    const rawLabel =
                      fv.customField?.label || fv.custom_field?.label || "";
                    resolvedId = {
                      label: rawLabel || idLabels[k] || "ID",
                      value: fv.value,
                    };
                    break;
                  }
                }
              }

              return (
                <AppCard
                  key={row.id}
                  onClick={
                    selectMode
                      ? (e) => {
                          e.stopPropagation();
                          toggleRow(row.id);
                        }
                      : undefined
                  }
                  sx={
                    selectMode
                      ? {
                          cursor: "pointer",
                          opacity: isSelected ? 1 : 0.55,
                          filter: isSelected ? "none" : "grayscale(0.4)",
                          outline: isSelected ? "2px solid" : "none",
                          outlineColor: isSelected
                            ? "primary.main"
                            : "transparent",
                          outlineOffset: 2,
                          transition: "opacity 0.2s, filter 0.2s",
                        }
                      : undefined
                  }
                >
                  <Box
                    sx={{
                      background: isDark
                        ? "linear-gradient(to right, rgba(255,255,255,0.05), rgba(255,255,255,0.08))"
                        : "linear-gradient(to right, #f5f5f5, #fafafa)",
                      borderBottom: "1px solid",
                      borderColor: "divider",
                      p: 2,
                    }}
                  >
                    <Stack spacing={0.6}>
                      <Stack
                        direction="row"
                        alignItems="center"
                        sx={{ gap: 1 }}
                      >
                        <Avatar
                          sx={{
                            width: 40,
                            height: 40,
                            bgcolor: isDark ? "#fff" : "#000",
                            color: isDark ? "#000" : "#fff",
                            fontSize: "1rem",
                            fontWeight: 800,
                          }}
                        >
                          {(row.full_name || "")
                            .split(" ")
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join("") || "?"}
                        </Avatar>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          {row.participants?.length > 1 ? (
                            <Typography
                              variant="subtitle1"
                              fontWeight={800}
                              noWrap
                              sx={{ lineHeight: 1.2 }}
                            >
                              {row.meetingName ||
                                `Group Meeting (${row.participants.length})`}
                            </Typography>
                          ) : (
                            <ClickableVisitorName
                              name={row.full_name}
                              visitorId={row.userId}
                              seed={{
                                fullName: row.full_name,
                                email: row.email,
                                phone: row.phone,
                                iso_code: row.phone_iso_code,
                              }}
                              onOpen={openVisitorDetails}
                              truncate
                              variant="subtitle1"
                              fontWeight={800}
                              sx={{ lineHeight: 1.2 }}
                            />
                          )}
                        </Box>
                        {selectMode && (
                          <Checkbox
                            checked={isSelected}
                            onChange={() => toggleRow(row.id)}
                            onClick={(e) => e.stopPropagation()}
                            size="small"
                            sx={{ p: 0.5, ml: "auto" }}
                            color="success"
                          />
                        )}
                      </Stack>
                    </Stack>
                    <Stack
                      direction="row"
                      alignItems="center"
                      spacing={0.6}
                      sx={{ mt: 1 }}
                      flexWrap="wrap"
                      useFlexGap
                    >
                      <Chip
                        label={config.label}
                        color={config.color}
                        size="small"
                        icon={config.icon}
                        sx={{ fontWeight: 800, borderRadius: 1.5, height: 24 }}
                      />
                      {(row.participants?.length > 1) && (
                        <Chip
                          label="Group Meeting"
                          color="primary"
                          size="small"
                          icon={<ICONS.group fontSize="small" />}
                          sx={{
                            fontWeight: 800,
                            borderRadius: 1.5,
                            height: 24,
                          }}
                        />
                      )}
                      {row.overstay && (
                        <Chip
                          label="Overstay"
                          color="error"
                          size="small"
                          icon={<ICONS.errorOutline />}
                          sx={{
                            fontWeight: 800,
                            borderRadius: 1.5,
                            height: 24,
                          }}
                        />
                      )}
                      {(row.isVipFastTrack || row.is_vip_fast_track) && (
                        <Chip
                          label="VIP Fast Track"
                          color="warning"
                          size="small"
                          icon={<ICONS.star />}
                          sx={{
                            fontWeight: 800,
                            borderRadius: 1.5,
                            height: 24,
                          }}
                        />
                      )}
                      {(row.is_vip || row.isVip) && (
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
                          }}
                        />
                      )}
                      {(row.allow_parking || row.allowParking) && (
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
                          }}
                        />
                      )}
                      {(row.isOutsideWorkingHours ||
                        row.is_outside_working_hours) && (
                        <Chip
                          icon={<ICONS.time style={{ fontSize: 14 }} />}
                          label="Outside Hours"
                          color="warning"
                          size="small"
                          sx={{
                            fontWeight: 800,
                            borderRadius: 1.5,
                            height: 24,
                          }}
                        />
                      )}
                      {(row.isOutsideWorkingDays ||
                        row.is_outside_working_days) && (
                        <Chip
                          icon={<ICONS.event style={{ fontSize: 14 }} />}
                          label="Outside Days"
                          color="warning"
                          size="small"
                          sx={{
                            fontWeight: 800,
                            borderRadius: 1.5,
                            height: 24,
                          }}
                        />
                      )}
                    </Stack>
                  </Box>

                  <Box
                    sx={{
                      flexGrow: 1,
                      px: 2,
                      py: 1.5,
                      "& > :not(:last-child)": {
                        borderBottom: "1px solid",
                        borderColor: "divider",
                      },
                    }}
                  >
                    {canReadInternalNote && (row.internal_note || row.internalNote) && (
                      <Box sx={{ py: 0.8 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 0.6,
                            color: "text.secondary",
                            mb: 0.6,
                          }}
                        >
                          <ICONS.description fontSize="small" sx={{ opacity: 0.6 }} />{" "}
                          Internal Note
                        </Typography>
                        <ExpandableNote text={row.internal_note || row.internalNote} />
                      </Box>
                    )}
                    {row.participants?.length > 1 && (
                      <Box sx={{ py: 0.8 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 0.6,
                            color: "text.secondary",
                            mb: 0.6,
                          }}
                        >
                          <ICONS.group fontSize="small" sx={{ opacity: 0.6 }} />{" "}
                          Members
                        </Typography>
                        <Stack
                          direction="row"
                          flexWrap="wrap"
                          useFlexGap
                          spacing={0.6}
                        >
                          {row.participants.map((p) => (
                            <Tooltip
                              key={p.id}
                              title="View visitor details"
                              arrow
                              placement="top"
                            >
                              <Chip
                                label={p.fullName}
                                size="small"
                                variant="outlined"
                                clickable
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openVisitorDetails(p.id, p);
                                }}
                                sx={{
                                  fontWeight: 600,
                                  fontSize: "0.68rem",
                                  height: 22,
                                  cursor: "pointer",
                                }}
                              />
                            </Tooltip>
                          ))}
                        </Stack>
                      </Box>
                    )}
                    {resolvedId && (
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          py: 0.8,
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 0.6,
                            color: "text.secondary",
                          }}
                        >
                          <ICONS.key fontSize="small" sx={{ opacity: 0.6 }} />{" "}
                          {resolvedId.label}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 600,
                            ml: 2,
                            flex: 1,
                            textAlign: "right",
                            color: "text.primary",
                          }}
                        >
                          {resolvedId.value}
                        </Typography>
                      </Box>
                    )}
                    {row.email && (
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          py: 0.8,
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 0.6,
                            color: "text.secondary",
                          }}
                        >
                          <ICONS.emailOutline
                            fontSize="small"
                            sx={{ opacity: 0.6 }}
                          />{" "}
                          Email
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 600,
                            ml: 2,
                            flex: 1,
                            textAlign: "right",
                            color: "text.primary",
                          }}
                        >
                          {row.email}
                        </Typography>
                      </Box>
                    )}
                    {row.purpose_of_visit && (
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          py: 0.8,
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 0.6,
                            color: "text.secondary",
                          }}
                        >
                          <ICONS.info fontSize="small" sx={{ opacity: 0.6 }} />{" "}
                          Purpose
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 600,
                            ml: 2,
                            flex: 1,
                            textAlign: "right",
                            color: "text.primary",
                          }}
                        >
                          {row.purpose_of_visit}
                        </Typography>
                      </Box>
                    )}
                    {(row.requested_from || row.requested_to) && (
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          py: 0.8,
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 0.6,
                            color: "text.secondary",
                          }}
                        >
                          <ICONS.event fontSize="small" sx={{ opacity: 0.6 }} />
                          {row.status !== "pending" &&
                          row.status !== "rejected" &&
                          (row.approved_from || row.approved_to)
                            ? "Approved"
                            : "Requested"}
                        </Typography>
                        <Box sx={{ ml: 2, flex: 1, textAlign: "right" }}>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 600, color: "text.primary" }}
                          >
                            {(() => {
                              const showApp =
                                row.status !== "pending" &&
                                row.status !== "rejected" &&
                                (row.approved_from || row.approved_to);
                              const f = showApp
                                ? row.approved_from
                                : row.requested_from;
                              const t = showApp
                                ? row.approved_to
                                : row.requested_to;
                              if (!f) return "—";
                              const df = formatDate(f);
                              const dt = formatDate(t);
                              return dt && df !== dt
                                ? `${df} to ${dt}`
                                : df || "—";
                            })()}
                          </Typography>
                        </Box>
                      </Box>
                    )}
                    {row.recurring_type &&
                      Array.isArray(row.recurring_days) &&
                      row.recurring_days.length > 0 && (
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            py: 0.4,
                          }}
                        >
                          <Typography
                            variant="body2"
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 0.6,
                              color: "text.secondary",
                            }}
                          >
                            <ICONS.replay
                              fontSize="small"
                              sx={{ opacity: 0.6 }}
                            />{" "}
                            Recurring
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 600,
                              ml: 2,
                              flex: 1,
                              textAlign: "right",
                              color: "text.primary",
                            }}
                          >
                            {row.recurring_days
                              .map((d) => DAY_LABELS[d])
                              .join(", ")}
                            {row.recurring_time_from &&
                              row.recurring_time_to &&
                              ` · ${row.recurring_time_from} – ${row.recurring_time_to}`}
                          </Typography>
                        </Box>
                      )}
                  </Box>

                  <Box
                    sx={{
                      p: 1.2,
                      borderTop: "1px solid",
                      borderColor: "divider",
                      bgcolor: isDark
                        ? "rgba(255,255,255,0.02)"
                        : "rgba(0,0,0,0.01)",
                    }}
                  >
                    <RecordMetadata
                      createdByName={row.createdBy}
                      updatedByName={row.updatedBy}
                      createdAt={row.createdAt || row.created_at}
                      updatedAt={row.updatedAt}
                      locale="en-GB"
                      sx={{ px: 0, py: 0, mb: 0.5 }}
                    />
                    <Stack
                      direction="row"
                      spacing={1}
                      justifyContent="flex-end"
                    >
                      <Tooltip title="Print Badge">
                        <span>
                          <IconButton
                            size="small"
                            disabled={selectMode}
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePrintBadge(row);
                            }}
                            sx={{
                              color: selectMode ? "grey.400" : "success.main",
                            }}
                          >
                            <ICONS.print fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      {(canUpdate || canWriteInternalNote) &&
                        canEditRegistration(row, isSuperAdmin, userRole) && (
                          <Tooltip
                            title={canUpdate ? "Edit Visit" : "Edit Internal Note"}
                          >
                            <span>
                              <IconButton
                                size="small"
                                disabled={selectMode}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (canUpdate) {
                                    handleCardEdit(row);
                                  } else if (canWriteInternalNote) {
                                    setInternalNoteTarget(row);
                                    setInternalNoteDraft(
                                      canReadInternalNote
                                        ? row.internal_note ||
                                            row.internalNote ||
                                            ""
                                        : "",
                                    );
                                    setInternalNoteDialogOpen(true);
                                  }
                                }}
                                sx={{
                                  color: selectMode
                                    ? "grey.400"
                                    : "warning.main",
                                }}
                              >
                                <ICONS.edit fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        )}
                      <Tooltip title="View Details">
                        <span>
                          <IconButton
                            size="small"
                            disabled={selectMode}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenProfile(row);
                            }}
                            sx={{
                              color: selectMode ? "grey.400" : "primary.main",
                            }}
                          >
                            <ICONS.view fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Stack>
                  </Box>
                </AppCard>
              );
            })}
          </ResponsiveCardGrid>
        )}

        {filtered.length > rowsPerPage && (
          <Box display="flex" justifyContent="center" mt={4}>
            <Pagination
              count={Math.ceil(filtered.length / rowsPerPage)}
              page={page + 1}
              onChange={(e, v) => setPage(v - 1)}
              color="primary"
            />
          </Box>
        )}

        {/* ── New Request Dialog (admin creates visit for existing visitors) ── */}
        {(() => {
          // Find purpose-of-visit field from already-loaded custom fields
          const normKey = (s = "") => s.toLowerCase().replace(/[^a-z0-9]/g, "");
          const purposeField = activeCustomFields.find((f) => {
            const k = normKey(f.fieldKey || f.field_key);
            const l = (f.label || "").toLowerCase();
            return (
              k.includes("purposeofvisit") ||
              k === "purpose" ||
              l.includes("purpose of visit")
            );
          });
          const purposeOptions = Array.isArray(purposeField?.optionsJson)
            ? purposeField.optionsJson
            : [];

          // Which selected visitors need an NDA
          const visitorsNeedingNda = selectedVisitors.filter(
            (v) => ndaStatusMap[v.id] === true,
          );
          const anyNdaNeeded = visitorsNeedingNda.length > 0;

          // Department choices: dept admin sees only their depts; SA sees all
          const deptChoices = isSuperAdmin
            ? departments
            : departments.filter((d) =>
                (user?.departments ?? []).some((ud) => ud.id === d.id),
              );

          return (
            <Dialog
              open={newVisitOpen}
              onClose={() => !newVisitSubmitting && setNewVisitOpen(false)}
              maxWidth="md"
              fullWidth
              PaperProps={{
                sx: { borderRadius: 4, overflow: "hidden", variant: "frosted" },
              }}
            >
              <DialogHeader
                title="New Visit Request"
                onClose={
                  !newVisitSubmitting ? () => setNewVisitOpen(false) : undefined
                }
              />
              <Divider />
              <DialogContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
                <Stack spacing={3}>
                  {/* Visitor multi-select with search */}
                  <Box>
                    <Typography
                      variant="subtitle2"
                      fontWeight={700}
                      sx={{ mb: 1 }}
                    >
                      Visitors
                    </Typography>
                    <Autocomplete
                      multiple
                      disableCloseOnSelect
                      open={visitorMenuOpen}
                      onOpen={() => setVisitorMenuOpen(true)}
                      onClose={(event, reason) => {
                        if (reason === "blur" && visitorDialog.open) return;
                        setVisitorMenuOpen(false);
                      }}
                      inputValue={visitorSearchInput}
                      onInputChange={(event, value) =>
                        setVisitorSearchInput(value)
                      }
                      options={visitorOptions}
                      loading={visitorOptionsLoading}
                      value={selectedVisitors}
                      onChange={handleNewVisitorChange}
                      getOptionLabel={(opt) =>
                        `${opt.fullName}${opt.email ? ` — ${opt.email}` : ""}`
                      }
                      filterOptions={(options, state) => {
                        const q = state.inputValue.trim().toLowerCase();
                        if (!q) return options;
                        return options.filter((opt) =>
                          [opt.fullName, opt.email, opt.idNo].some(
                            (v) => v != null && String(v).toLowerCase().includes(q),
                          ) || phoneMatchesQuery(opt.phone, q, opt.iso_code),
                        );
                      }}
                      isOptionEqualToValue={(opt, val) => opt.id === val.id}
                      getOptionDisabled={(opt) => opt.hasActiveVisit}
                      renderTags={(value, getTagProps) =>
                        value.map((opt, index) => (
                          <Chip
                            {...getTagProps({ index })}
                            key={opt.id}
                            label={`${opt.fullName}${visitorVisitCounts[opt.id] != null && visitorVisitCounts[opt.id] > 0 ? ` (${visitorVisitCounts[opt.id]})` : ""}`}
                            size="small"
                            avatar={
                              <Avatar
                                sx={{
                                  width: 20,
                                  height: 20,
                                  fontSize: "0.6rem",
                                  bgcolor: "primary.main",
                                  color: "primary.contrastText",
                                }}
                              >
                                {opt.fullName?.[0] ?? "?"}
                              </Avatar>
                            }
                          />
                        ))
                      }
                      renderOption={(props, opt) => (
                        <Box component="li" {...props} key={opt.id}>
                          <Stack
                            direction="row"
                            spacing={1.5}
                            alignItems="flex-start"
                            sx={{ flexGrow: 1, flexWrap: "wrap", rowGap: 0.5 }}
                          >
                            <Avatar
                              sx={{
                                width: 32,
                                height: 32,
                                fontSize: "0.75rem",
                                bgcolor: isDark ? "#fff" : "#000",
                                color: isDark ? "#000" : "#fff",
                                flexShrink: 0,
                              }}
                            >
                              {opt.fullName?.[0] ?? "?"}
                            </Avatar>
                            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                              <Typography variant="body2" fontWeight={600} noWrap>
                                {opt.fullName}
                              </Typography>
                              {opt.email && (
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  noWrap
                                >
                                  {opt.email}
                                </Typography>
                              )}
                            </Box>
                            <Stack
                              direction="row"
                              spacing={0.5}
                              alignItems="center"
                              sx={{
                                flexWrap: "wrap",
                                flexShrink: 0,
                                flexBasis: { xs: "100%", sm: "auto" },
                                order: 3,
                              }}
                            >
                              {visitorVisitCounts[opt.id] != null &&
                                visitorVisitCounts[opt.id] > 0 && (
                                  <Chip
                                    label={`${visitorVisitCounts[opt.id]} past visit${visitorVisitCounts[opt.id] !== 1 ? "s" : ""}`}
                                    size="small"
                                    color="info"
                                    sx={{
                                      fontWeight: 700,
                                      height: 20,
                                      fontSize: "0.62rem",
                                    }}
                                  />
                                )}
                              {opt.hasActiveVisit && (
                                <Chip
                                  label="Active Visit"
                                  size="small"
                                  color="warning"
                                  sx={{
                                    fontWeight: 700,
                                    height: 20,
                                    fontSize: "0.62rem",
                                  }}
                                />
                              )}
                            </Stack>
                            <IconButton
                              size="small"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={(e) => {
                                e.stopPropagation();
                                openVisitorDetails(opt.id, opt);
                              }}
                              sx={{
                                color: "primary.main",
                                p: 0.5,
                                flexShrink: 0,
                                ml: "auto",
                                order: { xs: 2, sm: 4 },
                              }}
                              title="View visitor details"
                            >
                              <ICONS.view fontSize="small" />
                            </IconButton>
                          </Stack>
                        </Box>
                      )}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          placeholder="Search visitors…"
                          size="small"
                          InputProps={{
                            ...params.InputProps,
                            sx: { borderRadius: 2 },
                            endAdornment: (
                              <>
                                {visitorOptionsLoading && (
                                  <CircularProgress size={16} />
                                )}
                                {params.InputProps.endAdornment}
                              </>
                            ),
                          }}
                        />
                      )}
                      noOptionsText={
                        visitorOptionsLoading
                          ? "Loading…"
                          : "No eligible visitors found"
                      }
                    />
                    {selectedVisitors.length > 0 && (
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        sx={{ mt: 0.5 }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          {selectedVisitors.length} visitor
                          {selectedVisitors.length > 1 ? "s" : ""} selected
                        </Typography>
                      </Stack>
                    )}
                  </Box>

                  {/* Department + Purpose */}
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormControl fullWidth required size="small">
                      <InputLabel>Visiting Department</InputLabel>
                      <Select
                        value={newDepartmentId}
                        label="Visiting Department"
                          onChange={(e) => setNewDepartmentId(e.target.value)}
                          sx={{ borderRadius: 2 }}
                        >
                          {deptChoices.map((d) => (
                            <MenuItem key={d.id} value={d.id}>
                              {d.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      {purposeOptions.length > 0 ? (
                        <FormControl fullWidth size="small">
                          <InputLabel>Purpose of Visit</InputLabel>
                          <Select
                            value={newPurpose}
                            label="Purpose of Visit"
                            onChange={(e) => {
                              setNewPurpose(e.target.value);
                              if (e.target.value !== "Other")
                                setNewPurposeOther("");
                            }}
                            sx={{ borderRadius: 2 }}
                          >
                            <MenuItem value="">
                              <em>None</em>
                            </MenuItem>
                            {purposeOptions.map((opt) => (
                              <MenuItem key={opt} value={opt}>
                                {opt}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      ) : (
                        <TextField
                          fullWidth
                          size="small"
                          label="Purpose of Visit"
                          value={newPurpose}
                          onChange={(e) => setNewPurpose(e.target.value)}
                          InputProps={{ sx: { borderRadius: 2 } }}
                        />
                      )}
                      {newPurpose === "Other" && (
                        <TextField
                          fullWidth
                          size="small"
                          label="Please specify"
                          value={newPurposeOther}
                          onChange={(e) => setNewPurposeOther(e.target.value)}
                          sx={{
                            mt: 1,
                            "& .MuiOutlinedInput-root": { borderRadius: 2 },
                          }}
                        />
                      )}
                    </Grid>
                  </Grid>

                  <Divider />

                  {/* Access Zones + multi-checkin + parking + VIP */}
                  <Stack spacing={2}>
                    <FormControl
                      fullWidth
                      required
                      size="small"
                      error={Boolean(newVisitAccessLevelError)}
                    >
                      <InputLabel>Access Zones</InputLabel>
                      <Select
                        multiple
                        value={selectedAccessLevelIds}
                        label="Access Zones"
                        onChange={(e) => {
                          setSelectedAccessLevelIds(e.target.value);
                          setNewVisitAccessLevelError("");
                        }}
                        renderValue={(sel) => (
                          <Box
                            sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}
                          >
                            {sel.map((id) => {
                              const al = accessLevels.find((a) => a.id === id);
                              return (
                                <Chip
                                  key={id}
                                  label={al?.name || id}
                                  size="small"
                                />
                              );
                            })}
                          </Box>
                        )}
                        sx={{ borderRadius: 2 }}
                      >
                        {accessLevels.map((al) => (
                          <MenuItem key={al.id} value={al.id}>
                            {al.name}
                          </MenuItem>
                        ))}
                      </Select>
                      {newVisitAccessLevelError && (
                        <Typography
                          variant="caption"
                          color="error"
                          sx={{ mt: 0.5, ml: 1.5 }}
                        >
                          {newVisitAccessLevelError}
                        </Typography>
                      )}
                    </FormControl>

                    <FormControlLabel
                      control={
                        <Switch
                          checked={allowMultiCheckin}
                          onChange={(e) =>
                            setAllowMultiCheckin(e.target.checked)
                          }
                          color="success"
                        />
                      }
                      label={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="body2">
                            Allow Multiple Check-ins
                          </Typography>
                          <Chip
                            label={allowMultiCheckin ? "Enabled" : "Disabled"}
                            size="small"
                            color={allowMultiCheckin ? "success" : "default"}
                            sx={{
                              fontWeight: 700,
                              height: 20,
                              fontSize: "0.65rem",
                            }}
                          />
                        </Stack>
                      }
                    />

                    <FormControlLabel
                      control={
                        <Switch
                          checked={isVip}
                          onChange={(e) => {
                            setIsVip(e.target.checked);
                            if (!e.target.checked) {
                              setVipReason("");
                              setVipReasonError("");
                            }
                          }}
                          color="success"
                        />
                      }
                      label={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="body2">VIP</Typography>
                          <Chip
                            label={isVip ? "Enabled" : "Disabled"}
                            size="small"
                            color={isVip ? "success" : "default"}
                            sx={{
                              fontWeight: 700,
                              height: 20,
                              fontSize: "0.65rem",
                            }}
                          />
                        </Stack>
                      }
                    />
                    {isVip && (
                      <TextField
                        fullWidth
                        required
                        size="small"
                        label="VIP Reason"
                        placeholder="Enter the reason for VIP status…"
                        value={vipReason}
                        onChange={(e) => {
                          setVipReason(e.target.value);
                          setVipReasonError("");
                        }}
                        error={Boolean(vipReasonError)}
                        helperText={vipReasonError}
                        sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                        inputProps={{ maxLength: 300 }}
                      />
                    )}

                    <FormControlLabel
                      control={
                        <Switch
                          checked={escortRequired}
                          onChange={(e) => setEscortRequired(e.target.checked)}
                          color="success"
                        />
                      }
                      label={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="body2">
                            Escort Required
                          </Typography>
                          <Chip
                            label={escortRequired ? "Enabled" : "Disabled"}
                            size="small"
                            color={escortRequired ? "success" : "default"}
                            sx={{
                              fontWeight: 700,
                              height: 20,
                              fontSize: "0.65rem",
                            }}
                          />
                        </Stack>
                      }
                    />
                  </Stack>

                  <Divider />

                  {/* Schedule — reuse the exact same calendar + schedule controls as the approve dialog */}
                  <Box>
                    <Typography
                      variant="subtitle2"
                      sx={{ mb: 1.5, fontWeight: 700, color: "text.primary" }}
                    >
                      Schedule
                    </Typography>
                    <Grid container spacing={3}>
                      <Grid size={{ xs: 12, sm: 6.5 }}>
                        <Box
                          sx={{
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: 4,
                            bgcolor: "action.hover",
                            "& .MuiDateCalendar-root": {
                              width: "100%",
                              height: "auto",
                              maxHeight: "none",
                            },
                          }}
                        >
                          <DateCalendar
                            value={scheduledDate}
onChange={(newDate) => applySchedule({ scheduledDate: newDate })}
                            disablePast
                          />
                        </Box>
                      </Grid>
                      <Grid size={{ xs: 12, sm: 5.5 }}>
                        <Stack spacing={2}>
                          <Tabs
                            value={scheduleType}
                            onChange={(_, v) => applySchedule({ scheduleType: v })}
                            variant="fullWidth"
                            sx={{
                              minHeight: 46,
                              bgcolor: (theme) =>
                                alpha(
                                  theme.palette.text.primary,
                                  isDark ? 0.06 : 0.04,
                                ),
                              borderRadius: 999,
                              p: 0.5,
                              "& .MuiTabs-indicator": { display: "none" },
                            }}
                          >
                            <Tab
                              value="custom"
                              icon={<ICONS.time fontSize="small" />}
                              iconPosition="start"
                              label="Custom"
                              sx={{
                                minHeight: 38,
                                borderRadius: 999,
                                fontWeight: 800,
                                textTransform: "none",
                                "&.Mui-selected": {
                                  bgcolor: "background.paper",
                                  color: "text.primary",
                                  boxShadow: "0 6px 14px rgba(0,0,0,0.08)",
                                },
                              }}
                            />
                            <Tab
                              value="preset"
                              icon={<ICONS.event fontSize="small" />}
                              iconPosition="start"
                              label="Preset"
                              sx={{
                                minHeight: 38,
                                borderRadius: 999,
                                fontWeight: 800,
                                textTransform: "none",
                                "&.Mui-selected": {
                                  bgcolor: "background.paper",
                                  color: "text.primary",
                                  boxShadow: "0 6px 14px rgba(0,0,0,0.08)",
                                },
                              }}
                            />
                          </Tabs>
                          {scheduleType === "custom" && (
                            <Box
                              sx={{
                                p: 2,
                                bgcolor: "action.hover",
                                borderRadius: 2,
                                border: "1px solid",
                                borderColor: "divider",
                              }}
                            >
                              {hostConfig && (
                                <Typography
                                  variant="caption"
                                  color="info.main"
                                  sx={{ display: "block", mb: 1.5, fontSize: "0.68rem", direction: "ltr" }}
                                >
                                  {t.bookingWorkingHoursInfo
                                    .replace("{{start}}", fmtLocalWorkingHours(hostConfig).start)
                                    .replace("{{end}}", fmtLocalWorkingHours(hostConfig).end)}
                                </Typography>
                              )}
                              <Stack spacing={2} sx={{ mb: 2 }}>
                                {renderTimeDropdowns(
                                  "scheduledFrom",
                                  "Expected Arrival (From)",
                                )}
                                {renderTimeDropdowns(
                                  "scheduledTo",
                                  "Expected Departure (To)",
                                )}
                              </Stack>
                              <Box
                                sx={{
                                  p: 1.5,
                                  bgcolor: "background.paper",
                                  borderRadius: 2,
                                  border: "1px solid",
                                  borderColor: "divider",
                                }}
                              >
                                <Stack
                                  direction="row"
                                  spacing={1}
                                  alignItems="center"
                                >
                                  <ICONS.info
                                    sx={{
                                      fontSize: 16,
                                      color: "text.secondary",
                                    }}
                                  />
                                  <Typography
                                    variant="caption"
                                    fontWeight={700}
                                    color="text.secondary"
                                    sx={{ fontSize: 12 }}
                                  >
                                    Visit duration: {getDuration()} min
                                  </Typography>
                                </Stack>
                              </Box>
                            </Box>
                          )}
                          {scheduleType === "preset" && (
                            <Box
                              sx={{
                                p: 2,
                                bgcolor: "action.hover",
                                borderRadius: 2,
                                border: "1px solid",
                                borderColor: "divider",
                                minHeight: 280,
                              }}
                            >
                              {/* Preset Type Selector */}
                              <Box sx={{ mb: 2.5 }}>
                                <Typography
                                  variant="caption"
                                  fontWeight={700}
                                  color="text.secondary"
                                  sx={{
                                    display: "block",
                                    mb: 1,
                                    textTransform: "uppercase",
                                    fontSize: "0.65rem",
                                  }}
                                >
                                  Preset Type
                                </Typography>
                                <TextField
                                  fullWidth
                                  select
                                  size="small"
                                  value={selectedPreset || "fullDay"}
                                  onChange={(e) =>
                                    applySchedule({
                                      selectedPreset: e.target.value,
                                      specificDays: [],
                                      dayTypeTab: "working",
                                    })
                                  }
                                  sx={{
                                    "& .MuiOutlinedInput-root": {
                                      borderRadius: 2,
                                    },
                                  }}
                                >
                                  <MenuItem value="fullDay">Full Day</MenuItem>
                                  <MenuItem value="fullWeek">
                                    Full Week
                                  </MenuItem>
                                  <MenuItem value="fullMonth">
                                    Full Month
                                  </MenuItem>
                                  <MenuItem value="specificDays">
                                    Specific Days
                                  </MenuItem>
                                </TextField>
                              </Box>

                              {/* Date Range Display */}
                              {selectedPreset !== "specificDays" && (
                                <Box
                                  sx={{
                                    p: 1.5,
                                    bgcolor: "background.paper",
                                    borderRadius: 2,
                                    border: "1px solid",
                                    borderColor: "divider",
                                    mb: 2.5,
                                  }}
                                >
                                  <Typography
                                    variant="caption"
                                    fontWeight={700}
                                    color="text.secondary"
                                    sx={{
                                      display: "block",
                                      mb: 0.5,
                                      textTransform: "uppercase",
                                      fontSize: "0.65rem",
                                    }}
                                  >
                                    Date Range
                                  </Typography>
                                  <Typography
                                    variant="body2"
                                    fontWeight={600}
                                    color="text.primary"
                                  >
                                    {!scheduledDate
                                      ? "Select a date"
                                      : (() => {
                                          const date = scheduledDate;
                                          let from = date.clone();
                                          let to = date.clone();
                                          if (selectedPreset === "fullDay") {
                                            const startH = hostConfig?.start ?? 8;
                                            const startM = hostConfig?.startMinute ?? 0;
                                            const endH = hostConfig?.end ?? 17;
                                            const endM = hostConfig?.endMinute ?? 0;
                                            from = from.startOf("day").hour(startH).minute(startM);
                                            to = date.clone().startOf("day").hour(endH).minute(endM);
                                          } else if (selectedPreset === "fullWeek") {
                                            from = from.startOf("day");
                                            to = from.add(6, "days").endOf("day");
                                          } else if (selectedPreset === "fullMonth") {
                                            from = from.startOf("day");
                                            to = from.endOf("month");
                                          }
                                          return `${from.format("DD MMMM YYYY, hh:mm A")} → ${to.format("DD MMMM YYYY, hh:mm A")}`;
                                        })()}
                                  </Typography>
                                </Box>
                              )}

                              {/* Day-type tabs for fullWeek/fullMonth */}
                              {(selectedPreset === "fullWeek" ||
                                selectedPreset === "fullMonth") && (
                                <Box sx={{ mb: 2 }}>
                                  <Typography
                                    variant="caption"
                                    fontWeight={600}
                                    color="info.main"
                                    sx={{
                                      display: "block",
                                      mb: 0.75,
                                      fontSize: "0.68rem",
                                    }}
                                  >
                                    {t.bookingWorkingDays}:{" "}
                                    {(hostConfig?.workingDays ?? [0, 1, 2, 3, 4])
                                      .map((d) => DAY_LABELS[d])
                                      .join(", ")}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    fontWeight={700}
                                    color="text.secondary"
                                    sx={{
                                      display: "block",
                                      mb: 0.75,
                                      textTransform: "uppercase",
                                      fontSize: "0.65rem",
                                    }}
                                  >
                                    {t.bookingDayType}
                                  </Typography>
                                  <RadioGroup
                                    row
                                    value={dayTypeTab}
                                    onChange={(_, v) =>
                                      applySchedule({ dayTypeTab: v })
                                    }
                                  >
                                    <FormControlLabel
                                      value="working"
                                      control={<Radio size="small" />}
                                      label={t.bookingWorkingOnly}
                                    />
                                    <FormControlLabel
                                      value="all"
                                      control={<Radio size="small" />}
                                      label={t.bookingWorkingPlusWeekends}
                                    />
                                  </RadioGroup>
                                </Box>
                              )}

                              {/* Day chips for specificDays */}
                              {selectedPreset === "specificDays" && (
                                <Box sx={{ mb: 2 }}>
                                  {hostConfig &&
                                    (() => {
                                      const wDays = hostConfig.workingDays ?? [
                                        0, 1, 2, 3, 4,
                                      ];
                                      const wEnds = hostConfig.weekendDays ?? [
                                        5, 6,
                                      ];
                                      const chip = (idx, label, isWeekend) => {
                                        const active =
                                          specificDays.includes(idx);
                                        return (
                                          <Box
                                            key={idx}
                                            onClick={() =>
                                              applySchedule({
                                                specificDays: active
                                                  ? specificDays.filter(
                                                      (d) => d !== idx,
                                                    )
                                                  : [...specificDays, idx],
                                              })
                                            }
                                            sx={{
                                              px: 1.5,
                                              py: 0.5,
                                              borderRadius: 30,
                                              cursor: "pointer",
                                              userSelect: "none",
                                              border: "1px solid",
                                              fontWeight: 700,
                                              fontSize: "0.75rem",
                                              borderColor: active
                                                ? isWeekend
                                                  ? "warning.main"
                                                  : "primary.main"
                                                : "divider",
                                              bgcolor: active
                                                ? isWeekend
                                                  ? "warning.main"
                                                  : "primary.main"
                                                : "background.paper",
                                              color: active
                                                ? isWeekend
                                                  ? "warning.contrastText"
                                                  : "primary.contrastText"
                                                : isWeekend
                                                  ? "warning.main"
                                                  : "text.secondary",
                                              transition: "all 0.12s",
                                            }}
                                          >
                                            {label}
                                          </Box>
                                        );
                                      };
                                      return (
                                        <>
                                          <Typography
                                            variant="caption"
                                            fontWeight={600}
                                            color="info.main"
                                            sx={{
                                              display: "block",
                                              mb: 0.5,
                                              fontSize: "0.68rem",
                                            }}
                                          >
                                            {t.bookingWorkingDays}
                                          </Typography>
                                          <Stack
                                            direction="row"
                                            flexWrap="wrap"
                                            sx={{ gap: 0.75, mb: 1.5 }}
                                          >
                                            {wDays.map((idx) =>
                                              chip(idx, DAY_LABELS[idx], false),
                                            )}
                                          </Stack>
                                          <Typography
                                            variant="caption"
                                            fontWeight={600}
                                            color="warning.main"
                                            sx={{
                                              display: "block",
                                              mb: 0.5,
                                              fontSize: "0.68rem",
                                            }}
                                          >
                                            {t.bookingWeekendDays}
                                          </Typography>
                                          <Stack
                                            direction="row"
                                            flexWrap="wrap"
                                            sx={{ gap: 0.75, mb: 1.5 }}
                                          >
                                            {wEnds.map((idx) =>
                                              chip(idx, DAY_LABELS[idx], true),
                                            )}
                                          </Stack>
                                        </>
                                      );
                                    })()}
                                  <Stack
                                    direction="row"
                                    spacing={1}
                                    alignItems="center"
                                  >
                                    <Typography
                                      variant="caption"
                                      fontWeight={600}
                                      color="text.secondary"
                                      sx={{ whiteSpace: "nowrap" }}
                                    >
                                      From{" "}
                                      {scheduledDate?.format("DD MMM YYYY")}
                                    </Typography>
                                    <Typography
                                      variant="caption"
                                      color="text.disabled"
                                    >
                                      →
                                    </Typography>
                                    <TextField
                                      type="date"
                                      size="small"
                                      value={
                                        specificEndDate
                                          ? specificEndDate.format("YYYY-MM-DD")
                                          : ""
                                      }
                                      onChange={(e) =>
                                        applySchedule({
                                          specificEndDate: e.target.value
                                            ? dayjs(e.target.value)
                                            : null,
                                        })
                                      }
                                      inputProps={{
                                        min: scheduledDate
                                          ? scheduledDate.format("YYYY-MM-DD")
                                          : dayjs().format("YYYY-MM-DD"),
                                      }}
                                      sx={{
                                        width: 180,
                                        "& .MuiOutlinedInput-root": {
                                          borderRadius: 2,
                                        },
                                      }}
                                    />
                                  </Stack>
                                </Box>
                              )}

                              {/* Bracket preview for fullWeek/fullMonth */}
                              {(selectedPreset === "fullWeek" ||
                                selectedPreset === "fullMonth") &&
                                hostConfig &&
                                scheduledDate &&
                                (() => {
                                  const activeDaySet = computeDaySet(
                                    dayTypeTab,
                                    hostConfig,
                                  );
                                  const weekendSet = hostConfig.weekendDays ?? [
                                    5, 6,
                                  ];
                                  const date = scheduledDate;
                                  let endDate;
                                  if (selectedPreset === "fullWeek")
                                    endDate = date.clone().add(6, "days");
                                  else if (selectedPreset === "fullMonth")
                                    endDate = date.clone().endOf("month");
                                  const matches = [];
                                  let cursor = date.clone();
                                  while (
                                    cursor.isBefore(endDate) ||
                                    cursor.isSame(endDate, "day")
                                  ) {
                                    if (activeDaySet.includes(cursor.day()))
                                      matches.push(cursor.clone());
                                    cursor = cursor.add(1, "day");
                                  }
                                  return matches.length > 0 ? (
                                    <Box sx={{ mb: 2 }}>
                                      <Typography
                                        variant="caption"
                                        fontWeight={700}
                                        color="text.secondary"
                                        sx={{
                                          display: "block",
                                          mb: 0.75,
                                          textTransform: "uppercase",
                                          fontSize: "0.65rem",
                                        }}
                                      >
                                        {t.bookingDaysInRange.replace(
                                          "{{type}}",
                                          dayTypeTab === "all"
                                            ? t.bookingAllDays
                                            : t.bookingWorkingDays,
                                        )}
                                      </Typography>
                                      <Stack
                                        direction="row"
                                        flexWrap="wrap"
                                        sx={{ gap: 0.5 }}
                                      >
                                        {matches.map((d, i) => {
                                          const isOff = weekendSet.includes(
                                            d.day(),
                                          );
                                          return (
                                            <Chip
                                              key={i}
                                              label={`${DAY_LABELS[d.day()]} ${d.format("DD")}`}
                                              size="small"
                                              color={
                                                isOff ? "warning" : "primary"
                                              }
                                              variant="outlined"
                                              sx={{
                                                fontWeight: 600,
                                                fontSize: "0.65rem",
                                                height: 20,
                                              }}
                                            />
                                          );
                                        })}
                                      </Stack>
                                    </Box>
                                  ) : null;
                                })()}

                              {/* Full Day info OR time-type tabs + dropdowns for other presets */}
                              {selectedPreset === "fullDay" ? (
                                <Box
                                  sx={{
                                    p: 1.5,
                                    bgcolor: "background.paper",
                                    borderRadius: 2,
                                    border: "1px solid",
                                    borderColor: "divider",
                                  }}
                                >
                                  <Stack
                                    direction="row"
                                    spacing={1}
                                    alignItems="center"
                                  >
                                    <ICONS.info
                                      sx={{ fontSize: 16, color: "info.main" }}
                                    />
                                    <Typography
                                      variant="caption"
                                      fontWeight={700}
                                      color="text.secondary"
                                      sx={{ fontSize: 12 }}
                                    >
                                      {hostConfig
                                        ? t.bookingFullDayWorkingHoursInfo
                                            .replace(
                                              "{{start}}",
                                              fmtLocalWorkingHours(hostConfig).start,
                                            )
                                            .replace(
                                              "{{end}}",
                                              fmtLocalWorkingHours(hostConfig).end,
                                            )
                                        : t.bookingFullDayWorkingHoursInfo
                                            .replace("{{start}}", "8:00 AM")
                                            .replace("{{end}}", "5:00 PM")}
                                    </Typography>
                                  </Stack>
                                </Box>
                              ) : (
                                  <>
                                    {hostConfig &&
                                      (() => {
                                        const fmt = (h24, min) => {
                                          const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
                                          const ampm = h24 < 12 ? "AM" : "PM";
                                          return `${h12}:${String(min).padStart(2, "0")} ${ampm}`;
                                        };
                                        const s = fmt(fmtLocalWorkingHours(hostConfig).startH, fmtLocalWorkingHours(hostConfig).startM);
                                        const e = fmt(fmtLocalWorkingHours(hostConfig).endH, fmtLocalWorkingHours(hostConfig).endM);
                                        return (
                                          <Typography dir="ltr" variant="caption" color="info.main" sx={{ display: "block", mb: 0.75, fontSize: "0.68rem" }}>
                                            {t.bookingWorkingHoursInfo.replace("{{start}}", s).replace("{{end}}", e)}
                                          </Typography>
                                        );
                                      })()}
                                    <Stack spacing={2} sx={{ mb: 2 }}>
                                      {renderTimeDropdowns("scheduledFrom", "Start Time")}
                                      {renderTimeDropdowns("scheduledTo", "End Time")}
                                    </Stack>
                                    {(() => {
                                      const mins = getDuration();
                                      if (mins <= 0) return null;
                                      return (
                                        <Box sx={{ p: 1.5, bgcolor: "background.paper", borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
                                          <Stack direction="row" spacing={1} alignItems="center">
                                            <ICONS.info sx={{ fontSize: 16, color: "text.secondary" }} />
                                            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ fontSize: 12 }}>
                                              Visit duration: {getDuration()} min
                                            </Typography>
                                          </Stack>
                                        </Box>
                                      );
                                    })()}
                                  </>
                                )}
                            </Box>
                          )}
                          {renderScheduleOutsideWarning()}
                        </Stack>
                      </Grid>
                    </Grid>
                  </Box>

                  <Divider />

                  {/* Approval note */}
                  <Box>
                    <Typography
                      variant="subtitle2"
                      sx={{ mb: 1, fontWeight: 700, color: "text.primary" }}
                    >
                      Note{" "}
                      <Typography
                        component="span"
                        variant="caption"
                        color="text.secondary"
                      >
                        (optional)
                      </Typography>
                    </Typography>
                    <TextField
                      fullWidth
                      multiline
                      minRows={2}
                      maxRows={4}
                      size="small"
                      placeholder="Add a note for the visitor (will appear in their approval email)…"
                      value={approvalNote}
                      onChange={(e) => setApprovalNote(e.target.value)}
                      inputProps={{ maxLength: 500 }}
                      sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                    />
                  </Box>

                  {/* NDA section */}
                  {anyNdaNeeded && (
                    <Box
                      sx={{
                        p: 2,
                        border: "1px solid",
                        borderColor: "warning.main",
                        borderRadius: 2,
                        bgcolor: (theme) =>
                          alpha(theme.palette.warning.main, 0.06),
                      }}
                    >
                      <Typography
                        variant="subtitle2"
                        fontWeight={700}
                        color="warning.dark"
                        sx={{
                          mb: 1,
                          display: "flex",
                          alignItems: "center",
                          gap: 0.5,
                        }}
                      >
                        <ICONS.info fontSize="small" /> NDA Required
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block", mb: 1 }}
                      >
                        The following visitor
                        {visitorsNeedingNda.length > 1 ? "s do" : " does"} not
                        have a valid NDA on record:
                      </Typography>
                      <Box
                        sx={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 0.5,
                          mb: 1.5,
                        }}
                      >
                        {visitorsNeedingNda.map((v) => (
                          <Chip
                            key={v.id}
                            label={v.fullName}
                            size="small"
                            color="warning"
                            variant="outlined"
                            clickable
                            onClick={(e) => {
                              e.stopPropagation();
                              openVisitorDetails(v.id, v);
                            }}
                            sx={{ cursor: "pointer" }}
                          />
                        ))}
                      </Box>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={newNdaAccepted}
                            onChange={(e) =>
                              setNewNdaAccepted(e.target.checked)
                            }
                            color="warning"
                          />
                        }
                        label={
                          <Typography variant="body2" fontWeight={600}>
                            Accept NDA on behalf of visitor
                            {visitorsNeedingNda.length > 1 ? "s" : ""} who need
                            it
                          </Typography>
                        }
                      />
                    </Box>
                  )}

                  {selectedVisitors.length > 1 && (
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        border: "1px solid",
                        borderColor: "divider",
                        bgcolor: (theme) =>
                          alpha(theme.palette.primary.main, 0.04),
                      }}
                    >
                      <FormControlLabel
                        control={
                          <Switch
                            checked={newGroupMeeting}
                            onChange={(e) =>
                              setNewGroupMeeting(e.target.checked)
                            }
                            color="success"
                          />
                        }
                        label={
                          <Stack spacing={0.25}>
                            <Typography variant="body2" fontWeight={700}>
                              Group as a single meeting
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              All {selectedVisitors.length} visitors become one
                              meeting with a single purpose, approval and
                              check-in/out status.
                            </Typography>
                          </Stack>
                        }
                      />
                      {newGroupMeeting && (
                        <TextField
                          fullWidth
                          size="small"
                          label="Meeting Name (Optional)"
                          placeholder="e.g. Board Meeting"
                          value={newMeetingName}
                          onChange={(e) => setNewMeetingName(e.target.value)}
                          inputProps={{ maxLength: 100 }}
                          helperText="Leave empty to default to “Group Meeting”."
                          sx={{ mt: 1 }}
                        />
                      )}
                    </Box>
                  )}
                </Stack>
              </DialogContent>
              <Divider />
              <DialogActions
                disableSpacing
                sx={{
                  p: 2.5,
                  gap: 1,
                  flexDirection: { xs: "column", sm: "row" },
                  justifyContent: "flex-end",
                }}
              >
                <Button
                  variant="outlined"
                  onClick={() => setNewVisitOpen(false)}
                  startIcon={<ICONS.cancel />}
                  disabled={newVisitSubmitting}
                  sx={{
                    px: 3,
                    fontWeight: 700,
                    borderRadius: 30,
                    width: { xs: "100%", sm: "auto" },
                    order: { xs: 2, sm: 0 },
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={
                    newVisitSubmitting ? (
                      <CircularProgress size={16} color="inherit" />
                    ) : (
                      <ICONS.check />
                    )
                  }
                  onClick={handleSubmitNewRequest}
                  disabled={
                    newVisitSubmitting ||
                    !selectedVisitors.length ||
                    !newDepartmentId
                  }
                  sx={{
                    borderRadius: 30,
                    px: 4,
                    fontWeight: 700,
                    width: { xs: "100%", sm: "auto" },
                    order: { xs: 1, sm: 0 },
                  }}
                >
                  {newVisitSubmitting
                    ? "Creating…"
                    : newGroupMeeting
                      ? "Create Meeting"
                      : `Create ${selectedVisitors.length > 1 ? `${selectedVisitors.length} Visits` : "Visit"}`}
                </Button>
              </DialogActions>
            </Dialog>
          );
        })()}

        {/* Visitor Details Overlay (shared component) */}
        <VisitorDetailsDialog
          open={visitorDialog.open}
          visitorId={visitorDialog.visitorId}
          seed={visitorDialog.seed}
          onClose={() => setVisitorDialog({ open: false, visitorId: null, seed: null })}
        />

        {/* ── Filter Modal ── */}
        <FilterModal
          open={filterModalOpen}
          onClose={() => setFilterModalOpen(false)}
          title="Filter Visits"
        >
          <Stack spacing={3}>
            <Box>
              <Typography
                variant="subtitle2"
                fontWeight={700}
                sx={{ mb: 1, ml: 1 }}
              >
                Status
              </Typography>
              <TextField
                select
                fullWidth
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(0);
                }}
                InputProps={{ sx: { borderRadius: 3 } }}
              >
                <MenuItem value="all">Any Status</MenuItem>
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                  <MenuItem key={key} value={key}>
                    {cfg.label}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={vipFastTrackOnly}
                    disabled={groupMeetingOnly}
                    onChange={(e) => {
                      setVipFastTrackOnly(e.target.checked);
                      if (e.target.checked) setGroupMeetingOnly(false);
                      setPage(0);
                    }}
                    color="warning"
                  />
                }
                label={
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Typography variant="subtitle2" fontWeight={700}>
                      VIP Fast Track Only
                    </Typography>
                    {groupMeetingOnly && (
                      <Tooltip title="Group Meeting filter is active — they cannot be combined">
                        <ICONS.info
                          fontSize="small"
                          sx={{ color: "text.disabled" }}
                        />
                      </Tooltip>
                    )}
                  </Stack>
                }
              />
            </Box>
            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={groupMeetingOnly}
                    disabled={vipFastTrackOnly}
                    onChange={(e) => {
                      setGroupMeetingOnly(e.target.checked);
                      if (e.target.checked) setVipFastTrackOnly(false);
                      setPage(0);
                    }}
                    color="info"
                  />
                }
                label={
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Typography variant="subtitle2" fontWeight={700}>
                      Group Meeting Only
                    </Typography>
                    {vipFastTrackOnly && (
                      <Tooltip title="VIP Fast Track filter is active — they cannot be combined">
                        <ICONS.info
                          fontSize="small"
                          sx={{ color: "text.disabled" }}
                        />
                      </Tooltip>
                    )}
                  </Stack>
                }
              />
            </Box>
            <Divider />
            <Box>
              <Typography
                variant="subtitle2"
                fontWeight={700}
                sx={{ mb: 1, ml: 1 }}
              >
                Requested Visit Date
              </Typography>
              <Stack direction="row" spacing={1.5}>
                <TextField
                  label="From"
                  type="date"
                  size="small"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={requestDateFrom}
                  onChange={(e) => {
                    setRequestDateFrom(e.target.value);
                    setPage(0);
                  }}
                  inputProps={{ max: requestDateTo || undefined }}
                />
                <TextField
                  label="To"
                  type="date"
                  size="small"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={requestDateTo}
                  onChange={(e) => {
                    setRequestDateTo(e.target.value);
                    setPage(0);
                  }}
                  inputProps={{ min: requestDateFrom || undefined }}
                />
              </Stack>
            </Box>
            <Box>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ mb: 1, ml: 1 }}
              >
                <Typography variant="subtitle2" fontWeight={700}>
                  Requested Visit Time
                </Typography>
                <Chip
                  label={requestTimeFilter.enabled ? "Enabled" : "Disabled"}
                  size="small"
                  color={requestTimeFilter.enabled ? "success" : "default"}
                  onClick={() =>
                    setRequestTimeFilter({
                      ...requestTimeFilter,
                      enabled: !requestTimeFilter.enabled,
                    })
                  }
                  sx={{ fontWeight: 800, cursor: "pointer" }}
                />
              </Stack>
              <Stack
                direction="row"
                spacing={1}
                sx={{
                  opacity: requestTimeFilter.enabled ? 1 : 0.5,
                  pointerEvents: requestTimeFilter.enabled ? "auto" : "none",
                }}
              >
                <TextField
                  select
                  fullWidth
                  label="Hr"
                  size="small"
                  value={requestTimeFilter.hour12}
                  onChange={(e) =>
                    setRequestTimeFilter({
                      ...requestTimeFilter,
                      hour12: e.target.value,
                    })
                  }
                  InputProps={{ sx: { borderRadius: 3 } }}
                >
                  {HOURS.map((h) => (
                    <MenuItem key={h} value={h}>
                      {h}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  fullWidth
                  label="Min"
                  size="small"
                  value={requestTimeFilter.minute}
                  onChange={(e) =>
                    setRequestTimeFilter({
                      ...requestTimeFilter,
                      minute: e.target.value,
                    })
                  }
                  InputProps={{ sx: { borderRadius: 3 } }}
                >
                  {MINUTES.map((m) => (
                    <MenuItem key={m} value={m}>
                      {m}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  fullWidth
                  label="AM/PM"
                  size="small"
                  value={requestTimeFilter.ampm}
                  onChange={(e) =>
                    setRequestTimeFilter({
                      ...requestTimeFilter,
                      ampm: e.target.value,
                    })
                  }
                  InputProps={{ sx: { borderRadius: 3 } }}
                >
                  {PERIODS.map((p) => (
                    <MenuItem key={p} value={p}>
                      {p}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
            </Box>
            <Divider />
            <Box>
              <Typography
                variant="subtitle2"
                fontWeight={700}
                sx={{ mb: 1, ml: 1 }}
              >
                Approved Visit Date
              </Typography>
              <Stack direction="row" spacing={1.5}>
                <TextField
                  label="From"
                  type="date"
                  size="small"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={approvedDateFrom}
                  onChange={(e) => {
                    setApprovedDateFrom(e.target.value);
                    setPage(0);
                  }}
                  inputProps={{ max: approvedDateTo || undefined }}
                />
                <TextField
                  label="To"
                  type="date"
                  size="small"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={approvedDateTo}
                  onChange={(e) => {
                    setApprovedDateTo(e.target.value);
                    setPage(0);
                  }}
                  inputProps={{ min: approvedDateFrom || undefined }}
                />
              </Stack>
            </Box>
            <Box>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ mb: 1, ml: 1 }}
              >
                <Typography variant="subtitle2" fontWeight={700}>
                  Approved Visit Time
                </Typography>
                <Chip
                  label={approvedTimeFilter.enabled ? "Enabled" : "Disabled"}
                  size="small"
                  color={approvedTimeFilter.enabled ? "success" : "default"}
                  onClick={() =>
                    setApprovedTimeFilter({
                      ...approvedTimeFilter,
                      enabled: !approvedTimeFilter.enabled,
                    })
                  }
                  sx={{ fontWeight: 800, cursor: "pointer" }}
                />
              </Stack>
              <Stack
                direction="row"
                spacing={1}
                sx={{
                  opacity: approvedTimeFilter.enabled ? 1 : 0.5,
                  pointerEvents: approvedTimeFilter.enabled ? "auto" : "none",
                }}
              >
                <TextField
                  select
                  fullWidth
                  label="Hr"
                  size="small"
                  value={approvedTimeFilter.hour12}
                  onChange={(e) =>
                    setApprovedTimeFilter({
                      ...approvedTimeFilter,
                      hour12: e.target.value,
                    })
                  }
                  InputProps={{ sx: { borderRadius: 3 } }}
                >
                  {HOURS.map((h) => (
                    <MenuItem key={h} value={h}>
                      {h}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  fullWidth
                  label="Min"
                  size="small"
                  value={approvedTimeFilter.minute}
                  onChange={(e) =>
                    setApprovedTimeFilter({
                      ...approvedTimeFilter,
                      minute: e.target.value,
                    })
                  }
                  InputProps={{ sx: { borderRadius: 3 } }}
                >
                  {MINUTES.map((m) => (
                    <MenuItem key={m} value={m}>
                      {m}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  fullWidth
                  label="AM/PM"
                  size="small"
                  value={approvedTimeFilter.ampm}
                  onChange={(e) =>
                    setApprovedTimeFilter({
                      ...approvedTimeFilter,
                      ampm: e.target.value,
                    })
                  }
                  InputProps={{ sx: { borderRadius: 3 } }}
                >
                  {PERIODS.map((p) => (
                    <MenuItem key={p} value={p}>
                      {p}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
            </Box>
            <Button
              variant="contained"
              fullWidth
              startIcon={<ICONS.filter />}
              onClick={() => setFilterModalOpen(false)}
              sx={{ mt: 2, height: 48, borderRadius: 3, fontWeight: 800 }}
            >
              Apply
            </Button>
            <Button
              variant="text"
              fullWidth
              color="inherit"
              startIcon={<ICONS.clear />}
              onClick={() => {
                setStatusFilter("all");
                setVipFastTrackOnly(false);
                setGroupMeetingOnly(false);
                setDatePreset("all");
                setCustomFrom("");
                setCustomTo("");
                setRequestDateFrom("");
                setRequestDateTo("");
                setRequestTimeFilter({
                  hour12: "",
                  minute: "00",
                  ampm: "AM",
                  enabled: false,
                });
                setApprovedDateFrom("");
                setApprovedDateTo("");
                setApprovedTimeFilter({
                  hour12: "",
                  minute: "00",
                  ampm: "AM",
                  enabled: false,
                });
                setFilterModalOpen(false);
                setPage(0);
              }}
              sx={{ fontWeight: 700, opacity: 0.6 }}
            >
              Clear
            </Button>
          </Stack>
        </FilterModal>

        {/* ── Detail Dialog ── */}
        <Dialog
          open={!!selected}
          onClose={() => {
            setSelected(null);
            setInternalNoteDialogOpen(false);
            setDetailPastVisits(null);
            setDetailPastVisitsOpen(false);
            setOrders([]);
            setOrdersLoading(false);
          }}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: { borderRadius: 4, overflow: "hidden", variant: "frosted" },
          }}
        >
          <DialogHeader
            title="Visit Details"
            onClose={() => {
              setSelected(null);
        setInternalNoteDialogOpen(false);
              setDetailPastVisits(null);
              setDetailPastVisitsOpen(false);
              setOrders([]);
              setOrdersLoading(false);
            }}
          />
          <Divider />
          <DialogContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
            {fetchingProfile ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress />
              </Box>
            ) : selected ? (
              (() => {
                const sc = STATUS_CONFIG[selected.status] || {
                  label: selected.status,
                  color: "default",
                };
                const allowMultiCheckin =
                  selected.allow_multi_checkin ??
                  selected.allowMultiCheckin ??
                  false;

                return (
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
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={2}
                        alignItems={{ xs: "center", sm: "flex-start" }}
                        textAlign={{ xs: "left", sm: "left" }}
                        sx={{ width: "100%" }}
                      >
                        <Avatar
                          sx={{
                            width: 56,
                            height: 56,
                            bgcolor: isDark ? "#fff" : "#000",
                            color: isDark ? "#000" : "#fff",
                            fontSize: "1.2rem",
                            fontWeight: 700,
                            mx: { xs: "auto", sm: 0 },
                          }}
                        >
                          {(selected.full_name || "")
                            .split(" ")
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join("")}
                        </Avatar>
                        <Box sx={{ flex: 1, width: "100%" }}>
                          <Stack
                            direction={{ xs: "column", sm: "row" }}
                            spacing={1}
                            alignItems={{ xs: "center", sm: "center" }}
                            justifyContent={{ xs: "center", sm: "space-between" }}
                            sx={{ width: "100%" }}
                          >
{selected.participants?.length > 1 ? (
                              <Typography
                                variant="subtitle1"
                                fontWeight={700}
                                sx={{ textAlign: { xs: "center", sm: "left" } }}
                              >
                                {selected.meetingName ||
                                  `Group Meeting (${selected.participants.length})`}
                              </Typography>
) : (
                              <ClickableVisitorName
                                name={selected.full_name}
                                visitorId={selected.userId}
                                seed={{
                                  fullName: selected.full_name,
                                  email: selected.email,
                                  phone: selected.phone,
                                  iso_code: selected.phone_iso_code,
                                }}
                                onOpen={openVisitorDetails}
                                variant="subtitle1"
                                fontWeight={700}
                                sx={{
                                  width: "fit-content",
                                  mx: { xs: "auto", sm: 0 },
                                }}
                              />
                            )}
                            {detailPastVisits &&
                              !detailPastVisits.isGroup &&
                              detailPastVisits.breakdown[0] && (
                                <Chip
                                  size="small"
                                  label={
                                    detailPastVisits.breakdown[0].count > 0
                                      ? `${detailPastVisits.breakdown[0].count} past visit${detailPastVisits.breakdown[0].count !== 1 ? "s" : ""}`
                                      : "New"
                                  }
                                  color={
                                    detailPastVisits.breakdown[0].count > 0
                                      ? "info"
                                      : "default"
                                  }
                                  sx={{
                                    height: 22,
                                    fontSize: "0.65rem",
                                    fontWeight: 700,
                                    flexShrink: 0,
                                    display: { xs: "none", sm: "flex" },
                                  }}
                                />
                              )}
                          </Stack>
                          {selected.participants?.length > 1 && (
                            <Stack
                              direction="row"
                              spacing={0.6}
                              flexWrap="wrap"
                              useFlexGap
                              sx={{ mt: 0.75, justifyContent: { xs: "center", sm: "flex-start" } }}
                            >
                              {selected.participants.map((p) => (
                                <Tooltip
                                  key={p.id}
                                  title="View visitor details"
                                  arrow
                                  placement="top"
                                >
                                  <Chip
                                    label={p.fullName}
                                    size="small"
                                    variant="outlined"
                                    color="primary"
                                    clickable
                                    onClick={() => openVisitorDetails(p.id, p)}
                                    icon={<ICONS.person fontSize="small" />}
                                    sx={{
                                      fontWeight: 600,
                                      fontSize: "0.68rem",
                                      height: 22,
                                      cursor: "pointer",
                                    }}
                                  />
                                </Tooltip>
                              ))}
                            </Stack>
                          )}
                          <Stack
                            direction={{ xs: "column", sm: "row" }}
                            spacing={{ xs: 0.5, sm: 2 }}
                            sx={{ mt: 0.5, flexWrap: "wrap", alignItems: "center" }}
                          >
                            {selected.email && (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 0.5,
                                  textAlign: { xs: "center", sm: "left" },
                                }}
                              >
                                {selected.email}
                              </Typography>
                            )}
                            {selected.phone && (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 0.5,
                                }}
                              >
                                <ICONS.phone sx={{ fontSize: 13 }} />
                                {formatPhoneNumberForDisplay(
                                  selected.phone,
                                  selected.phone_iso_code ||
                                    selected.phoneIsoCode,
                                )}
                              </Typography>
                            )}
                          </Stack>
                          <Stack
                            direction={{ xs: "column", sm: "row" }}
                            spacing={1}
                            sx={{
                              mt: 1.5,
                              flexWrap: "wrap",
                              gap: 0.5,
                              width: "100%",
                            }}
                          >
                            <Chip
                              label={sc.label}
                              color={sc.color}
                              size="small"
                              icon={sc.icon}
                              sx={{
                                fontWeight: 700,
                                height: 22,
                                fontSize: "0.65rem",
                                width: { xs: "100%", sm: "auto" },
                              }}
                            />
                            {allowMultiCheckin && (
                              <Chip
                                icon={<ICONS.replay style={{ fontSize: 13 }} />}
                                label="Multi Check-in Allowed"
                                color="primary"
                                size="small"
                                variant="outlined"
                                sx={{
                                  fontWeight: 600,
                                  height: 22,
                                  fontSize: "0.65rem",
                                  width: { xs: "100%", sm: "auto" },
                                }}
                              />
                            )}
                            {(selected.is_vip_fast_track ||
                              selected.isVipFastTrack) && (
                              <Chip
                                icon={<ICONS.star style={{ fontSize: 13 }} />}
                                label="VIP Fast Track"
                                color="warning"
                                size="small"
                                sx={{
                                  fontWeight: 800,
                                  height: 22,
                                  fontSize: "0.65rem",
                                  width: { xs: "100%", sm: "auto" },
                                }}
                              />
                            )}
                            {(selected.is_vip || selected.isVip) && (
                              <Chip
                                icon={<ICONS.star style={{ fontSize: 13 }} />}
                                label="VIP"
                                size="small"
                                sx={{
                                  fontWeight: 800,
                                  height: 22,
                                  fontSize: "0.65rem",
                                  bgcolor: "success.main",
                                  color: isDark ? "#000" : "#fff",
                                  "& .MuiChip-icon": {
                                    color: isDark ? "#000" : "#fff",
                                  },
                                  width: { xs: "100%", sm: "auto" },
                                }}
                              />
                            )}
                            {(selected.allow_parking ||
                              selected.allowParking) && (
                              <Chip
                                icon={
                                  <ICONS.parking style={{ fontSize: 13 }} />
                                }
                                label="Parking Allowed"
                                size="small"
                                sx={{
                                  fontWeight: 800,
                                  height: 22,
                                  fontSize: "0.65rem",
                                  bgcolor: isDark ? "#CE93D8" : "#6A0DAD",
                                  color: isDark ? "#000" : "#fff",
                                  "& .MuiChip-icon": {
                                    color: isDark ? "#000" : "#fff",
                                  },
                                  width: { xs: "100%", sm: "auto" },
                                }}
                              />
                            )}
                            {(selected.isOutsideWorkingHours ||
                              selected.is_outside_working_hours) && (
                              <Chip
                                icon={<ICONS.time style={{ fontSize: 13 }} />}
                                label="Outside Working Hours"
                                color="warning"
                                size="small"
                                sx={{
                                  fontWeight: 800,
                                  height: 22,
                                  fontSize: "0.65rem",
                                  width: { xs: "100%", sm: "auto" },
                                }}
                              />
                            )}
                            {(selected.isOutsideWorkingDays ||
                              selected.is_outside_working_days) && (
                              <Chip
                                icon={<ICONS.event style={{ fontSize: 13 }} />}
                                label="Outside Working Days"
                                color="warning"
                                size="small"
                                sx={{
                                  fontWeight: 800,
                                  height: 22,
                                  fontSize: "0.65rem",
                                  width: { xs: "100%", sm: "auto" },
                                }}
                              />
                            )}
                            {(selected.escort_required ??
                              selected.escortRequired ??
                              true) && (
                              <Chip
                                icon={
                                  <ICONS.security style={{ fontSize: 13 }} />
                                }
                                label="Escort Required"
                                size="small"
                                sx={{
                                  fontWeight: 800,
                                  height: 22,
                                  fontSize: "0.65rem",
                                  bgcolor: isDark ? "#FF8A65" : "#E64A19",
                                  color: "#fff",
                                  "& .MuiChip-icon": { color: "#fff" },
                                  width: { xs: "100%", sm: "auto" },
                                }}
                              />
                            )}
                          </Stack>
                          {detailPastVisits &&
                            !detailPastVisits.isGroup &&
                            detailPastVisits.breakdown[0] && (
                              <Chip
                                size="small"
                                label={
                                  detailPastVisits.breakdown[0].count > 0
                                    ? `${detailPastVisits.breakdown[0].count} past visit${detailPastVisits.breakdown[0].count !== 1 ? "s" : ""}`
                                    : "New"
                                }
                                color={
                                  detailPastVisits.breakdown[0].count > 0
                                    ? "info"
                                    : "default"
                                }
                                sx={{
                                  display: { xs: "flex", sm: "none" },
                                  width: "100%",
                                  height: 22,
                                  fontSize: "0.65rem",
                                  fontWeight: 700,
                                  mt: 1.5,
                                }}
                              />
                            )}
                          {detailPastVisits && detailPastVisits.isGroup && (
                            <Stack
                              direction="row"
                              spacing={1}
                              sx={{
                                mt: 1.5,
                                alignItems: "center",
                                flexWrap: "wrap",
                                justifyContent: { xs: "center", sm: "flex-start" },
                              }}
                            >
                              <Button
                                size="small"
                                onClick={() => setDetailPastVisitsOpen((v) => !v)}
                                endIcon={
                                  detailPastVisitsOpen ? (
                                    <ICONS.expandLess sx={{ fontSize: 16 }} />
                                  ) : (
                                    <ICONS.expandMore sx={{ fontSize: 16 }} />
                                  )
                                }
                                sx={{
                                  textTransform: "none",
                                  height: 26,
                                  px: 1,
                                  fontSize: "0.7rem",
                                  fontWeight: 700,
                                  color: "text.secondary",
                                }}
                              >
                                Members' past visits
                              </Button>
                            </Stack>
                          )}
                          {detailPastVisitsOpen &&
                            detailPastVisits?.isGroup && (
                              <Stack spacing={1} sx={{ mt: 1.5 }}>
                                {detailPastVisits.breakdown.map((m) => (
                                  <Box
                                    key={m.id}
                                    sx={{
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "space-between",
                                      gap: 1,
                                      p: 1,
                                      borderRadius: 1,
                                      bgcolor: (theme) =>
                                        alpha(theme.palette.text.primary, 0.03),
                                    }}
                                  >
                                    <ClickableVisitorName
                                      name={m.fullName || "Member"}
                                      visitorId={m.id}
                                      seed={m}
                                      onOpen={openVisitorDetails}
                                      truncate
                                      variant="caption"
                                      fontWeight={600}
                                      sx={{ minWidth: 0 }}
                                    />
                                    <Chip
                                      size="small"
                                      label={
                                        m.count > 0
                                          ? `${m.count} past visit${m.count !== 1 ? "s" : ""}`
                                          : "New"
                                      }
                                      color={m.count > 0 ? "info" : "default"}
                                      sx={{
                                        height: 22,
                                        fontSize: "0.65rem",
                                        fontWeight: 700,
                                        flexShrink: 0,
                                      }}
                                    />
                                  </Box>
                                ))}
                              </Stack>
                            )}
                        </Box>
                      </Stack>
                    </Box>

                    {/* Details info grid */}
                    <Box sx={{ px: { xs: 0, sm: 1 } }}>
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                          gap: { xs: 2, md: "16px 32px" },
                        }}
                      >
                        <InfoItem
                          label="Requested Schedule"
                          value={buildScheduleText(
                            selected.requested_from,
                            selected.requested_to,
                            "Not provided",
                          )}
                          icon={<ICONS.event fontSize="small" />}
                        />
                        <InfoItem
                          label="Approved Schedule"
                          value={buildScheduleText(
                            selected.approved_from,
                            selected.approved_to,
                            "Pending approval",
                          )}
                          icon={<ICONS.checkCircle fontSize="small" />}
                        />
                        {isInvertedWindow(
                          selected.approved_from,
                          selected.approved_to,
                        ) && (
                          <Alert
                            severity="error"
                            sx={{
                              borderRadius: 2,
                              gridColumn: { xs: "1", md: "1 / -1" },
                            }}
                          >
                            This visit's approved window is invalid — it ends
                            before it starts. Correct the approved end date/time
                            before checking in.
                          </Alert>
                        )}
                        {(() => {
                          const rType =
                            selected.recurring_type ??
                            selected.recurringType ??
                            null;
                          const rDays =
                            selected.recurring_days ??
                            selected.recurringDays ??
                            null;
                          const rFrom =
                            selected.recurring_time_from ??
                            selected.recurringTimeFrom ??
                            null;
                          const rTo =
                            selected.recurring_time_to ??
                            selected.recurringTimeTo ??
                            null;
                          if (!rType) return null;
                          const DAY_NAMES = [
                            "Sun",
                            "Mon",
                            "Tue",
                            "Wed",
                            "Thu",
                            "Fri",
                            "Sat",
                          ];
                          const daysLabel =
                            Array.isArray(rDays) && rDays.length
                              ? rDays.map((d) => DAY_NAMES[d]).join(", ")
                              : null;
                          const timeLabel =
                            rFrom && rTo ? `${rFrom} – ${rTo}` : null;
                          const label = [daysLabel, timeLabel]
                            .filter(Boolean)
                            .join("  ·  ");
                          return (
                            <InfoItem
                              label="Recurring Days"
                              value={label}
                              icon={<ICONS.replay fontSize="small" />}
                              sx={{ gridColumn: { md: "1 / -1" } }}
                            />
                          );
                        })()}
                        <InfoItem
                          label="Purpose of Visit"
                          value={selected.purpose_of_visit}
                          icon={<ICONS.info fontSize="small" />}
                        />
                        {(selected.department?.name || selected.department) && (
                          <InfoItem
                            label="Visiting Department"
                            value={
                              selected.department?.name || selected.department
                            }
                            icon={<ICONS.apartment fontSize="small" />}
                          />
                        )}
                        {selected.access_levels?.length ||
                        selected.access_level?.name ||
                        selected.accessLevel?.name ? (
                          <InfoItem
                            label="Access Level"
                            value={
                              selected.access_levels?.length > 1
                                ? selected.access_levels
                                    .map((al) => al.name)
                                    .join(", ")
                                : selected.access_levels?.[0]?.name ||
                                  selected.access_level?.name ||
                                  selected.accessLevel?.name
                            }
                            icon={<ICONS.key fontSize="small" />}
                          />
                        ) : null}
                        {selected.vehicle_plate && (
                          <InfoItem
                            label="Vehicle Plate"
                            value={selected.vehicle_plate}
                            icon={<ICONS.parking fontSize="small" />}
                          />
                        )}
                        {selected.vip_reason && (
                          <InfoItem
                            label="VIP Reason"
                            value={selected.vip_reason}
                            icon={<ICONS.star fontSize="small" />}
                          />
                        )}
                      </Box>
                    </Box>

                    {canReadInternalNote && (
                      <Box sx={{ mt: 2 }}>
                        <Box
                          sx={{
                            mb: 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <Typography
                            variant="subtitle2"
                            sx={{
                              fontWeight: 700,
                              color: "text.secondary",
                              textTransform: "uppercase",
                              fontSize: "0.7rem",
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                            }}
                          >
                            <ICONS.description sx={{ fontSize: "1rem" }} />{" "}
                            Internal Note
                          </Typography>
                        </Box>
                        {selected.internal_note || selected.internalNote ? (
                          <ExpandableNote
                            text={
                              selected.internal_note || selected.internalNote
                            }
                          />
                        ) : (
                          <Typography
                            variant="body2"
                            color="text.primary"
                            sx={{
                              overflowWrap: "anywhere",
                              wordBreak: "break-word",
                              whiteSpace: "pre-wrap",
                            }}
                          >
                            No internal note
                          </Typography>
                        )}
                      </Box>
                    )}

                    {/* Timeline button */}
                    <Box>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<ICONS.list fontSize="small" />}
                        onClick={handleViewTimeline}
                        sx={{ borderRadius: 30 }}
                      >
                        View Timeline
                      </Button>
                    </Box>

                    <Divider sx={{ my: 1 }} />
                    <Box>
                      <Typography
                        variant="subtitle2"
                        sx={{
                          mb: 1.5,
                          fontWeight: 700,
                          color: "text.secondary",
                          textTransform: "uppercase",
                          fontSize: "0.7rem",
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                        }}
                      >
                        <ICONS.restaurant sx={{ fontSize: "1rem" }} /> Kitchen
                        Orders
                      </Typography>
                      <KitchenOrderList
                        orders={orders}
                        loading={ordersLoading}
                        isDark={isDark}
                      />
                    </Box>
                  </Stack>
                );
              })()
            ) : null}
          </DialogContent>
          <Divider />

          {/* Dialog actions — status transitions + edit */}
          {selected && canUpdate && (
            <DialogActions
              sx={{
                p: 2.5,
                alignItems: "stretch",
                flexWrap: "wrap",
                bgcolor: (theme) =>
                  alpha(
                    theme.palette.common.black,
                    theme.palette.mode === "dark" ? 0.12 : 0.02,
                  ),
              }}
            >
              {isMobileActions && (
                <Stack
                  direction="row"
                  alignItems="center"
                  sx={{ width: "100%", mb: 0.5 }}
                >
                  <Tooltip
                    title={
                      actionsExpanded
                        ? "Collapse actions"
                        : "Expand actions"
                    }
                  >
                    <IconButton
                      size="small"
                      onClick={() => setActionsExpanded((prev) => !prev)}
                      sx={{ color: "text.secondary" }}
                    >
                      {actionsExpanded ? <ICONS.expandLess /> : <ICONS.down />}
                    </IconButton>
                  </Tooltip>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontWeight: 700, textTransform: "uppercase" }}
                  >
                    Actions
                  </Typography>
                </Stack>
              )}
              <Collapse
                in={isMobileActions ? actionsExpanded : true}
                sx={{ width: "100%" }}
              >
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                flexWrap="wrap"
                justifyContent="flex-end"
                useFlexGap
                sx={{ width: "100%" }}
              >
                {allowedTransitions.length === 0 &&
                overrideTransitions.length === 0 ? (
                  <Typography variant="caption" color="text.secondary">
                    No actions available for your role
                  </Typography>
                ) : (
                  <>
                    {allowedTransitions.map((targetStatus) => {
                      const cfg = STATUS_CONFIG[targetStatus] || {
                        label: toTitleCase(targetStatus),
                        color: "primary",
                      };
                      const btnColors = {
                        admin_approved: "info",
                        approved: "success",
                        rejected: "error",
                        cancelled: "warning",
                        checked_in: "success",
                        checked_out: "warning",
                        visit_ended: "error",
                      };
                      return (
                        <Button
                          key={targetStatus}
                          variant={
                            targetStatus === "approved" ||
                            targetStatus === "admin_approved" ||
                            targetStatus === "visit_ended"
                              ? "contained"
                              : "outlined"
                          }
                          color={btnColors[targetStatus] || "primary"}
                          size="small"
                          disabled={actionLoading}
                          startIcon={
                            actionLoading ? (
                              <CircularProgress size={14} color="inherit" />
                            ) : (
                              cfg.icon
                            )
                          }
                          onClick={() => handleStatusAction(targetStatus)}
                          sx={{
                            borderRadius: 30,
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                            width: { xs: "100%", sm: "auto" },
                          }}
                        >
                          {ACTION_LABELS[targetStatus] ?? cfg.label}
                        </Button>
                      );
                    })}
                    {overrideTransitions.length > 0 && (
                      <>
                        <Button
                          variant="outlined"
                          color="warning"
                          size="small"
                          disabled={actionLoading}
                          onClick={(e) =>
                            setOverrideMenuAnchor(e.currentTarget)
                          }
                          sx={{
                            borderRadius: 30,
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                            width: { xs: "100%", sm: "auto" },
                          }}
                        >
                          Override status ▾
                        </Button>
                        <Menu
                          anchorEl={overrideMenuAnchor}
                          open={Boolean(overrideMenuAnchor)}
                          onClose={() => setOverrideMenuAnchor(null)}
                          anchorOrigin={{
                            vertical: "top",
                            horizontal: "right",
                          }}
                          transformOrigin={{
                            vertical: "bottom",
                            horizontal: "right",
                          }}
                        >
                          {overrideTransitions.map((s) => (
                            <MenuItem
                              key={s}
                              onClick={() => {
                                setOverrideMenuAnchor(null);
                                handleStatusAction(s, true);
                              }}
                            >
                              {ACTION_LABELS[s] || STATUS_CONFIG[s]?.label || toTitleCase(s)}
                            </MenuItem>
                          ))}
                        </Menu>
                      </>
                    )}
                  </>
                )}
              </Stack>
              </Collapse>
            </DialogActions>
          )}
        </Dialog>

        {/* ── Edit Internal Note Dialog ── */}
        <Dialog
          open={internalNoteDialogOpen}
          onClose={() => {
            if (internalNoteSaving) return;
            setInternalNoteDraft(
              internalNoteTarget?.internal_note ||
                internalNoteTarget?.internalNote ||
                "",
            );
            setInternalNoteDialogOpen(false);
            setInternalNoteTarget(null);
          }}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: { borderRadius: 4, overflow: "hidden", variant: "frosted" },
          }}
        >
          <DialogHeader
            title="Edit Internal Note"
            onClose={() => {
              if (internalNoteSaving) return;
              setInternalNoteDraft(
                internalNoteTarget?.internal_note ||
                  internalNoteTarget?.internalNote ||
                  "",
              );
              setInternalNoteDialogOpen(false);
              setInternalNoteTarget(null);
            }}
          />
          <Divider />
          <DialogContent sx={{ p: 3 }}>
            <TextField
              fullWidth
              multiline
              minRows={4}
              size="small"
              autoFocus
              placeholder="Private note for staff only — never shared with the visitor."
              value={internalNoteDraft}
              onChange={(e) => setInternalNoteDraft(e.target.value)}
              disabled={internalNoteSaving}
              sx={{
                "& .MuiOutlinedInput-root": { borderRadius: 2 },
              }}
            />
          </DialogContent>
          <Divider />
          <DialogActions sx={{ p: 2.5, justifyContent: "flex-end" }}>
            <Button
              variant="outlined"
              size="small"
              disabled={internalNoteSaving}
              onClick={() => {
                setInternalNoteDraft(
                  internalNoteTarget?.internal_note ||
                    internalNoteTarget?.internalNote ||
                    "",
                );
                setInternalNoteDialogOpen(false);
                setInternalNoteTarget(null);
              }}
              startIcon={<ICONS.cancel fontSize="small" />}
              sx={{ borderRadius: 30 }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              size="small"
              disabled={
                internalNoteSaving ||
                (!canReadInternalNote &&
                  internalNoteDraft.trim() === "") ||
                internalNoteDraft.trim() ===
                  (internalNoteTarget?.internal_note ||
                    internalNoteTarget?.internalNote ||
                    "")
              }
              onClick={handleSaveInternalNote}
              startIcon={
                internalNoteSaving ? (
                  <CircularProgress size={14} color="inherit" />
                ) : (
                  <ICONS.save fontSize="small" />
                )
              }
              sx={{ borderRadius: 30 }}
            >
              Save
            </Button>
          </DialogActions>
        </Dialog>

        {/* ── Timeline Modal ── */}
        <Dialog
          open={timelineModal.open}
          onClose={() => setTimelineModal({ open: false })}
          maxWidth="sm"
          fullWidth
          PaperProps={{ sx: { borderRadius: 4, overflow: "hidden" } }}
        >
          <DialogHeader
            title={`Activity Timeline${timelineModal.visitorName ? ` — ${timelineModal.visitorName}` : ""}`}
            onClose={() => setTimelineModal({ open: false })}
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
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  by {displayName}
                                </Typography>
                              )}
                            </Box>
                          );
                        })()}
                        {log.activityType === "internal_note" &&
                        log.metadata?.internalNote &&
                        canReadInternalNote ? (
                          <Box sx={{ mt: 0.75 }}>
                            <ExpandableNote
                              text={log.metadata.internalNote}
                              maxLines={4}
                            />
                          </Box>
                        ) : log.notes ? (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mt: 0.5, fontStyle: "italic" }}
                          >
                            {log.notes}
                          </Typography>
                        ) : null}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}
          </DialogContent>
        </Dialog>

        {/* ── Approve Dialog ── */}
        <Dialog
          open={!!approveTarget}
          onClose={() => {
            setApproveTarget(null);
            setApprovePastVisits(null);
          }}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: { borderRadius: 4, overflow: "hidden", variant: "frosted" },
          }}
        >
          <DialogHeader
            title={
              approvalTargetStatus === "approved"
                ? "Final Approve & Schedule"
                : "Approve & Schedule"
            }
            onClose={() => {
              setApproveTarget(null);
              setApprovePastVisits(null);
              setEscortRequired(true);
            }}
          />
          <Divider />
          <DialogContent sx={{ p: 4 }}>
            {approveTarget && (
              <Box
                sx={{
                  mb: 3,
                  p: 2,
                  borderRadius: 2,
                  bgcolor: (theme) => alpha(theme.palette.text.primary, 0.02),
                  border: (theme) =>
                    `1px solid ${alpha(theme.palette.text.primary, 0.04)}`,
                }}
              >
                <Stack
                  direction="row"
                  spacing={2}
                  alignItems="center"
                  sx={{ justifyContent: "space-between" }}
                >
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Avatar
                        sx={{
                          width: 44,
                          height: 44,
                          bgcolor: "text.primary",
                          color: "background.paper",
                        }}
                      >
                        {getRegistrationDisplayInitial(approveTarget)}
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle1" fontWeight={700}>
                          {getRegistrationDisplayName(approveTarget)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {approveTarget.email}
                        </Typography>
                      </Box>
                  </Stack>
                  {approvePastVisits && !approvePastVisits.isGroup && approvePastVisits.breakdown[0] && (
                    <Chip
                      size="small"
                      label={
                        approvePastVisits.breakdown[0].count > 0
                          ? `${approvePastVisits.breakdown[0].count} past visit${approvePastVisits.breakdown[0].count !== 1 ? "s" : ""}`
                          : "New"
                      }
                      color={approvePastVisits.breakdown[0].count > 0 ? "info" : "default"}
                      sx={{
                        height: 22,
                        fontSize: "0.65rem",
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    />
                  )}
                  {approvePastVisits && approvePastVisits.isGroup && (
                    <Button
                      size="small"
                      onClick={() => setPastVisitsOpen((v) => !v)}
                      endIcon={
                        pastVisitsOpen ? (
                          <ICONS.expandLess sx={{ fontSize: 16 }} />
                        ) : (
                          <ICONS.expandMore sx={{ fontSize: 16 }} />
                        )
                      }
                      sx={{
                        textTransform: "none",
                        height: 26,
                        px: 1,
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        color: "text.secondary",
                        flexShrink: 0,
                      }}
                    >
                      Members' past visits
                    </Button>
                  )}
                </Stack>
                {pastVisitsOpen && approvePastVisits?.isGroup && (
                  <Stack spacing={1} sx={{ mt: 1.5 }}>
                    {approvePastVisits.breakdown.map((m) => (
                      <Box
                        key={m.id}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 1,
                          p: 1,
                          borderRadius: 1,
                          bgcolor: (theme) =>
                            alpha(theme.palette.text.primary, 0.03),
                        }}
                      >
                        <ClickableVisitorName
                          name={m.fullName || "Member"}
                          visitorId={m.id}
                          seed={m}
                          onOpen={openVisitorDetails}
                          truncate
                          variant="caption"
                          fontWeight={600}
                          sx={{ minWidth: 0 }}
                        />
                        <Chip
                          size="small"
                          label={
                            m.count > 0
                              ? `${m.count} past visit${m.count !== 1 ? "s" : ""}`
                              : "New"
                          }
                          color={m.count > 0 ? "info" : "default"}
                          sx={{
                            height: 22,
                            fontSize: "0.65rem",
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        />
                      </Box>
                    ))}
                  </Stack>
                )}
                <Divider sx={{ my: 1.5 }} />
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={{ xs: 2, sm: 4 }}
                  justifyContent="space-between"
                  alignItems="flex-start"
                >
                  <Stack spacing={1.25} sx={{ flex: 1, minWidth: 0 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Purpose
                      </Typography>
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        sx={{ mt: 0.25 }}
                      >
                        {approveTarget.purpose_of_visit || "-"}
                      </Typography>
                    </Box>
                    {(approveTarget.department?.name ||
                      approveTarget.department) && (
                      <Box>
                    <Typography variant="caption" color="text.secondary">
                      Visiting Department
                    </Typography>
                        <Typography
                          variant="body2"
                          fontWeight={500}
                          sx={{ mt: 0.25 }}
                        >
                          {approveTarget.department?.name ||
                            approveTarget.department}
                        </Typography>
                      </Box>
                    )}
                    {(() => {
                      const rType =
                        approveTarget?.recurring_type ??
                        approveTarget?.recurringType ??
                        null;
                      const rDays =
                        approveTarget?.recurring_days ??
                        approveTarget?.recurringDays ??
                        null;
                      if (!rType || !Array.isArray(rDays) || !rDays.length)
                        return null;
                      const rFrom =
                        approveTarget?.recurring_time_from ??
                        approveTarget?.recurringTimeFrom ??
                        null;
                      const rTo =
                        approveTarget?.recurring_time_to ??
                        approveTarget?.recurringTimeTo ??
                        null;
                      const DAY_NAMES_SHORT = [
                        "Sun",
                        "Mon",
                        "Tue",
                        "Wed",
                        "Thu",
                        "Fri",
                        "Sat",
                      ];
                      const daysLabel = rDays
                        .map((d) => DAY_NAMES_SHORT[d])
                        .join(", ");
                      const timeLabel =
                        rFrom && rTo ? `${rFrom} – ${rTo}` : null;
                      const label = [daysLabel, timeLabel]
                        .filter(Boolean)
                        .join("  ·  ");
                      return (
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Recurring
                          </Typography>
                          <Typography
                            variant="body2"
                            fontWeight={500}
                            sx={{ mt: 0.25 }}
                          >
                            {label}
                          </Typography>
                        </Box>
                      );
                    })()}
                    {isSuperAdmin &&
                      approveTarget.status === "admin_approved" &&
                      (approveTarget.access_levels?.length ||
                        approveTarget.access_level?.name) && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Access Zones
                          </Typography>
                          <Box
                            sx={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 0.5,
                              mt: 0.5,
                            }}
                          >
                            {(approveTarget.access_levels?.length
                              ? approveTarget.access_levels
                              : approveTarget.access_level
                                ? [approveTarget.access_level]
                                : []
                            ).map((al) => (
                              <Chip
                                key={al.id}
                                label={al.name}
                                size="small"
                                variant="outlined"
                                sx={{
                                  fontWeight: 600,
                                  fontSize: "0.65rem",
                                  height: 20,
                                }}
                              />
                            ))}
                          </Box>
                        </Box>
                      )}
                    {isSuperAdmin &&
                      approveTarget.status === "admin_approved" && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Multi Check-in
                          </Typography>
                          <Chip
                            label={
                              approveTarget.allow_multi_checkin
                                ? "Allowed"
                                : "Not Allowed"
                            }
                            size="small"
                            color={
                              approveTarget.allow_multi_checkin
                                ? "success"
                                : "default"
                            }
                            variant={
                              approveTarget.allow_multi_checkin
                                ? "filled"
                                : "outlined"
                            }
                            sx={{
                              mt: 0.5,
                              fontWeight: 700,
                              fontSize: "0.6rem",
                              height: 20,
                            }}
                          />
                        </Box>
                      )}
                  </Stack>
                  <Box
                    sx={{
                      width: { xs: "100%", sm: "auto" },
                      minWidth: { sm: 260 },
                      textAlign: { xs: "left", sm: "right" },
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      {slotLabel}
                    </Typography>
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      sx={{ mt: 0.25 }}
                    >
                      {slotDateText}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 0.25 }}
                    >
                      {slotTimeText}
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            )}

            {/* Access Zones + Multi-Checkin */}
            <Stack spacing={2}>
              <FormControl fullWidth required error={Boolean(accessLevelError)}>
                <InputLabel>Access Zones</InputLabel>
                <Select
                  multiple
                  value={selectedAccessLevelIds}
                  label="Access Zones"
                  onChange={(e) => {
                    setSelectedAccessLevelIds(e.target.value);
                    setAccessLevelError("");
                  }}
                  renderValue={(selected) => (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                      {selected.map((id) => {
                        const al = accessLevels.find((a) => a.id === id);
                        return (
                          <Chip key={id} label={al?.name || id} size="small" />
                        );
                      })}
                    </Box>
                  )}
                  sx={{ borderRadius: 2 }}
                >
                  {accessLevels.map((al) => (
                    <MenuItem key={al.id} value={al.id}>
                      {al.name}
                    </MenuItem>
                  ))}
                </Select>
                {accessLevelError && (
                  <Typography
                    variant="caption"
                    color="error"
                    sx={{ mt: 0.5, ml: 1.5 }}
                  >
                    {accessLevelError}
                  </Typography>
                )}
              </FormControl>

              <FormControlLabel
                sx={{ mb: 1 }}
                control={
                  <Switch
                    checked={allowMultiCheckin}
                    onChange={(e) => setAllowMultiCheckin(e.target.checked)}
                    color="success"
                  />
                }
                label={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2">
                      Allow Multiple Check-ins
                    </Typography>
                    <Chip
                      label={allowMultiCheckin ? "Enabled" : "Disabled"}
                      size="small"
                      color={allowMultiCheckin ? "success" : "default"}
                      sx={{ fontWeight: 700, height: 20, fontSize: "0.65rem" }}
                    />
                  </Stack>
                }
              />
              <FormControlLabel
                sx={{ mb: allowParking ? 0.5 : 1 }}
                control={
                  <Switch
                    checked={allowParking}
                    onChange={(e) => {
                      setAllowParking(e.target.checked);
                      if (!e.target.checked) {
                        setVehiclePlate("");
                        setVehiclePlateError("");
                      }
                    }}
                    color="success"
                  />
                }
                label={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2">Allow Parking</Typography>
                    <Chip
                      label={allowParking ? "Enabled" : "Disabled"}
                      size="small"
                      color={allowParking ? "success" : "default"}
                      sx={{ fontWeight: 700, height: 20, fontSize: "0.65rem" }}
                    />
                  </Stack>
                }
              />
              {allowParking && (
                <TextField
                  fullWidth
                  required
                  size="small"
                  label="Vehicle Plate Number"
                  placeholder="e.g. A 12345"
                  value={vehiclePlate}
                  onChange={(e) => {
                    setVehiclePlate(e.target.value.toUpperCase());
                    setVehiclePlateError("");
                  }}
                  error={Boolean(vehiclePlateError)}
                  helperText={vehiclePlateError}
                  sx={{
                    mb: 1,
                    "& .MuiOutlinedInput-root": { borderRadius: 2 },
                  }}
                  inputProps={{ maxLength: 20 }}
                />
              )}
              <FormControlLabel
                sx={{ mb: isVip ? 0.5 : 1 }}
                control={
                  <Switch
                    checked={isVip}
                    onChange={(e) => {
                      setIsVip(e.target.checked);
                      if (!e.target.checked) {
                        setVipReason("");
                        setVipReasonError("");
                      }
                    }}
                    color="success"
                  />
                }
                label={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2">VIP</Typography>
                    <Chip
                      label={isVip ? "Enabled" : "Disabled"}
                      size="small"
                      color={isVip ? "success" : "default"}
                      sx={{ fontWeight: 700, height: 20, fontSize: "0.65rem" }}
                    />
                  </Stack>
                }
              />
              {isVip && (
                <TextField
                  fullWidth
                  required
                  size="small"
                  label="VIP Reason"
                  placeholder="Enter the reason for VIP status…"
                  value={vipReason}
                  onChange={(e) => {
                    setVipReason(e.target.value);
                    setVipReasonError("");
                  }}
                  error={Boolean(vipReasonError)}
                  helperText={vipReasonError}
                  sx={{
                    mb: 1,
                    "& .MuiOutlinedInput-root": { borderRadius: 2 },
                  }}
                  inputProps={{ maxLength: 300 }}
                />
              )}

              <FormControlLabel
                control={
                  <Switch
                    checked={escortRequired}
                    onChange={(e) => setEscortRequired(e.target.checked)}
                    color="success"
                  />
                }
                label={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2">Escort Required</Typography>
                    <Chip
                      label={escortRequired ? "Enabled" : "Disabled"}
                      size="small"
                      color={escortRequired ? "success" : "default"}
                      sx={{ fontWeight: 700, height: 20, fontSize: "0.65rem" }}
                    />
                  </Stack>
                }
              />
            </Stack>

            <Divider sx={{ my: 1 }} />

            <Box>
              <Typography
                variant="subtitle2"
                sx={{ mb: 1.5, fontWeight: 700, color: "text.primary" }}
              >
                Review and Adjust Schedule
              </Typography>
              {isInvertedWindow(
                approveTarget?.approved_from,
                approveTarget?.approved_to,
              ) && (
                <Alert severity="error" sx={{ borderRadius: 2, mb: 2 }}>
                  This visit's approved window is invalid — it ends before it
                  starts. Set a valid end date/time below before approving.
                </Alert>
              )}
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, sm: 6.5 }}>
                  <Box
                    sx={{
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 4,
                      bgcolor: "action.hover",
                      "& .MuiDateCalendar-root": {
                        width: "100%",
                        height: "auto",
                        maxHeight: "none",
                      },
                    }}
                  >
                    <DateCalendar
                      value={scheduledDate}
                      onChange={(newDate) => applySchedule({ scheduledDate: newDate })}
                      disablePast
                    />
                  </Box>
                </Grid>

                <Grid size={{ xs: 12, sm: 5.5 }}>
                  <Stack spacing={2}>
                    {/* Toggle between Preset and Custom using Tabs */}
                    <Tabs
                      value={scheduleType}
                      onChange={(_, value) => applySchedule({ scheduleType: value })}
                      variant="fullWidth"
                      sx={{
                        minHeight: 46,
                        bgcolor: (theme) =>
                          alpha(
                            theme.palette.text.primary,
                            isDark ? 0.06 : 0.04,
                          ),
                        borderRadius: 999,
                        p: 0.5,
                        "& .MuiTabs-indicator": { display: "none" },
                      }}
                    >
                      <Tab
                        value="custom"
                        icon={<ICONS.time fontSize="small" />}
                        iconPosition="start"
                        label="Custom"
                        sx={{
                          minHeight: 38,
                          borderRadius: 999,
                          fontWeight: 800,
                          textTransform: "none",
                          "&.Mui-selected": {
                            bgcolor: "background.paper",
                            color: "text.primary",
                            boxShadow: "0 6px 14px rgba(0,0,0,0.08)",
                          },
                        }}
                      />
                      <Tab
                        value="preset"
                        icon={<ICONS.event fontSize="small" />}
                        iconPosition="start"
                        label="Preset"
                        sx={{
                          minHeight: 38,
                          borderRadius: 999,
                          fontWeight: 800,
                          textTransform: "none",
                          "&.Mui-selected": {
                            bgcolor: "background.paper",
                            color: "text.primary",
                            boxShadow: "0 6px 14px rgba(0,0,0,0.08)",
                          },
                        }}
                      />
                    </Tabs>

                    {/* Custom Time Section */}
                    {scheduleType === "custom" && (
                      <Box
                        sx={{
                          p: 2,
                          bgcolor: "action.hover",
                          borderRadius: 2,
                          border: "1px solid",
                          borderColor: "divider",
                          minHeight: 280,
                        }}
                      >
                        {hostConfig && (
                          <Typography
                            variant="caption"
                            color="info.main"
                            sx={{ display: "block", mb: 1.5, fontSize: "0.68rem", direction: "ltr" }}
                          >
                            {t.bookingWorkingHoursInfo
                              .replace("{{start}}", fmtLocalWorkingHours(hostConfig).start)
                              .replace("{{end}}", fmtLocalWorkingHours(hostConfig).end)}
                          </Typography>
                        )}
                        <Stack spacing={2} sx={{ mb: 2 }}>
                          {renderTimeDropdowns(
                            "scheduledFrom",
                            "Expected Arrival (From)",
                            true,
                          )}
                          {renderTimeDropdowns(
                            "scheduledTo",
                            "Expected Departure (To)",
                            true,
                          )}
                        </Stack>
                        <Box
                          sx={{
                            p: 1.5,
                            bgcolor: "background.paper",
                            borderRadius: 2,
                            border: "1px solid",
                            borderColor: "divider",
                          }}
                        >
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                          >
                            <ICONS.info
                              sx={{ fontSize: 16, color: "text.secondary" }}
                            />
                            <Typography
                              variant="caption"
                              fontWeight={700}
                              color="text.secondary"
                              sx={{ fontSize: 12 }}
                            >
                              Visit duration: {getDuration()} min
                            </Typography>
                          </Stack>
                        </Box>
                      </Box>
                    )}

                    {/* Preset Options Section */}
                    {scheduleType === "preset" && (
                      <Box
                        sx={{
                          p: 2,
                          bgcolor: "action.hover",
                          borderRadius: 2,
                          border: "1px solid",
                          borderColor: "divider",
                          minHeight: 280,
                        }}
                      >
                        {/* Preset Type Selector */}
                        <Box sx={{ mb: 2.5 }}>
                          <Typography
                            variant="caption"
                            fontWeight={700}
                            color="text.secondary"
                            sx={{
                              display: "block",
                              mb: 1,
                              textTransform: "uppercase",
                              fontSize: "0.65rem",
                            }}
                          >
                            Preset Type
                          </Typography>
                          <TextField
                            fullWidth
                            select
                            size="small"
                            value={selectedPreset || "fullDay"}
                            onChange={(e) =>
                              applySchedule({
                                selectedPreset: e.target.value,
                                specificDays: [],
                                dayTypeTab: "working",
                              })
                            }
                            sx={{
                              "& .MuiOutlinedInput-root": { borderRadius: 2 },
                            }}
                          >
                            <MenuItem value="fullDay">Full Day</MenuItem>
                            <MenuItem value="fullWeek">Full Week</MenuItem>
                            <MenuItem value="fullMonth">Full Month</MenuItem>
                            <MenuItem value="specificDays">
                              Specific Days
                            </MenuItem>
                          </TextField>
                        </Box>

                        {/* Date Range Display */}
                        {selectedPreset !== "specificDays" && (
                          <Box
                            sx={{
                              p: 1.5,
                              bgcolor: "background.paper",
                              borderRadius: 2,
                              border: "1px solid",
                              borderColor: "divider",
                              mb: 2.5,
                            }}
                          >
                            <Typography
                              variant="caption"
                              fontWeight={700}
                              color="text.secondary"
                              sx={{
                                display: "block",
                                mb: 0.5,
                                textTransform: "uppercase",
                                fontSize: "0.65rem",
                              }}
                            >
                              Date Range
                            </Typography>
                            <Typography
                              variant="body2"
                              fontWeight={600}
                              color="text.primary"
                            >
                              {!scheduledDate
                                ? "Select a date"
                                : (() => {
                                    const date = scheduledDate;
                                    let from = date.clone();
                                    let to = date.clone();
                                    if (selectedPreset === "fullDay") {
                                      const startH = hostConfig?.start ?? 8;
                                      const startM = hostConfig?.startMinute ?? 0;
                                      const endH = hostConfig?.end ?? 17;
                                      const endM = hostConfig?.endMinute ?? 0;
                                      from = from.startOf("day").hour(startH).minute(startM);
                                      to = date.clone().startOf("day").hour(endH).minute(endM);
                                    } else if (selectedPreset === "fullWeek") {
                                      from = from.startOf("day");
                                      to = from.add(6, "days").endOf("day");
                                    } else if (selectedPreset === "fullMonth") {
                                      from = from.startOf("day");
                                      to = from.endOf("month");
                                    }
                                    return `${from.format("DD MMMM YYYY, hh:mm A")} → ${to.format("DD MMMM YYYY, hh:mm A")}`;
                                  })()}
                            </Typography>
                          </Box>
                        )}

                        {/* Day-type tabs for fullWeek/fullMonth only */}
                        {(selectedPreset === "fullWeek" ||
                          selectedPreset === "fullMonth") && (
                          <Box sx={{ mb: 2 }}>
                            <Typography
                              variant="caption"
                              fontWeight={600}
                              color="info.main"
                              sx={{
                                display: "block",
                                mb: 0.75,
                                fontSize: "0.68rem",
                              }}
                            >
                              {t.bookingWorkingDays}:{" "}
                              {(hostConfig?.workingDays ?? [0, 1, 2, 3, 4])
                                .map((d) => DAY_LABELS[d])
                                .join(", ")}
                            </Typography>
                            <Typography
                              variant="caption"
                              fontWeight={700}
                              color="text.secondary"
                              sx={{
                                display: "block",
                                mb: 0.75,
                                textTransform: "uppercase",
                                fontSize: "0.65rem",
                              }}
                            >
                              {t.bookingDayType}
                            </Typography>
                            <RadioGroup
                              row
                              value={dayTypeTab}
                              onChange={(_, v) =>
                                applySchedule({ dayTypeTab: v })
                              }
                            >
                              <FormControlLabel
                                value="working"
                                control={<Radio size="small" />}
                                label={t.bookingWorkingOnly}
                              />
                              <FormControlLabel
                                value="all"
                                control={<Radio size="small" />}
                                label={t.bookingWorkingPlusWeekends}
                              />
                            </RadioGroup>
                          </Box>
                        )}

                        {/* Day chips for specificDays — separate working / weekend groups */}
                        {selectedPreset === "specificDays" && (
                          <Box sx={{ mb: 2 }}>
                            {hostConfig &&
                              (() => {
                                const wDays = hostConfig.workingDays ?? [
                                  0, 1, 2, 3, 4,
                                ];
                                const wEnds = hostConfig.weekendDays ?? [5, 6];
                                const chip = (idx, label, isWeekend) => {
                                  const active = specificDays.includes(idx);
                                  return (
                                    <Box
                                      key={idx}
                                      onClick={() =>
                                        applySchedule({
                                          specificDays: active
                                            ? specificDays.filter(
                                                (d) => d !== idx,
                                              )
                                            : [...specificDays, idx],
                                        })
                                      }
                                      sx={{
                                        px: 1.5,
                                        py: 0.5,
                                        borderRadius: 30,
                                        cursor: "pointer",
                                        userSelect: "none",
                                        border: "1px solid",
                                        fontWeight: 700,
                                        fontSize: "0.75rem",
                                        borderColor: active
                                          ? isWeekend
                                            ? "warning.main"
                                            : "primary.main"
                                          : "divider",
                                        bgcolor: active
                                          ? isWeekend
                                            ? "warning.main"
                                            : "primary.main"
                                          : "background.paper",
                                        color: active
                                          ? isWeekend
                                            ? "warning.contrastText"
                                            : "primary.contrastText"
                                          : isWeekend
                                            ? "warning.main"
                                            : "text.secondary",
                                        transition: "all 0.12s",
                                      }}
                                    >
                                      {label}
                                    </Box>
                                  );
                                };
                                return (
                                  <>
                                    <Typography
                                      variant="caption"
                                      fontWeight={600}
                                      color="info.main"
                                      sx={{
                                        display: "block",
                                        mb: 0.5,
                                        fontSize: "0.68rem",
                                      }}
                                    >
                                      {t.bookingWorkingDays}
                                    </Typography>
                                    <Stack
                                      direction="row"
                                      flexWrap="wrap"
                                      sx={{ gap: 0.75, mb: 1.5 }}
                                    >
                                      {wDays.map((idx) =>
                                        chip(idx, DAY_LABELS[idx], false),
                                      )}
                                    </Stack>
                                    <Typography
                                      variant="caption"
                                      fontWeight={600}
                                      color="warning.main"
                                      sx={{
                                        display: "block",
                                        mb: 0.5,
                                        fontSize: "0.68rem",
                                      }}
                                    >
                                      {t.bookingWeekendDays}
                                    </Typography>
                                    <Stack
                                      direction="row"
                                      flexWrap="wrap"
                                      sx={{ gap: 0.75, mb: 1.5 }}
                                    >
                                      {wEnds.map((idx) =>
                                        chip(idx, DAY_LABELS[idx], true),
                                      )}
                                    </Stack>
                                  </>
                                );
                              })()}
                            <Stack
                              direction="row"
                              spacing={1}
                              alignItems="center"
                            >
                              <Typography
                                variant="caption"
                                fontWeight={600}
                                color="text.secondary"
                                sx={{ whiteSpace: "nowrap" }}
                              >
                                From {scheduledDate?.format("DD MMM YYYY")}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.disabled"
                              >
                                →
                              </Typography>
                              <TextField
                                type="date"
                                size="small"
                                value={
                                  specificEndDate
                                    ? specificEndDate.format("YYYY-MM-DD")
                                    : ""
                                }
                                onChange={(e) =>
                                  applySchedule({
                                    specificEndDate: e.target.value
                                      ? dayjs(e.target.value)
                                      : null,
                                  })
                                }
                                inputProps={{
                                  min: scheduledDate
                                    ? scheduledDate.format("YYYY-MM-DD")
                                    : dayjs().format("YYYY-MM-DD"),
                                }}
                                sx={{
                                  width: 180,
                                  "& .MuiOutlinedInput-root": {
                                    borderRadius: 2,
                                  },
                                }}
                              />
                            </Stack>
                          </Box>
                        )}

                        {/* Bracket preview for fullWeek/fullMonth — shows both working & weekend with visual distinction */}
                        {(selectedPreset === "fullWeek" ||
                          selectedPreset === "fullMonth") &&
                          hostConfig &&
                          scheduledDate &&
                          (() => {
                            const activeDaySet = computeDaySet(dayTypeTab, hostConfig);
                            const weekendSet = hostConfig.weekendDays ?? [5, 6];
                            const date = scheduledDate;
                            let endDate;
                            if (selectedPreset === "fullWeek")
                              endDate = date.clone().add(6, "days");
                            else if (selectedPreset === "fullMonth")
                              endDate = date.clone().endOf("month");
                            const matches = [];
                            let cursor = date.clone();
                            while (
                              cursor.isBefore(endDate) ||
                              cursor.isSame(endDate, "day")
                            ) {
                              if (activeDaySet.includes(cursor.day()))
                                matches.push(cursor.clone());
                              cursor = cursor.add(1, "day");
                            }
                            return matches.length > 0 ? (
                              <Box sx={{ mb: 2 }}>
                                <Typography
                                  variant="caption"
                                  fontWeight={700}
                                  color="text.secondary"
                                  sx={{
                                    display: "block",
                                    mb: 0.75,
                                    textTransform: "uppercase",
                                    fontSize: "0.65rem",
                                  }}
                                >
                                  {t.bookingDaysInRange.replace(
                                    "{{type}}",
                                    dayTypeTab === "all"
                                      ? t.bookingAllDays
                                      : t.bookingWorkingDays,
                                  )}
                                </Typography>
                                <Stack
                                  direction="row"
                                  flexWrap="wrap"
                                  sx={{ gap: 0.5 }}
                                >
                                  {matches.map((d, i) => {
                                    const isOff = weekendSet.includes(d.day());
                                    return (
                                      <Chip
                                        key={i}
                                        label={`${DAY_LABELS[d.day()]} ${d.format("DD")}`}
                                        size="small"
                                        color={isOff ? "warning" : "primary"}
                                        variant="outlined"
                                        sx={{
                                          fontWeight: 600,
                                          fontSize: "0.65rem",
                                          height: 20,
                                        }}
                                      />
                                    );
                                  })}
                                </Stack>
                              </Box>
                            ) : null;
                          })()}

                        {/* Full Day: working hours info */}
                        {selectedPreset === "fullDay" ? (
                          <Box
                            sx={{
                              p: 1.5,
                              bgcolor: "background.paper",
                              borderRadius: 2,
                              border: "1px solid",
                              borderColor: "divider",
                            }}
                          >
                            <Stack
                              direction="row"
                              spacing={1}
                              alignItems="center"
                            >
                              <ICONS.info
                                sx={{ fontSize: 16, color: "info.main" }}
                              />
                              <Typography
                                variant="caption"
                                fontWeight={700}
                                color="text.secondary"
                                sx={{ fontSize: 12 }}
                              >
                                {hostConfig
                                  ? t.bookingFullDayWorkingHoursInfo
                                      .replace(
                                        "{{start}}",
                                        fmtLocalWorkingHours(hostConfig).start,
                                      )
                                      .replace(
                                        "{{end}}",
                                        fmtLocalWorkingHours(hostConfig).end,
                                      )
                                  : t.bookingFullDayWorkingHoursInfo
                                      .replace("{{start}}", "8:00 AM")
                                      .replace("{{end}}", "5:00 PM")}
                              </Typography>
                            </Stack>
                          </Box>
                        ) : (
                          <>
                            {hostConfig &&
                              (() => {
                                const fmt = (h24, min) => {
                                  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
                                  const ampm = h24 < 12 ? "AM" : "PM";
                                  return `${h12}:${String(min).padStart(2, "0")} ${ampm}`;
                                };
                                const s = fmt(fmtLocalWorkingHours(hostConfig).startH, fmtLocalWorkingHours(hostConfig).startM);
                                const e = fmt(fmtLocalWorkingHours(hostConfig).endH, fmtLocalWorkingHours(hostConfig).endM);
                                return (
                                  <Typography dir="ltr" variant="caption" color="info.main" sx={{ display: "block", mb: 0.75, fontSize: "0.68rem" }}>
                                    {t.bookingWorkingHoursInfo.replace("{{start}}", s).replace("{{end}}", e)}
                                  </Typography>
                                );
                              })()}
                            <Stack spacing={2} sx={{ mb: 2 }}>
                              {renderTimeDropdowns("scheduledFrom", "Start Time")}
                              {renderTimeDropdowns("scheduledTo", "End Time")}
                            </Stack>
                            {(() => {
                              const mins = getDuration();
                              if (mins <= 0) return null;
                              return (
                                <Box sx={{ p: 1.5, bgcolor: "background.paper", borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
                                  <Stack direction="row" spacing={1} alignItems="center">
                                    <ICONS.info sx={{ fontSize: 16, color: "text.secondary" }} />
                                    <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ fontSize: 12 }}>
                                      Visit duration: {mins} min
                                    </Typography>
                                  </Stack>
                                </Box>
                              );
                            })()}
                          </>
                        )}
                      </Box>
                    )}
                    {renderScheduleOutsideWarning()}
                  </Stack>
                </Grid>
              </Grid>
            </Box>

            <Divider sx={{ my: 1 }} />
            <Box>
              <Typography
                variant="subtitle2"
                sx={{ mb: 1, fontWeight: 700, color: "text.primary" }}
              >
                Note{" "}
                <Typography
                  component="span"
                  variant="caption"
                  color="text.secondary"
                >
                  (optional)
                </Typography>
              </Typography>
              <TextField
                fullWidth
                multiline
                minRows={2}
                maxRows={5}
                size="small"
                placeholder="Add a note for the visitor (will appear in their approval email)…"
                value={approvalNote}
                onChange={(e) => setApprovalNote(e.target.value)}
                inputProps={{ maxLength: 500 }}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
              />
            </Box>
            {canWriteInternalNote && (
              <Box sx={{ mt: 2 }}>
                <Typography
                  variant="subtitle2"
                  sx={{ mb: 1, fontWeight: 700, color: "text.primary" }}
                >
                  Internal Note{" "}
                  <Typography
                    component="span"
                    variant="caption"
                    color="text.secondary"
                  >
                    (optional)
                  </Typography>
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  maxRows={5}
                  size="small"
                  placeholder="Private note for staff only — never shown to the visitor"
                  value={approvalInternalNote}
                  onChange={(e) => setApprovalInternalNote(e.target.value)}
                  inputProps={{ maxLength: 1000 }}
                  sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                />
              </Box>
            )}
          </DialogContent>
          <Divider />
          <DialogActions
            disableSpacing
            sx={{
              p: 2.5,
              gap: 1,
              flexDirection: { xs: "column-reverse", sm: "row" },
              alignItems: { xs: "stretch", sm: "center" },
              justifyContent: { xs: "stretch", sm: "flex-end" },
            }}
          >
            <Button
              variant="outlined"
              onClick={() => {
                setApproveTarget(null);
                setApprovePastVisits(null);
              }}
              startIcon={<ICONS.cancel />}
              sx={{ px: 3, fontWeight: 700, borderRadius: 30, width: { xs: "100%", sm: "auto" } }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              color={approvalCfg.color || "success"}
              startIcon={approvalCfg.icon}
              onClick={handleApprove}
              disabled={!scheduledDate || submitting}
              sx={{ borderRadius: 30, px: 4, fontWeight: 700, width: { xs: "100%", sm: "auto" } }}
            >
              {approvalLabel}
            </Button>
          </DialogActions>
        </Dialog>

        {/* ── Reject Dialog ── */}
        <Dialog
          open={!!rejectTarget}
          onClose={() => setRejectTarget(null)}
          maxWidth="xs"
          fullWidth
        >
          <DialogHeader
            title="Reject Visit"
            onClose={() => setRejectTarget(null)}
          />
          <DialogContent>
            {rejectTarget && (
              <Stack spacing={2}>
                <Typography variant="body2">
                  Are you sure you want to reject{" "}
                  <strong>{resolveVisitName(rejectTarget)}</strong>'s visit?
                </Typography>
                <TextField
                  size="small"
                  label="Rejection Reason *"
                  multiline
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              </Stack>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 2, gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<ICONS.cancel />}
              onClick={() => setRejectTarget(null)}
              sx={{ borderRadius: 30 }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              color="error"
              startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <ICONS.close />}
              onClick={handleReject}
              disabled={submitting}
              sx={{ borderRadius: 30 }}
            >
              Reject
            </Button>
          </DialogActions>
        </Dialog>

        {/* ── Confirm Modal (cancel / checkin / checkout / visit_ended) ──────────── */}
        <Dialog
          open={confirmModal.open}
          onClose={() => {
            setConfirmModal({ open: false, targetStatus: null, message: "" });
            setCustomTimestamp(null);
          }}
          maxWidth="xs"
          fullWidth
          PaperProps={{ sx: { borderRadius: 4, overflow: "hidden" } }}
        >
          <DialogHeader
            title={
              confirmModal.targetStatus === "cancelled"
                ? "Cancel Visit"
                : confirmModal.targetStatus === "checked_in"
                  ? "Confirm Check-in"
                  : confirmModal.targetStatus === "checked_out"
                    ? "Confirm Check-out"
                    : "End Visit"
            }
            onClose={() => {
              setConfirmModal({ open: false, targetStatus: null, message: "" });
              setCustomTimestamp(null);
            }}
          />
          <Divider />
          <DialogContent sx={{ p: 3 }}>
            <Typography
              variant="body2"
              sx={{
                mb:
                  confirmModal.targetStatus === "checked_in" ||
                  confirmModal.targetStatus === "checked_out"
                    ? 2
                    : 0,
              }}
            >
              {confirmModal.message}
            </Typography>
            {(confirmModal.targetStatus === "checked_in" ||
              confirmModal.targetStatus === "checked_out") && (
              <Box>
                <DateTimeFieldFlatpickr
                  label="Timestamp"
                  value={customTimestamp}
                  helperText="Times are shown and entered in your timezone."
                  onChange={(val) => {
                    let iso = null;
                    if (
                      val &&
                      val instanceof Date &&
                      Number.isFinite(val.getTime())
                    ) {
                      try {
                        iso = val.toISOString();
                      } catch {
                        iso = null;
                      }
                    }
                    setCustomTimestamp(iso);
                    customTimestampRef.current = iso;
                  }}
                />
              </Box>
            )}
          </DialogContent>
          <Divider />
          <DialogActions sx={{ p: 2, gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<ICONS.cancel />}
              onClick={() => {
                setConfirmModal({
                  open: false,
                  targetStatus: null,
                  message: "",
                });
                setCustomTimestamp(null);
              }}
              sx={{ borderRadius: 30 }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              color={
                confirmModal.targetStatus === "cancelled"
                  ? "error"
                  : "success"
              }
              onClick={handleConfirm}
              disabled={actionLoading}
              startIcon={
                actionLoading ? (
                  <CircularProgress size={16} color="inherit" />
                ) : confirmModal.targetStatus === "cancelled" ? (
                  <ICONS.close />
                ) : (
                  <ICONS.check />
                )
              }
              sx={{ borderRadius: 30 }}
            >
              Confirm
            </Button>
          </DialogActions>
        </Dialog>

        {/* ── Batch Update Dialog ── */}
        <Dialog
          open={batchOpen}
          onClose={() => {
            if (!batchSubmitting) {
              setBatchOpen(false);
            }
          }}
          maxWidth="md"
          fullWidth
          PaperProps={{ sx: { borderRadius: 4, overflow: "hidden" } }}
        >
          <DialogHeader
            title={`Update Batch (${selectedRowIds.size} visit${selectedRowIds.size !== 1 ? "s" : ""})`}
            onClose={() => {
              if (!batchSubmitting) {
                setBatchOpen(false);
              }
            }}
          />
          <Divider />
          <DialogContent sx={{ p: 3 }}>
            <Stack spacing={3}>
              {/* Past visits — collapsible */}
              {Object.keys(batchVisitorVisitCounts).length > 0 &&
                (() => {
                  // Deduplicate by visitor (userId)
                  const visitorMap = {};
                  [...selectedRowIds].forEach((id) => {
                    const row = rows.find((r) => r.id === id);
                    const isGroup =
                      Array.isArray(row?.participants) &&
                      row.participants.length > 1;
                    const keyId = row?.user_id || row?.userId || id;
                    const groupNames = isGroup
                      ? row.participants
                          .map((p) => p.fullName)
                          .filter(Boolean)
                          .join(", ")
                      : "";
                    if (!visitorMap[keyId]) {
                      visitorMap[keyId] = {
                        keyId,
                        // Group meetings have no single owner — each member is
                        // listed individually and opens their own details.
                        userId: isGroup ? null : keyId,
                        name: isGroup
                          ? `${row?.meetingName?.trim() || "Group Meeting"}${
                              groupNames ? ` (${groupNames})` : ""
                            }`
                          : row?.full_name ||
                            row?.fullName ||
                            "Visitor",
                        members: isGroup
                          ? row.participants
                              .map((p) => ({
                                id: p.id,
                                fullName:
                                  p.fullName || p.name || "Member",
                                email: p.email || null,
                                phone: p.phone || null,
                                iso_code: p.iso_code || null,
                                idNo: p.idNo || null,
                                idType: p.idType || null,
                              }))
                              .filter((p) => p.id)
                          : null,
                        email: row?.email || null,
                        phone: row?.phone || null,
                        iso_code: row?.phone_iso_code || null,
                        selectedCount: 0,
                        pastVisits: batchVisitorVisitCounts[id] ?? 0,
                      };
                    }
                    visitorMap[keyId].selectedCount++;
                  });
                  const visitors = Object.values(visitorMap);
                  return (
                    <Accordion
                      disableGutters
                      elevation={0}
                      sx={{
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 2,
                        "&::before": { display: "none" },
                      }}
                    >
                      <AccordionSummary
                        expandIcon={<ICONS.expandMore />}
                        sx={{
                          minHeight: 40,
                          "& .MuiAccordionSummary-content": { my: 1 },
                        }}
                      >
                        <Typography variant="subtitle2" fontWeight={700}>
                          Past Visits
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails sx={{ pt: 0, pb: 1.5 }}>
                        <Stack spacing={0.75}>
                          {visitors.map((v) => (
                            <Stack
                              key={v.keyId}
                              direction="row"
                              spacing={1}
                              alignItems="flex-start"
                              sx={{ py: 0.4, flexWrap: "wrap", rowGap: 0.5 }}
                            >
{Array.isArray(v.members) && v.members.length > 0 ? (
                              <Stack
                                direction="row"
                                alignItems="center"
                                flexWrap="wrap"
                                useFlexGap
                                sx={{
                                  flex: 1,
                                  minWidth: { xs: 0, sm: 120 },
                                  rowGap: 0.5,
                                  gap: 0.5,
                                }}
                              >
                                {v.members.map((m, i) => (
                                  <Fragment key={m.id}>
                                    <ClickableVisitorName
                                      name={m.fullName}
                                      visitorId={m.id}
                                      seed={{
                                        fullName: m.fullName,
                                        email: m.email,
                                        phone: m.phone,
                                        iso_code: m.iso_code,
                                        idNo: m.idNo,
                                        idType: m.idType,
                                      }}
                                      onOpen={openVisitorDetails}
                                      variant="body2"
                                      fontWeight={600}
                                      sx={{ minWidth: 0 }}
                                    />
                                    {i < v.members.length - 1 && (
                                      <Typography
                                        component="span"
                                        variant="body2"
                                        color="text.disabled"
                                        sx={{ flexShrink: 0 }}
                                      >
                                        ,
                                      </Typography>
                                    )}
                                  </Fragment>
                                ))}
                              </Stack>
                            ) : (
                              <ClickableVisitorName
                                name={v.name}
                                visitorId={v.userId}
                                seed={{
                                  fullName: v.name,
                                  email: v.email,
                                  phone: v.phone,
                                  iso_code: v.iso_code,
                                }}
                                onOpen={openVisitorDetails}
                                truncate
                                variant="body2"
                                fontWeight={600}
                                sx={{ flex: 1, minWidth: 120 }}
                              />
                            )}
                              <Stack
                                direction="row"
                                spacing={0.5}
                                alignItems="center"
                                sx={{ flexShrink: 0, flexWrap: "wrap" }}
                              >
                                {v.selectedCount > 1 && (
                                  <Chip
                                    size="small"
                                    label={`Selected (${v.selectedCount})`}
                                    color="primary"
                                    variant="outlined"
                                    sx={{
                                      height: 22,
                                      fontSize: "0.65rem",
                                      fontWeight: 700,
                                    }}
                                  />
                                )}
                                <Chip
                                  size="small"
                                  label={
                                    v.pastVisits > 0
                                      ? `${v.pastVisits} past visit${v.pastVisits !== 1 ? "s" : ""}`
                                      : "New"
                                  }
                                  color={v.pastVisits > 0 ? "info" : "default"}
                                  sx={{
                                    height: 22,
                                    fontSize: "0.65rem",
                                    fontWeight: 700,
                                  }}
                                />
                              </Stack>
                            </Stack>
                          ))}
                        </Stack>
                      </AccordionDetails>
                    </Accordion>
                  );
                })()}

              {/* Status selector */}
              <Box>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                  Target Status
                </Typography>
                <FormControl fullWidth size="small">
                  <InputLabel>Select status</InputLabel>
                  <Select
                    value={batchTargetStatus}
                    label="Select status"
                    onChange={(e) => {
                      setBatchTargetStatus(e.target.value);
                      setBatchAccessLevelError("");
                      setAccessLevelError("");
                      setVehiclePlateError("");
                      setVipReasonError("");
                      if (
                        e.target.value === "checked_in" ||
                        e.target.value === "checked_out"
                      ) {
                        const now = new Date().toISOString();
                        setBatchTimestamp(now);
                        batchTimestampRef.current = now;
                      }
                    }}
                    sx={{ borderRadius: 2 }}
                  >
                    {ALL_ACTIONABLE_STATUSES.filter(
                      (s) => !(s === "approved" && !isSuperAdmin),
                    ).map((s) => {
                      const cfg = STATUS_CONFIG[s] || { label: toTitleCase(s) };
                      return (
                        <MenuItem key={s} value={s}>
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                          >
                            <Box
                              sx={{
                                color: `${cfg.color || "primary"}.main`,
                                display: "flex",
                              }}
                            >
                              {cfg.icon}
                            </Box>
                            <Typography variant="body2" fontWeight={600}>
                              {ACTION_LABELS[s] || cfg.label}
                            </Typography>
                          </Stack>
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", mt: 0.75, ml: 0.5 }}
                >
                  Cards already in the target status or where the transition
                  isn't permitted will be skipped automatically.
                </Typography>
              </Box>

              {/* Per-status sub-form */}
              {batchTargetStatus === "rejected" && (
                <Box>
                  <Typography
                    variant="subtitle2"
                    fontWeight={700}
                    sx={{ mb: 1 }}
                  >
                    Rejection Reason *
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    multiline
                    rows={3}
                    placeholder="Enter rejection reason…"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                  />
                </Box>
              )}

              {(batchTargetStatus === "cancelled" ||
                batchTargetStatus === "visit_ended") && (
                <Alert severity="warning" sx={{ borderRadius: 2 }}>
                  {batchTargetStatus === "cancelled"
                    ? `This will cancel all ${selectedRowIds.size} selected visit(s).`
                    : `This will mark all ${selectedRowIds.size} selected visit(s) as ended.`}
                </Alert>
              )}

              {(batchTargetStatus === "checked_in" ||
                batchTargetStatus === "checked_out") && (
                <Box>
                  <Typography
                    variant="subtitle2"
                    fontWeight={700}
                    sx={{ mb: 1 }}
                  >
                    Timestamp{" "}
                    <Typography
                      component="span"
                      variant="caption"
                      color="text.secondary"
                    >
                      (optional — defaults to now)
                    </Typography>
                  </Typography>
                  <DateTimeFieldFlatpickr
                    label="Timestamp"
                    value={batchTimestamp}
                    helperText="Times are shown and entered in your timezone."
                    onChange={(val) => {
                      let iso = null;
                      if (
                        val &&
                        val instanceof Date &&
                        Number.isFinite(val.getTime())
                      ) {
                        try {
                          iso = val.toISOString();
                        } catch {
                          iso = null;
                        }
                      }
                      setBatchTimestamp(iso);
                      batchTimestampRef.current = iso;
                    }}
                  />
                </Box>
              )}

              {(batchTargetStatus === "admin_approved" ||
                batchTargetStatus === "approved") && (
                <Stack spacing={2}>
                  <Alert severity="info" sx={{ borderRadius: 2 }}>
                    The schedule and settings below will be applied to all{" "}
                    {selectedRowIds.size} selected visit(s).
                  </Alert>

                  {/* Access Zones */}
                  <FormControl
                    fullWidth
                    required
                    error={Boolean(batchAccessLevelError || accessLevelError)}
                  >
                    <InputLabel>Access Zones</InputLabel>
                    <Select
                      multiple
                      value={selectedAccessLevelIds}
                      label="Access Zones"
                      onChange={(e) => {
                        setSelectedAccessLevelIds(e.target.value);
                        setBatchAccessLevelError("");
                        setAccessLevelError("");
                      }}
                      renderValue={(selected) => (
                        <Box
                          sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}
                        >
                          {selected.map((id) => {
                            const al = accessLevels.find((a) => a.id === id);
                            return (
                              <Chip
                                key={id}
                                label={al?.name || id}
                                size="small"
                              />
                            );
                          })}
                        </Box>
                      )}
                      sx={{ borderRadius: 2 }}
                    >
                      {accessLevels.map((al) => (
                        <MenuItem key={al.id} value={al.id}>
                          {al.name}
                        </MenuItem>
                      ))}
                    </Select>
                    {(batchAccessLevelError || accessLevelError) && (
                      <Typography
                        variant="caption"
                        color="error"
                        sx={{ mt: 0.5, ml: 1.5 }}
                      >
                        {batchAccessLevelError || accessLevelError}
                      </Typography>
                    )}
                  </FormControl>

                  {/* Multi-checkin */}
                  <FormControlLabel
                    control={
                      <Switch
                        checked={allowMultiCheckin}
                        onChange={(e) => setAllowMultiCheckin(e.target.checked)}
                        color="success"
                      />
                    }
                    label={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2">
                          Allow Multiple Check-ins
                        </Typography>
                        <Chip
                          label={allowMultiCheckin ? "Enabled" : "Disabled"}
                          size="small"
                          color={allowMultiCheckin ? "success" : "default"}
                          sx={{
                            fontWeight: 700,
                            height: 20,
                            fontSize: "0.65rem",
                          }}
                        />
                      </Stack>
                    }
                  />

                  {/* Parking */}
                  <FormControlLabel
                    control={
                      <Switch
                        checked={allowParking}
                        onChange={(e) => {
                          setAllowParking(e.target.checked);
                          if (!e.target.checked) {
                            setVehiclePlate("");
                            setVehiclePlateError("");
                          }
                        }}
                        color="success"
                      />
                    }
                    label={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2">Allow Parking</Typography>
                        <Chip
                          label={allowParking ? "Enabled" : "Disabled"}
                          size="small"
                          color={allowParking ? "success" : "default"}
                          sx={{
                            fontWeight: 700,
                            height: 20,
                            fontSize: "0.65rem",
                          }}
                        />
                      </Stack>
                    }
                  />
                  {allowParking && (
                    <TextField
                      fullWidth
                      required
                      size="small"
                      label="Vehicle Plate Number"
                      placeholder="e.g. A 12345"
                      value={vehiclePlate}
                      onChange={(e) => {
                        setVehiclePlate(e.target.value.toUpperCase());
                        setVehiclePlateError("");
                      }}
                      error={Boolean(vehiclePlateError)}
                      helperText={vehiclePlateError}
                      sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                      inputProps={{ maxLength: 20 }}
                    />
                  )}

                  {/* VIP */}
                  <FormControlLabel
                    control={
                      <Switch
                        checked={isVip}
                        onChange={(e) => {
                          setIsVip(e.target.checked);
                          if (!e.target.checked) {
                            setVipReason("");
                            setVipReasonError("");
                          }
                        }}
                        color="success"
                      />
                    }
                    label={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2">VIP</Typography>
                        <Chip
                          label={isVip ? "Enabled" : "Disabled"}
                          size="small"
                          color={isVip ? "success" : "default"}
                          sx={{
                            fontWeight: 700,
                            height: 20,
                            fontSize: "0.65rem",
                          }}
                        />
                      </Stack>
                    }
                  />
                  {isVip && (
                    <TextField
                      fullWidth
                      required
                      size="small"
                      label="VIP Reason"
                      placeholder="Enter the reason for VIP status…"
                      value={vipReason}
                      onChange={(e) => {
                        setVipReason(e.target.value);
                        setVipReasonError("");
                      }}
                      error={Boolean(vipReasonError)}
                      helperText={vipReasonError}
                      sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                      inputProps={{ maxLength: 300 }}
                    />
                  )}

                  <FormControlLabel
                    control={
                      <Switch
                        checked={escortRequired}
                        onChange={(e) => setEscortRequired(e.target.checked)}
                        color="success"
                      />
                    }
                    label={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2">Escort Required</Typography>
                        <Chip
                          label={escortRequired ? "Enabled" : "Disabled"}
                          size="small"
                          color={escortRequired ? "success" : "default"}
                          sx={{
                            fontWeight: 700,
                            height: 20,
                            fontSize: "0.65rem",
                          }}
                        />
                      </Stack>
                    }
                  />

                  <Divider />

                  {/* Schedule */}
                  <Typography variant="subtitle2" fontWeight={700}>
                    Schedule
                  </Typography>
                  <Grid container spacing={3}>
                    <Grid size={{ xs: 12, sm: 6.5 }}>
                      <Box
                        sx={{
                          border: "1px solid",
                          borderColor: "divider",
                          borderRadius: 4,
                          bgcolor: "action.hover",
                          "& .MuiDateCalendar-root": {
                            width: "100%",
                            height: "auto",
                            maxHeight: "none",
                          },
                        }}
                      >
                        <DateCalendar
                          value={scheduledDate}
                          onChange={(newDate) => applySchedule({ scheduledDate: newDate })}
                          disablePast
                        />
                      </Box>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 5.5 }}>
                      <Stack spacing={2}>
                        <Tabs
                          value={scheduleType}
                          onChange={(_, value) => applySchedule({ scheduleType: value })}
                          variant="fullWidth"
                          sx={{
                            minHeight: 46,
                            bgcolor: (theme) =>
                              alpha(
                                theme.palette.text.primary,
                                isDark ? 0.06 : 0.04,
                              ),
                            borderRadius: 999,
                            p: 0.5,
                            "& .MuiTabs-indicator": { display: "none" },
                          }}
                        >
                          <Tab
                            value="custom"
                            icon={<ICONS.time fontSize="small" />}
                            iconPosition="start"
                            label="Custom"
                            sx={{
                              minHeight: 38,
                              borderRadius: 999,
                              fontWeight: 800,
                              textTransform: "none",
                              "&.Mui-selected": {
                                bgcolor: "background.paper",
                                color: "text.primary",
                                boxShadow: "0 6px 14px rgba(0,0,0,0.08)",
                              },
                            }}
                          />
                          <Tab
                            value="preset"
                            icon={<ICONS.event fontSize="small" />}
                            iconPosition="start"
                            label="Preset"
                            sx={{
                              minHeight: 38,
                              borderRadius: 999,
                              fontWeight: 800,
                              textTransform: "none",
                              "&.Mui-selected": {
                                bgcolor: "background.paper",
                                color: "text.primary",
                                boxShadow: "0 6px 14px rgba(0,0,0,0.08)",
                              },
                            }}
                          />
                        </Tabs>
                        {scheduleType === "custom" && (
                          <Box
                            sx={{
                              p: 2,
                              bgcolor: "action.hover",
                              borderRadius: 2,
                              border: "1px solid",
                              borderColor: "divider",
                              minHeight: 280,
                            }}
                          >
                            {hostConfig && (
                              <Typography
                                variant="caption"
                                color="info.main"
                                sx={{ display: "block", mb: 1.5, fontSize: "0.68rem", direction: "ltr" }}
                              >
                                {t.bookingWorkingHoursInfo
                                  .replace("{{start}}", fmtLocalWorkingHours(hostConfig).start)
                                  .replace("{{end}}", fmtLocalWorkingHours(hostConfig).end)}
                              </Typography>
                            )}
                            <Stack spacing={2} sx={{ mb: 2 }}>
                              {renderTimeDropdowns(
                                "scheduledFrom",
                                "Expected Arrival (From)",
                                true,
                              )}
                              {renderTimeDropdowns(
                                "scheduledTo",
                                "Expected Departure (To)",
                                true,
                              )}
                            </Stack>
                            <Box
                              sx={{
                                p: 1.5,
                                bgcolor: "background.paper",
                                borderRadius: 2,
                                border: "1px solid",
                                borderColor: "divider",
                              }}
                            >
                              <Stack
                                direction="row"
                                spacing={1}
                                alignItems="center"
                              >
                                <ICONS.info
                                  sx={{ fontSize: 16, color: "text.secondary" }}
                                />
                                <Typography
                                  variant="caption"
                                  fontWeight={700}
                                  color="text.secondary"
                                  sx={{ fontSize: 12 }}
                                >
                                  Visit duration: {getDuration()} min
                                </Typography>
                              </Stack>
                            </Box>
                          </Box>
                        )}
                        {scheduleType === "preset" && (
                          <Box
                            sx={{
                              p: 2,
                              bgcolor: "action.hover",
                              borderRadius: 2,
                              border: "1px solid",
                              borderColor: "divider",
                              minHeight: 280,
                            }}
                          >
                            <Box sx={{ mb: 2.5 }}>
                              <Typography
                                variant="caption"
                                fontWeight={700}
                                color="text.secondary"
                                sx={{
                                  display: "block",
                                  mb: 1,
                                  textTransform: "uppercase",
                                  fontSize: "0.65rem",
                                }}
                              >
                                Preset Type
                              </Typography>
                              <TextField
                                fullWidth
                                select
                                size="small"
                                value={selectedPreset || "fullDay"}
                                onChange={(e) =>
                                  applySchedule({
                                    selectedPreset: e.target.value,
                                    specificDays: [],
                                    dayTypeTab: "working",
                                  })
                                }
                                sx={{
                                  "& .MuiOutlinedInput-root": {
                                    borderRadius: 2,
                                  },
                                }}
                              >
                                <MenuItem value="fullDay">Full Day</MenuItem>
                                <MenuItem value="fullWeek">Full Week</MenuItem>
                                <MenuItem value="fullMonth">
                                  Full Month
                                </MenuItem>
                                <MenuItem value="specificDays">
                                  Specific Days
                                </MenuItem>
                              </TextField>
                            </Box>
                            {selectedPreset !== "specificDays" && (
                              <Box
                                sx={{
                                  p: 1.5,
                                  bgcolor: "background.paper",
                                  borderRadius: 2,
                                  border: "1px solid",
                                  borderColor: "divider",
                                  mb: 2.5,
                                }}
                              >
                                <Typography
                                  variant="caption"
                                  fontWeight={700}
                                  color="text.secondary"
                                  sx={{
                                    display: "block",
                                    mb: 0.5,
                                    textTransform: "uppercase",
                                    fontSize: "0.65rem",
                                  }}
                                >
                                  Date Range
                                </Typography>
                                <Typography
                                  variant="body2"
                                  fontWeight={600}
                                  color="text.primary"
                                >
                                  {!scheduledDate
                                    ? "Select a date"
                                    : (() => {
                                        const date = scheduledDate;
                                        let from = date.clone();
                                        let to = date.clone();
                                        if (selectedPreset === "fullDay") {
                                          const startH = hostConfig?.start ?? 8;
                                          const startM = hostConfig?.startMinute ?? 0;
                                          const endH = hostConfig?.end ?? 17;
                                          const endM = hostConfig?.endMinute ?? 0;
                                          from = from.startOf("day").hour(startH).minute(startM);
                                          to = date.clone().startOf("day").hour(endH).minute(endM);
                                        } else if (selectedPreset === "fullWeek") {
                                          from = from.startOf("day");
                                          to = from.add(6, "days").endOf("day");
                                        } else if (selectedPreset === "fullMonth") {
                                          from = from.startOf("day");
                                          to = from.endOf("month");
                                        }
                                        return `${from.format("DD MMMM YYYY, hh:mm A")} → ${to.format("DD MMMM YYYY, hh:mm A")}`;
                                      })()}
                                </Typography>
                              </Box>
                            )}
                            {(selectedPreset === "fullWeek" ||
                              selectedPreset === "fullMonth") && (
                              <Box sx={{ mb: 2 }}>
                                <Typography
                                  variant="caption"
                                  fontWeight={600}
                                  color="info.main"
                                  sx={{
                                    display: "block",
                                    mb: 0.75,
                                    fontSize: "0.68rem",
                                  }}
                                >
                                  {t.bookingWorkingDays}:{" "}
                                  {(hostConfig?.workingDays ?? [0, 1, 2, 3, 4])
                                    .map((d) => DAY_LABELS[d])
                                    .join(", ")}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  fontWeight={700}
                                  color="text.secondary"
                                  sx={{
                                    display: "block",
                                    mb: 0.75,
                                    textTransform: "uppercase",
                                    fontSize: "0.65rem",
                                  }}
                                >
                                  {t.bookingDayType}
                                </Typography>
                                <RadioGroup
                                  row
                                  value={dayTypeTab}
                                  onChange={(_, v) =>
                                    applySchedule({ dayTypeTab: v })
                                  }
                                >
                                  <FormControlLabel
                                    value="working"
                                    control={<Radio size="small" />}
                                    label={t.bookingWorkingOnly}
                                  />
                                  <FormControlLabel
                                    value="all"
                                    control={<Radio size="small" />}
                                    label={t.bookingWorkingPlusWeekends}
                                  />
                                </RadioGroup>
                              </Box>
                            )}
                            {selectedPreset === "specificDays" && (
                              <Box sx={{ mb: 2 }}>
                                {hostConfig &&
                                  (() => {
                                    const wDays = hostConfig.workingDays ?? [
                                      0, 1, 2, 3, 4,
                                    ];
                                    const wEnds = hostConfig.weekendDays ?? [
                                      5, 6,
                                    ];
                                    const chip = (idx, label, isWeekend) => {
                                      const active = specificDays.includes(idx);
                                      return (
                                        <Box
                                          key={idx}
                                          onClick={() =>
                                            applySchedule({
                                              specificDays: active
                                                ? specificDays.filter(
                                                    (d) => d !== idx,
                                                  )
                                                : [...specificDays, idx],
                                            })
                                          }
                                          sx={{
                                            px: 1.5,
                                            py: 0.5,
                                            borderRadius: 30,
                                            cursor: "pointer",
                                            userSelect: "none",
                                            border: "1px solid",
                                            fontWeight: 700,
                                            fontSize: "0.75rem",
                                            borderColor: active
                                              ? isWeekend
                                                ? "warning.main"
                                                : "primary.main"
                                              : "divider",
                                            bgcolor: active
                                              ? isWeekend
                                                ? "warning.main"
                                                : "primary.main"
                                              : "background.paper",
                                            color: active
                                              ? isWeekend
                                                ? "warning.contrastText"
                                                : "primary.contrastText"
                                              : isWeekend
                                                ? "warning.main"
                                                : "text.secondary",
                                            transition: "all 0.12s",
                                          }}
                                        >
                                          {label}
                                        </Box>
                                      );
                                    };
                                    return (
                                      <>
                                        <Typography
                                          variant="caption"
                                          fontWeight={600}
                                          color="info.main"
                                          sx={{
                                            display: "block",
                                            mb: 0.5,
                                            fontSize: "0.68rem",
                                          }}
                                        >
                                          {t.bookingWorkingDays}
                                        </Typography>
                                        <Stack
                                          direction="row"
                                          flexWrap="wrap"
                                          sx={{ gap: 0.75, mb: 1.5 }}
                                        >
                                          {wDays.map((idx) =>
                                            chip(idx, DAY_LABELS[idx], false),
                                          )}
                                        </Stack>
                                        <Typography
                                          variant="caption"
                                          fontWeight={600}
                                          color="warning.main"
                                          sx={{
                                            display: "block",
                                            mb: 0.5,
                                            fontSize: "0.68rem",
                                          }}
                                        >
                                          {t.bookingWeekendDays}
                                        </Typography>
                                        <Stack
                                          direction="row"
                                          flexWrap="wrap"
                                          sx={{ gap: 0.75, mb: 1.5 }}
                                        >
                                          {wEnds.map((idx) =>
                                            chip(idx, DAY_LABELS[idx], true),
                                          )}
                                        </Stack>
                                      </>
                                    );
                                  })()}
                                <Stack
                                  direction="row"
                                  spacing={1}
                                  alignItems="center"
                                >
                                  <Typography
                                    variant="caption"
                                    fontWeight={600}
                                    color="text.secondary"
                                    sx={{ whiteSpace: "nowrap" }}
                                  >
                                    From {scheduledDate?.format("DD MMM YYYY")}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    color="text.disabled"
                                  >
                                    →
                                  </Typography>
                                  <TextField
                                    type="date"
                                    size="small"
                                    value={
                                      specificEndDate
                                        ? specificEndDate.format("YYYY-MM-DD")
                                        : ""
                                    }
                                    onChange={(e) =>
                                      applySchedule({
                                        specificEndDate: e.target.value
                                          ? dayjs(e.target.value)
                                          : null,
                                      })
                                    }
                                    inputProps={{
                                      min: scheduledDate
                                        ? scheduledDate.format("YYYY-MM-DD")
                                        : dayjs().format("YYYY-MM-DD"),
                                    }}
                                    sx={{
                                      width: 180,
                                      "& .MuiOutlinedInput-root": {
                                        borderRadius: 2,
                                      },
                                    }}
                                  />
                                </Stack>
                              </Box>
                            )}
                            {(selectedPreset === "fullWeek" ||
                              selectedPreset === "fullMonth") &&
                              hostConfig &&
                              scheduledDate &&
                              (() => {
                                const activeDaySet = computeDaySet(dayTypeTab, hostConfig);
                                const weekendSet = hostConfig.weekendDays ?? [
                                  5, 6,
                                ];
                                const date = scheduledDate;
                                let endDate;
                                if (selectedPreset === "fullWeek")
                                  endDate = date.clone().add(6, "days");
                                else if (selectedPreset === "fullMonth")
                                  endDate = date.clone().endOf("month");
                                const matches = [];
                                let cursor = date.clone();
                                while (
                                  cursor.isBefore(endDate) ||
                                  cursor.isSame(endDate, "day")
                                ) {
                                  if (activeDaySet.includes(cursor.day()))
                                    matches.push(cursor.clone());
                                  cursor = cursor.add(1, "day");
                                }
                                return matches.length > 0 ? (
                                  <Box sx={{ mb: 2 }}>
                                    <Typography
                                      variant="caption"
                                      fontWeight={700}
                                      color="text.secondary"
                                      sx={{
                                        display: "block",
                                        mb: 0.75,
                                        textTransform: "uppercase",
                                        fontSize: "0.65rem",
                                      }}
                                    >
                                      {t.bookingDaysInRange.replace(
                                        "{{type}}",
                                        dayTypeTab === "all"
                                          ? t.bookingAllDays
                                          : t.bookingWorkingDays,
                                      )}
                                    </Typography>
                                    <Stack
                                      direction="row"
                                      flexWrap="wrap"
                                      sx={{ gap: 0.5 }}
                                    >
                                      {matches.map((d, i) => {
                                        const isOff = weekendSet.includes(
                                          d.day(),
                                        );
                                        return (
                                          <Chip
                                            key={i}
                                            label={`${DAY_LABELS[d.day()]} ${d.format("DD")}`}
                                            size="small"
                                            color={
                                              isOff ? "warning" : "primary"
                                            }
                                            variant="outlined"
                                            sx={{
                                              fontWeight: 600,
                                              fontSize: "0.65rem",
                                              height: 20,
                                            }}
                                          />
                                        );
                                      })}
                                    </Stack>
                                  </Box>
                                ) : null;
                              })()}
                            {selectedPreset === "fullDay" ? (
                              <Box
                                sx={{
                                  p: 1.5,
                                  bgcolor: "background.paper",
                                  borderRadius: 2,
                                  border: "1px solid",
                                  borderColor: "divider",
                                }}
                              >
                                <Stack
                                  direction="row"
                                  spacing={1}
                                  alignItems="center"
                                >
                                  <ICONS.info
                                    sx={{ fontSize: 16, color: "info.main" }}
                                  />
                               <Typography
                                  variant="caption"
                                  fontWeight={700}
                                  color="text.secondary"
                                  sx={{ fontSize: 12 }}
                                >
                                  {hostConfig
                                    ? t.bookingFullDayWorkingHoursInfo
                                          .replace(
                                            "{{start}}",
                                            fmtLocalWorkingHours(hostConfig).start,
                                          )
                                          .replace(
                                            "{{end}}",
                                            fmtLocalWorkingHours(hostConfig).end,
                                          )
                                      : t.bookingFullDayWorkingHoursInfo
                                          .replace("{{start}}", "8:00 AM")
                                          .replace("{{end}}", "5:00 PM")}
                                  </Typography>
                                </Stack>
                              </Box>
                            ) : (
                              <>
                                {hostConfig &&
                                  (() => {
                                    const fmt = (h24, min) => {
                                      const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
                                      const ampm = h24 < 12 ? "AM" : "PM";
                                      return `${h12}:${String(min).padStart(2, "0")} ${ampm}`;
                                    };
                                    const s = fmt(fmtLocalWorkingHours(hostConfig).startH, fmtLocalWorkingHours(hostConfig).startM);
                                    const e = fmt(fmtLocalWorkingHours(hostConfig).endH, fmtLocalWorkingHours(hostConfig).endM);
                                    return (
                                      <Typography dir="ltr" variant="caption" color="info.main" sx={{ display: "block", mb: 0.75, fontSize: "0.68rem" }}>
                                        {t.bookingWorkingHoursInfo.replace("{{start}}", s).replace("{{end}}", e)}
                                      </Typography>
                                    );
                                  })()}
                                <Stack spacing={2} sx={{ mb: 2 }}>
                                  {renderTimeDropdowns("scheduledFrom", "Start Time")}
                                  {renderTimeDropdowns("scheduledTo", "End Time")}
                                </Stack>
                                {getDuration() > 0 && (
                                  <Box sx={{ p: 1.5, bgcolor: "background.paper", borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
                                    <Stack direction="row" spacing={1} alignItems="center">
                                      <ICONS.info sx={{ fontSize: 16, color: "text.secondary" }} />
                                      <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ fontSize: 12 }}>
                                        Visit duration: {getDuration()} min
                                      </Typography>
                                    </Stack>
                                  </Box>
                                )}
                              </>
                            )}
                          </Box>
                        )}
                        {renderScheduleOutsideWarning()}
                      </Stack>
                    </Grid>
                  </Grid>

                  <Divider />

                  {/* Approval note */}
                  <Box>
                    <Typography
                      variant="subtitle2"
                      sx={{ mb: 1, fontWeight: 700 }}
                    >
                      Note{" "}
                      <Typography
                        component="span"
                        variant="caption"
                        color="text.secondary"
                      >
                        (optional)
                      </Typography>
                    </Typography>
                    <TextField
                      fullWidth
                      multiline
                      minRows={2}
                      maxRows={4}
                      size="small"
                      placeholder="Add a note for the visitors…"
                      value={approvalNote}
                      onChange={(e) => setApprovalNote(e.target.value)}
                      inputProps={{ maxLength: 500 }}
                      sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                    />
                  </Box>
                </Stack>
              )}
            </Stack>
          </DialogContent>
          <Divider />
          <DialogActions
            disableSpacing
            sx={{
              p: 2.5,
              gap: 1,
              flexDirection: { xs: "column", sm: "row" },
              justifyContent: "flex-end",
            }}
          >
            <Button
              variant="outlined"
              onClick={() => {
                if (!batchSubmitting) setBatchOpen(false);
              }}
              startIcon={<ICONS.cancel />}
              disabled={batchSubmitting}
              sx={{
                px: 3,
                fontWeight: 700,
                borderRadius: 30,
                width: { xs: "100%", sm: "auto" },
                order: { xs: 2, sm: 0 },
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              color="warning"
              disabled={batchSubmitting || !batchTargetStatus}
              startIcon={
                batchSubmitting ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <ICONS.check />
                )
              }
              onClick={handleBatchApply}
              sx={{
                borderRadius: 30,
                px: 4,
                fontWeight: 700,
                width: { xs: "100%", sm: "auto" },
                order: { xs: 1, sm: 0 },
              }}
            >
              {batchSubmitting
                ? "Applying…"
                : `Apply to ${selectedRowIds.size} Visit${selectedRowIds.size !== 1 ? "s" : ""}`}
            </Button>
          </DialogActions>
        </Dialog>

        {/* ── Edit Dialog ── */}
        <Dialog
          open={!!editForm}
          onClose={() => {
            setOpenSchedulePicker(null);
            setEditForm(null);
          }}
          maxWidth="md"
          fullWidth
          PaperProps={{ sx: { borderRadius: 4, overflow: "hidden" } }}
        >
          <DialogHeader
            title="Edit Visit"
            onClose={() => {
              setOpenSchedulePicker(null);
              setEditForm(null);
            }}
          />
          <Divider />
          <DialogContent sx={{ p: 2.5 }}>
            {editForm &&
              (() => {
                const nk = (s = "") =>
                  s.toLowerCase().replace(/[^a-z0-9]/g, "");
                const purposeField = activeCustomFields.find((f) => {
                  const k = nk(f.fieldKey || f.field_key);
                  const l = (f.label || "").toLowerCase();
                  return (
                    k.includes("purposeofvisit") ||
                    k === "purpose" ||
                    l.includes("purpose of visit")
                  );
                });
                const purposeVal = purposeField
                  ? (editForm.fieldValues?.[purposeField.fieldKey] ?? "")
                  : "";
                const isOther = purposeVal === "Other";

                let otherField = null;
                if (purposeField?.dependentsJson) {
                  const rawDeps =
                    typeof purposeField.dependentsJson === "string"
                      ? JSON.parse(purposeField.dependentsJson)
                      : purposeField.dependentsJson;
                  const otherConfig = rawDeps["Other"];
                  if (otherConfig?.fieldIds?.length > 0) {
                    otherField = activeCustomFields.find((f) =>
                      otherConfig.fieldIds.includes(f.id),
                    );
                  }
                }
                if (!otherField) {
                  const nonPurpose = activeCustomFields.filter(
                    (f) => f.id !== purposeField?.id,
                  );
                  otherField = nonPurpose.find((f) => {
                    const k = nk(f.fieldKey || f.field_key);
                    const l = (f.label || "").toLowerCase();
                    return (
                      k.includes("pleasespecify") ||
                      k.includes("specify") ||
                      k.includes("otherdetails") ||
                      k.includes("otherspecify") ||
                      k.includes("otherpurpose") ||
                      k.includes("otherreason") ||
                      k.includes("otherdetail") ||
                      l.includes("please specify") ||
                      (l.includes("other") &&
                        (l.includes("specify") ||
                          l.includes("purpose") ||
                          l.includes("reason") ||
                          l.includes("detail")))
                    );
                  });
                  if (!otherField && isOther) {
                    otherField = nonPurpose[0] || null;
                  }
                }

                const renderField = (field, value, onChange) => {
                  const opts = Array.isArray(field.optionsJson)
                    ? field.optionsJson
                    : [];
                  if (
                    ["list", "select", "dropdown"].includes(field.inputType)
                  ) {
                    return (
                      <FormControl key={field.fieldKey} fullWidth>
                        <InputLabel>{field.label}</InputLabel>
                        <Select
                          value={value}
                          label={field.label}
                          onChange={(e) => onChange(e.target.value)}
                          sx={{ borderRadius: 2 }}
                        >
                          <MenuItem value="">
                            <em>None</em>
                          </MenuItem>
                          {opts.map((opt) => (
                            <MenuItem key={opt} value={opt}>
                              {opt}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    );
                  }
                  if (field.inputType === "country") {
                    return (
                      <CountryPicker
                        key={field.fieldKey}
                        label={field.label}
                        value={value}
                        onChange={(v) => onChange(v)}
                        lang={lang}
                      />
                    );
                  }
                  return (
                    <TextField
                      key={field.fieldKey}
                      label={field.label}
                      fullWidth
                      value={value}
                      onChange={(e) => onChange(e.target.value)}
                      type={
                        field.inputType === "email"
                          ? "email"
                          : field.inputType === "number"
                            ? "number"
                            : "text"
                      }
                      InputProps={{ sx: { borderRadius: 2 } }}
                    />
                  );
                };

                return (
                  <Stack spacing={2}>
                    {editForm.isGroupMeeting && (
                      <Box>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          fontWeight={700}
                          sx={{
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                            display: "block",
                            mb: 1,
                          }}
                        >
                          Meeting Name
                        </Typography>
                        <TextField
                          fullWidth
                          value={editForm.meetingName || ""}
                          placeholder="e.g. Board Meeting"
                          inputProps={{ maxLength: 100 }}
                          helperText="Leave empty to keep the default “Group Meeting” label."
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              meetingName: e.target.value,
                            }))
                          }
                          sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                        />
                      </Box>
                    )}
                    <Box>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        fontWeight={700}
                        sx={{
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                          display: "block",
                          mb: 1,
                        }}
                      >
                        {editForm.hasApproved
                          ? "Approved From"
                          : "Requested From"}
                      </Typography>
                      <DateTimeFieldFlatpickr
                        value={editForm.scheduleFrom || ""}
                        maxDate={editForm.scheduleTo}
                        open={openSchedulePicker === "from"}
                        onOpenChange={(v) =>
                          setOpenSchedulePicker(v ? "from" : null)
                        }
                        onChange={(val) =>
                          setEditForm((prev) => ({
                            ...prev,
                            scheduleFrom: val,
                            ...(editScheduleSpansMultiple(val, prev.scheduleTo)
                              ? { allowMultiCheckin: true }
                              : {}),
                          }))
                        }
                        placeholder={
                          editForm.hasApproved
                            ? "Approved start date & time"
                            : "Requested start date & time"
                        }
                      />
                    </Box>
                    <Box>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        fontWeight={700}
                        sx={{
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                          display: "block",
                          mb: 1,
                        }}
                      >
                        {editForm.hasApproved ? "Approved To" : "Requested To"}
                      </Typography>
                      <DateTimeFieldFlatpickr
                        value={editForm.scheduleTo || ""}
                        minDate={editForm.scheduleFrom}
                        open={openSchedulePicker === "to"}
                        onOpenChange={(v) =>
                          setOpenSchedulePicker(v ? "to" : null)
                        }
                        onChange={(val) =>
                          setEditForm((prev) => ({
                            ...prev,
                            scheduleTo: val,
                            ...(editScheduleSpansMultiple(prev.scheduleFrom, val)
                              ? { allowMultiCheckin: true }
                              : {}),
                          }))
                        }
                        placeholder={
                          editForm.hasApproved
                            ? "Approved end date & time"
                            : "Requested end date & time"
                        }
                      />
                    </Box>
                    <FormControl fullWidth>
                      <InputLabel>Visiting Department</InputLabel>
                      <Select
                        value={editForm.departmentId || ""}
                        label="Visiting Department"
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            departmentId: e.target.value,
                          })
                        }
                        sx={{ borderRadius: 2 }}
                      >
                        <MenuItem value="">
                          <em>None</em>
                        </MenuItem>
                        {departments.map((d) => (
                          <MenuItem key={d.id} value={d.id}>
                            {d.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    {editForm.hasApproved && (
                      <>
                        <FormControl fullWidth>
                          <InputLabel>Access Zones</InputLabel>
                          <Select
                            multiple
                            value={editForm.accessLevelIds || []}
                            label="Access Zones"
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                accessLevelIds: e.target.value,
                              })
                            }
                            renderValue={(selected) => (
                              <Box
                                sx={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: 0.5,
                                }}
                              >
                                {selected.map((id) => {
                                  const al = accessLevels.find(
                                    (a) => a.id === id,
                                  );
                                  return (
                                    <Chip
                                      key={id}
                                      label={al?.name || id}
                                      size="small"
                                    />
                                  );
                                })}
                              </Box>
                            )}
                            sx={{ borderRadius: 2 }}
                          >
                            {accessLevels
                              .filter((al) => al.isActive !== false)
                              .map((al) => (
                                <MenuItem key={al.id} value={al.id}>
                                  {al.name}
                                </MenuItem>
                              ))}
                          </Select>
                        </FormControl>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={editForm.allowMultiCheckin ?? false}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  allowMultiCheckin: e.target.checked,
                                })
                              }
                              color="success"
                            />
                          }
                          label={
                            <Stack
                              direction="row"
                              spacing={1}
                              alignItems="center"
                            >
                              <Typography variant="body2">
                                Allow Multiple Check-ins
                              </Typography>
                              <Chip
                                label={
                                  editForm.allowMultiCheckin
                                    ? "Enabled"
                                    : "Disabled"
                                }
                                size="small"
                                color={
                                  editForm.allowMultiCheckin
                                    ? "success"
                                    : "default"
                                }
                                sx={{
                                  fontWeight: 700,
                                  height: 20,
                                  fontSize: "0.65rem",
                                }}
                              />
                            </Stack>
                          }
                        />

                        <FormControlLabel
                          control={
                            <Switch
                              checked={editForm.allowParking ?? false}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setEditForm({
                                  ...editForm,
                                  allowParking: checked,
                                });
                                if (!checked)
                                  setEditForm((prev) => ({
                                    ...prev,
                                    vehiclePlate: "",
                                  }));
                              }}
                              color="success"
                            />
                          }
                          label={
                            <Stack
                              direction="row"
                              spacing={1}
                              alignItems="center"
                            >
                              <Typography variant="body2">
                                Allow Parking
                              </Typography>
                              <Chip
                                label={
                                  editForm.allowParking ? "Enabled" : "Disabled"
                                }
                                size="small"
                                color={
                                  editForm.allowParking ? "success" : "default"
                                }
                                sx={{
                                  fontWeight: 700,
                                  height: 20,
                                  fontSize: "0.65rem",
                                }}
                              />
                            </Stack>
                          }
                        />
                        {editForm.allowParking && (
                          <TextField
                            fullWidth
                            size="small"
                            label="Vehicle Plate Number"
                            placeholder="e.g. A 12345"
                            value={editForm.vehiclePlate ?? ""}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                vehiclePlate: e.target.value.toUpperCase(),
                              }))
                            }
                            sx={{
                              "& .MuiOutlinedInput-root": { borderRadius: 2 },
                            }}
                            inputProps={{ maxLength: 20 }}
                          />
                        )}

                        <FormControlLabel
                          control={
                            <Switch
                              checked={editForm.isVip ?? false}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setEditForm({ ...editForm, isVip: checked });
                                if (!checked)
                                  setEditForm((prev) => ({
                                    ...prev,
                                    vipReason: "",
                                  }));
                              }}
                              color="success"
                            />
                          }
                          label={
                            <Stack
                              direction="row"
                              spacing={1}
                              alignItems="center"
                            >
                              <Typography variant="body2">VIP</Typography>
                              <Chip
                                label={editForm.isVip ? "Enabled" : "Disabled"}
                                size="small"
                                color={editForm.isVip ? "success" : "default"}
                                sx={{
                                  fontWeight: 700,
                                  height: 20,
                                  fontSize: "0.65rem",
                                }}
                              />
                            </Stack>
                          }
                        />
                        {editForm.isVip && (
                          <TextField
                            fullWidth
                            size="small"
                            label="VIP Reason"
                            placeholder="Enter the reason for VIP status…"
                            value={editForm.vipReason ?? ""}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                vipReason: e.target.value,
                              }))
                            }
                            sx={{
                              "& .MuiOutlinedInput-root": { borderRadius: 2 },
                            }}
                            inputProps={{ maxLength: 300 }}
                          />
                        )}

                        <FormControlLabel
                          control={
                            <Switch
                              checked={editForm.escortRequired ?? true}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  escortRequired: e.target.checked,
                                })
                              }
                              color="success"
                            />
                          }
                          label={
                            <Stack
                              direction="row"
                              spacing={1}
                              alignItems="center"
                            >
                              <Typography variant="body2">
                                Escort Required
                              </Typography>
                              <Chip
                                label={
                                  editForm.escortRequired
                                    ? "Enabled"
                                    : "Disabled"
                                }
                                size="small"
                                color={
                                  editForm.escortRequired
                                    ? "success"
                                    : "default"
                                }
                                sx={{
                                  fontWeight: 700,
                                  height: 20,
                                  fontSize: "0.65rem",
                                }}
                              />
                            </Stack>
                          }
                        />
                      </>
                    )}

                    {purposeField &&
                      renderField(
                        purposeField,
                        editForm.fieldValues?.[purposeField.fieldKey] ?? "",
                        (v) =>
                          setEditForm((prev) => ({
                            ...prev,
                            fieldValues: {
                              ...prev.fieldValues,
                              [purposeField.fieldKey]: v,
                            },
                          })),
                      )}

                    {isOther &&
                      otherField &&
                      renderField(
                        otherField,
                        editForm.fieldValues?.[otherField.fieldKey] ?? "",
                        (v) =>
                          setEditForm((prev) => ({
                            ...prev,
                            fieldValues: {
                              ...prev.fieldValues,
                              [otherField.fieldKey]: v,
                            },
                          })),
                      )}

                    {canWriteInternalNote && (
                      <Divider sx={{ my: 0.5 }} />
                    )}

                    {canWriteInternalNote && (
                      <Box>
                        <Typography
                          variant="subtitle2"
                          fontWeight={700}
                          sx={{ mb: 0.75, display: "flex", alignItems: "center", gap: 1 }}
                        >
                          <ICONS.description sx={{ fontSize: "0.95rem" }} />
                          Internal Note
                        </Typography>
                        <TextField
                          size="small"
                          fullWidth
                          multiline
                          rows={3}
                          value={editForm.internalNote ?? ""}
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              internalNote: e.target.value,
                            }))
                          }
                          placeholder="Private internal note — never shown to the visitor"
                        />
                      </Box>
                    )}
                  </Stack>
                );
              })()}
          </DialogContent>
          <Divider />
          <DialogActions
            disableSpacing
            sx={{
              p: 2.5,
              gap: 1,
              flexDirection: { xs: "column-reverse", sm: "row" },
            }}
          >
            <Button
              variant="outlined"
              startIcon={<ICONS.cancel />}
              onClick={() => {
                setOpenSchedulePicker(null);
                setEditForm(null);
              }}
              disabled={submitting}
              sx={{ borderRadius: 30, width: { xs: "100%", sm: "auto" } }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSaveEdit}
              disabled={submitting}
              startIcon={
                submitting ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <ICONS.save />
                )
              }
              sx={{ borderRadius: 30, width: { xs: "100%", sm: "auto" } }}
            >
              Save Changes
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </PermissionRouteGuard>
  );
}
