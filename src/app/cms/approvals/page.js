"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  Box,
  Typography,
  Stack,
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Avatar,
  Divider,
  CircularProgress,
  Pagination,
  FormControl,
  Select,
  InputLabel,
  MenuItem,
  alpha,
  Tabs,
  Tab,
  Switch,
  FormControlLabel,
  Chip,
  LinearProgress,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { useColorMode } from "@/contexts/ThemeContext";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";
import dayjs from "dayjs";
import { useMessage } from "@/contexts/MessageContext";
import { useSocket } from "@/contexts/SocketContext";
import { useAuth } from "@/contexts/AuthContext";
import ICONS from "@/utils/iconUtil";

import {
  getRegistrations,
  updateStatus,
  getRegistrationById,
  mapRegistration,
} from "@/services/registrationService";
import { getAccessLevels } from "@/services/accessLevelService";
import {
  formatDate,
  formatTime,
  formatDateTimeWithLocale,
  getLocalDate,
  getLocalTime,
  parse24To12,
  convert12To24,
} from "@/utils/dateUtils";
import { validateRequired } from "@/utils/validationUtils";

import AppCard from "@/components/cards/AppCard";
import DialogHeader from "@/components/modals/DialogHeader";
import ListToolbar from "@/components/ListToolbar";
import LoadingState from "@/components/LoadingState";
import NoDataAvailable from "@/components/NoDataAvailable";
import ResponsiveCardGrid from "@/components/ResponsiveCardGrid";

const TIME_SLOTS = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
];

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) =>
  String(i).padStart(2, "0"),
);
const PERIODS = ["AM", "PM"];

export default function CmsApprovalsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "superadmin";
  const userDepartmentIds = Array.isArray(user?.departments)
    ? user.departments.map((dept) => dept.id).filter(Boolean)
    : [];
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isListRefreshing, setIsListRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [approveTarget, setApproveTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [fetchingProfile, setFetchingProfile] = useState(false);
  const [loadingId, setLoadingId] = useState(null);
  const hasLoadedOnceRef = useRef(false);

  const [scheduledDate, setScheduledDate] = useState(null);
  const [scheduledFrom, setScheduledFrom] = useState("09:00");
  const [scheduledTo, setScheduledTo] = useState("18:00");
  const [scheduleType, setScheduleType] = useState("custom"); // "custom" or "preset"
  const [selectedPreset, setSelectedPreset] = useState("fullDay"); // "fullDay", "fullWeek", "fullMonth"
  const { mode } = useColorMode();
  const isDark = mode === "dark";
  const { showMessage } = useMessage();

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(12);
  const [accessLevels, setAccessLevels] = useState([]);
  const [selectedAccessLevelIds, setSelectedAccessLevelIds] = useState([]);
  const [allowMultiCheckin, setAllowMultiCheckin] = useState(false);
  const [allowParking, setAllowParking] = useState(false);
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [vehiclePlateError, setVehiclePlateError] = useState("");
  const [approvalNote, setApprovalNote] = useState("");
  const [isVip, setIsVip] = useState(false);
  const [vipReason, setVipReason] = useState("");
  const [vipReasonError, setVipReasonError] = useState("");
  const [accessLevelError, setAccessLevelError] = useState("");

  const canSeeRegistration = useCallback((registration) => {
    if (isSuperAdmin) return true;

    const registrationDepartmentId =
      registration?.departmentId ||
      registration?.department_id ||
      registration?.department?.id;

    if (!registrationDepartmentId) return false;

    return userDepartmentIds.includes(registrationDepartmentId);
  }, [isSuperAdmin, userDepartmentIds]);

  const fetchPending = useCallback(async ({ refreshOnly = false } = {}) => {
    const shouldShowFullLoader = !refreshOnly && !hasLoadedOnceRef.current;
    if (shouldShowFullLoader) setLoading(true);
    else setIsListRefreshing(true);
    try {
      if (isSuperAdmin) {
        const [pending, adminApproved] = await Promise.all([
          getRegistrations("pending"),
          getRegistrations("admin_approved"),
        ]);
        setRows([
          ...(Array.isArray(pending) ? pending : []),
          ...(Array.isArray(adminApproved) ? adminApproved : []),
        ]);
      } else {
        const data = await getRegistrations("pending");
        setRows(Array.isArray(data) ? data : []);
      }
      hasLoadedOnceRef.current = true;
      setHasLoadedOnce(true);
    } finally {
      if (shouldShowFullLoader) setLoading(false);
      setIsListRefreshing(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  useEffect(() => {
    getAccessLevels().then((res) => {
      if (Array.isArray(res)) setAccessLevels(res.filter((al) => al.isActive !== false));
    });
  }, []);

  const { on } = useSocket();

  useEffect(() => {
    const unsubNew = on("registration:new", (newReg) => {
      if (!newReg?.id) return;
      const isRelevant = (newReg.status === "pending" || newReg.status === "admin_approved") && canSeeRegistration(newReg);
      if (isRelevant) {
        setRows((prev) => {
          const exists = prev.some((row) => row.id === newReg.id);
          return exists ? prev.map((row) => (row.id === newReg.id ? { ...row, ...newReg } : row)) : [newReg, ...prev];
        });
      }
    });
    const unsubUpdated = on("registration:updated", (updatedReg) => {
      if (!updatedReg?.id) return;
      const mappedReg = mapRegistration(updatedReg);
      const isRelevant = (mappedReg.status === "pending" || mappedReg.status === "admin_approved") && canSeeRegistration(mappedReg);
      setRows((prev) => {
        const stillRelevant = isRelevant && (mappedReg.status === "pending" || mappedReg.status === "admin_approved");
        if (!stillRelevant) {
          return prev.filter((row) => row.id !== mappedReg.id);
        }
        const exists = prev.some((row) => row.id === mappedReg.id);
        return exists ? prev.map((row) => (row.id === mappedReg.id ? mappedReg : row)) : [mappedReg, ...prev];
      });

      // Auto-close modals if registration was processed by someone else
      if (approveTarget?.id === updatedReg.id || rejectTarget?.id === updatedReg.id) {
        const stillRelevantForModal = isSuperAdmin 
          ? (updatedReg.status === "pending" || updatedReg.status === "admin_approved")
          : (updatedReg.status === "pending");

        if (!stillRelevantForModal) {
          setApproveTarget(null);
          setRejectTarget(null);
          setRejectReason("");
        }
      }
    });

    return () => {
      unsubNew?.();
      unsubUpdated?.();
    };
  }, [canSeeRegistration, isSuperAdmin, on, approveTarget?.id, rejectTarget?.id]);

  const filtered = useMemo(() => {
    if (!Array.isArray(rows)) return [];
    return rows
      .filter((r) =>
        [r.full_name, r.email]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase()),
      )
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [rows, search]);

  const pagedRows = useMemo(() => {
    return filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [filtered, page, rowsPerPage]);

  const openApprove = async (row) => {
    setFetchingProfile(true);
    setLoadingId(row.id);
    try {
      const fullReg = await getRegistrationById(row.id);
      setApproveTarget(fullReg);

      // For admin_approved registrations (superadmin doing final approval),
      // prefill from what the dept admin already set; otherwise use visitor's requested slot.
      const isAdminApproved = fullReg.status === "admin_approved";
      const scheduleFrom = isAdminApproved ? fullReg.approved_from : fullReg.requested_from;
      const scheduleTo   = isAdminApproved ? fullReg.approved_to   : fullReg.requested_to;

      let detectedType = "custom";
      let detectedPreset = "fullDay";

      if (scheduleFrom && scheduleTo) {
        const dateFrom = getLocalDate(scheduleFrom);
        const dateTo = getLocalDate(scheduleTo);
        const timeFrom = getLocalTime(scheduleFrom);
        const timeTo = getLocalTime(scheduleTo);

        if (dateFrom && dateTo) {
          const d1 = dayjs(dateFrom);
          const d2 = dayjs(dateTo);
          const daysDiff = d2.diff(d1, "days");

          if ((daysDiff === 0 || daysDiff === 1) && timeFrom === timeTo) {
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
        ? (fullReg.access_levels?.length
            ? fullReg.access_levels.map((al) => al.id)
            : fullReg.accessLevels?.length
              ? fullReg.accessLevels.map((al) => al.id)
              : (fullReg.access_level_id || fullReg.accessLevelId)
                ? [fullReg.access_level_id || fullReg.accessLevelId]
                : [])
        : [];
      setSelectedAccessLevelIds(prefillIds);
      setAllowMultiCheckin(isAdminApproved ? (fullReg.allow_multi_checkin ?? false) : false);
      const prefillParking = isAdminApproved ? (fullReg.allow_parking ?? false) : false;
      setAllowParking(prefillParking);
      setVehiclePlate(prefillParking ? (fullReg.vehicle_plate ?? "") : "");
      setVehiclePlateError("");
      setApprovalNote(isAdminApproved ? (fullReg.approval_note ?? "") : "");
      const prefillVip = isAdminApproved ? (fullReg.is_vip ?? false) : false;
      setIsVip(prefillVip);
      setVipReason(prefillVip ? (fullReg.vip_reason ?? "") : "");
      setVipReasonError("");
      setAccessLevelError("");
    } finally {
      setFetchingProfile(false);
      setLoadingId(null);
    }
  };

  const handleTimePartChange = (type, part, value) => {
    const timeValue = type === "scheduledFrom" ? scheduledFrom : scheduledTo;
    const current = parse24To12(timeValue);
    const next = { ...current, [part]: value };
    const time24 = convert12To24(next.hour12, next.minute, next.ampm);

    if (type === "scheduledFrom") {
      setScheduledFrom(time24);
      if (scheduledTo <= time24) {
        let [h, m] = time24.split(":").map(Number);
        h = (h + 1) % 24;
        setScheduledTo(
          `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
        );
      }
    } else {
      setScheduledTo(time24);
      if (scheduledFrom >= time24) {
        let [h, m] = time24.split(":").map(Number);
        h = (h - 1 + 24) % 24;
        setScheduledFrom(
          `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
        );
      }
    }
  };

  const renderTimeDropdowns = (type, label) => {
    const timeValue = type === "scheduledFrom" ? scheduledFrom : scheduledTo;
    const { hour12, minute, ampm } = parse24To12(timeValue);

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
              {HOURS.map((h) => (
                <MenuItem key={h} value={h} sx={{ fontSize: "0.75rem" }}>
                  {h}
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
              {MINUTES.map((m) => (
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

  const handleApprove = async () => {
    if (!scheduledDate) {
      showMessage("Please select a date.", "warning");
      return;
    }
    if (!selectedAccessLevelIds.length) {
      setAccessLevelError("At least one access zone is required");
      return;
    }
    if (allowParking && !vehiclePlate.trim()) {
      setVehiclePlateError("Vehicle plate number is required when parking is enabled");
      return;
    }
    if (isVip && !vipReason.trim()) {
      setVipReasonError("A reason is required when marking a visitor as VIP");
      return;
    }
    setSubmitting(true);
    try {
      let fromDate, toDate;
      if (scheduleType === "preset") {
        const date = scheduledDate;
        let from = date.clone();
        let to = date.clone();

        if (selectedPreset === "fullDay") {
          from = from.hour(parseInt(scheduledFrom.split(":")[0])).minute(parseInt(scheduledFrom.split(":")[1]));
          to = to.add(1, "day").hour(parseInt(scheduledFrom.split(":")[0])).minute(parseInt(scheduledFrom.split(":")[1]));
        } else if (selectedPreset === "fullWeek") {
          to = from.clone().add(6, "days");
        } else if (selectedPreset === "fullMonth") {
          to = from.clone().add(30, "days");
        }

        fromDate = from.format("YYYY-MM-DD");
        toDate = to.format("YYYY-MM-DD");
      } else {
        fromDate = scheduledDate.format("YYYY-MM-DD");
        toDate = scheduledDate.format("YYYY-MM-DD");
      }

      const payload = {
        approvedFrom: dayjs(`${fromDate}T${scheduledFrom}`).toISOString(),
        approvedTo: dayjs(`${toDate}T${scheduleType === "preset" && selectedPreset === "fullDay" ? scheduledFrom : scheduledTo}`).toISOString(),
        accessLevelIds: selectedAccessLevelIds,
        accessLevelId: selectedAccessLevelIds[0],
        allowMultiCheckin,
        allowParking,
        vehiclePlate: allowParking ? vehiclePlate.trim() : null,
        isVip,
        vipReason: isVip ? vipReason.trim() : undefined,
        approvalNote: approvalNote.trim() || undefined,
      };

      await updateStatus(approveTarget.id, { status: isSuperAdmin ? "approved" : "admin_approved", ...payload });
      showMessage(
        `${approveTarget.full_name}'s registration has been ${isSuperAdmin ? "finally approved" : "dept. approved"}.`,
        "success",
      );
      setRows((prev) => prev.filter((r) => r.id !== approveTarget.id));
      setApproveTarget(null);
    } catch (err) {
      showMessage("Failed to approve registration", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    const error = validateRequired(rejectReason, "Rejection reason");
    if (error) {
      showMessage(error, "warning");
      return;
    }
    try {
      await updateStatus(rejectTarget.id, { status: "rejected", rejectionReason: rejectReason.trim() });
      showMessage(
        `${rejectTarget.full_name}'s registration has been rejected.`,
        "warning",
      );
      setRows((prev) => prev.filter((r) => r.id !== rejectTarget.id));
      setRejectTarget(null);
      setRejectReason("");
    } catch (err) {
      showMessage("Failed to reject registration", "error");
    }
  };

  const handleChangePage = (event, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const isAdminApprovedTarget =
    isSuperAdmin && approveTarget?.status === "admin_approved";
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

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          justifyContent: "space-between",
          alignItems: { xs: "stretch", sm: "center" },
          mt: 2,
          mb: 1,
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight="bold">
            Approvals
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.5, opacity: 0.8 }}
          >
            Review and manage incoming visitor requests.
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ mb: 3 }} />

      <ListToolbar
        showingCount={pagedRows.length}
        totalCount={filtered.length}
        searchSlot={
          <TextField
            fullWidth
            size="small"
            variant="outlined"
            placeholder="Search pending requests..."
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
            sx={{ maxWidth: { md: 380 } }}
          />
        }
        actionsSlot={
          <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 160 } }}>
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
        }
      />

      {isListRefreshing && !loading && (
        <LinearProgress
          sx={{
            mb: 2,
            borderRadius: 2,
            height: 4,
            backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.12),
          }}
        />
      )}

      {loading ? (
        <LoadingState />
      ) : (
        <>
          {pagedRows.length === 0 ? (
            <NoDataAvailable
              title={search ? "No matches found" : "All caught up!"}
              description={
                search
                  ? "Try a different name or email search."
                  : "No pending approvals to display."
              }
            />
          ) : (
            <ResponsiveCardGrid>
              {pagedRows.map((row) => (
                <AppCard
                  key={row.id}
                  sx={{
                    height: "100%",
                    width: "100%",
                  }}
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
                            bgcolor: row.status === "admin_approved" ? "info.light" : "warning.light",
                            color: row.status === "admin_approved" ? "info.dark" : "warning.dark",
                            fontSize: "1rem",
                            fontWeight: 800,
                          }}
                        >
                          {row.full_name
                            ?.split(" ")
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join("") || "?"}
                        </Avatar>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography
                            variant="subtitle1"
                            fontWeight={800}
                            noWrap
                            sx={{ lineHeight: 1.2 }}
                          >
                            {row.full_name}
                          </Typography>
                        </Box>
                        {row.status === "admin_approved" && (
                          <Chip
                            label="Dept. Approved"
                            size="small"
                            color="info"
                            sx={{ fontWeight: 700, fontSize: "0.6rem", height: 20, flexShrink: 0 }}
                          />
                        )}
                      </Stack>
                      <Typography
                        variant="caption"
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 0.5,
                          color: "text.secondary",
                        }}
                      >
                        <ICONS.time fontSize="inherit" sx={{ opacity: 0.7 }} />
                        Submitted {formatDateTimeWithLocale(row.created_at)}
                      </Typography>
                    </Stack>
                  </Box>

                  {/* Dynamic Fields */}
                  <Box sx={{ flexGrow: 1, px: 2, py: 1.5 }}>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        py: 0.8,
                        borderBottom: "1px solid",
                        borderColor: "divider",
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
                        {row.email || "—"}
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        py: 0.8,
                        borderBottom: "1px solid",
                        borderColor: "divider",
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{ display: "flex", alignItems: "center", gap: 0.6, color: "text.secondary" }}
                      >
                        <ICONS.info fontSize="small" sx={{ opacity: 0.6 }} /> Purpose
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, ml: 2, flex: 1, textAlign: "right", color: "text.primary" }}>
                        {row.purpose_of_visit || "—"}
                      </Typography>
                    </Box>
                    {row.department?.name && (
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          py: 0.8,
                          borderBottom: "1px solid",
                          borderColor: "divider",
                        }}
                      >
                        <Typography variant="body2" sx={{ display: "flex", alignItems: "center", gap: 0.6, color: "text.secondary" }}>
                          <ICONS.apartment fontSize="small" sx={{ opacity: 0.6 }} /> Department
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, ml: 2, flex: 1, textAlign: "right", color: "text.primary" }}>
                          {row.department.name}
                        </Typography>
                      </Box>
                    )}
                    {isSuperAdmin && row.status === "admin_approved" && (row.access_levels?.length || row.access_level?.name) && (
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          py: 0.8,
                          borderBottom: "1px solid",
                          borderColor: "divider",
                        }}
                      >
                        <Typography variant="body2" sx={{ display: "flex", alignItems: "center", gap: 0.6, color: "text.secondary" }}>
                          <ICONS.key fontSize="small" sx={{ opacity: 0.6 }} /> Access Zones
                        </Typography>
                        <Box sx={{ ml: 2, flex: 1, display: "flex", flexWrap: "wrap", gap: 0.5, justifyContent: "flex-end" }}>
                          {(row.access_levels?.length
                            ? row.access_levels
                            : row.access_level ? [row.access_level] : []
                          ).map((al) => (
                            <Chip key={al.id} label={al.name} size="small" variant="outlined" sx={{ fontWeight: 600, fontSize: "0.65rem", height: 20 }} />
                          ))}
                        </Box>
                      </Box>
                    )}
                    {isSuperAdmin && row.status === "admin_approved" && (
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          py: 0.8,
                          borderBottom: "1px solid",
                          borderColor: "divider",
                        }}
                      >
                        <Typography variant="body2" sx={{ display: "flex", alignItems: "center", gap: 0.6, color: "text.secondary" }}>
                          <ICONS.replay fontSize="small" sx={{ opacity: 0.6 }} /> Multi Check-in
                        </Typography>
                        <Chip
                          label={row.allow_multi_checkin ? "Allowed" : "Not Allowed"}
                          size="small"
                          color={row.allow_multi_checkin ? "success" : "default"}
                          variant={row.allow_multi_checkin ? "filled" : "outlined"}
                          sx={{ fontWeight: 700, fontSize: "0.6rem", height: 20 }}
                        />
                      </Box>
                    )}
                    {row.requested_from && (
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          py: 0.8,
                          borderBottom: "none",
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
                          <ICONS.event fontSize="small" sx={{ opacity: 0.6 }} />{" "}
                          Requested Slot
                        </Typography>
                        <Box sx={{ ml: 2, flex: 1, textAlign: "right" }}>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 600, color: "primary.main" }}
                          >
                            {(() => {
                              const fromStr = row.requested_from;
                              const toStr = row.requested_to;
                              const dateFrom = getLocalDate(fromStr);
                              const dateTo = getLocalDate(toStr);
                              
                              return dateFrom && dateTo && dateFrom !== dateTo
                                ? `${formatDate(fromStr)} to ${formatDate(toStr)}`
                                : fromStr ? formatDate(fromStr)  : "-";
                            })()}
                          </Typography>
                          {(() => {
                            const fromStr = row.requested_from;
                            const hTo = row.requested_to;
                            
                            return (fromStr || hTo) && (
                              <Typography
                                variant="caption"
                                sx={{
                                  fontWeight: 600,
                                  color: "text.secondary",
                                  display: "block",
                                }}
                              >
                                {fromStr ? formatTime(fromStr) : "—"} -{" "}
                                {hTo ? formatTime(hTo) : "—"}
                              </Typography>
                            );
                          })()}
                        </Box>
                      </Box>
                    )}
                  </Box>

                  {/* Actions / Footer */}
                  <Box
                    sx={{
                      p: 2,
                      borderTop: "1px solid",
                      borderColor: "divider",
                      bgcolor: isDark
                        ? "rgba(255,255,255,0.02)"
                        : "rgba(0,0,0,0.01)",
                      display: "flex",
                      gap: 1.5,
                    }}
                  >
                    <Button
                      fullWidth
                      variant="contained"
                      color={row.status === "admin_approved" ? "primary" : "success"}
                      onClick={() => openApprove(row)}
                      disabled={loadingId === row.id}
                      startIcon={loadingId === row.id ? <CircularProgress size={16} /> : <ICONS.check />}
                      sx={{ borderRadius: 30, fontWeight: 700 }}
                    >
                      {row.status === "admin_approved" ? "Final Approve" : "Approve"}
                    </Button>
                    <Button
                      fullWidth
                      variant="outlined"
                      color="error"
                      onClick={() => {
                        setRejectTarget(row);
                        setRejectReason("");
                      }}
                      startIcon={<ICONS.close />}
                      sx={{ borderRadius: 30, fontWeight: 700 }}
                    >
                      Reject
                    </Button>
                  </Box>
                </AppCard>
              ))}
            </ResponsiveCardGrid>
          )}

          <Box display="flex" justifyContent="center" mt={4}>
            {filtered.length > rowsPerPage && (
              <Pagination
                count={Math.ceil(filtered.length / rowsPerPage)}
                page={page + 1}
                onChange={(e, v) => setPage(v - 1)}
                color="primary"
              />
            )}
          </Box>
        </>
      )}

      <Dialog
        open={!!approveTarget}
        onClose={() => setApproveTarget(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 4, overflow: "hidden", variant: "frosted" },
        }}
      >
        <DialogHeader
          title={isSuperAdmin ? "Final Approve & Schedule" : "Approve & Schedule"}
          onClose={() => setApproveTarget(null)}
        />
        <Divider />
        <DialogContent sx={{ p: 4 }}>
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
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar
                sx={{
                  width: 44,
                  height: 44,
                  bgcolor: "text.primary",
                  color: "background.paper",
                }}
              >
                {approveTarget?.full_name?.[0]}
              </Avatar>
              <Box>
                <Typography variant="subtitle1" fontWeight={700}>
                  {approveTarget?.full_name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {approveTarget?.email}
                </Typography>
              </Box>
            </Stack>
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
                  <Typography variant="body2" fontWeight={600} sx={{ mt: 0.25 }}>
                    {approveTarget?.purpose_of_visit || "-"}
                  </Typography>
                </Box>
                {approveTarget?.department?.name && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Department
                    </Typography>
                    <Typography variant="body2" fontWeight={500} sx={{ mt: 0.25 }}>
                      {approveTarget.department.name}
                    </Typography>
                  </Box>
                )}
                {isSuperAdmin && approveTarget?.status === "admin_approved" &&
                  (approveTarget?.access_levels?.length || approveTarget?.access_level?.name) && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Access Zones
                    </Typography>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
                      {(approveTarget.access_levels?.length
                        ? approveTarget.access_levels
                        : approveTarget.access_level ? [approveTarget.access_level] : []
                      ).map((al) => (
                        <Chip key={al.id} label={al.name} size="small" variant="outlined" sx={{ fontWeight: 600, fontSize: "0.65rem", height: 20 }} />
                      ))}
                    </Box>
                  </Box>
                )}
                {isSuperAdmin && approveTarget?.status === "admin_approved" && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Multi Check-in
                    </Typography>
                    <Chip
                      label={approveTarget?.allow_multi_checkin ? "Allowed" : "Not Allowed"}
                      size="small"
                      color={approveTarget?.allow_multi_checkin ? "success" : "default"}
                      variant={approveTarget?.allow_multi_checkin ? "filled" : "outlined"}
                      sx={{ mt: 0.5, fontWeight: 700, fontSize: "0.6rem", height: 20 }}
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
                <Typography variant="body2" fontWeight={600} sx={{ mt: 0.25 }}>
                  {slotDateText}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                  {slotTimeText}
                </Typography>
              </Box>
            </Stack>
          </Box>

          {/* Access Zones + Multi-Checkin */}
          <Stack spacing={2}>
            <FormControl fullWidth required error={Boolean(accessLevelError)}>
              <InputLabel>Access Zones</InputLabel>
              <Select
                multiple
                value={selectedAccessLevelIds}
                label="Access Zones"
                onChange={(e) => { setSelectedAccessLevelIds(e.target.value); setAccessLevelError(""); }}
                renderValue={(selected) => (
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {selected.map((id) => {
                      const al = accessLevels.find((a) => a.id === id);
                      return <Chip key={id} label={al?.name || id} size="small" />;
                    })}
                  </Box>
                )}
                sx={{ borderRadius: 2 }}
              >
                {accessLevels.map((al) => (
                  <MenuItem key={al.id} value={al.id}>{al.name}</MenuItem>
                ))}
              </Select>
              {accessLevelError && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>{accessLevelError}</Typography>
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
                  <Typography variant="body2">Allow Multiple Check-ins</Typography>
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
                onChange={(e) => { setVehiclePlate(e.target.value.toUpperCase()); setVehiclePlateError(""); }}
                error={Boolean(vehiclePlateError)}
                helperText={vehiclePlateError}
                sx={{ mb: 1, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
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
                    if (!e.target.checked) { setVipReason(""); setVipReasonError(""); }
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
                onChange={(e) => { setVipReason(e.target.value); setVipReasonError(""); }}
                error={Boolean(vipReasonError)}
                helperText={vipReasonError}
                sx={{ mb: 1, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                inputProps={{ maxLength: 300 }}
              />
            )}
          </Stack>

          <Divider sx={{ my: 1 }} />

          <Box>
            <Typography
              variant="subtitle2"
              sx={{ mb: 1.5, fontWeight: 700, color: "text.primary" }}
            >
              Review and Adjust Schedule
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
                      maxHeight: "310px",
                      transform: "scale(0.88)",
                      transformOrigin: "top left",
                    },
                  }}
                >
                  <DateCalendar
                    value={scheduledDate}
                    onChange={(newDate) => setScheduledDate(newDate)}
                    disablePast
                  />
                </Box>
              </Grid>

              <Grid size={{ xs: 12, sm: 5.5 }}>
                <Stack spacing={2}>
                  {/* Toggle between Custom and Preset using Tabs */}
                  <Tabs
                    value={scheduleType}
                    onChange={(_, value) => setScheduleType(value)}
                    variant="fullWidth"
                    sx={{
                      minHeight: 46,
                      bgcolor: (theme) => alpha(theme.palette.text.primary, isDark ? 0.06 : 0.04),
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
                    <Box sx={{ p: 2, bgcolor: "action.hover", borderRadius: 2, border: "1px solid", borderColor: "divider", minHeight: 280 }}>
                      <Stack spacing={2} sx={{ mb: 2 }}>
                        {renderTimeDropdowns("scheduledFrom", "Expected Arrival (From)")}
                        {renderTimeDropdowns("scheduledTo", "Expected Departure (To)")}
                      </Stack>
                      <Box sx={{ p: 1.5, bgcolor: "background.paper", borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <ICONS.info sx={{ fontSize: 16, color: "text.secondary" }} />
                          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ fontSize: 12 }}>
                            Visit duration: {getDuration()} min
                          </Typography>
                        </Stack>
                      </Box>
                    </Box>
                  )}

                  {/* Preset Options Section */}
                  {scheduleType === "preset" && (
                    <Box sx={{ p: 2, bgcolor: "action.hover", borderRadius: 2, border: "1px solid", borderColor: "divider", minHeight: 280 }}>
                      {/* Preset Type Selector */}
                      <Box sx={{ mb: 2.5 }}>
                        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: "block", mb: 1, textTransform: "uppercase", fontSize: "0.65rem" }}>
                          Preset Type
                        </Typography>
                        <TextField
                          fullWidth
                          select
                          size="small"
                          value={selectedPreset || "fullDay"}
                          onChange={(e) => setSelectedPreset(e.target.value)}
                          sx={{
                            "& .MuiOutlinedInput-root": { borderRadius: 2 },
                          }}
                        >
                          <MenuItem value="fullDay">Full Day</MenuItem>
                          <MenuItem value="fullWeek">Full Week</MenuItem>
                          <MenuItem value="fullMonth">Full Month</MenuItem>
                        </TextField>
                      </Box>

                      {/* Date Range Display */}
                      <Box sx={{ p: 1.5, bgcolor: "background.paper", borderRadius: 2, border: "1px solid", borderColor: "divider", mb: 2.5 }}>
                        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: "block", mb: 0.5, textTransform: "uppercase", fontSize: "0.65rem" }}>
                          Date Range
                        </Typography>
                        <Typography variant="body2" fontWeight={600} color="text.primary">
                          {(() => {
                            const date = scheduledDate;
                            let from = date.clone();
                            let to = date.clone();
                            if (selectedPreset === "fullDay") {
                              to = to.add(1, "day");
                            } else if (selectedPreset === "fullWeek") {
                              to = to.add(6, "days");
                            } else if (selectedPreset === "fullMonth") {
                              to = to.add(30, "days");
                            }
                            return `${from.format("DD MMMM YYYY")} to ${to.format("DD MMMM YYYY")}`;
                          })()}
                        </Typography>
                      </Box>

                      <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: "block", mb: 2, textTransform: "uppercase", fontSize: "0.65rem" }}>
                        Time
                      </Typography>
                      <Stack spacing={2}>
                        {renderTimeDropdowns("scheduledFrom", selectedPreset === "fullDay" ? "Full Day Start Time" : "Start Time")}
                        {selectedPreset !== "fullDay" && renderTimeDropdowns("scheduledTo", "End Time")}
                        {selectedPreset === "fullDay" && (
                          <Box sx={{ p: 1.5, bgcolor: "background.paper", borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <ICONS.info sx={{ fontSize: 16, color: "text.secondary" }} />
                              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ fontSize: 12 }}>
                                Full day booking: Same time for start and end
                              </Typography>
                            </Stack>
                          </Box>
                        )}
                      </Stack>
                    </Box>
                  )}
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
              Note <Typography component="span" variant="caption" color="text.secondary">(optional)</Typography>
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
        </DialogContent>
        <Divider />
        <DialogActions sx={{ p: 2.5, gap: 1, justifyContent: "flex-end" }}>
          <Button
            onClick={() => setApproveTarget(null)}
            startIcon={<ICONS.cancel />}
            sx={{ px: 3, fontWeight: 700, borderRadius: 30 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="success"
            startIcon={<ICONS.check />}
            onClick={handleApprove}
            disabled={!scheduledDate || submitting}
            sx={{ borderRadius: 30, px: 4, fontWeight: 700 }}
          >
            {isSuperAdmin ? "Final Approve" : "Approve"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reverted Reject Confirm Dialog */}
      <Dialog
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogHeader
          title="Reject Registration"
          onClose={() => setRejectTarget(null)}
        />
        <DialogContent>
          <Typography variant="body2" mb={2} color="text.secondary">
            Are you sure you want to reject{" "}
            <strong>{rejectTarget?.full_name}</strong>?
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Rejection Reason"
            placeholder="e.g. Missing documentation..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button
            onClick={() => setRejectTarget(null)}
            startIcon={<ICONS.cancel />}
            sx={{ fontWeight: 700, borderRadius: 30 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<ICONS.close />}
            onClick={handleReject}
            disabled={!rejectReason.trim()}
            sx={{ fontWeight: 700, borderRadius: 30 }}
          >
            Reject
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}


