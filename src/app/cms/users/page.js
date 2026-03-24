"use client";

import {
  Box,
  Typography,
  Button,
  Paper,
  Avatar,
  IconButton,
  Tooltip,
  Chip,
  Dialog,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
  MenuItem,
  CircularProgress,
  InputAdornment,
  Divider,
  Pagination,
  FormControl,
  Select,
  InputLabel,
} from "@mui/material";
import { useColorMode } from "@/contexts/ThemeContext";
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
import AppCard from "@/components/cards/AppCard";
import ConfirmationDialog from "@/components/modals/ConfirmationDialog";
import DialogHeader from "@/components/modals/DialogHeader";
import ListToolbar from "@/components/ListToolbar";
import NoDataAvailable from "@/components/NoDataAvailable";
import ResponsiveCardGrid from "@/components/ResponsiveCardGrid";

const CREATABLE_ROLES = ["admin", "staff"];
const STAFF_TYPES = ["gate", "kitchen"];

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const { showMessage } = useMessage();
  const { mode } = useColorMode();
  const isDark = mode === "dark";
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
  const [rowsPerPage, setRowsPerPage] = useState(12);

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
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      newErrors.email = "Invalid email";
    if (!isEditMode && !form.password.trim())
      newErrors.password = "Password is required";
    if (form.role === "staff" && !form.staff_type)
      newErrors.staff_type = "Staff Type is required";

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
        res =
          form.role === "admin"
            ? await createAdminUser(form)
            : await createStaffUser(form);
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
      const matchStaffType =
        staffTypeFilter === "all" || u.staff_type === staffTypeFilter;
      return matchSearch && matchRole && matchStaffType;
    });
  }, [users, searchQuery, roleFilter, staffTypeFilter]);

  const pagedUsers = useMemo(() => {
    return filteredUsers.slice(
      page * rowsPerPage,
      page * rowsPerPage + rowsPerPage,
    );
  }, [filteredUsers, page, rowsPerPage]);

  const handleChangePage = (event, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const getRoleColor = (role) => {
    switch (role) {
      case "superadmin":
        return "error";
      case "admin":
        return "primary";
      case "staff":
        return "secondary";
      case "visitor":
        return "success";
      default:
        return "default";
    }
  };

  if (loading) {
    return <LoadingState />;
  }

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
            User Management
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.5, opacity: 0.8 }}
          >
            Manage organizational users and system access roles.
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
          {isSuperAdmin && (
            <Button
              variant="contained"
              startIcon={<ICONS.add />}
              onClick={handleOpenCreate}
            >
              Create
            </Button>
          )}
        </Box>
      </Box>

      <Divider sx={{ mb: 3 }} />

      <ListToolbar
        showingCount={pagedUsers.length}
        totalCount={filteredUsers.length}
        searchSlot={
          <TextField
            fullWidth
            size="small"
            variant="outlined"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
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
          <>
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
              sx={{ minWidth: { xs: "100%", sm: 160 } }}
            >
              <MenuItem value="all">All Roles</MenuItem>
              <MenuItem value="superadmin">SuperAdmin</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
              <MenuItem value="staff">Staff</MenuItem>
              <MenuItem value="visitor">Visitor</MenuItem>
            </TextField>

            <FormControl
              size="small"
              sx={{ minWidth: { xs: "100%", sm: 160 } }}
            >
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
          </>
        }
      />

      {pagedUsers.length === 0 ? (
        <NoDataAvailable
          title="No users found"
          description="Try adjusting your filters or create a new user."
        />
      ) : (
        <ResponsiveCardGrid gap={{ xs: 3, md: 3.5 }}>
          {pagedUsers.map((u) => (
            <AppCard
              key={u.id}
              sx={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                width: "100%",
              }}
            >
              {/* Header: Exact match to registrations */}
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
                <Stack spacing={0.25}>
                  <Stack direction="row" alignItems="center" sx={{ gap: 1 }}>
                    <Avatar
                      sx={{
                        width: 40,
                        height: 40,
                        bgcolor: isDark ? "#fff" : "#000",
                        color: isDark ? "#000" : "#fff",
                        fontSize: "1rem",
                        fontWeight: 800,
                      }}
                    >
                      {u.full_name
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
                        {u.full_name}
                      </Typography>
                    </Box>
                  </Stack>
                </Stack>
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={0.6}
                  sx={{ mt: 1 }}
                >
                  <Chip
                    label={u.role.toUpperCase()}
                    size="small"
                    color={getRoleColor(u.role)}
                    icon={<ICONS.person sx={{ fontSize: "12px !important" }} />}
                    sx={{ fontWeight: 800, borderRadius: 1.5, height: 24 }}
                  />
                </Stack>
              </Box>

              {/* Body: Email and Phone rows */}
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
                    {u.email}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    py: 0.8,
                    borderBottom:
                      u.role === "staff" && u.staff_type
                        ? "1px solid"
                        : "none",
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
                    <ICONS.phone fontSize="small" sx={{ opacity: 0.6 }} /> Phone
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
                    {u.phone || "—"}
                  </Typography>
                </Box>
                {u.role === "staff" && u.staff_type && (
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
                      <ICONS.business fontSize="small" sx={{ opacity: 0.6 }} />{" "}
                      Staff Type
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        ml: 2,
                        flex: 1,
                        textAlign: "right",
                        color: "text.primary",
                        textTransform: "capitalize",
                      }}
                    >
                      {u.staff_type}
                    </Typography>
                  </Box>
                )}
              </Box>

              {/* Footer: Icon Buttons */}
              {isSuperAdmin && (
                <Box
                  sx={{
                    p: 1.5,
                    borderTop: "1px solid",
                    borderColor: "divider",
                    bgcolor: isDark
                      ? "rgba(255,255,255,0.02)"
                      : "rgba(0,0,0,0.01)",
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 1,
                  }}
                >
                  <Tooltip title="Edit User">
                    <IconButton
                      color="primary"
                      onClick={() => handleOpenEdit(u)}
                      size="small"
                      sx={{
                        bgcolor: isDark
                          ? "rgba(255,255,255,0.05)"
                          : "rgba(0,0,0,0.03)",
                      }}
                    >
                      <ICONS.edit fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  {u.id !== currentUser.id && (
                    <Tooltip title="Delete User">
                      <IconButton
                        color="error"
                        onClick={() => handleDeleteClick(u)}
                        size="small"
                        sx={{
                          bgcolor: isDark
                            ? "rgba(255,100,100,0.05)"
                            : "rgba(255,0,0,0.03)",
                        }}
                      >
                        <ICONS.delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              )}
            </AppCard>
          ))}
        </ResponsiveCardGrid>
      )}

      <Box display="flex" justifyContent="center" mt={4}>
        {filteredUsers.length > rowsPerPage && (
          <Pagination
            count={Math.ceil(filteredUsers.length / rowsPerPage)}
            page={page + 1}
            onChange={(e, v) => setPage(v - 1)}
            color="primary"
          />
        )}
      </Box>

      <Dialog
        open={modalOpen}
        onClose={() => !submitting && setModalOpen(false)}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: { variant: "frosted", borderRadius: 4 } }}
      >
        <DialogHeader
          title={isEditMode ? "Edit User" : "Create New User"}
          onClose={!submitting ? () => setModalOpen(false) : undefined}
        />
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
              disabled={isEditMode && form.role === "visitor"}
            >
              {CREATABLE_ROLES.map((r) => (
                <MenuItem key={r} value={r}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </MenuItem>
              ))}
              {!CREATABLE_ROLES.includes(form.role) && (
                <MenuItem value={form.role} disabled>
                  {form.role.charAt(0).toUpperCase() + form.role.slice(1)}
                </MenuItem>
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
          <Button
            onClick={() => setModalOpen(false)}
            disabled={submitting}
            startIcon={<ICONS.cancel />}
            sx={{ borderRadius: 30 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={submitting}
            startIcon={
              submitting ? (
                <CircularProgress size={20} />
              ) : isEditMode ? (
                <ICONS.save />
              ) : (
                <ICONS.add />
              )
            }
            sx={{ borderRadius: 30 }}
          >
            {submitting
              ? "Saving..."
              : isEditMode
                ? "Update"
                : "Create"}
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
