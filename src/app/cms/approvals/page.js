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
  TablePagination,
  InputAdornment,
  MenuItem,
} from "@mui/material";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";
import dayjs from "dayjs";
import { useMessage } from "@/contexts/MessageContext";
import ICONS from "@/utils/iconUtil";

import { getRegistrations, updateRegistrationStatus, getRegistrationById } from "@/services/registrationService";

const TIME_SLOTS = [
  "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"
];

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
  const { showMessage } = useMessage();

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

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

  const handleTimeChange = (type, value) => {
    if (type === "scheduledFrom") {
      setScheduledFrom(value);
      if (scheduledTo <= value) {
        const fromIndex = TIME_SLOTS.indexOf(value);
        if (fromIndex !== -1 && fromIndex + 1 < TIME_SLOTS.length) {
          setScheduledTo(TIME_SLOTS[fromIndex + 1]);
        }
      }
    } else {
      setScheduledTo(value);
    }
  };

  const getDuration = () => {
    if (!scheduledFrom || !scheduledTo) return 0;
    return dayjs(`2000-01-01 ${scheduledTo}`).diff(dayjs(`2000-01-01 ${scheduledFrom}`), 'minute');
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
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} mb={3} gap={1}>
        <Box>
          <Typography variant="h4" fontWeight={800}>Approvals</Typography>
          <Typography color="text.secondary" variant="body2" mt={0.5}>
            Review and manage incoming visitor requests.
          </Typography>
        </Box>
        <Chip
          label={`${rows.length} pending`}
          color={rows.length > 0 ? "warning" : "default"}
          variant="outlined"
          size="small"
          sx={{ fontWeight: 600 }}
        />
      </Stack>

      <Paper elevation={0} sx={{ borderRadius: 4, border: "1px solid rgba(0,0,0,0.07)", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
        <Box sx={{ p: 2, borderBottom: "1px solid rgba(0,0,0,0.06)", bgcolor: "rgba(0,0,0,0.01)" }}>
          <TextField
            size="small"
            placeholder="Search pending requests..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            sx={{ width: { xs: "100%", sm: 320 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <ICONS.search sx={{ fontSize: 18, color: "text.secondary" }} />
                </InputAdornment>
              ),
            }}
          />
        </Box>

        <TableContainer sx={{ minHeight: 400 }}>
          {loading ? (
            <Stack alignItems="center" justifyContent="center" sx={{ py: 10 }}>
              <CircularProgress size={32} />
              <Typography variant="caption" sx={{ mt: 1 }}>Loading pending requests...</Typography>
            </Stack>
          ) : (
            <Table>
              <TableHead sx={{ bgcolor: "rgba(0,0,0,0.02)" }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Visitor</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Purpose</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Requested Slot</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Submitted At</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pagedRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 8, color: "text.secondary" }}>
                      <ICONS.checkCircle sx={{ fontSize: 40, display: "block", mx: "auto", mb: 1, color: "success.light", opacity: 0.5 }} />
                      <Typography variant="body2">{search ? "No matches found" : "All caught up! No pending approvals."}</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                pagedRows.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Avatar sx={{ width: 34, height: 34, fontSize: "0.85rem", bgcolor: "warning.light", color: "warning.dark", fontWeight: 700 }}>
                          {row.full_name?.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight={600}>{row.full_name}</Typography>
                          <Typography variant="caption" color="text.secondary">{row.email}</Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell><Typography variant="body2" fontWeight={500}>{row.purpose_of_visit}</Typography></TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.2 }}>{row.requested_date}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {row.requested_time_from} - {row.requested_time_to}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell><Typography variant="caption" color="text.secondary">{row.created_at}</Typography></TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Tooltip title="Approve & Adjust Schedule">
                          <IconButton 
                            size="small" 
                            color="success" 
                            onClick={() => openApprove(row)}
                            disabled={fetchingProfile}
                          >
                            {(fetchingProfile && loadingId === row.id) ? (
                              <CircularProgress size={16} color="inherit" />
                            ) : (
                              <ICONS.check fontSize="small" />
                            )}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Reject Request">
                          <IconButton size="small" color="error" onClick={() => { setRejectTarget(row); setRejectReason(""); }}>
                            <ICONS.close fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
              </TableBody>
            </Table>
          )}
        </TableContainer>

        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={filtered.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          sx={{ 
            borderTop: "1px solid rgba(0,0,0,0.06)",
            "& .MuiTablePagination-select": { pr: 4 },
            "& .MuiTablePagination-selectIcon": { right: 4 }
          }}
        />
      </Paper>

      {/* Reverted Approve Confirm & Schedule Dialog */}
      <Dialog 
        open={!!approveTarget} 
        onClose={() => setApproveTarget(null)} 
        maxWidth="sm" 
        fullWidth 
        PaperProps={{ sx: { borderRadius: 4, overflow: "hidden" } }}
      >
        <DialogTitle sx={{ py: 2.5, px: 3 }}>
          <Typography variant="h6" fontWeight={700} component="span">Approve & Schedule</Typography>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ p: 4 }}>
          <Box sx={{ mb: 3, p: 2, borderRadius: 2, bgcolor: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.04)" }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar sx={{ width: 44, height: 44, bgcolor: "primary.light" }}>{approveTarget?.full_name?.[0]}</Avatar>
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
              <Grid item xs={12} sm={7}>
                <Box
                  sx={{
                    border: "1px solid rgba(0,0,0,0.05)",
                    borderRadius: 4,
                    bgcolor: "rgba(0,0,0,0.01)",
                    "& .MuiDateCalendar-root": { width: "100%", height: "auto", maxHeight: "330px" },
                  }}
                >
                  <DateCalendar
                    value={scheduledDate}
                    onChange={(newDate) => setScheduledDate(newDate)}
                    disablePast
                  />
                </Box>
              </Grid>

              <Grid item xs={12} sm={5}>
                <Stack spacing={2}>
                  <TextField 
                    select fullWidth size="small" label="From" 
                    value={scheduledFrom} 
                    onChange={(e) => handleTimeChange("scheduledFrom", e.target.value)}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 3 } }}
                  >
                    {TIME_SLOTS.slice(0, -1).map((slot) => (
                      <MenuItem key={slot} value={slot}>{slot}</MenuItem>
                    ))}
                  </TextField>

                  <TextField 
                    select fullWidth size="small" label="To" 
                    value={scheduledTo} 
                    onChange={(e) => handleTimeChange("scheduledTo", e.target.value)}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 3 } }}
                  >
                    {TIME_SLOTS.map((slot) => (
                      <MenuItem key={slot} value={slot} disabled={slot <= scheduledFrom}>{slot}</MenuItem>
                    ))}
                  </TextField>

                  <Box sx={{ mt: 1, p: 2, bgcolor: "primary.main", borderRadius: 3, color: "white", boxShadow: "0 4px 12px rgba(18,129,153,0.15)" }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <ICONS.info sx={{ fontSize: 16 }} />
                      <Typography variant="caption" fontWeight={700} sx={{ fontSize: 12 }}>
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

          <Box sx={{ mt: 3, px: 2, py: 1.2, borderRadius: 2, bgcolor: "rgba(2,136,209,0.04)", display: "flex", alignItems: "center", gap: 1.5 }}>
            <ICONS.info sx={{ fontSize: 18, color: "info.main" }} />
            <Typography variant="caption" color="info.dark" fontWeight={500}>
              The visitor will be notified of their confirmed time.
            </Typography>
          </Box>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ p: 2.5, gap: 1 }}>
          <Button onClick={() => setApproveTarget(null)} sx={{ px: 3, fontWeight: 600 }}>Cancel</Button>
          <Button 
            variant="contained" 
            color="success" 
            onClick={handleApprove}
            sx={{ borderRadius: "10px", px: 4, fontWeight: 700 }}
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
