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
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  Stack,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Divider,
  Avatar,
  MenuItem,
  TablePagination,
  Grid,
  CircularProgress,
  Alert,
} from "@mui/material";
import { useMessage } from "@/contexts/MessageContext";
import ICONS from "@/utils/iconUtil";
import DateTimeFieldFlatpickr from "@/components/forms/DateTimeFieldFlatpickr";
import { getRegistrations, updateRegistrationStatus, getRegistrationById } from "@/services/registrationService";

const STATUS_CONFIG = {
  pending:     { label: "Pending",    color: "warning" },
  approved:    { label: "Approved",   color: "success" },
  rejected:    { label: "Rejected",   color: "error" },
  checked_in:  { label: "Checked In", color: "info" },
  checked_out: { label: "Checked Out",color: "default" },
  cancelled:   { label: "Cancelled",  color: "default" },
  expired:     { label: "Expired",    color: "default" },
};

export default function CmsRegistrationsPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [selected, setSelected] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [fetchingProfile, setFetchingProfile] = useState(false);

  const { showMessage } = useMessage();

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getRegistrations(statusFilter);
      setData(res);
    } catch (err) {
      console.error("Failed to load registrations", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const handleOpenProfile = async (row) => {
    setFetchingProfile(true);
    try {
      const fullDetail = await getRegistrationById(row.id);
      setSelected(fullDetail);
    } catch (err) {
      showMessage("Failed to load visitor profile", "error");
    } finally {
      setFetchingProfile(false);
    }
  };

  const handleStatusUpdate = async (id, status) => {
    let payload = {};
    if (status === "reject") {
      const reason = window.prompt("Enter rejection reason:");
      if (reason === null) return;
      payload = { rejectionReason: reason || "No reason provided" };
    } else if (status === "approve") {
      payload = {
        approvedDate: selected?.requested_date,
        approvedTimeFrom: selected?.requested_time_from || "09:00:00",
        approvedTimeTo: selected?.requested_time_to || "17:00:00",
      };
    }

    setActionLoading(true);
    try {
      await updateRegistrationStatus(id, status, payload);
      showMessage(`Registration ${status}ed successfully.`, "success");
      await fetchData();
      setSelected(null);
    } catch (err) {
      showMessage(`Failed to ${status} registration`, "error");
      console.error(`Failed to ${status} registration`, err);
    } finally {
      setActionLoading(false);
    }
  };

  const filtered = useMemo(() => {
    return data.filter((r) => {
      const matchSearch = [r.full_name, r.email, r.purpose_of_visit].join(" ").toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || r.status === statusFilter;
      
      let matchDate = true;
      if (dateFilter) {
        const filterStr = (typeof dateFilter === "string" ? dateFilter : dateFilter.toISOString()).split(" ")[0].split("T")[0];
        matchDate = r.requested_date === filterStr;
      }
      
      return matchSearch && matchStatus && matchDate;
    }).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
  }, [data, search, statusFilter, dateFilter]);

  const pagedRows = useMemo(() => {
    return filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [filtered, page, rowsPerPage]);

  const handleChangePage = (event, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const sc = STATUS_CONFIG[selected?.status] || { label: selected?.status, color: "default" };

  return (
    <Box>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} mb={3} gap={1}>
        <Box>
          <Typography variant="h4" fontWeight={800}>Registrations</Typography>
          <Typography color="text.secondary" variant="body2" mt={0.5}>
            Comprehensive list of visitor requests and lifecycle status.
          </Typography>
        </Box>
        <Chip label={`${filtered.length} total records`} variant="outlined" size="small" sx={{ fontWeight: 600 }} />
      </Stack>

      <Paper elevation={0} sx={{ borderRadius: 4, border: "1px solid rgba(0,0,0,0.07)", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
        <Box sx={{ p: 2, bgcolor: "rgba(0,0,0,0.01)", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
            <TextField
              fullWidth size="small"
              placeholder="Search name, email, purpose..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <ICONS.search sx={{ fontSize: 18, color: "text.secondary" }} />
                  </InputAdornment>
                ),
              }}
              sx={{ flexGrow: 1, "& .MuiInputBase-root": { height: 40 } }}
            />
            
            <Stack direction="row" spacing={1.5} sx={{ width: { xs: "100%", md: "auto" } }} alignItems="center">
              <TextField
                select size="small"
                label="Status"
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
                sx={{ minWidth: 140, "& .MuiInputBase-root": { height: 40 } }}
              >
                <MenuItem value="all">Any Status</MenuItem>
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                  <MenuItem key={key} value={key}>{cfg.label}</MenuItem>
                ))}
              </TextField>
              
              <Box sx={{ 
                minWidth: 180, 
                display: "flex",
                alignItems: "center",
                height: 40,
                "& .flatpickr-input": { 
                   height: "40px !important", 
                   borderRadius: "4px",
                   paddingLeft: "12px",
                   paddingRight: "12px",
                   border: "1px solid rgba(0,0,0,0.23) !important",
                   bgcolor: "background.paper",
                   width: "100%",
                   fontSize: "0.875rem",
                   color: "text.primary",
                   "&:hover": { borderColor: "rgba(0,0,0,0.87) !important" },
                   "&:focus": { borderColor: "primary.main !important", borderWidth: "2px", outline: "none" }
                } 
              }}>
                <DateTimeFieldFlatpickr 
                  placeholder="Visit Date"
                  value={dateFilter}
                  onChange={(val) => { setDateFilter(val); setPage(0); }}
                />
              </Box>

              {(search || statusFilter !== "all" || dateFilter) && (
                <Tooltip title="Reset Filters">
                  <IconButton 
                    size="small" 
                    color="error" 
                    onClick={() => { setSearch(""); setStatusFilter("all"); setDateFilter(""); setPage(0); }}
                    sx={{ 
                      height: 40,
                      width: 40,
                      border: "1px solid rgba(0,0,0,0.12)",
                      "&:hover": { bgcolor: "rgba(211,47,47,0.04)" }
                    }}
                  >
                    <ICONS.close fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          </Stack>
        </Box>

        <TableContainer sx={{ minHeight: 400 }}>
          {loading ? (
            <Stack alignItems="center" justifyContent="center" sx={{ py: 10 }}>
              <CircularProgress size={32} />
              <Typography variant="caption" sx={{ mt: 1 }}>Loading registrations...</Typography>
            </Stack>
          ) : (
            <Table>
              <TableHead sx={{ bgcolor: "rgba(0,0,0,0.02)" }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Visitor</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Purpose</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Date Requested</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pagedRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 8, color: "text.secondary" }}>
                      <ICONS.empty sx={{ fontSize: 40, display: "block", mx: "auto", mb: 1, opacity: 0.3 }} />
                      <Typography variant="body2" fontWeight={500}>No matches found for current filters</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedRows.map((row) => {
                    const { label, color } = STATUS_CONFIG[row.status] || { label: row.status, color: "default" };
                    return (
                      <TableRow key={row.id} hover sx={{ cursor: "pointer", opacity: fetchingProfile ? 0.7 : 1 }} onClick={() => !fetchingProfile && handleOpenProfile(row)}>
                        <TableCell>
                          <Stack direction="row" alignItems="center" spacing={1.5}>
                            <Avatar sx={{ width: 34, height: 34, fontSize: "0.85rem", bgcolor: "primary.light", color: "primary.dark", fontWeight: 700 }}>
                              {row.full_name?.split(" ").map((n) => n[0]).slice(0, 2).join("") || "?"}
                            </Avatar>
                            <Box>
                              <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.2 }}>{row.full_name}</Typography>
                              <Typography variant="caption" color="text.secondary">{row.email}</Typography>
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>{row.purpose_of_visit}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">{row.requested_date}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={label} color={color} size="small" sx={{ fontWeight: 700, fontSize: "0.7rem", height: 20 }} />
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="Detailed Profile">
                            <IconButton 
                                size="small" 
                                color="primary" 
                                onClick={(e) => { e.stopPropagation(); handleOpenProfile(row); }}
                                disabled={fetchingProfile}
                            >
                              {fetchingProfile ? <CircularProgress size={16} /> : <ICONS.view fontSize="small" />}
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })
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

      <Dialog 
        open={!!selected} 
        onClose={() => setSelected(null)} 
        maxWidth="sm" 
        fullWidth 
        PaperProps={{ sx: { borderRadius: 4, overflow: "hidden" } }}
      >
        <DialogTitle sx={{ py: 2.5, px: 3 }}>
          <Typography variant="h6" fontWeight={700} component="span">Visitor Details</Typography>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ p: 4 }}>
          {selected && (
            <Stack spacing={3}>
              <Box sx={{ p: 2, borderRadius: 2, bgcolor: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.04)" }}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Avatar sx={{ width: 54, height: 54, bgcolor: "primary.main", fontSize: "1.2rem", fontWeight: 700 }}>
                    {selected.full_name?.split(" ").map(n => n[0]).slice(0,2).join("")}
                  </Avatar>
                  <Box>
                    <Typography variant="h6" fontWeight={800}>{selected.full_name}</Typography>
                    <Typography variant="body2" color="text.secondary">{selected.email}</Typography>
                    <Chip label={sc.label} color={sc.color} size="small" sx={{ mt: 1, fontWeight: 700, height: 20, fontSize: "0.6rem" }} />
                  </Box>
                </Stack>
              </Box>

              <Grid container spacing={2.5}>
                <Grid item xs={12} sm={6}>
                  <InfoItem label="Email Address" value={selected.email} icon={<ICONS.email fontSize="small" />} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <InfoItem label="Phone Number" value={selected.phone} icon={<ICONS.phone fontSize="small" />} />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <InfoItem 
                    label="Requested Schedule" 
                    value={`${selected.requested_date} (${selected.requested_time_from} - ${selected.requested_time_to})`} 
                    icon={<ICONS.event fontSize="small" />} 
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <InfoItem 
                    label="Approved Schedule" 
                    value={selected.approved_date ? `${selected.approved_date} (${selected.approved_time_from} - ${selected.approved_time_to})` : "Pending Approval"} 
                    icon={<ICONS.checkCircle fontSize="small" />} 
                  />
                </Grid>

                <Grid item xs={12}>
                  <InfoItem label="Purpose of Visit" value={selected.purpose_of_visit} icon={<ICONS.info fontSize="small" />} />
                </Grid>
              </Grid>

              {selected.fieldValues?.length > 0 && (
                <Box>
                   <Divider sx={{ mb: 2 }} />
                   <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 700, color: "text.secondary", textTransform: "uppercase", fontSize: "0.7rem", letterSpacing: 0.5 }}>
                     Additional Information
                   </Typography>
                   <Grid container spacing={2}>
                     {selected.fieldValues.map(fv => (
                       <Grid item xs={12} sm={6} key={fv.id}>
                         <Box sx={{ p: 1.5, borderRadius: 2, border: "1px solid rgba(0,0,0,0.06)", bgcolor: "rgba(0,0,0,0.01)" }}>
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, textTransform: "uppercase", fontSize: "0.6rem" }}>
                               {fv.customField?.label || fv.customField?.fieldKey || "Field"}
                            </Typography>
                            <Typography variant="body2" fontWeight={600} sx={{ mt: 0.3 }}>
                               {fv.value || "—"}
                            </Typography>
                         </Box>
                       </Grid>
                     ))}
                   </Grid>
                </Box>
              )}

              {selected.status === "rejected" && selected.rejection_reason && (
                <Alert severity="error" variant="outlined" sx={{ borderRadius: 2 }}>
                  <Typography variant="caption" fontWeight={700} display="block">REJECTION REASON</Typography>
                  <Typography variant="body2">{selected.rejection_reason}</Typography>
                </Alert>
              )}
            </Stack>
          )}
        </DialogContent>
        <Divider />
        <DialogActions sx={{ p: 2.5, gap: 1 }}>
          <Button onClick={() => setSelected(null)} sx={{ px: 3, fontWeight: 600 }}>Close</Button>
          {selected?.status === "approved" && (
            <Button 
              variant="contained" 
              color="error" 
              onClick={() => handleStatusUpdate(selected.id, "cancel")}
              disabled={actionLoading}
              startIcon={actionLoading ? <CircularProgress size={18} /> : <ICONS.close />}
              sx={{ borderRadius: "10px", px: 4, fontWeight: 700 }}
            >
              Cancel Registration
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function InfoItem({ label, value, icon }) {
  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
        <Box sx={{ color: "text.secondary", display: "flex", alignItems: "center" }}>{icon}</Box>
        <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, textTransform: "uppercase", fontSize: "0.65rem", letterSpacing: 0.5 }}>
          {label}
        </Typography>
      </Stack>
      <Typography variant="body2" sx={{ fontWeight: 600, pl: 3 }}>
        {value || "—"}
      </Typography>
    </Box>
  );
}
