"use client";

import { useState, useCallback, useRef, useEffect, useMemo, Fragment } from "react";
import dayjs from "dayjs";
import {
  Box,
  Typography,
  Button,
  Stack,
  Container,
  Paper,
  Chip,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  TextField,
  IconButton,
  CircularProgress,
  Tooltip,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Avatar,
  alpha,
  Tabs,
  Tab,
  Grid,
  Switch,
  FormControlLabel,
  RadioGroup,
  Radio,
} from "@mui/material";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";
import { useTheme } from "@mui/material/styles";

import { pdf, Document } from "@react-pdf/renderer";
import QRCode from "qrcode";
import BadgePDF from "@/components/badges/BadgePDF";
import { getDefaultBadgeTemplate } from "@/services/badgeService";

import QrScanner from "@/components/QrScanner";
import RoleGuard from "@/components/auth/RoleGuard";
import ICONS from "@/utils/iconUtil";
import LoadingState from "@/components/LoadingState";
import { useMessage } from "@/contexts/MessageContext";
import { useColorMode } from "@/contexts/ThemeContext";
import useI18nLayout from "@/hooks/useI18nLayout";
import gateStaffTranslations from "@/locales/gateStaff";
import { useAuth } from "@/contexts/AuthContext";
import { canAccessResource } from "@/utils/permissions";
import { workingHoursToUserLocal, userTimeZone, rollOvernightEnd } from "@/utils/premiseTime";
import { useSocket } from "@/contexts/SocketContext";
import {
  verifyRegistrationByToken,
  updateStatus,
  getRegistrationActivityLogs,
  mapRegistration,
  verifyRegistrationById,
  createVipRevisit,
  getCurrentlyInside,
  getRegistrations,
  getRegistrationById,
  updateInternalNote,
} from "@/services/registrationService";
import { getWorkingHours } from "@/services/hostService";
import { getAccessLevels } from "@/services/accessLevelService";
import { formatDate, formatTime, getLocalDate, getLocalTime, parse24To12, convert12To24 } from "@/utils/dateUtils";
import getStartIconSpacing from "@/utils/getStartIconSpacing";
import getChipIconSpacing from "@/utils/getChipIconSpacing";
import { resolvePastVisitBreakdown } from "@/utils/visitCount";
import { formatActorLabel } from "@/utils/actorLabel";
import { getRegistrationDisplayName, getRegistrationDisplayInitial } from "@/utils/registrationDisplay";
import { countScheduledDays } from "@/utils/scheduleDayCount";
import { markBadgesPrinted } from "@/services/activityService";
import DialogHeader from "@/components/modals/DialogHeader";
import VipFastTrackModal from "./VipFastTrackModal";
import GateTodayView from "@/components/staff/GateTodayView";

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
  rejected: {
    labelKey: "statusRejected",
    color: "error",
    icon: <ICONS.close fontSize="small" />,
  },
  checked_in: {
    labelKey: "statusCheckedIn",
    color: "info",
    icon: <ICONS.login fontSize="small" />,
  },
  checked_out: {
    labelKey: "statusCheckedOut",
    color: "default",
    icon: <ICONS.logout fontSize="small" />,
  },
  visit_ended: {
    labelKey: "statusVisitEnded",
    color: "default",
    icon: <ICONS.stop fontSize="small" />,
  },
  cancelled: {
    labelKey: "statusCancelled",
    color: "default",
    icon: <ICONS.cancel fontSize="small" />,
  },
  expired: {
    labelKey: "statusExpired",
    color: "default",
    icon: <ICONS.history fontSize="small" />,
  },
};

const MINUTES = Array.from({ length: 12 }, (_, i) =>
  String(i * 5).padStart(2, "0"),
);

export default function StaffVerifyPage() {
  const theme = useTheme();
  const { user } = useAuth();
  const { showMessage } = useMessage();
  const { mode } = useColorMode();
  const { t, dir, language: lang } = useI18nLayout(gateStaffTranslations);
  const isSuperAdmin = user?.role === "superadmin";

  // Localized periods for time dropdowns
  const PERIOD_VALUES = ["AM", "PM"];

  const DAY_LABELS = [
    t.daySun,
    t.dayMon,
    t.dayTue,
    t.dayWed,
    t.dayThu,
    t.dayFri,
    t.daySat,
  ];
  // Backend-driven ID types ("Oman ID", "Passport", "ID") → localized display labels
  const translateIdType = (type) =>
    type === "Oman ID"
      ? t.idTypeOmanId
      : type === "Passport"
        ? t.idTypePassport
        : type === "ID"
          ? t.idTypeId
          : type;
  const canCheckin = canAccessResource(user, "verify", { action: "checkin" });
  const canCheckout = canAccessResource(user, "verify", { action: "checkout" });
  const canVipBypass = canAccessResource(user, "verify", { action: "vip-bypass" });
  const canTodayVisitors = canAccessResource(user, "verify", { action: "todays-visitors" });
  const canRead = canAccessResource(user, "verify", { action: "read" });
  const canReadInternalNote = canAccessResource(user, "internal-notes", {
    hardcodeAllowed: isSuperAdmin,
    action: "read",
  });
  const canWriteInternalNote = canAccessResource(user, "internal-notes", {
    hardcodeAllowed: isSuperAdmin,
    action: "update",
  });
  // Gate staff may grant the final approval at the gate ONLY when the
  // verify:approve-status permission has been granted to the staff:gate role
  // (default denied).
  const canApproveStatus =
    user?.role === "staff" &&
    user?.staffType === "gate" &&
    canAccessResource(user, "verify", { action: "approve-status" });
  const isDark = mode === "dark";
  const [showScanner, setShowScanner] = useState(false);
  const [vipModalOpen, setVipModalOpen] = useState(false);
  const [internalNoteDraft, setInternalNoteDraft] = useState("");
  const [internalNoteDialogOpen, setInternalNoteDialogOpen] = useState(false);
  const [internalNoteSaving, setInternalNoteSaving] = useState(false);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [scannerFailed, setScannerFailed] = useState(false);
  const [workingHours, setWorkingHours] = useState(null);
  const hostConfig = workingHours;
  const [outsideHoursWarning, setOutsideHoursWarning] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [activityLogs, setActivityLogs] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [idSearch, setIdSearch] = useState("");
  const [isSearchingById, setIsSearchingById] = useState(false);
  const scanningRef = useRef(false);
  const idSearchRef = useRef(null);
  const [badgeTemplate, setBadgeTemplate] = useState(null);

  // Today's View
  const [todayView, setTodayView] = useState(false);

  // Assembly mode
  const [idVerified, setIdVerified] = useState(false);
  const [showIdVerifyDialog, setShowIdVerifyDialog] = useState(false);

  const [assemblyMode, setAssemblyMode] = useState(false);
  const [assemblyVisitors, setAssemblyVisitors] = useState([]);
  const [assemblyLoading, setAssemblyLoading] = useState(false);
  const [accountedIds, setAccountedIds] = useState(new Set());
  const [assemblySearch, setAssemblySearch] = useState("");

  const enterAssemblyMode = async () => {
    setAssemblyMode(true);
    setAssemblyLoading(true);
    setAccountedIds(new Set());
    setAssemblySearch("");
    try {
      const visitors = await getCurrentlyInside();
      setAssemblyVisitors(Array.isArray(visitors) ? visitors : []);
    } finally {
      setAssemblyLoading(false);
    }
  };

  const exitAssemblyMode = () => {
    setAssemblyMode(false);
    setAssemblyVisitors([]);
    setAccountedIds(new Set());
    setAssemblySearch("");
  };

  const toggleAccounted = (id) => {
    setAccountedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    fetchDefaultBadgeTemplate();
    getWorkingHours().then((wh) => {
      if (wh) setWorkingHours(wh);
    });
  }, []);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        getWorkingHours().then((wh) => {
          if (wh) setWorkingHours(wh);
        });
      }
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const fetchDefaultBadgeTemplate = async () => {
    const template = await getDefaultBadgeTemplate();
    if (template && !template.error) {
      setBadgeTemplate(template);
    }
  };

  const doVerify = useCallback(async (input) => {
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await verifyRegistrationByToken(input);

      if (res?.error) {
        setError(res.message);
      } else if (res) {
        const mapped = mapRegistration(res);
        setResult(mapped);
        // Fetch activity logs for timestamps (check-in, check-out, visit-ended)
        if (
          res.id &&
          ["checked_in", "checked_out", "visit_ended"].includes(res.status)
        ) {
          const logs = await getRegistrationActivityLogs(res.id);
          setActivityLogs(Array.isArray(logs) ? logs : []);
        } else {
          setActivityLogs([]);
        }
      } else {
        setError(t.gateInvalidToken);
      }
    } finally {
      setLoading(false);
    }
  }, [t]);

  const handleIdSearch = async (e) => {
    if (e) e.preventDefault();
    if (!idSearch.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setSearchResults([]);
    setIsSearchingById(true);

    try {
      const res = await verifyRegistrationById(idSearch);
      if (res?.error) {
        setError(res.message);
      } else if (res && Array.isArray(res) && res.length > 0) {
        if (res.length === 1) {
          handleSelectVisitor(res[0]);
        } else {
          setSearchResults(res);
        }
      } else {
        setError(t.gateNoRegistrationFound);
      }
    } catch (err) {
      console.error("ID search error:", err);
      setError(t.gateSearchError);
    } finally {
      setLoading(false);
      setIsSearchingById(false);
    }
  };

  const handleSelectVisitor = async (visitor) => {
    const mapped = mapRegistration(visitor);
    setResult(mapped);
    setSearchResults([]);
    if (
      visitor.id &&
      ["checked_in", "checked_out", "visit_ended"].includes(visitor.status)
    ) {
      const logs = await getRegistrationActivityLogs(visitor.id);
      setActivityLogs(Array.isArray(logs) ? logs : []);
    } else {
      setActivityLogs([]);
    }
  };

  const openInternalNoteDialog = () => {
    if (!result?.id) return;
    setInternalNoteDraft(
      result.internal_note ?? result.internalNote ?? "",
    );
    setInternalNoteDialogOpen(true);
  };

  const handleSaveInternalNote = async () => {
    if (!result?.id) return;
    setInternalNoteSaving(true);
    try {
      const res = await updateInternalNote(
        result.id,
        internalNoteDraft.trim() || "",
      );
      if (res?.error) return;
      const saved = (res?.internalNote ?? internalNoteDraft.trim()) || null;
      setResult((prev) =>
        prev
          ? { ...prev, internal_note: saved, internalNote: saved }
          : prev,
      );
      setInternalNoteDraft(saved || "");
      setInternalNoteDialogOpen(false);
      showMessage(t.gateNoteSaved || "Internal note saved", "success");
    } catch (e) {
      showMessage(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to save internal note",
        "error",
      );
    } finally {
      setInternalNoteSaving(false);
    }
  };

  const handleScanSuccess = useCallback(
    async (scanned) => {
      if (scanningRef.current) return;
      scanningRef.current = true;
      setShowScanner(false);
      await doVerify(scanned);
      setTimeout(() => {
        scanningRef.current = false;
      }, 600);
    },
    [doVerify],
  );

  const selfInitiatedRef = useRef(null);

  const handleCheckInAction = async () => {
    if (!result?.id) return;
    setActionLoading(true);
    selfInitiatedRef.current = { id: result.id, status: "checked_in" };
    try {
      const updated = await updateStatus(result.id, {
        status: "checked_in",
        clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      if (!updated?.error) {
        setResult((prev) => ({
          ...prev,
          status: updated?.status || "checked_in",
        }));
        const logs = await getRegistrationActivityLogs(result.id);
        setActivityLogs(Array.isArray(logs) ? logs : []);
        flagIfOutsideHours("check_in");
      }
    } finally {
      setActionLoading(false);
      setTimeout(() => {
        selfInitiatedRef.current = null;
      }, 5000);
    }
  };

  const handleVipRevisit = async () => {
    if (!result?.id) return;
    setActionLoading(true);
    try {
      const newReg = await createVipRevisit(result.id);
      if (newReg && !newReg.error) {
        const mapped = mapRegistration(newReg);
        setResult(mapped);
        const logs = await getRegistrationActivityLogs(newReg.id);
        if (Array.isArray(logs)) setActivityLogs(logs);
        showMessage(t.gateVipCheckedIn, "success");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOutAction = async () => {
    if (!result?.id) return;
    setActionLoading(true);
    selfInitiatedRef.current = { id: result.id, status: "checked_out" };
    try {
      const updated = await updateStatus(result.id, {
        status: "checked_out",
        clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      if (!updated?.error) {
        // Update self-initiated ref with actual backend status (may be visit_ended if auto-ended)
        if (updated?.status) {
          selfInitiatedRef.current = { id: result.id, status: updated.status };
        }
        setResult((prev) => ({
          ...prev,
          status: updated?.status || "checked_out",
        }));
        const logs = await getRegistrationActivityLogs(result.id);
        setActivityLogs(Array.isArray(logs) ? logs : []);
        flagIfOutsideHours("check_out");
        setIdVerified(false);
      }
    } finally {
      setActionLoading(false);
      setTimeout(() => {
        selfInitiatedRef.current = null;
      }, 5000);
    }
  };

  // ── Approve dialog state (ported from CMS visits) ──
  const [approveTarget, setApproveTarget] = useState(null);
  const [approvePastVisits, setApprovePastVisits] = useState(null);
  const [pastVisitsOpen, setPastVisitsOpen] = useState(false);
  const [scheduledDate, setScheduledDate] = useState(null);
  const [scheduledFrom, setScheduledFrom] = useState("");
  const [scheduledTo, setScheduledTo] = useState("");
  const [scheduleType, setScheduleType] = useState("custom");
  const [selectedPreset, setSelectedPreset] = useState("fullDay");
  const [dayTypeTab, setDayTypeTab] = useState("working");
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
  const [accessLevels, setAccessLevels] = useState([]);
  const [submitting, setSubmitting] = useState(false);

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

  // ── Time selection helpers (from CMS visits) ──
  const getAllowedHours12 = () =>
    Array.from({ length: 24 }, (_, h24) => ({
      h24,
      h12: h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24,
      ampm: h24 < 12 ? "AM" : "PM",
    }));

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
    const allowedHours = [
      ...new Map(rawHours.map((h) => [h.h12, h])).values(),
    ].sort((a, b) => (a.h12 === 12 ? 13 : a.h12) - (b.h12 === 12 ? 13 : b.h12));
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
        <Stack direction="row" sx={{ gap: 0.5 }} dir="ltr">
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
              {t.bookingHr}
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
              {allowedHours.map(({ h12 }) => (
                <MenuItem key={h12} value={h12} sx={{ fontSize: "0.75rem" }}>
                  {h12}
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
              {t.bookingMin}
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
              {t.bookingAmPm}
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
              {PERIOD_VALUES.map((p) => (
                <MenuItem key={p} value={p} sx={{ fontSize: "0.75rem" }}>
                  {lang === "ar" ? (p === "AM" ? "ص" : "م") : p}
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
  // schedule currently selected in the dialog, so the gate warns the same way the
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
          ? t.approveDialogOutsideWorkingDaysWithDays.replace("{{days}}", info.offDays.map((d) => DAY_LABELS[d]).join(", "))
          : t.approveDialogOutsideWorkingDays,
      );
    }
    if (info.outsideHours) {
      parts.push(t.approveDialogOutsideWorkingHours);
    }

    const joined = parts.reduce(
      (acc, part, i) => (
        <Fragment key={i}>
          {acc}
          {i > 0 ? t.approveDialogOutsideWorkingAnd : null}
          {part}
        </Fragment>
      ),
      null,
    );
    const [before, , after] = t.approveDialogOutsideWorkingWarning.split("{{parts}}");

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
            {before}
            {joined}
            {after}
          </Typography>
        </Stack>
      </Box>
    );
  };

  // ── Approve flow (ported from CMS visits) ──
  const openApprove = async () => {
    if (!result?.id) return;
    try {
      if (canApproveStatus && accessLevels.length === 0) {
        try {
          const levels = await getAccessLevels(true);
          setAccessLevels(Array.isArray(levels) ? levels : []);
        } catch {}
      }

      let fullReg = result;
      try {
        const fetched = await getRegistrationById(result.id);
        if (fetched && !fetched.error) fullReg = fetched;
      } catch {}

      // For admin_approved registrations (final approval at the gate),
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
      setApprovalInternalNote(fullReg?.internal_note ?? fullReg?.internalNote ?? "");
      const prefillVip = isAdminApproved ? (fullReg.is_vip ?? false) : false;
      setIsVip(prefillVip);
      setEscortRequired(
        isAdminApproved ? (fullReg.escort_required ?? true) : true,
      );
      setVipReason(prefillVip ? (fullReg.vip_reason ?? "") : "");
      setVipReasonError("");
      setAccessLevelError("");

      setApproveTarget({
        ...fullReg,
        _pendingStatus: "approved",
        _override: true,
      });
      // Fetch past-visit breakdown for returning visitor badge. The registration
      // being approved is excluded from every member's count. Group meetings
      // show a per-member breakdown instead of a summed count.
      try {
        setApprovePastVisits(
          await resolvePastVisitBreakdown(fullReg, getRegistrations),
        );
        setPastVisitsOpen(false);
      } catch {
        setApprovePastVisits(null);
      }
    } catch {
    }
  };

  const handleApprove = async () => {
    if (!approveTarget) return;
    if (!scheduledDate) {
      showMessage("Please select a date.", "warning");
      return;
    }
    if (!selectedAccessLevelIds.length) {
      setAccessLevelError("At least one access zone is required");
      return;
    }
    if (allowParking && !vehiclePlate.trim()) {
      setVehiclePlateError(
        "Vehicle plate number is required when parking is enabled",
      );
      return;
    }
    if (isVip && !vipReason.trim()) {
      setVipReasonError("A reason is required when marking a visitor as VIP");
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
        clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
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
          setResult((prev) =>
            prev?.id === approveTarget.id
              ? { ...prev, internal_note: saved, internalNote: saved }
              : prev,
          );
        } catch {
          // best-effort — the approval itself succeeded
        }
      }
      showMessage(t.gateResolveSuccess, "success");
      setApproveTarget(null);
      setApprovePastVisits(null);
      setEscortRequired(true);
      setResult((prev) => ({
        ...prev,
        status: approveResult?.status || "approved",
      }));
      const logs = await getRegistrationActivityLogs(approveTarget.id);
      setActivityLogs(Array.isArray(logs) ? logs : []);
    } catch (e) {
      showMessage(
        e?.response?.data?.message || e?.response?.data?.error || e?.message || "Approval failed",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const isAdminApprovedTarget =
    isSuperAdmin && approveTarget?.status === "admin_approved";
  const slotLabel = isAdminApprovedTarget ? t.approveDialogApprovedSlot : t.approveDialogRequestedSlot;
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
      ? `${formatDate(slotFrom)} ${t.approveDialogTo} ${formatDate(slotTo)}`
      : formatDate(slotFrom);
  })();
  const slotTimeText =
    getLocalTime(slotFrom) || getLocalTime(slotTo)
      ? `${slotFrom ? formatTime(slotFrom) : "-"} - ${slotTo ? formatTime(slotTo) : "-"}`
      : "-";

  const handlePrintBadge = async (registration) => {
    if (!registration?.qr_token) {
      showMessage(t.gateNoQrToken, "warning");
      return;
    }

    try {
      const qrCodeDataUrl = await QRCode.toDataURL(
        registration.qr_token || "N/A",
        {
          width: 300,
          margin: 1,
          color: { dark: "#000000", light: "#ffffff" },
        },
      );

      const buildBadgeData = (member) => ({
        fullName:
          member?.fullName ||
          registration.full_name ||
          registration.visitor?.fullName ||
          registration.user?.full_name ||
          "Unnamed Visitor",
        company:
          member?.companyName ||
          registration.organisation ||
          registration.companyName ||
          registration.company_name ||
          registration.visitor?.companyName ||
          registration.visitor?.organisation ||
          registration.user?.companyName ||
          registration.user?.company_name ||
          "",
        email:
          member?.email ||
          registration.email ||
          registration.visitor?.email ||
          registration.user?.email ||
          "",
        phone:
          member?.phone ||
          registration.phone ||
          registration.visitor?.phone ||
          registration.user?.phone ||
          "",
        purposeOfVisit: registration.purpose_of_visit || "",
        hostName: registration.host_name || "",
        requestedDate: registration.requested_from
          ? formatDate(registration.requested_from)
          : "",
        requestedTimeFrom: registration.requested_from
          ? formatTime(registration.requested_from)
          : "",
        requestedTimeTo: registration.requested_to
          ? formatTime(registration.requested_to)
          : "",
        badgeIdentifier: registration.badge_identifier || "",
        token: registration.qr_token || "N/A",
        showQrOnBadge: true,
        fieldValues: registration.fieldValues || {},
      });

      // Group meeting → one badge per member (like the CMS visits card print)
      const participants =
        Array.isArray(registration.participants) &&
        registration.participants.length > 1
          ? registration.participants
          : null;
      const doc = participants ? (
        <Document>
          {participants.map((m) => (
            <BadgePDF
              key={m.id}
              data={buildBadgeData(m)}
              qrCodeDataUrl={qrCodeDataUrl}
              customizations={badgeTemplate?.layoutJson}
              single={false}
            />
          ))}
        </Document>
      ) : (
        <BadgePDF
          data={buildBadgeData(null)}
          qrCodeDataUrl={qrCodeDataUrl}
          customizations={badgeTemplate?.layoutJson}
        />
      );
      const blob = await pdf(doc).toBlob();
      const blobUrl = URL.createObjectURL(blob);

      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

      if (isMobile) {
        const printWindow = window.open(blobUrl, "_blank");
        if (!printWindow) {
          showMessage(t.gateAllowPopups, "warning");
          return;
        }
        return;
      }

      const width = Math.floor(window.outerWidth * 0.9);
      const height = Math.floor(window.outerHeight * 0.9);
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const printWindow = window.open(
        "",
        "_blank",
        `width=${width},height=${height},left=${left},top=${top},resizable=no,scrollbars=no,status=no`,
      );

      if (!printWindow) {
        showMessage(t.gateAllowPopups, "warning");
        return;
      }

      printWindow.document.write(`
        <html>
          <head>
            <title>Print Badge - ${
              registration.full_name || "Badge"
            }</title>
            <style>
              html, body {
                margin: 0;
                padding: 0;
                height: 100%;
                overflow: hidden;
                background: #fff;
              }
              iframe {
                width: 100%;
                height: 100%;
                border: none;
              }
            </style>
          </head>
          <body>
            <iframe
              src="${blobUrl}"
              onload="this.contentWindow.focus(); this.contentWindow.print();"
            ></iframe>
          </body>
        </html>
      `);
      printWindow.document.close();
      markBadgesPrinted([registration?.id]).catch(() => {});
    } catch (err) {
      console.error("Print error:", err);
      showMessage(t.gatePrintFailed, "error");
    }
  };

  const flagIfOutsideHours = (type) => {
    if (!workingHours?.enabled) return;
    const localHour = new Date().getHours();
    if (localHour < workingHours.start || localHour >= workingHours.end) {
      setOutsideHoursWarning(type);
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
    setShowScanner(false);
    setScannerFailed(false);
    setOutsideHoursWarning(null);
    setIdVerified(false);
    setShowIdVerifyDialog(false);
  };

  const { on } = useSocket();
  // Ref keeps the current registration ID always up-to-date inside the socket
  const currentRegistrationIdRef = useRef(null);
  const currentRegistrationStatusRef = useRef(null);
  useEffect(() => {
    currentRegistrationIdRef.current = result?.id ?? null;
    currentRegistrationStatusRef.current = result?.status ?? null;
  }, [result?.id, result?.status]);

  useEffect(() => {
    setIdVerified(false);
  }, [result?.id]);

  // Derive resolvedId at component level so auto check-in effects can use it
  const resolvedId = useMemo(() => {
    if (!result) return null;
    const fvs = Array.isArray(result.fieldValues)
      ? result.fieldValues
      : Array.isArray(result.visitor?.fieldValues)
        ? result.visitor.fieldValues
        : [];
    const nk = (v) =>
      String(v ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
    const rv = (v) => {
      if (v == null || v === "") return null;
      if (typeof v === "object") return v.name || v.label || v.value || null;
      return String(v);
    };
    const find = (aliases) => {
      const norm = aliases.map(nk);
      const m = fvs.find(
        (fv) =>
          norm.includes(
            nk(fv?.customField?.fieldKey || fv?.customField?.name),
          ) || norm.includes(nk(fv?.customField?.label)),
      );
      return rv(m?.value);
    };
    const idType = find([
      "idtype",
      "identificationtype",
      "documenttype",
      "doctype",
    ]);
    const omanId = find([
      "omanid",
      "nationalid",
      "civilid",
      "idcardnumber",
      "idnumber",
      "idno",
    ]);
    const passport = find(["passport", "passportnumber", "passportno"]);
    const nkIdType = nk(idType || "");
    if (nkIdType.includes("passport") && (passport || omanId))
      return { type: "Passport", value: passport || omanId };
    if (omanId)
      return {
        type: nkIdType.includes("passport") ? "Passport" : "ID",
        value: omanId,
      };
    if (passport) return { type: "Passport", value: passport };
    return null;
  }, [result]);

  // Auto check-in: visitor scanned — open ID verification prompt if needed
  useEffect(() => {
    if (!result || result.status !== "approved") return;
    if (!canCheckin) return;
    if (result.is_vip_fast_track || result.isVipFastTrack) return;
    if (!result.approved_from) {
      if (resolvedId && !idVerified) {
        setShowIdVerifyDialog(true);
      } else {
        handleCheckInAction();
      }
      return;
    }
    const bufferMs = (workingHours?.checkInBufferMinutes ?? 60) * 60 * 1000;
    const now = Date.now();
    const approvedFromMs = new Date(result.approved_from).getTime();
    const approvedToMs = result.approved_to
      ? new Date(result.approved_to).getTime()
      : Number.POSITIVE_INFINITY;
    if (now >= approvedFromMs - bufferMs && now <= approvedToMs + bufferMs) {
      if (resolvedId && !idVerified) {
        setShowIdVerifyDialog(true);
      } else {
        handleCheckInAction();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result?.id]);

  // Auto check-in: fires the moment ID is ticked green
  useEffect(() => {
    if (!idVerified || !result || result.status !== "approved") return;
    if (!canCheckin) return;
    if (result.is_vip_fast_track || result.isVipFastTrack) return;
    if (!result.approved_from) {
      handleCheckInAction();
      return;
    }
    const bufferMs = (workingHours?.checkInBufferMinutes ?? 60) * 60 * 1000;
    const now = Date.now();
    const approvedFromMs = new Date(result.approved_from).getTime();
    const approvedToMs = result.approved_to
      ? new Date(result.approved_to).getTime()
      : Number.POSITIVE_INFINITY;
    if (now >= approvedFromMs - bufferMs && now <= approvedToMs + bufferMs) {
      handleCheckInAction();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idVerified]);

  useEffect(() => {
    const unsub = on("registration:updated", (updatedReg) => {
      // Ignore events that don't belong to the registration currently on screen.
      if (
        !currentRegistrationIdRef.current ||
        currentRegistrationIdRef.current !== updatedReg.id
      )
        return;

      const isAccessible = ["approved", "checked_in", "checked_out"].includes(
        updatedReg.status,
      );
      const mappedReg = {
        ...mapRegistration(updatedReg),
        notApproved: !isAccessible,
      };
      setResult(mappedReg);

      // Fetch activity logs for timestamps (check-in, check-out, visit-ended)
      if (
        ["checked_in", "checked_out", "visit_ended"].includes(updatedReg.status)
      ) {
        getRegistrationActivityLogs(updatedReg.id).then((logs) => {
        if (Array.isArray(logs)) setActivityLogs(logs);
        });
      }

      const isSelfEcho =
        selfInitiatedRef.current?.id === updatedReg.id &&
        selfInitiatedRef.current?.status === updatedReg.status;

      const statusActuallyChanged =
        updatedReg.status !== currentRegistrationStatusRef.current;

      if (isSelfEcho) {
        selfInitiatedRef.current = null;
      } else if (statusActuallyChanged) {
        showMessage(t.gateStatusUpdatedByOther, "info");
      }
    });

    const unsubOverstay = on("overstay:alert", (data) => {
      if (!data?.registrationId) return;
      if (currentRegistrationIdRef.current !== data.registrationId) return;
      // Update overstay flag on current result and refresh activity logs
      setResult((prev) => (prev ? { ...prev, overstay: true } : prev));
      getRegistrationActivityLogs(data.registrationId).then((logs) => {
        if (Array.isArray(logs)) setActivityLogs(logs);
      });
    });

    return () => {
      unsub?.();
      unsubOverstay?.();
    };
  }, [on, showMessage, t]);

  const sc = result
    ? STATUS_CONFIG[result.status] || { color: "default" }
    : null;
  const scLabel = sc ? (sc.labelKey ? t[sc.labelKey] : result.status) : null;

  if (todayView) {
    return (
      <RoleGuard allowedRoles={["staff"]} allowedStaffTypes={["gate"]}>
        <GateTodayView
          onBack={() => setTodayView(false)}
          canCheckin={canCheckin}
          canCheckout={canCheckout}
        />
      </RoleGuard>
    );
  }

  if (assemblyMode) {
    const total = assemblyVisitors.length;
    const accounted = accountedIds.size;
    const remaining = total - accounted;
    const progress = total > 0 ? Math.round((accounted / total) * 100) : 0;
    const allAccounted = total > 0 && accounted === total;

    const query = assemblySearch.trim().toLowerCase();
    const matchesQuery = (v) => {
      if (!query) return true;
      const name = v.full_name || v.visitor?.fullName || "";
      const company =
        v.organisation || v.visitor?.organisation || v.visitor?.companyName || "";
      const dept = v.department?.name || v.visitor?.department || "";
      return `${name} ${company} ${dept}`.toLowerCase().includes(query);
    };
    // Unaccounted visitors first — they are the ones staff is looking for
    const visibleVisitors = assemblyVisitors
      .filter(matchesQuery)
      .sort(
        (a, b) => Number(accountedIds.has(a.id)) - Number(accountedIds.has(b.id)),
      );

    return (
      <RoleGuard allowedRoles={["staff"]} allowedStaffTypes={["gate"]}>
        <Box sx={{ px: { xs: 2, sm: 3 }, py: 3, ...getStartIconSpacing(dir) }}>
          {/* Emergency header with exit action */}
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2, sm: 2.5 },
              mb: 2.5,
              borderRadius: 3,
              bgcolor: "error.main",
              color: "#fff",
            }}
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              alignItems={{ xs: "flex-start", sm: "center" }}
              justifyContent="space-between"
              spacing={1.5}
            >
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <ICONS.warning sx={{ fontSize: 28 }} />
                <Box>
                  <Typography variant="h6" fontWeight={800} sx={{ letterSpacing: 1, lineHeight: 1.2 }}>
                    {t.assemblyTitle}
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.9 }}>
                    {t.assemblySubtitle}
                  </Typography>
                </Box>
              </Stack>
              <Button
                variant="contained"
                startIcon={<ICONS.close />}
                onClick={exitAssemblyMode}
                sx={{
                  bgcolor: "#fff",
                  color: "error.main",
                  fontWeight: 700,
                  borderRadius: 2,
                  whiteSpace: "nowrap",
                  alignSelf: { xs: "stretch", sm: "auto" },
                  "&:hover": { bgcolor: "rgba(255,255,255,0.85)" },
                }}
              >
                {t.assemblyExit}
              </Button>
            </Stack>
          </Paper>

          {/* Roll-call progress */}
          <Paper
            elevation={0}
            variant="frosted"
            sx={{ p: 2.5, mb: 2.5, borderRadius: 3 }}
          >
            <Stack direction="row" spacing={3} mb={1.5}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h4" fontWeight={800} color="success.main">
                  {accounted}
                </Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  {t.assemblyAccountedFor}
                </Typography>
              </Box>
              <Divider orientation="vertical" flexItem />
              <Box sx={{ flex: 1 }}>
                <Typography
                  variant="h4"
                  fontWeight={800}
                  color={remaining > 0 ? "warning.main" : "text.disabled"}
                >
                  {remaining}
                </Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  {t.assemblyRemaining}
                </Typography>
              </Box>
              <Divider orientation="vertical" flexItem />
              <Box sx={{ flex: 1 }}>
                <Typography variant="h4" fontWeight={800}>
                  {total}
                </Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  {t.todayTotal}
                </Typography>
              </Box>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={progress}
              color={allAccounted ? "success" : "warning"}
              sx={{ borderRadius: 2, height: 8 }}
            />
            {allAccounted && (
              <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 1.25 }}>
                <ICONS.checkCircle sx={{ fontSize: 18, color: "success.main" }} />
                <Typography variant="body2" color="success.main" fontWeight={700}>
                  {t.assemblyAllAccounted}
                </Typography>
              </Stack>
            )}
          </Paper>

          {/* Visitor roll-call list */}
          {assemblyLoading ? (
            <Box sx={{ textAlign: "center", py: 6 }}>
              <CircularProgress color="error" />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                {t.assemblyLoading}
              </Typography>
            </Box>
          ) : total === 0 ? (
            <Paper
              elevation={0}
              variant="frosted"
              sx={{ p: 4, borderRadius: 3, textAlign: "center" }}
            >
              <ICONS.checkCircle
                sx={{ fontSize: 48, color: "success.main", mb: 1 }}
              />
              <Typography fontWeight={700} color="success.main">
                {t.assemblyNoneInside}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.5 }}
              >
                {t.assemblyFacilityClear}
              </Typography>
            </Paper>
          ) : (
            <>
              <TextField
                fullWidth
                size="small"
                placeholder={t.assemblySearchPlaceholder}
                value={assemblySearch}
                onChange={(e) => setAssemblySearch(e.target.value)}
                sx={{
                  mb: 2,
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 3,
                    bgcolor: isDark
                      ? "rgba(255,255,255,0.03)"
                      : "rgba(0,0,0,0.02)",
                  },
                }}
              />
              {visibleVisitors.length === 0 ? (
                <Paper
                  elevation={0}
                  variant="frosted"
                  sx={{ p: 3, borderRadius: 3, textAlign: "center" }}
                >
                  <Typography variant="body2" color="text.secondary">
                    {t.assemblyNoMatches}
                  </Typography>
                </Paper>
              ) : (
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      sm: "repeat(auto-fill, minmax(280px, 1fr))",
                    },
                    gap: 1.5,
                  }}
                >
                  {visibleVisitors.map((v) => {
                    const isAccounted = accountedIds.has(v.id);
                    const name =
                      v.full_name || v.visitor?.fullName || t.gateVisitor;
                    const company =
                      v.organisation ||
                      v.visitor?.organisation ||
                      v.visitor?.companyName ||
                      null;
                    const dept =
                      v.department?.name || v.visitor?.department || null;
                    const accessZones = v.access_levels?.length
                      ? v.access_levels
                          .map((al) => al.name)
                          .filter(Boolean)
                          .join(", ")
                      : v.access_level?.name || v.visitor?.accessLevel || null;
                    const subtitle = [company, dept, accessZones]
                      .filter(Boolean)
                      .join(" · ");

                    return (
                      <Paper
                        key={v.id}
                        elevation={0}
                        variant="frosted"
                        onClick={() => toggleAccounted(v.id)}
                        sx={{
                          p: 2,
                          borderRadius: 3,
                          border: "2px solid",
                          borderColor: isAccounted
                            ? "success.main"
                            : "warning.main",
                          bgcolor: isAccounted
                            ? isDark
                              ? "rgba(46,125,50,0.15)"
                              : "rgba(46,125,50,0.06)"
                            : "background.paper",
                          cursor: "pointer",
                          userSelect: "none",
                          transition: "all 0.15s",
                          display: "flex",
                          alignItems: "center",
                          gap: 2,
                          "&:active": { transform: "scale(0.99)" },
                        }}
                      >
                        <Box
                          sx={{
                            width: 28,
                            height: 28,
                            borderRadius: 1,
                            flexShrink: 0,
                            border: "2px solid",
                            borderColor: isAccounted
                              ? "success.main"
                              : "warning.main",
                            bgcolor: isAccounted ? "success.main" : "transparent",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {isAccounted && (
                            <ICONS.check sx={{ fontSize: 20, color: "#fff" }} />
                          )}
                        </Box>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography fontWeight={700} noWrap>
                            {name}
                          </Typography>
                          {subtitle && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ display: "block", lineHeight: 1.4 }}
                              noWrap
                            >
                              {subtitle}
                            </Typography>
                          )}
                        </Box>
                        <Typography
                          variant="caption"
                          fontWeight={800}
                          color={isAccounted ? "success.main" : "warning.main"}
                          sx={{ flexShrink: 0 }}
                        >
                          {isAccounted ? t.assemblyAccounted : t.assemblyMarkSafe}
                        </Typography>
                      </Paper>
                    );
                  })}
                </Box>
              )}
            </>
          )}
        </Box>
      </RoleGuard>
    );
  }

  return (
    <RoleGuard allowedRoles={["staff"]} allowedStaffTypes={["gate"]}>
      <Container maxWidth="sm">
        <Box
          sx={{
            py: 4,
            ...getStartIconSpacing(dir),
            ...getChipIconSpacing(dir),
          }}
        >
          {!canRead ? (
            <Box sx={{ textAlign: "center", py: 8 }}>
              <Typography variant="h5" fontWeight={700} color="text.secondary">
                {t.gateAccessDenied}
              </Typography>
              <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
                {t.gateAccessDeniedDesc}
              </Typography>
            </Box>
          ) : (
            <>
          <Typography
            variant="h4"
            fontWeight={800}
            gutterBottom
            textAlign="center"
            color="primary.main"
           
          >
            {t.gateTitle}
          </Typography>
          <Typography color="text.secondary" textAlign="center" sx={{ mb: 4 }}>
            {t.gateSubtitle}
          </Typography>

          {/* Offline banner */}
          {!isOnline && (
            <Alert
              severity="error"
              icon={<ICONS.wifiOff />}
              sx={{ mb: 3, borderRadius: 2, fontWeight: 600 }}
            >
              {t.gateOffline}
            </Alert>
          )}

          {/* Search by ID functionality */}
          <Box component="form" onSubmit={handleIdSearch} sx={{ mb: 4 }}>
            {scannerFailed && (
              <Alert
                severity="warning"
                onClose={() => setScannerFailed(false)}
                sx={{ mb: 1.5, borderRadius: 2 }}
              >
                {t.gateScannerUnavailable}
              </Alert>
            )}
            <Stack direction="row" spacing={2} alignItems="center" useFlexGap>
              <TextField
                fullWidth
                size="small"
                placeholder={t.gateSearchPlaceholder}
                value={idSearch}
                onChange={(e) => setIdSearch(e.target.value)}
                inputProps={{ inputMode: "text" }}
                inputRef={idSearchRef}
                disabled={loading}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 3,
                    bgcolor: isDark
                      ? "rgba(255,255,255,0.03)"
                      : "rgba(0,0,0,0.02)",
                  },
                }}
              />
              <Button
                variant="contained"
                onClick={handleIdSearch}
                disabled={loading || !idSearch.trim()}
                sx={{ borderRadius: 3, px: 3, minWidth: 100 }}
              >
                {isSearchingById && loading ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  t.gateSearch
                )}
              </Button>
            </Stack>
          </Box>

          <Box
            sx={{
              minHeight: "calc(90vh - 350px)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-start",
              alignItems: "center",
            }}
          >
            {!showScanner &&
              !loading &&
              !result &&
              !error &&
              searchResults.length > 0 && (
                <Box sx={{ width: "100%", mt: 2 }}>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    {t.gateMultipleMatches}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 3 }}
                  >
                    {t.gateMultipleMatchesDesc}
                  </Typography>
                  <Stack spacing={2}>
                    {searchResults.map((visitor) => (
                      <Paper
                        key={visitor.id}
                        elevation={0}
                        variant="frosted"
                        sx={{
                          p: 2,
                          borderRadius: 3,
                          cursor: "pointer",
                          transition: "all 0.2s",
                          border: "1px solid",
                          borderColor: isDark
                            ? "rgba(255,255,255,0.05)"
                            : "rgba(0,0,0,0.05)",
                          "&:hover": {
                            bgcolor: isDark
                              ? "rgba(255,255,255,0.05)"
                              : "rgba(0,0,0,0.03)",
                            transform: "translateY(-2px)",
                            borderColor: theme.palette.primary.main,
                          },
                        }}
                        onClick={() => handleSelectVisitor(visitor)}
                      >
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                        >
                          <Box>
                            <Typography sx={{ fontWeight: 600 }}>
                              {visitor.full_name && visitor.full_name !== "N/A"
                                ? visitor.full_name
                                : visitor.visitor?.fullName || t.gateVisitor}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {visitor.organisation &&
                              visitor.organisation !== "N/A"
                                ? visitor.organisation
                                : visitor.visitor?.organisation !== "N/A"
                                  ? visitor.visitor?.organisation
                                  : t.gateNoOrganization}
                              {" • "}
                              {visitor.department?.name ||
                                visitor.visitor?.department ||
                                t.gateNoDepartment}
                            </Typography>
                          </Box>
                          <Box sx={{ textAlign: "right" }}>
                            <Chip
                              label={
                                STATUS_CONFIG[visitor.status]
                                  ? t[STATUS_CONFIG[visitor.status].labelKey]
                                  : visitor.status
                              }
                              color={
                                STATUS_CONFIG[visitor.status]?.color ||
                                "default"
                              }
                              icon={STATUS_CONFIG[visitor.status]?.icon}
                              size="small"
                              sx={{ borderRadius: 1 }}
                            />
                            {visitor.overstay && (
                              <Chip
                                label={t.gateOverstay}
                                color="error"
                                size="small"
                                sx={{
                                  borderRadius: 1,
                                  ml: 0.5,
                                  fontWeight: 800,
                                }}
                              />
                            )}
                          </Box>
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                  <Button
                    fullWidth
                    variant="outlined"
                    sx={{ mt: 4, borderRadius: 3 }}
                    onClick={() => setSearchResults([])}
                  >
                    {t.gateClearResults}
                  </Button>
                </Box>
              )}

            {!showScanner &&
              !loading &&
              !result &&
              !error &&
              searchResults.length === 0 && (
                <Paper
                  elevation={0}
                  variant="frosted"
                  sx={{
                    p: 4,
                    borderRadius: 4,
                    textAlign: "center",
                    width: "100%",
                  }}
                >
                  <Box
                    sx={{
                      width: 72,
                      height: 72,
                      borderRadius: 3,
                      bgcolor: isDark
                        ? "rgba(255,255,255,0.07)"
                        : "rgba(0,0,0,0.05)",
                      boxShadow: isDark
                        ? "inset 0 1px 0 rgba(255,255,255,0.06)"
                        : "none",
                      color: "text.primary",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      mx: "auto",
                      mb: 3,
                    }}
                  >
                    <ICONS.qrCodeScanner sx={{ fontSize: 40 }} />
                  </Box>

                  <Stack spacing={2}>
                    <Button
                      variant="contained"
                      size="large"
                      fullWidth
                      startIcon={<ICONS.qrCodeScanner />}
                      onClick={() => setShowScanner(true)}
                      disabled={!isOnline}
                      sx={{ py: 1.8, borderRadius: 3, fontSize: "1.1rem" }}
                    >
                      {t.gateQrCheckin}
                    </Button>
                    {canVipBypass && (
                      <Button
                        variant="outlined"
                        fullWidth
                        startIcon={<ICONS.key />}
                        onClick={() => setVipModalOpen(true)}
                        sx={{ py: 1.5, borderRadius: 3 }}
                      >
                        {t.gateVipFastTrack}
                      </Button>
                    )}
                    {canTodayVisitors && (
                      <Button
                        variant="outlined"
                        fullWidth
                        startIcon={<ICONS.event />}
                        onClick={() => setTodayView(true)}
                        sx={{ py: 1.5, borderRadius: 3 }}
                      >
                        {t.gateTodaysVisitors}
                      </Button>
                    )}
                    <Button
                      variant="outlined"
                      fullWidth
                      color="error"
                      startIcon={<ICONS.warning />}
                      onClick={enterAssemblyMode}
                      sx={{ py: 1.5, borderRadius: 3 }}
                    >
                      {t.gateAssemblyMode}
                    </Button>
                  </Stack>
                </Paper>
              )}

            {showScanner && (
              <QrScanner
                onScanSuccess={handleScanSuccess}
                onCancel={() => setShowScanner(false)}
                onError={(err) => {
                  showMessage(err, "error");
                  setShowScanner(false);
                  setScannerFailed(true);
                  setTimeout(() => idSearchRef.current?.focus(), 100);
                }}
              />
            )}

            <VipFastTrackModal
              open={vipModalOpen}
              onClose={() => setVipModalOpen(false)}
              onCheckedIn={() => setVipModalOpen(false)}
            />

            <Dialog
              open={internalNoteDialogOpen}
              onClose={() => {
                if (internalNoteSaving) return;
                setInternalNoteDraft(
                  result?.internal_note || result?.internalNote || "",
                );
                setInternalNoteDialogOpen(false);
              }}
              maxWidth="sm"
              fullWidth
              PaperProps={{
                sx: { borderRadius: 4, overflow: "hidden" },
              }}
            >
              <DialogHeader
                title={t.gateEditInternalNote || "Edit Internal Note"}
                align={dir === "rtl" ? "right" : "left"}
                onClose={() => {
                  if (internalNoteSaving) return;
                  setInternalNoteDraft(
                    result?.internal_note || result?.internalNote || "",
                  );
                  setInternalNoteDialogOpen(false);
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
                  dir="auto"
                  placeholder={
                    t.gateInternalNotePlaceholder ||
                    "Private note for staff only — never shared with the visitor."
                  }
                  value={internalNoteDraft}
                  onChange={(e) => setInternalNoteDraft(e.target.value)}
                  disabled={internalNoteSaving}
                  sx={{
                    "& .MuiOutlinedInput-root": { borderRadius: 2 },
                  }}
                />
              </DialogContent>
              <Divider />
              <DialogActions
                disableSpacing
                sx={{
                  p: 2.5,
                  justifyContent: "flex-end",
                  gap: 1,
                  ...getStartIconSpacing(dir),
                }}
              >
                <Button
                  variant="outlined"
                  size="small"
                  disabled={internalNoteSaving}
                  onClick={() => {
                    setInternalNoteDraft(
                      result?.internal_note || result?.internalNote || "",
                    );
                    setInternalNoteDialogOpen(false);
                  }}
                  startIcon={<ICONS.cancel fontSize="small" />}
                  sx={{ borderRadius: 30 }}
                >
                  {t.gateCancelInternalNote || "Cancel"}
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  disabled={
                    internalNoteSaving ||
                    internalNoteDraft.trim() ===
                      (result?.internal_note || result?.internalNote || "")
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
                  {t.gateSaveInternalNote || "Save"}
                </Button>
              </DialogActions>
            </Dialog>

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
                  isSuperAdmin && approveTarget?.status === "admin_approved"
                    ? t.approveDialogFinalTitle
                    : t.approveDialogTitle
                }
                onClose={() => {
                  setApproveTarget(null);
                  setApprovePastVisits(null);
                  setEscortRequired(true);
                }}
              />
              <Divider />
              <DialogContent sx={{ p: 4, ...getChipIconSpacing(dir) }}>
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
                      useFlexGap
                      sx={{ justifyContent: "space-between" }}
                    >
                      <Stack direction="row" spacing={2} alignItems="center" useFlexGap>
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
                            {getRegistrationDisplayName(approveTarget, t.approveDialogNew)}
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
                              ? (dir === "rtl"
                                  ? t.approveDialogPastVisits.replace("{{count}}", approvePastVisits.breakdown[0].count)
                                  : `${t.approveDialogPastVisits.replace("{{count}}", approvePastVisits.breakdown[0].count)}${approvePastVisits.breakdown[0].count !== 1 ? "s" : ""}`)
                              : t.approveDialogNew
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
                          {t.approveDialogGroupPastVisits}
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
                            <Typography
                              variant="caption"
                              fontWeight={600}
                              sx={{
                                minWidth: 0,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {m.fullName || t.approveDialogGroupMember}
                            </Typography>
                            <Chip
                              size="small"
                              label={
                                m.count > 0
                                  ? (dir === "rtl"
                                      ? t.approveDialogPastVisits.replace("{{count}}", m.count)
                                      : `${t.approveDialogPastVisits.replace("{{count}}", m.count)}${m.count !== 1 ? "s" : ""}`)
                                  : t.approveDialogNew
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
                            {t.approveDialogPurpose}
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
                          {t.approveDialogVisitingDepartment}
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
                          const daysLabel = rDays
                            .map((d) => DAY_LABELS[d])
                            .join(", ");
                          const timeLabel =
                            rFrom && rTo ? `${rFrom} – ${rTo}` : null;
                          const label = [daysLabel, timeLabel]
                            .filter(Boolean)
                            .join("  ·  ");
                          return (
                            <Box>
                              <Typography variant="caption" color="text.secondary">
                                {t.approveDialogRecurring}
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
                                {t.approveDialogAccessZones}
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
                                {t.approveDialogMultiCheckin}
                              </Typography>
                              <Chip
                                label={
                                  approveTarget.allow_multi_checkin
                                    ? t.approveDialogAllowed
                                    : t.approveDialogNotAllowed
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
                          textAlign: dir === "rtl" ? { xs: "right", sm: "left" } : { xs: "left", sm: "right" },
                        }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          {slotLabel}
                        </Typography>
                        <Typography
                          variant="body2"
                          fontWeight={600}
                          dir={dir === "rtl" ? "ltr" : undefined}
                          sx={{ mt: 0.25, textAlign: dir === "rtl" ? "left" : undefined }}
                        >
                          {slotDateText}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          dir={dir === "rtl" ? "ltr" : undefined}
                          sx={{ mt: 0.25, textAlign: dir === "rtl" ? "left" : undefined }}
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
                    <InputLabel>{t.approveDialogAccessZones}</InputLabel>
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
                      <Stack direction="row" spacing={1} alignItems="center" useFlexGap>
                        <Typography variant="body2">
                          {t.approveDialogAllowMultipleCheckins}
                        </Typography>
                        <Chip
                          label={allowMultiCheckin ? t.approveDialogEnabled : t.approveDialogDisabled}
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
                      <Stack direction="row" spacing={1} alignItems="center" useFlexGap>
                        <Typography variant="body2">{t.approveDialogAllowParking}</Typography>
                        <Chip
                          label={allowParking ? t.approveDialogEnabled : t.approveDialogDisabled}
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
                      label={t.approveDialogVehiclePlateNumber}
                      placeholder={t.approveDialogVehiclePlatePlaceholder}
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
                      <Stack direction="row" spacing={1} alignItems="center" useFlexGap>
                        <Typography variant="body2">{t.approveDialogVip}</Typography>
                        <Chip
                          label={isVip ? t.approveDialogEnabled : t.approveDialogDisabled}
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
                      label={t.approveDialogVipReason}
                      placeholder={t.approveDialogVipReasonPlaceholder}
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
                      <Stack direction="row" spacing={1} alignItems="center" useFlexGap>
                        <Typography variant="body2">{t.approveDialogEscortRequired}</Typography>
                        <Chip
                          label={escortRequired ? t.approveDialogEnabled : t.approveDialogDisabled}
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
                    {t.approveDialogReviewSchedule}
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
                            label={t.approveDialogCustom}
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
                            label={t.approveDialogPreset}
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
                                t.approveDialogExpectedArrival,
                                true,
                              )}
                              {renderTimeDropdowns(
                                "scheduledTo",
                                t.approveDialogExpectedDeparture,
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
                                  {t.approveDialogVisitDuration.replace("{{min}}", getDuration())}
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
                                {t.approveDialogPresetType}
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
                                <MenuItem value="fullDay">{t.approveDialogFullDay}</MenuItem>
                                <MenuItem value="fullWeek">{t.approveDialogFullWeek}</MenuItem>
                                <MenuItem value="fullMonth">{t.approveDialogFullMonth}</MenuItem>
                                <MenuItem value="specificDays">
                                  {t.approveDialogSpecificDays}
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
                                  {t.approveDialogDateRange}
                                </Typography>
                                <Typography
                                  variant="body2"
                                  fontWeight={600}
                                  color="text.primary"
                                >
                                  {!scheduledDate
                                    ? t.approveDialogSelectDate
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
                                        return (
                                          <Box
                                            component="span"
                                            dir="ltr"
                                            sx={{ unicodeBidi: "isolate" }}
                                          >
                                            {`${from.format("DD MMMM YYYY, hh:mm A")} → ${to.format("DD MMMM YYYY, hh:mm A")}`}
                                          </Box>
                                        );
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
                                  onChange={(_, v) => applySchedule({ dayTypeTab: v })}
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
                                    {t.approveDialogFrom}{" "}
                                    <Box
                                      component="span"
                                      dir="ltr"
                                      sx={{ unicodeBidi: "isolate" }}
                                    >
                                      {scheduledDate?.format("DD MMM YYYY")}
                                    </Box>
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
                                {hostConfig && (() => {
                                  const fmtH12 = (h24, min) => {
                                    const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
                                    const ampm = h24 < 12 ? "AM" : "PM";
                                    return `${h12}:${String(min).padStart(2, "0")} ${ampm}`;
                                  };
                                  const s = fmtH12(fmtLocalWorkingHours(hostConfig).startH, fmtLocalWorkingHours(hostConfig).startM);
                                  const e = fmtH12(fmtLocalWorkingHours(hostConfig).endH, fmtLocalWorkingHours(hostConfig).endM);
                                  return (
                                    <Typography dir="ltr" variant="caption" color="info.main" sx={{ display: "block", mb: 0.75, fontSize: "0.68rem" }}>
                                      {t.bookingWorkingHoursInfo.replace("{{start}}", s).replace("{{end}}", e)}
                                    </Typography>
                                  );
                                })()}
                                <Stack spacing={2} sx={{ mb: 2 }}>
                                  {renderTimeDropdowns("scheduledFrom", t.approveDialogStartTime)}
                                  {renderTimeDropdowns("scheduledTo", t.approveDialogEndTime)}
                                </Stack>
                                {(() => {
                                  const mins = getDuration();
                                  if (mins <= 0) return null;
                                  return (
                                    <Box sx={{ p: 1.5, bgcolor: "background.paper", borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
                                      <Stack direction="row" spacing={1} alignItems="center">
                                        <ICONS.info sx={{ fontSize: 16, color: "text.secondary" }} />
                                        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ fontSize: 12 }}>
                                          {t.approveDialogVisitDuration.replace("{{min}}", mins)}
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
                    {t.approveDialogNote}{" "}
                    <Typography
                      component="span"
                      variant="caption"
                      color="text.secondary"
                    >
                      {t.approveDialogNoteOptional}
                    </Typography>
                  </Typography>
                  <TextField
                    fullWidth
                    multiline
                    minRows={2}
                    maxRows={5}
                    size="small"
                    placeholder={t.approveDialogNotePlaceholder}
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
                      {t.gateFieldInternalNote}{" "}
                      <Typography
                        component="span"
                        variant="caption"
                        color="text.secondary"
                      >
                        {t.approveDialogNoteOptional}
                      </Typography>
                    </Typography>
                    <TextField
                      fullWidth
                      multiline
                      minRows={2}
                      maxRows={5}
                      size="small"
                      placeholder={t.gateInternalNotePlaceholder}
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
                  sx={{ px: 3, fontWeight: 700, borderRadius: 30, width: { xs: "100%", sm: "auto" }, ...getStartIconSpacing(dir) }}
                >
                  {t.approveDialogCancel}
                </Button>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<ICONS.check />}
                  onClick={handleApprove}
                  disabled={!scheduledDate || submitting}
                  sx={{ borderRadius: 30, px: 4, fontWeight: 700, width: { xs: "100%", sm: "auto" }, ...getStartIconSpacing(dir) }}
                >
                  {isSuperAdmin ? t.approveDialogFinalApprove : t.approveDialogApprove}
                </Button>
              </DialogActions>
            </Dialog>

            {loading && <LoadingState cardMaxWidth={380} />}

            {result && (
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: 4,
                  border: `1px solid ${sc.color === "success" ? (isDark ? "rgba(46,125,50,0.5)" : "rgba(46,125,50,0.3)") : "divider"}`,
                  bgcolor: "background.paper",
                }}
              >
                <Stack direction="row" alignItems="center" spacing={2} mb={3} useFlexGap>
                  <Box
                    sx={{
                      bgcolor: `${sc.color}.main`,
                      color:
                        sc.color === "default"
                          ? isDark
                            ? "#fff"
                            : "rgba(0,0,0,0.7)"
                          : "#fff",
                      p: 1,
                      borderRadius: 2,
                      display: "flex",
                    }}
                  >
                    {sc.color === "success" ? (
                      <ICONS.checkCircle />
                    ) : sc.color === "error" ? (
                      <ICONS.errorOutline />
                    ) : ["visit_ended", "cancelled", "expired"].includes(
                        result.status,
                      ) ? (
                      <ICONS.logout />
                    ) : (
                      <ICONS.time />
                    )}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" fontWeight={700}>
                      {result.status === "visit_ended"
                        ? t.gateVisitConcluded
                        : result.status === "rejected"
                          ? t.gateVisitRejected
                          : result.status === "cancelled"
                            ? t.gateVisitCancelled
                            : result.status === "expired"
                              ? t.gateVisitExpired
                              : t.gateVerificationSuccess}
                    </Typography>
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      flexWrap="wrap"
                      useFlexGap
                    >
                      <Chip
                        label={scLabel}
                        color={sc.color}
                        size="small"
                        icon={sc.icon}
                        sx={{ fontWeight: 600 }}
                      />
                      {(result.is_vip_fast_track || result.isVipFastTrack) && (
                        <Chip
                          icon={<ICONS.star style={{ fontSize: 14 }} />}
                          label={t.gateVipFastTrack}
                          color="warning"
                          size="small"
                          sx={{ fontWeight: 800 }}
                        />
                      )}
                      {result.overstay && (
                        <Chip
                          label={t.gateOverstayDetected}
                          color="error"
                          size="small"
                          sx={{ fontWeight: 800 }}
                        />
                      )}
                      {(result.is_vip || result.isVip) && (
                        <Chip
                          icon={<ICONS.star style={{ fontSize: 14 }} />}
                          label={t.gateVip}
                          size="small"
                          sx={{
                            fontWeight: 800,
                            bgcolor: "success.main",
                            color: isDark ? "#000" : "#fff",
                            "& .MuiChip-icon": {
                              color: isDark ? "#000" : "#fff",
                            },
                          }}
                        />
                      )}
                      {(result.allow_parking || result.allowParking) && (
                        <Chip
                          icon={<ICONS.parking style={{ fontSize: 14 }} />}
                          label={t.gateParkingAllowed}
                          size="small"
                          sx={{
                            fontWeight: 800,
                            bgcolor: isDark ? "#CE93D8" : "#6A0DAD",
                            color: isDark ? "#000" : "#fff",
                            "& .MuiChip-icon": {
                              color: isDark ? "#000" : "#fff",
                            },
                          }}
                        />
                      )}
                      {(result.escort_required ??
                        result.escortRequired ??
                        true) && (
                        <Chip
                          icon={<ICONS.security style={{ fontSize: 14 }} />}
                          label={t.gateEscortRequired}
                          size="small"
                          sx={{
                            fontWeight: 800,
                            bgcolor: isDark ? "#FF8A65" : "#E64A19",
                            color: "#fff",
                            "& .MuiChip-icon": { color: "#fff" },
                          }}
                        />
                      )}
                    </Stack>
                  </Box>
                  {[
                    "admin_approved",
                    "approved",
                    "checked_in",
                    "checked_out",
                  ].includes(result.status) && (
                    <Tooltip title={t.gatePrintBadge}>
                      <IconButton
                        onClick={() => handlePrintBadge(result)}
                        sx={{ color: "success.main" }}
                      >
                        <ICONS.print />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>

                <Divider sx={{ mb: 2 }} />

                {outsideHoursWarning && (
                  <Alert
                    severity="warning"
                    icon={<ICONS.time fontSize="small" />}
                    sx={{ mb: 2, borderRadius: 2, fontWeight: 600 }}
                  >
                    {outsideHoursWarning === "check_in"
                      ? t.gateOutsideHoursCheckin
                      : t.gateOutsideHoursCheckout}
                  </Alert>
                )}
                {result.status === "pending" && (
                  <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
                    {t.gateNotYetApproved}
                  </Alert>
                )}
                {result.status === "visit_ended" &&
                  !(result.is_vip_fast_track || result.isVipFastTrack) && (
                    <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
                      {t.gateVisitConcludedInfo}
                    </Alert>
                  )}
                {result.status === "rejected" && (
                  <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                    {result.rejectionReason || result.rejection_reason
                      ? t.gateRejectedReason.replace(
                          "{{reason}}",
                          result.rejectionReason || result.rejection_reason,
                        )
                      : t.gateRejectedInfo}
                  </Alert>
                )}
                {result.status === "cancelled" && (
                  <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
                    {t.gateCancelledInfo}
                  </Alert>
                )}
                {result.status === "expired" && (
                  <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
                    {t.gateExpiredInfo}
                  </Alert>
                )}

                {/* Field Display Logic */}
                <List dense disablePadding>
                  {(() => {
                    const status = result.status;
                    const isPending = status === "pending";
                    const isApproved = ["approved", "admin_approved"].includes(
                      status,
                    );
                    const isCheckedIn = status === "checked_in";
                    const isCheckedOut = status === "checked_out";
                    const isEnded = status === "visit_ended";
                    const isRejected = status === "rejected";
                    const isCancelled = status === "cancelled";
                    const isExpired = status === "expired";
                    const fieldValues = Array.isArray(result.fieldValues)
                      ? result.fieldValues
                      : Array.isArray(result.visitor?.fieldValues)
                        ? result.visitor.fieldValues
                        : [];

                    const normalizeKey = (value) =>
                      String(value ?? "")
                        .toLowerCase()
                        .replace(/[^a-z0-9]/g, "");
                    const renderFieldValue = (value) => {
                      if (value == null || value === "") return null;
                      if (typeof value === "object") {
                        return (
                          value.name ||
                          value.label ||
                          value.value ||
                          JSON.stringify(value)
                        );
                      }
                      return String(value);
                    };
                    const findCustomFieldValue = (aliases) => {
                      const normalizedAliases = aliases.map(normalizeKey);
                      const match = fieldValues.find((fv) => {
                        const key = normalizeKey(
                          fv?.customField?.fieldKey || fv?.customField?.name,
                        );
                        const label = normalizeKey(fv?.customField?.label);
                        return (
                          normalizedAliases.includes(key) ||
                          normalizedAliases.includes(label)
                        );
                      });
                      return renderFieldValue(match?.value);
                    };

                    // Final field extraction with fallback to visitor summary
                    const visitorName =
                      findCustomFieldValue([
                        "fullname",
                        "name",
                        "visitorname",
                      ]) ||
                      result.visitor?.fullName ||
                      result.full_name ||
                      result.user?.fullName ||
                      "N/A";
                    const company =
                      findCustomFieldValue([
                        "company",
                        "organisation",
                        "organization",
                        "employer",
                        "firm",
                      ]) ||
                      result.visitor?.companyName ||
                      result.visitor?.organisation ||
                      result.organisation ||
                      result.companyName ||
                      result.user?.companyName ||
                      null;
                    const rawPurpose = findCustomFieldValue([
                      "purposeofvisit",
                      "purpose",
                      "visitpurpose",
                    ]);
                    const purpose =
                      (rawPurpose === "Other"
                        ? findCustomFieldValue([
                            "pleasespecify",
                            "specify",
                            "otherdetails",
                            "purposeotherdetails",
                          ]) || rawPurpose
                        : rawPurpose) ||
                      result.visitor?.purposeOfVisit ||
                      result.purpose_of_visit ||
                      null;
                    const department =
                      findCustomFieldValue([
                        "department",
                        "dept",
                        "division",
                        "unit",
                        "section",
                        "team",
                        "businessunit",
                      ]) ||
                      result.visitor?.department?.name ||
                      result.visitor?.department ||
                      result.department?.name ||
                      result.department ||
                      null;
                    const accessLevelsList = [
                      ...new Set(
                        [
                          ...(Array.isArray(result.access_levels)
                            ? result.access_levels
                            : []),
                          ...(Array.isArray(result.accessLevels)
                            ? result.accessLevels
                            : []),
                        ]
                          .map((al) => al?.name || al)
                          .filter(Boolean),
                      ),
                    ];
                    const accessLevel =
                      accessLevelsList.length
                        ? accessLevelsList.join(", ")
                        : (findCustomFieldValue([
                            "accesslevel",
                            "access level",
                            "access",
                            "clearance",
                            "securitylevel",
                            "badgelevel",
                            "accesstype",
                            "zone",
                          ]) ||
                          result.visitor?.accessLevel?.name ||
                          result.visitor?.accessLevel ||
                          result.accessLevel?.name ||
                          result.accessLevel ||
                          null);
                    const idTypeFromField = findCustomFieldValue([
                      "idtype",
                      "identificationtype",
                      "documenttype",
                      "doctype",
                      "id document type",
                    ]);
                    const omanIdValue = findCustomFieldValue([
                      "omanid",
                      "omanidnumber",
                      "omannationalid",
                      "nationalid",
                      "civilid",
                      "idcardnumber",
                    ]);
                    const passportValue = findCustomFieldValue([
                      "passport",
                      "passportnumber",
                      "passportno",
                      "passportid",
                    ]);
                    const genericIdValue = findCustomFieldValue([
                      "idnumber",
                      "idno",
                      "identificationnumber",
                      "documentnumber",
                    ]);

                    const resolvedId = (() => {
                      const normalizedType = normalizeKey(idTypeFromField);

                      if (
                        normalizedType.includes("oman") &&
                        (omanIdValue || genericIdValue)
                      ) {
                        return {
                          type: "Oman ID",
                          value: omanIdValue || genericIdValue,
                        };
                      }
                      if (
                        normalizedType.includes("passport") &&
                        (passportValue || genericIdValue)
                      ) {
                        return {
                          type: "Passport",
                          value: passportValue || genericIdValue,
                        };
                      }
                      if (omanIdValue) {
                        return { type: "Oman ID", value: omanIdValue };
                      }
                      if (passportValue) {
                        return { type: "Passport", value: passportValue };
                      }
                      if (idTypeFromField && genericIdValue) {
                        return { type: idTypeFromField, value: genericIdValue };
                      }
                      if (genericIdValue) {
                        return { type: "ID", value: genericIdValue };
                      }
                      return null;
                    })();

                    // Get latest check-in time from logs
                    const checkInLogs = (activityLogs || []).filter(
                      (log) => log?.activityType === "checked_in",
                    );
                    const latestCheckInLog = checkInLogs.reduce(
                      (latest, current) => {
                        if (!latest) return current;

                        const latestTime = new Date(
                          latest?.metadata?.checkedInAt ||
                            latest?.createdAt ||
                            0,
                        ).getTime();
                        const currentTime = new Date(
                          current?.metadata?.checkedInAt ||
                            current?.createdAt ||
                            0,
                        ).getTime();

                        return currentTime > latestTime ? current : latest;
                      },
                      null,
                    );
                    const checkInTime =
                      latestCheckInLog?.metadata?.checkedInAt ||
                      latestCheckInLog?.createdAt;
                    const formatActorSuffix = (log) => {
                      const actor = formatActorLabel(log);
                      if (!actor) return "";
                      const displayName = actor.name || "System";
                      return actor.roleLabel
                        ? ` · ${displayName} (${actor.roleLabel})`
                        : ` · ${displayName}`;
                    };
                    const checkInActor = formatActorSuffix(latestCheckInLog);
                    const expectedCheckout = (result.currentVisitEnd || result.approved_to)
                      ? `${formatDate(
                          checkInTime ||
                            result.currentVisitEnd ||
                            result.approved_to,
                        )} ${formatTime(
                          result.currentVisitEnd || result.approved_to,
                        )}`
                      : null;

                    const checkOutLogs = (activityLogs || []).filter(
                      (log) => log?.activityType === "checked_out",
                    );
                    const latestCheckOutLog = checkOutLogs.reduce(
                      (latest, current) => {
                        if (!latest) return current;
                        const latestTime = new Date(
                          latest?.metadata?.checkedOutAt ||
                            latest?.createdAt ||
                            0,
                        ).getTime();
                        const currentTime = new Date(
                          current?.metadata?.checkedOutAt ||
                            current?.createdAt ||
                            0,
                        ).getTime();
                        return currentTime > latestTime ? current : latest;
                      },
                      null,
                    );
                    const checkOutTime =
                      latestCheckOutLog?.metadata?.checkedOutAt ||
                      latestCheckOutLog?.createdAt;
                    const checkOutActor = formatActorSuffix(latestCheckOutLog);

                    const endedLog = (activityLogs || []).find(
                      (log) => log?.activityType === "visit_ended",
                    );
                    const visitEndedAt =
                      endedLog?.metadata?.endedAt ||
                      result.visitEndedAt ||
                      result.visit_ended_at;

                    const fields = [];
                    const displayedLabels = new Set();
                    const pushField = (label, value, icon = ICONS.info) => {
                      const rendered = renderFieldValue(value);
                      if (rendered == null) return;
                      fields.push({ icon, label, value: rendered });
                      displayedLabels.add(normalizeKey(label));
                    };

                    const isGroupResult =
                      Array.isArray(result.participants) &&
                      result.participants.length > 1;

                    // Group meeting → surface every member on the result card
                    if (isGroupResult) {
                      pushField(
                        t.gateFieldGroupMembers || "Group Meeting Members",
                        result.participants.map((p) => p.fullName).join(", "),
                        ICONS.group,
                      );
                    }

                    // Visit Ended: full info + checkout time + visit end time
                    if (isEnded) {
                      pushField(t.gateFieldName, isGroupResult ? null : visitorName, ICONS.person);
                      pushField(t.gateFieldCompany, company, ICONS.business);
                      pushField(t.gateFieldPurpose, purpose, ICONS.info);
                      pushField(t.department, department, ICONS.business);
                      pushField(t.gateFieldIdType, translateIdType(resolvedId?.type), ICONS.badge);
                      pushField(
                        resolvedId?.type
                          ? t.gateFieldNumberOf.replace(
                              "{{type}}",
                              translateIdType(resolvedId.type),
                            )
                          : t.gateFieldIdNumber,
                        resolvedId?.value,
                        ICONS.vpnKey,
                      );
                      if (result.approved_from || result.approved_to) {
                        pushField(
                          t.gateFieldApprovedDate,
                          `${result.approved_from ? formatDate(result.approved_from) : "—"} ${t.gateRangeTo} ${result.approved_to ? formatDate(result.approved_to) : "—"}`,
                          ICONS.event,
                        );
                        pushField(
                          t.gateFieldApprovedTime,
                          `${result.approved_from ? formatTime(result.approved_from) : "—"} ${t.gateRangeTo} ${result.approved_to ? formatTime(result.approved_to) : "—"}`,
                          ICONS.time,
                        );
                      }
                      pushField(t.gateFieldAccessLevel, accessLevel, ICONS.security);
                      if (checkOutTime)
                        pushField(
                          t.gateFieldCheckedOutAt,
                          `${formatDate(checkOutTime)} ${formatTime(checkOutTime)}${checkOutActor}`,
                          ICONS.logout,
                        );
                      if (visitEndedAt)
                        pushField(
                          t.gateFieldVisitEndedAt,
                          `${formatDate(visitEndedAt)} ${formatTime(visitEndedAt)}`,
                          ICONS.logout,
                        );
                    }
                    // Rejected/Cancelled/Expired: full info + rejection reason if available
                    else if (isRejected || isCancelled || isExpired) {
                      pushField(t.gateFieldName, isGroupResult ? null : visitorName, ICONS.person);
                      pushField(t.gateFieldCompany, company, ICONS.business);
                      pushField(t.gateFieldPurpose, purpose, ICONS.info);
                      pushField(t.department, department, ICONS.business);
                      pushField(t.gateFieldIdType, translateIdType(resolvedId?.type), ICONS.badge);
                      pushField(
                        resolvedId?.type
                          ? t.gateFieldNumberOf.replace(
                              "{{type}}",
                              translateIdType(resolvedId.type),
                            )
                          : t.gateFieldIdNumber,
                        resolvedId?.value,
                        ICONS.vpnKey,
                      );
                      if (result.approved_from || result.approved_to) {
                        pushField(
                          t.gateFieldApprovedDate,
                          `${result.approved_from ? formatDate(result.approved_from) : "—"} ${t.gateRangeTo} ${result.approved_to ? formatDate(result.approved_to) : "—"}`,
                          ICONS.event,
                        );
                        pushField(
                          t.gateFieldApprovedTime,
                          `${result.approved_from ? formatTime(result.approved_from) : "—"} ${t.gateRangeTo} ${result.approved_to ? formatTime(result.approved_to) : "—"}`,
                          ICONS.time,
                        );
                      }
                      pushField(t.gateFieldAccessLevel, accessLevel, ICONS.security);
                      if (isRejected) {
                        const reason =
                          result.rejectionReason || result.rejection_reason;
                        if (reason)
                          pushField(t.gateFieldRejectionReason, reason, ICONS.info);
                      }
                    }
                    // Approved/CheckedOut: full approved details + checkout time for checked_out
                    else if (isApproved || isCheckedOut) {
                      pushField(t.gateFieldName, isGroupResult ? null : visitorName, ICONS.person);
                      pushField(t.gateFieldCompany, company, ICONS.business);
                      pushField(t.gateFieldPurpose, purpose, ICONS.info);
                      pushField(t.department, department, ICONS.business);
                      pushField(t.gateFieldIdType, translateIdType(resolvedId?.type), ICONS.badge);
                      pushField(
                        resolvedId?.type
                          ? t.gateFieldNumberOf.replace(
                              "{{type}}",
                              translateIdType(resolvedId.type),
                            )
                          : t.gateFieldIdNumber,
                        resolvedId?.value,
                        ICONS.vpnKey,
                      );
                      if (result.approved_from || result.approved_to) {
                        pushField(
                          t.gateFieldApprovedDate,
                          `${result.approved_from ? formatDate(result.approved_from) : "—"} ${t.gateRangeTo} ${result.approved_to ? formatDate(result.approved_to) : "—"}`,
                          ICONS.event,
                        );
                        pushField(
                          t.gateFieldApprovedTime,
                          `${result.approved_from ? formatTime(result.approved_from) : "—"} ${t.gateRangeTo} ${result.approved_to ? formatTime(result.approved_to) : "—"}`,
                          ICONS.time,
                        );
                      }
                      pushField(t.gateFieldAccessLevel, accessLevel, ICONS.security);
                      if (isCheckedOut && checkOutTime)
                        pushField(
                          t.gateFieldCheckedOutAt,
                          `${formatDate(checkOutTime)} ${formatTime(checkOutTime)}${checkOutActor}`,
                          ICONS.logout,
                        );
                    }
                    // Pending/AdminApproved: visitor name, purpose of visit, department
                    else if (isPending) {
                      pushField(t.gateFieldName, isGroupResult ? null : visitorName, ICONS.person);
                      pushField(t.gateFieldPurpose, purpose, ICONS.info);
                      pushField(t.department, department, ICONS.business);
                      pushField(t.gateFieldIdType, translateIdType(resolvedId?.type), ICONS.badge);
                      pushField(
                        resolvedId?.type
                          ? t.gateFieldNumberOf.replace(
                              "{{type}}",
                              translateIdType(resolvedId.type),
                            )
                          : t.gateFieldIdNumber,
                        resolvedId?.value,
                        ICONS.vpnKey,
                      );
                    }
                    // CheckedIn: Show check-in timestamp, expected checkout time
                    else if (isCheckedIn) {
                      pushField(t.gateFieldName, isGroupResult ? null : visitorName, ICONS.person);
                      pushField(t.gateFieldCompany, company, ICONS.business);
                      pushField(t.gateFieldPurpose, purpose, ICONS.info);
                      pushField(t.department, department, ICONS.business);
                      pushField(t.gateFieldIdType, translateIdType(resolvedId?.type), ICONS.badge);
                      pushField(
                        resolvedId?.type
                          ? t.gateFieldNumberOf.replace(
                              "{{type}}",
                              translateIdType(resolvedId.type),
                            )
                          : t.gateFieldIdNumber,
                        resolvedId?.value,
                        ICONS.vpnKey,
                      );
                      if (result.approved_from || result.approved_to) {
                        pushField(
                          t.gateFieldApprovedDate,
                          `${result.approved_from ? formatDate(result.approved_from) : "—"} ${t.gateRangeTo} ${result.approved_to ? formatDate(result.approved_to) : "—"}`,
                          ICONS.event,
                        );
                        pushField(
                          t.gateFieldApprovedTime,
                          `${result.approved_from ? formatTime(result.approved_from) : "—"} ${t.gateRangeTo} ${result.approved_to ? formatTime(result.approved_to) : "—"}`,
                          ICONS.time,
                        );
                      }
                      pushField(t.gateFieldAccessLevel, accessLevel, ICONS.security);
                      if (checkInTime)
                        pushField(
                          t.gateFieldCheckinTime,
                          `${formatDate(checkInTime)} ${formatTime(checkInTime)}${checkInActor}`,
                          ICONS.login,
                        );
                      pushField(
                        t.gateFieldExpectedCheckout,
                        expectedCheckout,
                        ICONS.logout,
                      );
                    }

                    pushField(
                      t.gateFieldVehiclePlate,
                      result.vehicle_plate || result.vehiclePlate,
                      ICONS.parking,
                    );

                    const internalNoteText =
                      result.internal_note ?? result.internalNote ?? null;
                    if (canReadInternalNote && internalNoteText) {
                      pushField(
                        t.gateFieldInternalNote || "Internal Note",
                        internalNoteText,
                        ICONS.description,
                      );
                    }

                    return fields.map((item, idx) => (
                      <ListItem
                        key={`${item.label}-${idx}`}
                        disablePadding
                        sx={{ py: 0.8 }}
                      >
                        <ListItemIcon
                          sx={{ minWidth: 36, color: "primary.main" }}
                        >
                          {(() => {
                            const IconComponent = item.icon || ICONS.info;
                            return <IconComponent fontSize="small" />;
                          })()}
                        </ListItemIcon>
                        <ListItemText
                          primary={item.label}
                          secondary={item.value}
                          primaryTypographyProps={{
                            variant: "caption",
                            color: "text.secondary",
                            fontWeight: 600,
                            textAlign: dir === "rtl" ? "right" : "left",
                          }}
                          secondaryTypographyProps={{
                            variant: "body1",
                            color: "text.primary",
                            fontWeight: 500,
                            textAlign: dir === "rtl" ? "right" : "left",
                          }}
                        />
                      </ListItem>
                    ));
                  })()}
                </List>

                {canWriteInternalNote && (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={openInternalNoteDialog}
                    startIcon={<ICONS.edit fontSize="small" />}
                    sx={{ mt: 1.5, borderRadius: 30 }}
                  >
                    {t.gateEditInternalNote || "Edit Internal Note"}
                  </Button>
                )}

                <Stack spacing={2} mt={4}>
                  {(() => {
                    const status = result.status;
                    const isPending = result.status === "pending";
                    const isAdminApproved = result.status === "admin_approved";
                    const isApproved = result.status === "approved";
                    const isCheckedIn = result.status === "checked_in";
                    const isCheckedOut = result.status === "checked_out";
                    const isEnded = result.status === "visit_ended";
                    const isMulti =
                      result.allow_multi_checkin ?? result.allowMultiCheckin;
                    const isVipEnded =
                      isEnded &&
                      (result.is_vip_fast_track || result.isVipFastTrack);

                    const _fvs = Array.isArray(result.fieldValues)
                      ? result.fieldValues
                      : Array.isArray(result.visitor?.fieldValues)
                        ? result.visitor.fieldValues
                        : [];
                    const _nk = (v) =>
                      String(v ?? "")
                        .toLowerCase()
                        .replace(/[^a-z0-9]/g, "");
                    const _rv = (v) => {
                      if (v == null || v === "") return null;
                      if (typeof v === "object")
                        return v.name || v.label || v.value || null;
                      return String(v);
                    };
                    const _find = (aliases) => {
                      const norm = aliases.map(_nk);
                      const m = _fvs.find(
                        (fv) =>
                          norm.includes(
                            _nk(
                              fv?.customField?.fieldKey ||
                                fv?.customField?.name,
                            ),
                          ) || norm.includes(_nk(fv?.customField?.label)),
                      );
                      return _rv(m?.value);
                    };
                    const _idType = _find([
                      "idtype",
                      "identificationtype",
                      "documenttype",
                      "doctype",
                    ]);
                    const _omanId = _find([
                      "omanid",
                      "nationalid",
                      "civilid",
                      "idcardnumber",
                      "idnumber",
                      "idno",
                    ]);
                    const _passport = _find([
                      "passport",
                      "passportnumber",
                      "passportno",
                    ]);
                    const _nk2 = _nk(_idType || "");
                    const resolvedId = (() => {
                      if (_nk2.includes("passport") && (_passport || _omanId))
                        return {
                          type: "Passport",
                          value: _passport || _omanId,
                        };
                      if (_omanId)
                        return {
                          type: _nk2.includes("passport") ? "Passport" : "ID",
                          value: _omanId,
                        };
                      if (_passport)
                        return { type: "Passport", value: _passport };
                      return null;
                    })();

                    const isVipFastTrack =
                      result.is_vip_fast_track || result.isVipFastTrack;
                    const bufferMs =
                      (workingHours?.checkInBufferMinutes ?? 60) * 60 * 1000;

                    // Check-in window: full approvedFrom–approvedTo range
                    const outsideWindow = (() => {
                      if (isVipFastTrack || !isApproved) return false;
                      if (result.status === "admin_approved") return false;
                      if (!result.approved_from || !result.approved_to) return false;
                      const now = Date.now();
                      const fromMs = new Date(result.approved_from).getTime();
                      const toMs = new Date(result.approved_to).getTime();
                      return now < fromMs - bufferMs || now > toMs + bufferMs;
                    })();

                    const fmtWindow = () => {
                      const fmt = (d) => `${formatDate(d)} ${formatTime(d)}`;
                      const from = new Date(
                        new Date(result.approved_from).getTime() - bufferMs,
                      );
                      const to = new Date(
                        new Date(result.approved_to).getTime() + bufferMs,
                      );
                      return `${fmt(from)} – ${fmt(to)}`;
                    };

                    // For single-day visits: today must match the appointment day.
                    // For multi-day visits: today must fall within approved_from – approved_to.
                    const isMultiDay = (() => {
                      const f = result.approved_from;
                      const t = result.approved_to;
                      if (!f || !t) return false;
                      return new Date(f).toDateString() !== new Date(t).toDateString();
                    })();
                    const outsideCheckoutDay = (() => {
                      if (!isCheckedIn) return false;
                      if (isMultiDay) {
                        const todayMs = new Date().setHours(0, 0, 0, 0);
                        const fromMs = new Date(result.approved_from).setHours(0, 0, 0, 0);
                        const toMs = new Date(result.approved_to).setHours(0, 0, 0, 0);
                        return todayMs < fromMs || todayMs > toMs;
                      }
                      const ref = result.approved_to || result.approved_from;
                      if (!ref) return false;
                      return new Date(ref).toDateString() !== new Date().toDateString();
                    })();

                    return (
                      <>
                        {resolvedId &&
                          (isApproved || (isCheckedOut && isMulti)) && (
                            <Box
                              onClick={() => setIdVerified((v) => !v)}
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1.5,
                                p: 1.5,
                                borderRadius: 2,
                                border: "1px solid",
                                borderColor: idVerified
                                  ? "success.main"
                                  : "warning.main",
                                bgcolor: idVerified
                                  ? isDark
                                    ? "rgba(46,125,50,0.12)"
                                    : "rgba(46,125,50,0.06)"
                                  : isDark
                                    ? "rgba(237,108,2,0.12)"
                                    : "rgba(237,108,2,0.06)",
                                cursor: "pointer",
                                userSelect: "none",
                                width: "100%",
                              }}
                            >
                              <Box
                                sx={{
                                  width: 20,
                                  height: 20,
                                  borderRadius: 0.5,
                                  flexShrink: 0,
                                  border: "2px solid",
                                  borderColor: idVerified
                                    ? "success.main"
                                    : "warning.main",
                                  bgcolor: idVerified
                                    ? "success.main"
                                    : "transparent",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                {idVerified && (
                                  <ICONS.check
                                    sx={{ fontSize: 14, color: "#fff" }}
                                  />
                                )}
                              </Box>
                              <Box>
                                <Typography
                                  variant="body2"
                                  fontWeight={700}
                                  color={
                                    idVerified ? "success.main" : "warning.main"
                                  }
                                  display="block"
                                >
                                  {idVerified
                                    ? t.gateIdVerified
                                    : t.gateIdVerificationRequired}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  {translateIdType(resolvedId.type)}:{" "}
                                  <strong>{resolvedId.value}</strong>
                                </Typography>
                              </Box>
                            </Box>
                          )}

                        {outsideWindow && (
                          <Alert
                            severity="error"
                            icon={<ICONS.time fontSize="small" />}
                            sx={{ borderRadius: 2, fontWeight: 600, mb: 1 }}
                          >
                            {t.gateOutsideWindow.replace(
                              "{{window}}",
                              fmtWindow(),
                            )}
                          </Alert>
                        )}

                        {outsideCheckoutDay && (
                          <Alert
                            severity="error"
                            icon={<ICONS.time fontSize="small" />}
                            sx={{ borderRadius: 2, fontWeight: 600, mb: 1 }}
                          >
                            {isMultiDay
                              ? t.gateOutsideVisitWindow
                                  .replace(
                                    "{{from}}",
                                    formatDate(result.approved_from),
                                  )
                                  .replace(
                                    "{{to}}",
                                    formatDate(result.approved_to),
                                  )
                              : t.gateCheckoutSameDay.replace(
                                  "{{date}}",
                                  formatDate(
                                    result.approved_to || result.approved_from,
                                  ),
                                )}
                          </Alert>
                        )}

                        <Stack direction="column" spacing={1.5} sx={{ width: "100%" }}>
                          {/* When gate staff can final-approve, show the Approve button
                              instead of the "Awaiting Approval" placeholder. */}
                          {isPending && !canApproveStatus && (
                            <Button
                              fullWidth
                              variant="contained"
                              disabled
                              startIcon={<ICONS.time />}
                              sx={{
                                fontSize: "0.85rem",
                                bgcolor: isDark
                                  ? "rgba(255,255,255,0.08) !important"
                                  : "rgba(0,0,0,0.06) !important",
                                color: isDark
                                  ? "rgba(255,255,255,0.4) !important"
                                  : "rgba(0,0,0,0.4) !important",
                                border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                              }}
                            >
                              {t.gateAwaitingApproval}
                            </Button>
                          )}

                          {/* Final Approve — only for gate staff with approve-status permission */}
                          {canApproveStatus && (isPending || isAdminApproved) && (
                            <Button
                              fullWidth
                              variant="contained"
                              color="success"
                              startIcon={<ICONS.checkCircle />}
                              onClick={() => openApprove()}
                              disabled={submitting}
                            >
                              {t.gateApprove}
                            </Button>
                          )}

                          {/* Check In button */}
                          {isApproved && canCheckin && (
                            <Button
                              fullWidth
                              variant="contained"
                              color="success"
                              startIcon={
                                actionLoading ? (
                                  <CircularProgress size={20} />
                                ) : (
                                  <ICONS.login />
                                )
                              }
                              onClick={handleCheckInAction}
                              disabled={
                                actionLoading ||
                                (Boolean(resolvedId) && !idVerified) ||
                                outsideWindow
                              }
                            >
                              {t.gateCheckIn}
                            </Button>
                          )}

                          {/* Check Out button */}
                          {isCheckedIn && canCheckout && (
                            <Button
                              fullWidth
                              variant="contained"
                              color="error"
                              startIcon={
                                actionLoading ? (
                                  <CircularProgress size={20} />
                                ) : (
                                  <ICONS.logout />
                                )
                              }
                              onClick={handleCheckOutAction}
                              disabled={actionLoading || outsideCheckoutDay}
                            >
                              {t.gateCheckOut}
                            </Button>
                          )}

                          {/* Re-check-in for multi-checkin */}
                          {isCheckedOut && isMulti && canCheckin && (
                            <Button
                              fullWidth
                              variant="contained"
                              color="success"
                              startIcon={
                                actionLoading ? (
                                  <CircularProgress size={20} />
                                ) : (
                                  <ICONS.login />
                                )
                              }
                              onClick={handleCheckInAction}
                              disabled={
                                actionLoading ||
                                (Boolean(resolvedId) && !idVerified)
                              }
                            >
                              {t.gateCheckInAgain}
                            </Button>
                          )}

                          {/* VIP check-in */}
                          {isVipEnded && (
                            <Button
                              fullWidth
                              variant="contained"
                              color="warning"
                              startIcon={
                                actionLoading ? (
                                  <CircularProgress size={20} />
                                ) : (
                                  <ICONS.star />
                                )
                              }
                              onClick={handleVipRevisit}
                              disabled={actionLoading}
                            >
                              {t.gateVipCheckIn}
                            </Button>
                          )}

                          <Button
                            fullWidth
                            variant="outlined"
                            startIcon={<ICONS.close />}
                            onClick={reset}
                          >
                            {t.close}
                          </Button>
                        </Stack>
                      </>
                    );
                  })()}
                </Stack>
              </Paper>
            )}

            {error && (
              <Paper
                elevation={0}
                sx={{
                  p: 4,
                  borderRadius: 4,
                  border: `1px solid ${isDark ? "rgba(211,47,47,0.5)" : "rgba(211,47,47,0.2)"}`,
                  textAlign: "center",
                  bgcolor: "background.paper",
                  width: "100%",
                }}
              >
                <ICONS.errorOutline
                  sx={{ fontSize: 64, color: "error.main", mb: 2 }}
                />
                <Typography
                  variant="h6"
                  fontWeight={700}
                  color="error.main"
                  gutterBottom
                >
                  {t.gateVerificationFailed}
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={3}>
                  {error}
                </Typography>
                <Button
                  variant="contained"
                  color="error"
                  fullWidth
                  startIcon={<ICONS.refresh />}
                  onClick={reset}
                  sx={{ borderRadius: 3 }}
                >
                  {t.gateRetry}
                </Button>
              </Paper>
            )}
          </Box>
        </>
        )}
        </Box>
      </Container>

      {/* ID Verification Dialog — auto-opens on QR scan when ID is required */}
      <Dialog
        open={showIdVerifyDialog}
        onClose={() => setShowIdVerifyDialog(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 4, p: 1 },
        }}
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            fontWeight: 700,
          }}
        >
          <ICONS.vpnKey sx={{ color: "warning.main" }} />
          {t.gateIdVerificationRequired}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            {t.gateVerifyIdentityPrompt}
          </Typography>
          {resolvedId && (
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                border: "1px solid",
                borderColor: "warning.main",
                bgcolor: isDark
                  ? "rgba(237,108,2,0.08)"
                  : "rgba(237,108,2,0.04)",
              }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                display="block"
                mb={0.5}
              >
                {t.gateExpectedId.replace(
                  "{{type}}",
                  translateIdType(resolvedId.type),
                )}
              </Typography>
              <Typography variant="h6" fontWeight={700}>
                {resolvedId.value}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions
          sx={{
            px: 3,
            pb: 2,
            gap: 1,
            display: "flex",
            flexDirection: { xs: "column-reverse", sm: "row" },
            justifyContent: { xs: "flex-end", sm: "space-between" },
            width: "100%",
            ...getStartIconSpacing(dir),
          }}
        >
          <Button
            fullWidth
            variant="outlined"
            color="inherit"
            onClick={() => setShowIdVerifyDialog(false)}
            sx={{ borderRadius: 3, py: 1.5, whiteSpace: "nowrap" }}
          >
            {t.cancel}
          </Button>
          <Button
            fullWidth
            variant="contained"
            color="success"
            startIcon={<ICONS.check />}
            onClick={() => {
              setIdVerified(true);
              setShowIdVerifyDialog(false);
              handleCheckInAction();
            }}
            sx={{ borderRadius: 3, py: 1.5, whiteSpace: "nowrap" }}
          >
            {t.gateVerifyAndCheckIn}
          </Button>
        </DialogActions>
      </Dialog>
    </RoleGuard>
  );
}
