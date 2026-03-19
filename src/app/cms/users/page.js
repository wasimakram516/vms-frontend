"use client";

import {
  Box,
  Typography,
  Grid,
  Button,
  Paper,
  Avatar,
  IconButton,
  Tooltip,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
  MenuItem,
  CircularProgress,
  InputAdornment,
  TablePagination,
} from "@mui/material";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMessage } from "@/contexts/MessageContext";
import ICONS from "@/utils/iconUtil";
import LoadingState from "@/components/LoadingState";
import {
  getAllUsers,
  updateUser,
  deleteUser,
  createStaffUser,
  createAdminUser,
} from "@/services/userService";
import ConfirmationDialog from "@/components/modals/ConfirmationDialog";

const CREATABLE_ROLES = ["admin", "staff"];
const STAFF_TYPES = ["gate", "kitchen"];

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const { showMessage } = useMessage();
  const isSuperAdmin = currentUser?.role === "superadmin";

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [staffTypeFilter, setStaffTypeFilter] = useState("all");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(9);

  const defaultForm = {
    full_name: "",
    email: "",
    password: "",
    phone: "",
    role: "staff",
    staff_type: "gate",
  };

  const [form, setForm] = useState(defaultForm);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await getAllUsers();
      setUsers(data || []);
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setForm(defaultForm);
    setErrors({});
    setIsEditMode(false);
    setSelectedUserId(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (u) => {
    setForm({
      full_name: u.full_name || "",
      email: u.email || "",
      password: "",
      phone: u.phone || "",
      role: u.role || "staff",
      staff_type: u.staff_type || "gate",
    });
    setErrors({});
    setIsEditMode(true);
    setSelectedUserId(u.id);
    setModalOpen(true);
  };

  const validateForm = () => {
    const newErrors = {};
    if (!form.full_name.trim()) newErrors.full_name = "Full Name is required";
    if (!form.email.trim()) newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) newErrors.email = "Invalid email";
    if (!isEditMode && !form.password.trim()) newErrors.password = "Password is required";
    if (form.role === "staff" && !form.staff_type) newErrors.staff_type = "Staff Type is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setSubmitting(true);
    try {
      let res;
      if (isEditMode) {
        res = await updateUser(selectedUserId, form);
      } else {
        res = form.role === "admin" ? await createAdminUser(form) : await createStaffUser(form);
      }

      if (res.success) {
        showMessage(isEditMode ? "User updated" : "User created", "success");
        setModalOpen(false);
        fetchUsers();
      } else {
        showMessage(res.error || "Operation failed", "error");
      }
    } catch (error) {
      showMessage("An error occurred", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = (u) => {
    setUserToDelete(u);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    try {
      const res = await deleteUser(userToDelete.id);
      if (res.success) {
        showMessage("User deleted", "success");
        fetchUsers();
      }
    } catch (error) {
      showMessage(error.message || "Failed to delete user", "error");
    } finally {
      setDeleteConfirmOpen(false);
      setUserToDelete(null);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchSearch =
        u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchRole = roleFilter === "all" || u.role === roleFilter;
      const matchStaffType = staffTypeFilter === "all" || u.staff_type === staffTypeFilter;
      return matchSearch && matchRole && matchStaffType;
    });
  }, [users, searchQuery, roleFilter, staffTypeFilter]);

  const pagedUsers = useMemo(() => {
    return filteredUsers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [filteredUsers, page, rowsPerPage]);

  const handleChangePage = (event, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const getRoleColor = (role) => {
    switch (role) {
      case "superadmin": return "error";
      case "admin":      return "primary";
      case "staff":      return "secondary";
      case "visitor":    return "success";
      default:           return "default";
    }
  };

  if (loading) return <LoadingState />;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
        <Box>
          <Typography variant="h4" fontWeight={800}>User Management</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage organizational users and system access roles.
          </Typography>
        </Box>
        {isSuperAdmin && (
          <Button
            variant="contained"
            startIcon={<ICONS.add />}
            onClick={handleOpenCreate}
            sx={{ borderRadius: 2 }}
          >
            Create User
          </Button>
        )}
      </Stack>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 4 }} alignItems="center">
        <TextField
          fullWidth
          placeholder="Search by name or email..."
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <ICONS.search />
              </InputAdornment>
            ),
            sx: { borderRadius: 2, bgcolor: "background.paper" }
          }}
          sx={{ flexGrow: 1 }}
        />
        
        <Stack direction="row" spacing={2} sx={{ width: { xs: "100%", md: "auto" } }}>
          <TextField
            select
            label="Role"
            size="small"
            value={roleFilter}
            onChange={(e) => { 
              setRoleFilter(e.target.value); 
              if (e.target.value !== "staff") setStaffTypeFilter("all");
              setPage(0); 
            }}
            sx={{ minWidth: 140 }}
            InputProps={{ sx: { borderRadius: 2, bgcolor: "background.paper" } }}
          >
            <MenuItem value="all">All Roles</MenuItem>
            <MenuItem value="superadmin">SuperAdmin</MenuItem>
            <MenuItem value="admin">Admin</MenuItem>
            <MenuItem value="staff">Staff</MenuItem>
            <MenuItem value="visitor">Visitor</MenuItem>
          </TextField>

          {/* {roleFilter === "staff" && (
            <TextField
              select
              label="Staff Type"
              size="small"
              value={staffTypeFilter}
              onChange={(e) => { setStaffTypeFilter(e.target.value); setPage(0); }}
              sx={{ minWidth: 140 }}
              InputProps={{ sx: { borderRadius: 2, bgcolor: "background.paper" } }}
            >
              <MenuItem value="all">Any Type</MenuItem>
              <MenuItem value="gate">Gate</MenuItem>
              <MenuItem value="kitchen">Kitchen</MenuItem>
            </TextField>
          )} */}
        </Stack>
      </Stack>

      <Grid container spacing={3}>
        {pagedUsers.map((u) => (
          <Grid item xs={12} sm={6} md={4} key={u.id}>
            <Paper 
              elevation={0}
              sx={{ 
                p: 2, 
                borderRadius: 3, 
                border: "1px solid rgba(0,0,0,0.07)",
                transition: "all 0.2s ease",
                "&:hover": { boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }
              }}
            >
              <Stack direction="row" spacing={2} alignItems="center">
                <Avatar sx={{ width: 48, height: 48, bgcolor: "primary.light" }}>
                  {u.full_name[0]}
                </Avatar>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography variant="subtitle1" noWrap sx={{ fontWeight: 600 }}>
                    {u.full_name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {u.email}
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    <Chip
                      label={u.role}
                      size="small"
                      color={getRoleColor(u.role)}
                      variant="outlined"
                      sx={{ fontWeight: 600 }}
                    />
                    {u.role === "staff" && u.staff_type && (
                      <Chip label={u.staff_type} size="small" variant="tonal" />
                    )}
                  </Stack>
                </Box>
                {isSuperAdmin && u.id !== currentUser.id && (
                  <Stack direction="row">
                    <IconButton color="primary" onClick={() => handleOpenEdit(u)} size="small">
                      <ICONS.edit fontSize="small" />
                    </IconButton>
                    <IconButton color="error" onClick={() => handleDeleteClick(u)} size="small">
                      <ICONS.delete fontSize="small" />
                    </IconButton>
                  </Stack>
                )}
              </Stack>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <TablePagination
        rowsPerPageOptions={[6, 9, 12, 18, 24]}
        component="div"
        count={filteredUsers.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        sx={{ 
          mt: 4, 
          borderTop: "1px solid rgba(0,0,0,0.06)",
          "& .MuiTablePagination-select": {
             pl: 1,
             pr: 4,
          },
          "& .MuiTablePagination-selectIcon": {
             right: 4,
          }
        }}
      />

      <Dialog open={modalOpen} onClose={() => !submitting && setModalOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 700 }}>
          {isEditMode ? "Edit User" : "Create New User"}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Full Name"
              fullWidth
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              error={!!errors.full_name}
              helperText={errors.full_name}
            />
            <TextField
              label="Email"
              fullWidth
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              error={!!errors.email}
              helperText={errors.email}
            />
            <TextField
              label="Phone"
              fullWidth
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <TextField
              label={isEditMode ? "New Password (optional)" : "Password"}
              type="password"
              fullWidth
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              error={!!errors.password}
              helperText={errors.password}
            />
            <TextField
              select
              label="Role"
              fullWidth
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              {CREATABLE_ROLES.map((r) => (
                <MenuItem key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</MenuItem>
              ))}
              {!CREATABLE_ROLES.includes(form.role) && (
                <MenuItem value={form.role} disabled>{form.role}</MenuItem>
              )}
            </TextField>

            {/* {form.role === "staff" && (
              <TextField
                select
                label="Staff Type"
                fullWidth
                value={form.staff_type}
                onChange={(e) => setForm({ ...form, staff_type: e.target.value })}
                error={!!errors.staff_type}
                helperText={errors.staff_type}
              >
                {STAFF_TYPES.map((t) => (
                  <MenuItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</MenuItem>
                ))}
              </TextField>
            )} */}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setModalOpen(false)} disabled={submitting}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={submitting}
            startIcon={submitting && <CircularProgress size={20} />}
          >
            {submitting ? "Saving..." : isEditMode ? "Update User" : "Create User"}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmationDialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete User"
        message={`Are you sure you want to delete ${userToDelete?.full_name}? This action cannot be undone.`}
        confirmButtonText="Delete"
        confirmButtonIcon={<ICONS.delete fontSize="small" />}
      />
    </Box>
  );
}
