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
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Avatar,
  Chip,
  Divider,
  Grid,
  CircularProgress,
  Pagination,
  FormControl,
  Select,
  InputLabel,
  InputAdornment,
  MenuItem,
  alpha,
} from "@mui/material";
import { useColorMode } from "@/contexts/ThemeContext";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";
import dayjs from "dayjs";
import { useMessage } from "@/contexts/MessageContext";
import ICONS from "@/utils/iconUtil";

import { 
  getRegistrations, 
  updateRegistrationStatus, 
  getRegistrationById 
} from "@/services/registrationService";
import { formatDate, formatTime, formatDateTimeWithLocale, parse24To12, convert12To24 } from "@/utils/dateUtils";

import AppCard from "@/components/cards/AppCard";
import FilterModal from "@/components/modals/FilterModal";

const TIME_SLOTS = [
  "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"
];

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
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

  const filtered = useMemo(() => {
    return rows.filter((r) =>
      [r.full_name, r.email].join(" ").toLowerCase().includes(search.toLowerCase())
    ).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
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
      if (fullReg.requested_date) {
        setScheduledDate(dayjs(fullReg.requested_date));
        setScheduledFrom(fullReg.requested_time_from?.substring(0, 5) || "09:00");
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
        setScheduledTo(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
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
        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ ml: 1, mb: 0.5, display: "block", textTransform: "uppercase", fontSize: "0.6rem" }}>
          {label}
        </Typography>
        <Stack direction="row" spacing={0.5}>
          <Box sx={{ flex: 1.2 }}>
            <Typography variant="caption" sx={{ fontSize: "0.6rem", fontWeight: 700, ml: 1, color: "text.secondary", textTransform: "uppercase" }}>Hr</Typography>
            <TextField
              select
              size="small"
              value={hour12}
              onChange={(e) => handleTimePartChange(type, "hour12", e.target.value)}
              sx={{ 
                width: "100%",
                "& .MuiOutlinedInput-root": { borderRadius: 30 },
                "& .MuiSelect-select": { fontSize: "0.75rem", py: 1, px: 1 }
              }}
            >
              {HOURS.map((h) => (
                <MenuItem key={h} value={h} sx={{ fontSize: "0.75rem" }}>{h}</MenuItem>
              ))}
            </TextField>
          </Box>
          <Box sx={{ flex: 1.2 }}>
            <Typography variant="caption" sx={{ fontSize: "0.6rem", fontWeight: 700, ml: 1, color: "text.secondary", textTransform: "uppercase" }}>Min</Typography>
            <TextField
              select
              size="small"
              value={minute}
              onChange={(e) => handleTimePartChange(type, "minute", e.target.value)}
              sx={{ 
                width: "100%",
                "& .MuiOutlinedInput-root": { borderRadius: 30 },
                "& .MuiSelect-select": { fontSize: "0.75rem", py: 1, px: 1 }
              }}
            >
              {MINUTES.map((m) => (
                <MenuItem key={m} value={m} sx={{ fontSize: "0.75rem" }}>{m}</MenuItem>
              ))}
            </TextField>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" sx={{ fontSize: "0.6rem", fontWeight: 700, ml: 1, color: "text.secondary", textTransform: "uppercase" }}>AM/PM</Typography>
            <TextField
              select
              size="small"
              value={ampm}
              onChange={(e) => handleTimePartChange(type, "ampm", e.target.value)}
              sx={{ 
                width: "100%",
                "& .MuiOutlinedInput-root": { borderRadius: 30 },
                "& .MuiSelect-select": { fontSize: "0.75rem", py: 1, px: 1 }
              }}
            >
              {PERIODS.map((p) => (
                <MenuItem key={p} value={p} sx={{ fontSize: "0.75rem" }}>{p}</MenuItem>
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
      const payload = {
        approvedDate: scheduledDate.format("YYYY-MM-DD"),
        approvedTimeFrom: `${scheduledFrom}:00`,
        approvedTimeTo: `${scheduledTo}:00`, 
      };
      
      await updateRegistrationStatus(approveTarget.id, "approve", payload);
      showMessage(`${approveTarget.full_name}'s registration has been approved.`, "success");
      setApproveTarget(null);
      fetchPending();
    } catch (err) {
      showMessage("Failed to approve registration", "error");
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    try {
      await updateRegistrationStatus(rejectTarget.id, "reject", { rejectionReason: rejectReason });
      showMessage(`${rejectTarget.full_name}'s registration has been rejected.`, "warning");
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
          <Typography variant="h5" fontWeight="bold">Approvals</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, opacity: 0.8 }}>
            Review and manage incoming visitor requests.
          </Typography>
        </Box>
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            gap: 1,
            width: { xs: "100%", sm: "auto" },
          }}
        >
          <Chip
            label={`${rows.length} pending requests`}
            color={rows.length > 0 ? "warning" : "default"}
            variant="filled"
            sx={{ fontWeight: 800, borderRadius: 2 }}
          />
        </Box>
      </Box>

      <Divider sx={{ mb: 3 }} />

      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center" mb={4}>
        <TextField
          size="small"
          variant="outlined"
          placeholder="Search pending requests..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          InputProps={{
            startAdornment: <ICONS.search fontSize="small" sx={{ mr: 1, opacity: 0.6 }} />
          }}
          sx={{ minWidth: { xs: "100%", sm: 280 } }}
        />
        
        <Stack direction="row" spacing={1.5} sx={{ width: { xs: "100%", md: "auto" } }}>
          <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 150 } }}>
            <InputLabel>Records per page</InputLabel>
            <Select 
              value={rowsPerPage} 
              onChange={handleChangeRowsPerPage} 
              label="Records per page"
            >
              {[6, 12, 24, 48].map((n) => (
                <MenuItem key={n} value={n}>{n}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Stack>

      {loading ? (
        <Stack alignItems="center" justifyContent="center" sx={{ py: 15 }}>
          <CircularProgress size={32} thickness={5} />
          <Typography variant="body2" sx={{ mt: 2, fontWeight: 600, opacity: 0.6 }}>Loading pending requests...</Typography>
        </Stack>
      ) : (
        <>
          <Grid container spacing={4} justifyContent="center">
            {pagedRows.length === 0 ? (
              <Grid item xs={12}>
                <Box sx={{ py: 12, textAlign: "center", bgcolor: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)", borderRadius: 6, border: "2px dashed", borderColor: "divider" }}>
                  <ICONS.checkCircle sx={{ fontSize: 60, display: "block", mx: "auto", mb: 2, color: "success.light", opacity: 0.3 }} />
                  <Typography variant="h6" fontWeight={700}>{search ? "No matches found" : "All caught up!"}</Typography>
                  <Typography variant="body2" color="text.secondary">No pending approvals to display.</Typography>
                </Box>
              </Grid>
            ) : (
              pagedRows.map((row) => (
                <Grid 
                  item 
                  xs={12} sm={6} md={4} 
                  key={row.id}
                  sx={{ display: { xs: "flex", sm: "block" }, width: { xs: "100%", sm: "auto" } }}
                >
                  <AppCard 
                    sx={{ 
                      height: "100%",
                      width: "100%",
                      maxWidth: 380,
                      mx: "auto"
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
                          <Stack direction="row" alignItems="center" sx={{ gap: 1 }}>
                            <Avatar sx={{ width: 40, height: 40, bgcolor: "warning.light", color: "warning.dark", fontSize: "1rem", fontWeight: 800 }}>
                              {row.full_name?.split(" ").map(n => n[0]).slice(0, 2).join("") || "?"}
                            </Avatar>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Typography variant="subtitle1" fontWeight={800} noWrap sx={{ lineHeight: 1.2 }}>
                                {row.full_name}
                              </Typography>
                            </Box>
                          </Stack>
                          <Typography variant="caption" sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "text.secondary" }}>
                            <ICONS.time fontSize="inherit" sx={{ opacity: 0.7 }} />
                            Submitted {formatDateTimeWithLocale(row.created_at)}
                          </Typography>
                       </Stack>
                    </Box>

                    {/* Dynamic Fields */}
                    <Box sx={{ flexGrow: 1, px: 2, py: 1.5 }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", py: 0.8, borderBottom: "1px solid", borderColor: "divider" }}>
                        <Typography variant="body2" sx={{ display: "flex", alignItems: "center", gap: 0.6, color: "text.secondary" }}>
                          <ICONS.emailOutline fontSize="small" sx={{ opacity: 0.6 }} /> Email
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, ml: 2, flex: 1, textAlign: "right", color: "text.primary" }}>
                          {row.email || "—"}
                        </Typography>
                      </Box>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", py: 0.8, borderBottom: "1px solid", borderColor: "divider" }}>
                        <Typography variant="body2" sx={{ display: "flex", alignItems: "center", gap: 0.6, color: "text.secondary" }}>
                          <ICONS.info fontSize="small" sx={{ opacity: 0.6 }} /> Purpose
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, ml: 2, flex: 1, textAlign: "right", color: "text.primary" }}>
                          {row.purpose_of_visit || "—"}
                        </Typography>
                      </Box>
                      {row.requested_date && (
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", py: 0.8, borderBottom: "none" }}>
                        <Typography variant="body2" sx={{ display: "flex", alignItems: "center", gap: 0.6, color: "text.secondary" }}>
                          <ICONS.event fontSize="small" sx={{ opacity: 0.6 }} /> Requested Slot
                        </Typography>
                        <Box sx={{ ml: 2, flex: 1, textAlign: "right" }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: "primary.main" }}>
                            {formatDate(row.requested_date)}
                          </Typography>
                          <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary", display: "block" }}>
                            {formatTime(row.requested_time_from)} - {formatTime(row.requested_time_to)}
                          </Typography>
                        </Box>
                      </Box>
                      )}
                    </Box>

                    {/* Actions / Footer */}
                    <Box sx={{ p: 2, borderTop: "1px solid", borderColor: "divider", bgcolor: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)", display: "flex", gap: 1.5 }}>
                      <Button 
                        fullWidth 
                        variant="contained" 
                        color="success" 
                        size="small"
                        startIcon={(fetchingProfile && loadingId === row.id) ? <CircularProgress size={16} color="inherit" /> : <ICONS.check />}
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
                        onClick={() => { setRejectTarget(row); setRejectReason(""); }}
                        sx={{ borderRadius: 2, fontWeight: 700 }}
                      >
                        Reject
                      </Button>
                    </Box>
                  </AppCard>
                </Grid>
              ))
            )}
          </Grid>

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
        maxWidth="sm" 
        fullWidth 
        PaperProps={{ sx: { borderRadius: 4, overflow: "hidden", variant: "frosted" } }}
      >
        <DialogTitle sx={{ py: 2.5, px: 3 }}>
          <Typography variant="h6" fontWeight={700} component="span">Approve & Schedule</Typography>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ p: 4 }}>
          <Box sx={{ mb: 3, p: 2, borderRadius: 2, bgcolor: (theme) => alpha(theme.palette.text.primary, 0.02), border: (theme) => `1px solid ${alpha(theme.palette.text.primary, 0.04)}` }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar sx={{ width: 44, height: 44, bgcolor: "text.primary", color: "background.paper" }}>{approveTarget?.full_name?.[0]}</Avatar>
              <Box>
                <Typography variant="subtitle1" fontWeight={700}>{approveTarget?.full_name}</Typography>
                <Typography variant="caption" color="text.secondary">{approveTarget?.email}</Typography>
              </Box>
            </Stack>
            <Divider sx={{ my: 1.5 }} />
            <Stack direction="row" justifyContent="space-between">
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>Purpose</Typography>
                <Typography variant="body2" fontWeight={500}>{approveTarget?.purpose_of_visit}</Typography>
              </Box>
              <Box sx={{ textAlign: "right" }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>Requested On</Typography>
                <Typography variant="body2" fontWeight={500}>{approveTarget?.requested_date}</Typography>
              </Box>
            </Stack>
          </Box>

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 700, color: "text.primary" }}>Review and Adjust Schedule</Typography>
            <Grid container spacing={3}>
               <Grid item xs={12} sm={6.5}>
                 <Box
                   sx={{
                     border: "1px solid",
                     borderColor: "divider",
                     borderRadius: 4,
                     bgcolor: "action.hover",
                     "& .MuiDateCalendar-root": { width: "100%", height: "auto", maxHeight: "310px", transform: "scale(0.88)", transformOrigin: "top left" },
                   }}
                 >
                   <DateCalendar
                     value={scheduledDate}
                     onChange={(newDate) => setScheduledDate(newDate)}
                     disablePast
                   />
                 </Box>
               </Grid>
 
               <Grid item xs={12} sm={5.5}>
                 <Stack spacing={2}>
                   {renderTimeDropdowns("scheduledFrom", "Start Time")}
                   {renderTimeDropdowns("scheduledTo", "End Time")}
 
                  <Box sx={{ mt: 1, p: 1.5, bgcolor: (theme) => alpha(theme.palette.text.primary, 0.03), borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <ICONS.info sx={{ fontSize: 16, color: "text.secondary" }} />
                      <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ fontSize: 12 }}>
                        Visit duration: {getDuration()} min
                      </Typography>
                    </Stack>
                  </Box>
                  
                  <Typography variant="caption" color="text.secondary" sx={{ fontStyle: "italic", px: 0.5 }}>
                    Adjust based on availability.
                  </Typography>
                </Stack>
              </Grid>
            </Grid>
          </Box>

          <Box sx={{ 
            mt: 3, px: 2, py: 1.2, borderRadius: 2, 
            bgcolor: (theme) => alpha(theme.palette.info.main, 0.08), 
            display: "flex", alignItems: "center", gap: 1.5,
            border: "1px solid",
            borderColor: "info.light"
          }}>
            <ICONS.info sx={{ fontSize: 18, color: "info.main" }} />
            <Typography variant="caption" color="info.main" fontWeight={600}>
              The visitor will be notified of their confirmed time.
            </Typography>
          </Box>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ p: 2.5, gap: 1 }}>
          <Button onClick={() => setApproveTarget(null)} sx={{ px: 3, fontWeight: 600, borderRadius: 30 }}>Cancel</Button>
          <Button 
            variant="contained" 
            color="success" 
            onClick={handleApprove}
            sx={{ borderRadius: 30, px: 4, fontWeight: 700 }}
          >
            Finalize & Approve
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
        <DialogTitle sx={{ fontWeight: 700 }} component="h2">Reject Registration</DialogTitle>
        <DialogContent>
          <Typography variant="body2" mb={2} color="text.secondary">
            Are you sure you want to reject <strong>{rejectTarget?.full_name}</strong>?
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
          <Button onClick={() => setRejectTarget(null)}>Cancel</Button>
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
