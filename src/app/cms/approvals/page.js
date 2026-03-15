"use client";

import { useState } from "react";
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
  Alert,
  Chip,
  Divider,
  Grid,
} from "@mui/material";
import DateTimeFieldFlatpickr from "@/components/forms/DateTimeFieldFlatpickr";
import ICONS from "@/utils/iconUtil";

const MOCK_PENDING = [
  { id: "2", full_name: "Sara Aijaz",  email: "sara@example.com",   phone: "+96598765432", purpose_of_visit: "Interview",  requested_date: "2026-03-16", requested_time: "10:30 AM", created_at: "2026-03-14 10:30", requested_dt: "2026-03-16T10:30:00" },
  { id: "6", full_name: "Ali Hassan",   email: "ali@example.com",   phone: "+96577788899", purpose_of_visit: "Interview",  requested_date: "2026-03-18", requested_time: "02:00 PM", created_at: "2026-03-14 14:30", requested_dt: "2026-03-18T14:00:00" },
  { id: "7", full_name: "Omar Ali",     email: "omar@example.com",   phone: "+96544433221", purpose_of_visit: "Meeting",    requested_date: "2026-03-19", requested_time: "09:00 AM", created_at: "2026-03-14 15:00", requested_dt: "2026-03-19T09:00:00" },
];

export default function CmsApprovalsPage() {
  const [rows, setRows] = useState(MOCK_PENDING);
  const [approveTarget, setApproveTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  
  // Approval scheduling state
  const [scheduledDt, setScheduledDt] = useState(null);

  const [toast, setToast] = useState(null); // { msg, type }

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const openApprove = (row) => {
    setApproveTarget(row);
    setScheduledDt(row.requested_dt || new Date());
  };

  const handleApprove = () => {
    const dt = scheduledDt instanceof Date ? scheduledDt : new Date(scheduledDt);
    const dateStr = dt.toLocaleDateString();
    const timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    setRows((prev) => prev.filter((r) => r.id !== approveTarget.id));
    showToast(`${approveTarget.full_name}'s registration has been approved for ${dateStr} at ${timeStr}.`);
    setApproveTarget(null);
  };

  const handleReject = () => {
    if (!rejectReason.trim()) return;
    setRows((prev) => prev.filter((r) => r.id !== rejectTarget.id));
    showToast(`${rejectTarget.full_name}'s registration has been rejected.`, "warning");
    setRejectTarget(null);
    setRejectReason("");
  };

  return (
    <Box>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} mb={3} gap={1}>
        <Box>
          <Typography variant="h4" fontWeight={800}>Approvals</Typography>
          <Typography color="text.secondary" variant="body2" mt={0.5}>
            Review and approve or reject pending visitor requests. You can adjust the visit schedule before final approval.
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

      {toast && (
        <Alert severity={toast.type === "warning" ? "warning" : "success"} sx={{ mb: 2, borderRadius: 2 }} onClose={() => setToast(null)}>
          {toast.msg}
        </Alert>
      )}

      <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid rgba(0,0,0,0.07)", overflow: "hidden" }}>
        <TableContainer>
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
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6, color: "text.secondary" }}>
                    <ICONS.checkCircle sx={{ fontSize: 40, display: "block", mx: "auto", mb: 1, color: "success.light" }} />
                    <Typography variant="body2">All caught up! No pending approvals.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Avatar sx={{ width: 34, height: 34, fontSize: "0.8rem", bgcolor: "warning.light", color: "warning.dark", fontWeight: 700 }}>
                          {row.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight={600}>{row.full_name}</Typography>
                          <Typography variant="caption" color="text.secondary">{row.email}</Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell><Typography variant="body2">{row.purpose_of_visit}</Typography></TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>{row.requested_date}</Typography>
                        <Typography variant="caption" color="text.secondary">{row.requested_time}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell><Typography variant="body2" color="text.secondary">{row.created_at}</Typography></TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Tooltip title="Review & Approve">
                          <IconButton size="small" color="success" onClick={() => openApprove(row)}>
                            <ICONS.check fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Reject">
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
        </TableContainer>
      </Paper>

      {/* Approve Confirm & Schedule */}
      <Dialog 
        open={!!approveTarget} 
        onClose={() => setApproveTarget(null)} 
        maxWidth="sm" 
        fullWidth 
        PaperProps={{ 
          sx: { 
            borderRadius: 4, 
            boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
            overflow: "hidden" 
          } 
        }}
      >
        <DialogTitle sx={{ py: 2.5, px: 3 }}>
          <Typography variant="h6" fontWeight={700}>Approve & Schedule</Typography>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ p: 4, overflow: "hidden" }}>
          {/* Visitor Summary Card */}
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, mb: 3, bgcolor: "rgba(18,129,153,0.02)", borderColor: "rgba(18,129,153,0.1)" }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar sx={{ width: 44, height: 44, bgcolor: "success.light", color: "success.dark", fontSize: "1.1rem" }}>
                {approveTarget?.full_name[0]}
              </Avatar>
              <Box>
                <Typography variant="subtitle1" fontWeight={700} sx={{ lineHeight: 1.2 }}>{approveTarget?.full_name}</Typography>
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
          </Paper>
          
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1.2, color: "text.primary" }}>Review and Adjust Schedule</Typography>
            <DateTimeFieldFlatpickr 
              label="Finalized Arrival Time"
              value={scheduledDt}
              onChange={(dt) => setScheduledDt(dt)}
              helperText={`Currently set for: ${approveTarget?.requested_date} at ${approveTarget?.requested_time}`}
            />
          </Box>

          <Box sx={{ mt: 3, px: 2, py: 1.2, borderRadius: 2, bgcolor: "rgba(2,136,209,0.04)", display: "flex", alignItems: "center", gap: 1.5 }}>
            <ICONS.info sx={{ fontSize: 18, color: "info.main" }} />
            <Typography variant="caption" color="info.dark" fontWeight={500} sx={{ lineHeight: 1.3 }}>
              Visitor will receive an automated email with this confirmed time and their QR token.
            </Typography>
          </Box>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ p: 2.5, gap: 1 }}>
          <Button 
            variant="text" 
            onClick={() => setApproveTarget(null)} 
            sx={{ px: 3, fontWeight: 600, color: "text.secondary" }}
          >
            Cancel
          </Button>
          <Button 
            variant="contained" 
            color="success" 
            onClick={handleApprove} 
            sx={{ 
              borderRadius: "10px", 
              px: 4, 
              py: 0.8,
              fontWeight: 700,
              boxShadow: "0 4px 12px rgba(46,125,50,0.15)"
            }}
          >
            Finalize & Approve
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectTarget} onClose={() => setRejectTarget(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle>Reject Registration</DialogTitle>
        <DialogContent>
          <Typography variant="body2" mb={2}>
            Provide a reason for rejecting <strong>{rejectTarget?.full_name}</strong>&apos;s registration.
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Rejection Reason"
            placeholder="e.g. Missing documentation, unauthorized visit..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button variant="outlined" onClick={() => setRejectTarget(null)}>Cancel</Button>
          <Button variant="contained" color="error" startIcon={<ICONS.close />} onClick={handleReject} disabled={!rejectReason.trim()}>
            Reject
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
