"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Stack,
  Tooltip,
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Avatar,
  Chip,
  Divider,
  CircularProgress,
  Pagination,
  FormControl,
  Select,
  InputLabel,
  InputAdornment,
  MenuItem,
  alpha,
  Tabs,
  Tab,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { useColorMode } from "@/contexts/ThemeContext";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";
import dayjs from "dayjs";
import { useMessage } from "@/contexts/MessageContext";
import { useSocket } from "@/contexts/SocketContext";
import ICONS from "@/utils/iconUtil";

import {
  getRegistrations,
  updateRegistrationStatus,
  getRegistrationById,
} from "@/services/registrationService";
import {
  formatDate,
  formatTime,
  formatDateTimeWithLocale,
  parse24To12,
  convert12To24,
} from "@/utils/dateUtils";

import AppCard from "@/components/cards/AppCard";
import FilterModal from "@/components/modals/FilterModal";
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
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [approveTarget, setApproveTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [fetchingProfile, setFetchingProfile] = useState(false);
  const [loadingId, setLoadingId] = useState(null);

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

  const fetchPending = async () => {
    setLoading(true);
    try {
      const data = await getRegistrations("pending");
      setRows(data);
    } catch (err) {
      console.error("Failed to fetch pending approvals", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const { on } = useSocket();

  useEffect(() => {
    const unsubNew = on("registration:new", () => {
      fetchPending();
    });

    const unsubUpdated = on("registration:updated", () => {
      fetchPending();
    });

    return () => {
      unsubNew?.();
      unsubUpdated?.();
    };
  }, [on]);

  const filtered = useMemo(() => {
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

      let detectedType = "custom";
      let detectedPreset = "fullDay";

      if (fullReg.requested_date_from && fullReg.requested_date_to) {
        const dateFrom = dayjs(fullReg.requested_date_from);
        const dateTo = dayjs(fullReg.requested_date_to);
        const daysDiff = dateTo.diff(dateFrom, "days");

        if (daysDiff === 0) {
          detectedType = "preset";
          detectedPreset = "fullDay";
        } else if (daysDiff === 6) {
          detectedType = "preset";
          detectedPreset = "fullWeek";
        } else if (daysDiff === 30) {
          detectedType = "preset";
          detectedPreset = "fullMonth";
        }
      }

      setScheduleType(detectedType);
      if (detectedType === "preset") {
        setSelectedPreset(detectedPreset);
      }

      if (fullReg.requested_date_from) {
        setScheduledDate(dayjs(fullReg.requested_date_from));
        setScheduledFrom(
          fullReg.requested_time_from?.substring(0, 5) || "09:00",
        );
        setScheduledTo(fullReg.requested_time_to?.substring(0, 5) || "18:00");
      } else {
        setScheduledDate(dayjs());
        setScheduledFrom("09:00");
        setScheduledTo("18:00");
      }
    } catch (err) {
      showMessage("Failed to fetch fresh data for approval", "error");
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
    try {
      let fromDate, toDate;
      if (scheduleType === "preset") {
        const date = scheduledDate;
        let from = date.clone();
        let to = date.clone();

        if (selectedPreset === "fullDay") {
          from = from.startOf("day");
          to = to.endOf("day");
        } else if (selectedPreset === "fullWeek") {
          from = from.startOf("week");
          to = to.endOf("week");
        } else if (selectedPreset === "fullMonth") {
          from = from.startOf("month");
          to = to.endOf("month");
        }

        fromDate = from.format("YYYY-MM-DD");
        toDate = to.format("YYYY-MM-DD");
      } else {
        fromDate = scheduledDate.format("YYYY-MM-DD");
        toDate = scheduledDate.format("YYYY-MM-DD");
      }

      const payload = {
        approvedDateFrom: fromDate,
        approvedDateTo: toDate,
        approvedTimeFrom: `${scheduledFrom}:00`,
        approvedTimeTo: `${scheduledTo}:00`,
      };

      await updateRegistrationStatus(approveTarget.id, "approve", payload);
      showMessage(
        `${approveTarget.full_name}'s registration has been approved.`,
        "success",
      );
      setApproveTarget(null);
      fetchPending();
    } catch (err) {
      showMessage("Failed to approve registration", "error");
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    try {
      await updateRegistrationStatus(rejectTarget.id, "reject", {
        rejectionReason: rejectReason,
      });
      showMessage(
        `${rejectTarget.full_name}'s registration has been rejected.`,
        "warning",
      );
      setRejectTarget(null);
      setRejectReason("");
      fetchPending();
    } catch (err) {
      showMessage("Failed to reject registration", "error");
    }
  };

  const handleChangePage = (event, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

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
                  {/* Header with gradient + date */}
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
                            bgcolor: "warning.light",
                            color: "warning.dark",
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
                        {row.purpose_of_visit || "—"}
                      </Typography>
                    </Box>
                    {row.requested_date_from && (
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
                            {row.requested_date_from && row.requested_date_to && row.requested_date_from !== row.requested_date_to
                              ? `${formatDate(row.requested_date_from)} to ${formatDate(row.requested_date_to)}`
                              : row.requested_date_from ? formatDate(row.requested_date_from) : "—"}
                          </Typography>
                          {(row.requested_time_from || row.requested_time_to) && (
                            <Typography
                              variant="caption"
                              sx={{
                                fontWeight: 600,
                                color: "text.secondary",
                                display: "block",
                              }}
                            >
                              {row.requested_time_from ? formatTime(row.requested_time_from) : "—"} -{" "}
                              {row.requested_time_to ? formatTime(row.requested_time_to) : "—"}
                            </Typography>
                          )}
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
                      color="success"
                      size="small"
                      startIcon={
                        fetchingProfile && loadingId === row.id ? (
                          <CircularProgress size={16} color="inherit" />
                        ) : (
                          <ICONS.check />
                        )
                      }
                      onClick={() => openApprove(row)}
                      disabled={fetchingProfile}
                      sx={{ borderRadius: 2, fontWeight: 800 }}
                    >
                      Approve
                    </Button>
                    <Button
                      fullWidth
                      variant="outlined"
                      color="error"
                      size="small"
                      startIcon={<ICONS.close />}
                      onClick={() => {
                        setRejectTarget(row);
                        setRejectReason("");
                      }}
                      sx={{ borderRadius: 2, fontWeight: 700 }}
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
          title="Approve & Schedule"
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
            <Stack direction="row" justifyContent="space-between">
              <Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block" }}
                >
                  Purpose
                </Typography>
                <Typography variant="body2" fontWeight={500}>
                  {approveTarget?.purpose_of_visit}
                </Typography>
              </Box>
              <Box sx={{ textAlign: "right" }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block" }}
                >
                  Requested Slot
                </Typography>
                <Typography variant="body2" fontWeight={500}>
                  {approveTarget?.requested_date_from && approveTarget?.requested_date_to && approveTarget.requested_date_from !== approveTarget.requested_date_to
                    ? `${formatDate(approveTarget.requested_date_from)} to ${formatDate(approveTarget.requested_date_to)}`
                    : approveTarget?.requested_date_from ? formatDate(approveTarget.requested_date_from) : "—"}
                </Typography>
                {(approveTarget?.requested_time_from || approveTarget?.requested_time_to) && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                    {approveTarget?.requested_time_from ? formatTime(approveTarget.requested_time_from) : "—"} - {approveTarget?.requested_time_to ? formatTime(approveTarget.requested_time_to) : "—"}
                  </Typography>
                )}
              </Box>
            </Stack>
          </Box>

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
                              from = from.startOf("day");
                              to = to.endOf("day");
                            } else if (selectedPreset === "fullWeek") {
                              from = from.startOf("day");
                              to = to.add(6, "days").endOf("day");
                            } else if (selectedPreset === "fullMonth") {
                              from = from.startOf("day");
                              to = to.add(30, "days").endOf("day");
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
        </DialogContent>
        <Divider />
        <DialogActions sx={{ p: 2.5, gap: 1, justifyContent: "flex-end" }}>
          <Button
            onClick={() => setApproveTarget(null)}
            startIcon={<ICONS.cancel />}
            sx={{ px: 3, fontWeight: 600, borderRadius: 30 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="success"
            startIcon={<ICONS.checkCircle />}
            onClick={handleApprove}
            sx={{ borderRadius: 30, px: 4, fontWeight: 700 }}
          >
            Approve
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
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<ICONS.close />}
            onClick={handleReject}
            disabled={!rejectReason.trim()}
          >
            Reject
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
