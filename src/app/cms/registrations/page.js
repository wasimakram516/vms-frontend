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
} from "@mui/material";
import ICONS from "@/utils/iconUtil";

const STATUS_CONFIG = {
  pending:     { label: "Pending",    color: "warning" },
  approved:    { label: "Approved",   color: "success" },
  rejected:    { label: "Rejected",   color: "error" },
  checked_in:  { label: "Checked In", color: "info" },
  checked_out: { label: "Checked Out",color: "default" },
  cancelled:   { label: "Cancelled",  color: "default" },
  expired:     { label: "Expired",    color: "default" },
};

const MOCK_REGISTRATIONS = [
  { id: "1", full_name: "Ahmed Al-Rashidi",   email: "ahmed@example.com",   phone: "+96512345678", purpose_of_visit: "Meeting",    status: "approved",    requested_date: "2026-03-15", created_at: "2026-03-14 09:00" },
  { id: "2", full_name: "Sara Al-Mutairi",    email: "sara@example.com",    phone: "+96598765432", purpose_of_visit: "Interview",  status: "pending",     requested_date: "2026-03-16", created_at: "2026-03-14 10:30" },
  { id: "3", full_name: "Khalid Al-Fahad",    email: "khalid@example.com",  phone: "+96555512345", purpose_of_visit: "Delivery",   status: "checked_in",  requested_date: "2026-03-15", created_at: "2026-03-14 11:00" },
  { id: "4", full_name: "Noor Al-Sabah",      email: "noor@example.com",    phone: "+96566698765", purpose_of_visit: "Other",      status: "rejected",    requested_date: "2026-03-17", created_at: "2026-03-14 12:00" },
  { id: "5", full_name: "Faisal Al-Harbi",    email: "faisal@example.com",  phone: "+96511122334", purpose_of_visit: "Meeting",    status: "checked_out", requested_date: "2026-03-14", created_at: "2026-03-13 08:00" },
  { id: "6", full_name: "Maha Al-Ghamdi",     email: "maha@example.com",    phone: "+96577788899", purpose_of_visit: "Interview",  status: "pending",     requested_date: "2026-03-18", created_at: "2026-03-14 14:30" },
];

export default function CmsRegistrationsPage() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  const filtered = MOCK_REGISTRATIONS.filter((r) =>
    [r.full_name, r.email, r.purpose_of_visit, r.status]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const sc = STATUS_CONFIG[selected?.status] || { label: selected?.status, color: "default" };

  return (
    <Box>
      {/* Header */}
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} mb={3} gap={1}>
        <Box>
          <Typography variant="h4" fontWeight={800}>Registrations</Typography>
          <Typography color="text.secondary" variant="body2" mt={0.5}>
            All visitor registration requests and their statuses.
          </Typography>
        </Box>
        <Chip label={`${filtered.length} records`} variant="outlined" size="small" />
      </Stack>

      <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid rgba(0,0,0,0.07)", overflow: "hidden" }}>
        {/* Search */}
        <Box sx={{ p: 2, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
          <TextField
            size="small"
            placeholder="Search by name, email, purpose or status..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ width: { xs: "100%", sm: 360 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <ICONS.search sx={{ fontSize: 18, color: "text.secondary" }} />
                </InputAdornment>
              ),
            }}
          />
        </Box>

        <TableContainer>
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
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6, color: "text.secondary" }}>
                    <ICONS.empty sx={{ fontSize: 40, display: "block", mx: "auto", mb: 1, opacity: 0.3 }} />
                    No registrations found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => {
                  const { label, color } = STATUS_CONFIG[row.status] || { label: row.status, color: "default" };
                  return (
                    <TableRow key={row.id} hover sx={{ cursor: "pointer" }} onClick={() => setSelected(row)}>
                      <TableCell>
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                          <Avatar sx={{ width: 34, height: 34, fontSize: "0.8rem", bgcolor: "primary.light", color: "primary.dark", fontWeight: 700 }}>
                            {row.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                          </Avatar>
                          <Box>
                            <Typography variant="body2" fontWeight={600}>{row.full_name}</Typography>
                            <Typography variant="caption" color="text.secondary">{row.email}</Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{row.purpose_of_visit}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{row.requested_date}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={label} color={color} size="small" sx={{ fontWeight: 600 }} />
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="View details">
                          <IconButton size="small" color="primary" onClick={(e) => { e.stopPropagation(); setSelected(row); }}>
                            <ICONS.view fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onClose={() => setSelected(null)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        {selected && (
          <>
            <DialogTitle sx={{ pb: 1 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  <Avatar sx={{ bgcolor: "primary.main", fontWeight: 700 }}>
                    {selected.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                  </Avatar>
                  <Box>
                    <Typography fontWeight={700}>{selected.full_name}</Typography>
                    <Chip label={sc.label} color={sc.color} size="small" sx={{ fontWeight: 600 }} />
                  </Box>
                </Stack>
                <IconButton onClick={() => setSelected(null)} size="small">
                  <ICONS.close fontSize="small" />
                </IconButton>
              </Stack>
            </DialogTitle>
            <Divider />
            <DialogContent sx={{ pt: 2 }}>
              {[
                ["Email", selected.email],
                ["Phone", selected.phone],
                ["Purpose of Visit", selected.purpose_of_visit],
                ["Requested Date", selected.requested_date],
                ["Submitted At", selected.created_at],
              ].map(([label, value]) => (
                <Box key={label} sx={{ mb: 1.5 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">
                    {label}
                  </Typography>
                  <Typography variant="body2">{value || "—"}</Typography>
                </Box>
              ))}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
              <Button variant="outlined" onClick={() => setSelected(null)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}
