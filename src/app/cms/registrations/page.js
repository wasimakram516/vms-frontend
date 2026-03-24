"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Box,
  Typography,
  Chip,
  IconButton,
  TextField,
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
  Pagination,
  Select,
  InputLabel,
  Grid,
  CircularProgress,
  Alert,
  FormControl,
} from "@mui/material";
import { useColorMode } from "@/contexts/ThemeContext";
import { useMessage } from "@/contexts/MessageContext";
import ICONS from "@/utils/iconUtil";
import DateTimeFieldFlatpickr from "@/components/forms/DateTimeFieldFlatpickr";
import AppCard, { AppCardText } from "@/components/cards/AppCard";
import FilterModal from "@/components/modals/FilterModal";
import { getRegistrations, updateRegistrationStatus, getRegistrationById, updateRegistration } from "@/services/registrationService";
import { formatDate, formatTime, formatDateTimeWithLocale } from "@/utils/dateUtils";

const STATUS_CONFIG = {
  pending:     { label: "Pending",    color: "warning",  icon: <ICONS.time fontSize="small" /> },
  approved:    { label: "Approved",   color: "success",  icon: <ICONS.checkCircle fontSize="small" /> },
  rejected:    { label: "Rejected",   color: "error",    icon: <ICONS.close fontSize="small" /> },
  checked_in:  { label: "Checked In", color: "info",     icon: <ICONS.login fontSize="small" /> },
  checked_out: { label: "Checked Out",color: "default",  icon: <ICONS.logout fontSize="small" /> },
  cancelled:   { label: "Cancelled",  color: "default",  icon: <ICONS.close fontSize="small" /> },
  expired:     { label: "Expired",    color: "default",  icon: <ICONS.history fontSize="small" /> },
};

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = ["00", "15", "30", "45"];
const PERIODS = ["AM", "PM"];

export default function CmsRegistrationsPage() {
  const { mode } = useColorMode();
  const isDark = mode === "dark";
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [timeFilter, setTimeFilter] = useState({ hour12: "", minute: "00", ampm: "AM", enabled: false });
  const [selected, setSelected] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [fetchingProfile, setFetchingProfile] = useState(false);
  const [filterModalOpen, setFilterModalOpen] = useState(false);

  const { showMessage } = useMessage();

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(12);

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

  const handleManualStatusChange = async (status) => {
    if (!selected) return;
    setActionLoading(true);
    try {
      await updateRegistration(selected.id, { status });
      showMessage(`Status updated to ${status}`, "success");
      await fetchData();
      const updated = await getRegistrationById(selected.id);
      setSelected(updated);
    } catch (err) {
      showMessage("Failed to update status", "error");
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

      let matchTime = true;
      if (timeFilter.enabled && timeFilter.hour12) {
        const selectedTime24 = `${String(timeFilter.ampm === "PM" ? (parseInt(timeFilter.hour12) % 12) + 12 : (parseInt(timeFilter.hour12) % 12)).padStart(2, "0")}:${timeFilter.minute}:00`;
        matchTime = r.requested_time_from >= selectedTime24;
      }
      
      return matchSearch && matchStatus && matchDate && matchTime;
    }).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
  }, [data, search, statusFilter, dateFilter, timeFilter]);

  const pagedRows = useMemo(() => {
    return filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [filtered, page, rowsPerPage]);

  const handleChangePage = (event, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const sc = STATUS_CONFIG[selected?.status] || { label: selected?.status, color: "default" };

  const activeFiltersCount = (statusFilter !== "all" ? 1 : 0) + (dateFilter ? 1 : 0);

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
          <Typography variant="h5" fontWeight="bold">Registrations</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, opacity: 0.8 }}>
            View and manage all visitor registrations across your system.
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
            label={`${filtered.length} total records`} 
            variant="filled" 
            sx={{ 
              fontWeight: 800, 
              height: 32, 
              bgcolor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
              borderRadius: 2
            }} 
          />
        </Box>
      </Box>

      <Divider sx={{ mb: 3 }} />

      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center" mb={4}>
        <TextField
          size="small"
          variant="outlined"
          placeholder="Search name, email, purpose..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          InputProps={{
            startAdornment: <ICONS.search fontSize="small" sx={{ mr: 1, opacity: 0.6 }} />
          }}
          sx={{ minWidth: { xs: "100%", sm: 280 } }}
        />
        
        <Stack direction="row" spacing={1.5} sx={{ width: { xs: "100%", md: "auto" } }}>
          <Button
            variant="outlined"
            startIcon={<ICONS.filter />}
            onClick={() => setFilterModalOpen(true)}
          >
            Filters {activeFiltersCount > 0 && `(${activeFiltersCount})`}
          </Button>

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

          {(search || statusFilter !== "all" || dateFilter) && (
            <Tooltip title="Clear All Filters">
              <Button 
                size="small"
                color="secondary"
                startIcon={<ICONS.close />}
                onClick={() => { setSearch(""); setStatusFilter("all"); setDateFilter(""); setPage(0); }}
                sx={{ ml: 1 }}
              >
                Clear
              </Button>
            </Tooltip>
          )}
        </Stack>
      </Stack>

      {loading ? (
        <Stack alignItems="center" justifyContent="center" sx={{ py: 15 }}>
          <CircularProgress size={32} thickness={5} />
          <Typography variant="body2" sx={{ mt: 2, fontWeight: 600, opacity: 0.6 }}>Loading registrations...</Typography>
        </Stack>
      ) : (
        <>
          <Grid container spacing={4} justifyContent="center">
            {pagedRows.length === 0 ? (
              <Grid item xs={12}>
                <Box sx={{ py: 12, textAlign: "center", bgcolor: (theme) => isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)", borderRadius: 6, border: "2px dashed", borderColor: "divider" }}>
                  <ICONS.empty sx={{ fontSize: 60, opacity: 0.2, mb: 2 }} />
                  <Typography variant="h6" fontWeight={700}>No records found</Typography>
                  <Typography variant="body2" color="text.secondary">Try adjusting your filters or search query.</Typography>
                </Box>
              </Grid>
            ) : (
              pagedRows.map((row) => {
                const config = STATUS_CONFIG[row.status] || { label: row.status, color: "default", icon: <ICONS.info fontSize="small" /> };
                return (
                  <Grid 
                    item 
                    xs={12} sm={6} md={4} 
                    key={row.id}
                    sx={{ display: { xs: "flex", sm: "block" }, width: { xs: "100%", sm: "auto" } }}
                  >
                    <AppCard 
                      onClick={() => !fetchingProfile && handleOpenProfile(row)}
                      sx={{ 
                        cursor: "pointer", 
                        opacity: fetchingProfile ? 0.7 : 1,
                        height: "100%",
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
                              <Avatar sx={{ width: 40, height: 40, bgcolor: isDark ? "#fff" : "#000", color: isDark ? "#000" : "#fff", fontSize: "1rem", fontWeight: 800 }}>
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
                              {formatDateTimeWithLocale(row.created_at)}
                            </Typography>
                         </Stack>
                         <Stack direction="row" alignItems="center" spacing={0.6} sx={{ mt: 1 }}>
                           <Chip label={config.label} color={config.color} size="small" icon={config.icon} sx={{ fontWeight: 800, borderRadius: 1.5, height: 24 }} />
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
                            <ICONS.event fontSize="small" sx={{ opacity: 0.6 }} /> Scheduled
                          </Typography>
                          <Box sx={{ ml: 2, flex: 1, textAlign: "right" }}>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: "text.primary" }}>
                              {formatDate(row.requested_date)}
                            </Typography>
                            {(row.requested_time_from || row.requested_time_to) && (
                            <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary", display: "block" }}>
                              {formatTime(row.requested_time_from)} - {formatTime(row.requested_time_to)}
                            </Typography>
                            )}
                          </Box>
                        </Box>
                        )}
                      </Box>
                      
                      {/* Actions / Footer */}
                      <Box sx={{ p: 1.5, borderTop: "1px solid", borderColor: "divider", bgcolor: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)", display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
                        <Tooltip title="View Details">
                           <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleOpenProfile(row); }} sx={{ color: "primary.main" }}>
                             <ICONS.view fontSize="small" />
                           </IconButton>
                        </Tooltip>
                      </Box>
                    </AppCard>
                  </Grid>
                );
              })
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

      {/* Filter Modal */}
      <FilterModal
        open={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        title="Filter Registrations"
      >
        <Stack spacing={3}>
          <Box>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, ml: 1 }}>Status</Typography>
            <TextField
              select
              fullWidth
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
              InputProps={{ sx: { borderRadius: 3 } }}
            >
              <MenuItem value="all">Any Status</MenuItem>
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <MenuItem key={key} value={key}>{cfg.label}</MenuItem>
              ))}
            </TextField>
          </Box>

          <Box>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, ml: 1 }}>Visit Date</Typography>
            <DateTimeFieldFlatpickr 
              placeholder="Select Date"
              value={dateFilter}
              onChange={(val) => { setDateFilter(val); setPage(0); }}
              enableTime={false}
            />
          </Box>

          <Box>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1, ml: 1 }}>
              <Typography variant="subtitle2" fontWeight={700}>Filter By Time</Typography>
              <Chip 
                label={timeFilter.enabled ? "Enabled" : "Disabled"} 
                size="small" 
                color={timeFilter.enabled ? "primary" : "default"}
                onClick={() => setTimeFilter({ ...timeFilter, enabled: !timeFilter.enabled })}
                sx={{ fontWeight: 800, cursor: "pointer" }}
              />
            </Stack>
            
            <Stack direction="row" spacing={1} sx={{ opacity: timeFilter.enabled ? 1 : 0.5, pointerEvents: timeFilter.enabled ? "auto" : "none" }}>
              <TextField
                select
                fullWidth
                label="Hr"
                size="small"
                value={timeFilter.hour12}
                onChange={(e) => setTimeFilter({ ...timeFilter, hour12: e.target.value })}
                InputProps={{ sx: { borderRadius: 3 } }}
              >
                {HOURS.map((h) => (
                  <MenuItem key={h} value={h}>{h}</MenuItem>
                ))}
              </TextField>
              <TextField
                select
                fullWidth
                label="Min"
                size="small"
                value={timeFilter.minute}
                onChange={(e) => setTimeFilter({ ...timeFilter, minute: e.target.value })}
                InputProps={{ sx: { borderRadius: 3 } }}
              >
                {MINUTES.map((m) => (
                  <MenuItem key={m} value={m}>{m}</MenuItem>
                ))}
              </TextField>
              <TextField
                select
                fullWidth
                label="AM/PM"
                size="small"
                value={timeFilter.ampm}
                onChange={(e) => setTimeFilter({ ...timeFilter, ampm: e.target.value })}
                InputProps={{ sx: { borderRadius: 3 } }}
              >
                {PERIODS.map((p) => (
                  <MenuItem key={p} value={p}>{p}</MenuItem>
                ))}
              </TextField>
            </Stack>
          </Box>

          <Button 
            variant="contained" 
            fullWidth 
            onClick={() => setFilterModalOpen(false)}
            sx={{ mt: 2, height: 48, borderRadius: 3, fontWeight: 800 }}
          >
            Apply Filters
          </Button>
          
          <Button 
            variant="text" 
            fullWidth 
            color="inherit"
            onClick={() => { 
                setStatusFilter("all"); 
                setDateFilter(""); 
                setTimeFilter({ hour12: "", minute: "00", ampm: "AM", enabled: false });
                setFilterModalOpen(false); 
                setPage(0); 
            }}
            sx={{ fontWeight: 700, opacity: 0.6 }}
          >
            Clear All
          </Button>
        </Stack>
      </FilterModal>

      <Dialog 
        open={!!selected} 
        onClose={() => setSelected(null)} 
        maxWidth="sm" 
        fullWidth 
        PaperProps={{ sx: { borderRadius: 4, overflow: "hidden", variant: "frosted" } }}
      >
        <DialogTitle sx={{ py: 2.5, px: 3 }}>
          <Typography variant="h6" fontWeight={700} component="span">Visitor Details</Typography>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ p: 4 }}>
          {selected && (() => {
            const sc = STATUS_CONFIG[selected.status] || { label: selected.status, color: "default" };
            return (
              <Stack spacing={3}>
                <Box sx={{ p: 2, borderRadius: 2, bgcolor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", border: "1px solid", borderColor: "divider" }}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Avatar sx={{ width: 54, height: 54, bgcolor: isDark ? "#fff" : "#000", color: isDark ? "#000" : "#fff", fontSize: "1.2rem", fontWeight: 700 }}>
                      {selected.full_name?.split(" ").map(n => n[0]).slice(0,2).join("")}
                    </Avatar>
                    <Box>
                      <Typography variant="h6" fontWeight={800}>{selected.full_name}</Typography>
                      <Typography variant="body2" color="text.secondary">{selected.email}</Typography>
                      <Chip label={sc.label} color={sc.color} size="small" sx={{ mt: 1, fontWeight: 700, height: 20, fontSize: "0.6rem" }} />
                    </Box>
                  </Stack>
                </Box>

                <Box sx={{ px: 1 }}>
  <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 32px" }}>
    <InfoItem label="Email Address" value={selected.email} icon={<ICONS.emailOutline fontSize="small" />} />
    <InfoItem label="Phone Number" value={selected.phone} icon={<ICONS.phone fontSize="small" />} />

    <InfoItem 
      label="Requested Schedule" 
      value={`${formatDate(selected.requested_date)}, ${formatTime(selected.requested_time_from)}-${formatTime(selected.requested_time_to)}`} 
      icon={<ICONS.event fontSize="small" />} 
    />
    <InfoItem 
      label="Approved Schedule" 
      value={selected.approved_date ? `${formatDate(selected.approved_date)}, ${formatTime(selected.approved_time_from)}-${formatTime(selected.approved_time_to)}` : "Pending Approval"} 
      icon={<ICONS.checkCircle fontSize="small" />} 
    />

    <InfoItem label="Purpose of Visit" value={selected.purpose_of_visit} icon={<ICONS.info fontSize="small" />} />
    <Box />
  </Box>
</Box>

                {selected.fieldValues?.length > 0 && (
                  <Box>
                    <Divider sx={{ mb: 2 }} />
                    <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 700, color: "text.secondary", textTransform: "uppercase", fontSize: "0.7rem", letterSpacing: 0.5 }}>
                      Additional Information
                    </Typography>
                    <Box sx={{ px: 1 }}>
                      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 32px" }}>
                        {selected.fieldValues.map(fv => (
                          <Box key={fv.id} sx={{ p: 1.5, borderRadius: 2, border: "1px solid", borderColor: "divider", bgcolor: isDark ? "rgba(255,255,255,0.01)" : "rgba(0,0,0,0.01)" }}>
                             <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, textTransform: "uppercase", fontSize: "0.6rem" }}>
                                {fv.customField?.label || fv.customField?.fieldKey || "Field"}
                             </Typography>
                             <Typography variant="body2" fontWeight={600} sx={{ mt: 0.3 }}>
                                {fv.value || "—"}
                             </Typography>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  </Box>
                )}

                {selected.status === "rejected" && selected.rejection_reason && (
                  <Alert severity="error" variant="outlined" sx={{ borderRadius: 2 }}>
                    <Typography variant="caption" fontWeight={700} display="block">REJECTION REASON</Typography>
                    <Typography variant="body2">{selected.rejection_reason}</Typography>
                  </Alert>
                )}
              </Stack>
            );
          })()}
        </DialogContent>
        <Divider />
        <DialogActions sx={{ p: 2.5, gap: 1, justifyContent: "space-between", bgcolor: "rgba(0,0,0,0.01)" }}>
          <Box>
            <TextField
              select
              size="small"
              label="Action: Set Status"
              value={selected?.status || ""}
              onChange={(e) => handleManualStatusChange(e.target.value)}
              disabled={actionLoading}
              sx={{ 
                minWidth: 200,
                "& .MuiOutlinedInput-root": { borderRadius: 30, bgcolor: "background.paper" }
              }}
            >
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <MenuItem key={key} value={key}>{cfg.label}</MenuItem>
              ))}
            </TextField>
          </Box>

          <Stack direction="row" spacing={1.5}>
            <Button 
              onClick={() => setSelected(null)} 
              sx={{ px: 3, fontWeight: 700, borderRadius: 30, textTransform: "none", color: "text.secondary" }}
            >
              Close
            </Button>
            {selected?.status === "approved" && (
              <Button 
                variant="contained" 
                color="error" 
                onClick={() => handleStatusUpdate(selected.id, "cancel")}
                disabled={actionLoading}
                startIcon={actionLoading ? <CircularProgress size={18} /> : <ICONS.close />}
                sx={{ borderRadius: 30, px: 4, fontWeight: 700, textTransform: "none" }}
              >
                Cancel Registration
              </Button>
            )}
          </Stack>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function InfoItem({ label, value, icon }) {
  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
        <Box sx={{ color: "primary.main", display: "flex", alignItems: "center", minWidth: 22, opacity: 0.8 }}>
          {icon}
        </Box>
        <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, textTransform: "uppercase", fontSize: "0.65rem", letterSpacing: 0.5 }}>
          {label}
        </Typography>
      </Stack>
      <Box sx={{ pl: "30px" }}>
        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: "0.85rem", color: "text.primary", lineHeight: 1.4 }}>
          {value || "—"}
        </Typography>
      </Box>
    </Box>
  );
}
