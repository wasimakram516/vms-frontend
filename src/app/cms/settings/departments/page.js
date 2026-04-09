"use client";

import {
  Box,
  Typography,
  Button,
  IconButton,
  Tooltip,
  Chip,
  Dialog,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
  CircularProgress,
  Divider,
  Switch,
  FormControlLabel,
  Avatar,
} from "@mui/material";
import { useEffect, useState } from "react";
import ICONS from "@/utils/iconUtil";
import LoadingState from "@/components/LoadingState";
import AppCard from "@/components/cards/AppCard";
import ConfirmationDialog from "@/components/modals/ConfirmationDialog";
import DialogHeader from "@/components/modals/DialogHeader";
import ListToolbar from "@/components/ListToolbar";
import NoDataAvailable from "@/components/NoDataAvailable";
import ResponsiveCardGrid from "@/components/ResponsiveCardGrid";
import PermissionGuard, { usePermission } from "@/components/auth/PermissionGuard";
import {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from "@/services/departmentService";

function DepartmentsContent() {
  const { readOnly } = usePermission();
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  const [form, setForm] = useState({ name: "", description: "", order: 1, isActive: true });
  const [errors, setErrors] = useState({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getDepartments();
      setDepartments(Array.isArray(res) ? res : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = departments.filter((d) =>
    [d.name, d.description].join(" ").toLowerCase().includes(search.toLowerCase())
  );

  const nextOrder = departments.length > 0
    ? Math.max(...departments.map((d) => d.order ?? 0)) + 1
    : 1;

  const openCreate = () => {
    setForm({ name: "", description: "", order: nextOrder, isActive: true });
    setErrors({});
    setIsEditMode(false);
    setSelectedId(null);
    setModalOpen(true);
  };

  const openEdit = (dept) => {
    setForm({ name: dept.name, description: dept.description || "", order: dept.order ?? 1, isActive: dept.isActive ?? true });
    setErrors({});
    setIsEditMode(true);
    setSelectedId(dept.id);
    setModalOpen(true);
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Name is required";
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSubmitting(true);
    try {
      if (isEditMode) {
        await updateDepartment(selectedId, form);
      } else {
        await createDepartment(form);
      }
      setModalOpen(false);
      await fetchData();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    await deleteDepartment(itemToDelete.id);
    setDeleteConfirmOpen(false);
    setItemToDelete(null);
    await fetchData();
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
            Departments
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, opacity: 0.8 }}>
            {readOnly
              ? "Departments available for visitor registrations."
              : "Manage departments that visitors can select when registering."}
          </Typography>
        </Box>
        {!readOnly && (
          <Button
            variant="contained"
            startIcon={<ICONS.add />}
            onClick={openCreate}
            sx={{ borderRadius: 30, whiteSpace: "nowrap" }}
          >
            New Department
          </Button>
        )}
      </Box>

      <Divider sx={{ mb: 3 }} />

      <ListToolbar
        showingCount={filtered.length}
        totalCount={departments.length}
        searchSlot={
          <TextField
            fullWidth
            size="small"
            placeholder="Search departments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{ startAdornment: <ICONS.search fontSize="small" sx={{ mr: 1, opacity: 0.6 }} /> }}
            sx={{ maxWidth: { md: 360 } }}
          />
        }
      />

      {loading ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <NoDataAvailable
          title="No departments found"
          description={search ? "Try a different search." : "Create your first department to get started."}
        />
      ) : (
        <ResponsiveCardGrid>
          {filtered.map((dept) => (
            <AppCard key={dept.id}>
              <Box
                sx={{
                  bgcolor: "action.hover",
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  p: 2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 1,
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: 1.5,
                      bgcolor: "primary.main",
                      color: "primary.contrastText",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <ICONS.apartment fontSize="small" />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle1" fontWeight={700} noWrap>
                      {dept.name}
                    </Typography>
                    {dept.order !== undefined && (
                      <Typography variant="caption" color="text.secondary">
                        Order: {dept.order}
                      </Typography>
                    )}
                  </Box>
                </Stack>
                <Chip
                  label={dept.isActive ? "Active" : "Inactive"}
                  color={dept.isActive ? "success" : "default"}
                  size="small"
                  sx={{ fontWeight: 700, flexShrink: 0 }}
                />
              </Box>

              <Box sx={{ flexGrow: 1, px: 2, py: 1.5 }}>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                  {dept.description || "No description provided."}
                </Typography>

                {dept.assignedUsers?.length > 0 && (
                  <Box sx={{ mt: 1.5 }}>
                    <Divider sx={{ mb: 1.5 }} />
                    <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Departmental Admins
                    </Typography>
                    <Stack spacing={0.75} sx={{ mt: 1 }}>
                      {dept.assignedUsers.map((admin) => {
                        const initials = admin.fullName
                          ?.split(" ")
                          .map((n) => n[0]?.toUpperCase())
                          .slice(0, 2)
                          .join("") || "?";
                        return (
                          <Stack key={admin.id} direction="row" spacing={1} alignItems="center">
                            <Avatar
                              sx={{
                                width: 28,
                                height: 28,
                                fontSize: "0.65rem",
                                fontWeight: 700,
                                bgcolor: "primary.main",
                                color: "primary.contrastText",
                                flexShrink: 0,
                              }}
                            >
                              {initials}
                            </Avatar>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography variant="body2" fontWeight={600} noWrap>
                                {admin.fullName}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" noWrap>
                                {admin.email}
                              </Typography>
                            </Box>
                          </Stack>
                        );
                      })}
                    </Stack>
                  </Box>
                )}
              </Box>

              {!readOnly && (
                <Box
                  sx={{
                    p: 1.5,
                    borderTop: "1px solid",
                    borderColor: "divider",
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 1,
                  }}
                >
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => openEdit(dept)} sx={{ color: "primary.main" }}>
                      <ICONS.edit fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton
                      size="small"
                      onClick={() => { setItemToDelete(dept); setDeleteConfirmOpen(true); }}
                      sx={{ color: "error.main" }}
                    >
                      <ICONS.delete fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              )}
            </AppCard>
          ))}
        </ResponsiveCardGrid>
      )}

      {/* Create / Edit Dialog */}
      <Dialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 4, overflow: "hidden" } }}
      >
        <DialogHeader
          title={isEditMode ? "Edit Department" : "New Department"}
          onClose={() => setModalOpen(false)}
        />
        <Divider />
        <DialogContent sx={{ p: 3 }}>
          <Stack spacing={2.5}>
            <TextField
              label="Name"
              fullWidth
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              error={Boolean(errors.name)}
              helperText={errors.name}
              disabled={submitting}
              InputProps={{ sx: { borderRadius: 2 } }}
            />
            <TextField
              label="Description (optional)"
              fullWidth
              multiline
              minRows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              disabled={submitting}
              InputProps={{ sx: { borderRadius: 2 } }}
            />
            <TextField
              label="Display Order"
              type="number"
              fullWidth
              value={form.order}
              onChange={(e) => setForm({ ...form, order: Math.max(1, parseInt(e.target.value) || 1) })}
              disabled={submitting}
              helperText="Lower numbers appear first"
              inputProps={{ min: 1 }}
              InputProps={{ sx: { borderRadius: 2 } }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  disabled={submitting}
                  color="success"
                />
              }
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2">Visible in registration form</Typography>
                  <Chip
                    label={form.isActive ? "Active" : "Inactive"}
                    color={form.isActive ? "success" : "default"}
                    size="small"
                    sx={{ fontWeight: 700, height: 20, fontSize: "0.65rem" }}
                  />
                </Stack>
              }
            />
          </Stack>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ p: 2.5, gap: 1 }}>
          <Button variant="outlined" onClick={() => setModalOpen(false)} disabled={submitting} sx={{ borderRadius: 30 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <ICONS.save />}
            sx={{ borderRadius: 30 }}
          >
            {isEditMode ? "Save Changes" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmationDialog
        open={deleteConfirmOpen}
        onClose={() => { setDeleteConfirmOpen(false); setItemToDelete(null); }}
        onConfirm={handleDeleteConfirm}
        title="Delete Department"
        message={`Are you sure you want to delete "${itemToDelete?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        confirmColor="error"
      />
    </Box>
  );
}

export default function DepartmentsPage() {
  return (
    <PermissionGuard fullAccessRoles={["superadmin"]} readOnlyRoles={["admin"]}>
      <DepartmentsContent />
    </PermissionGuard>
  );
}
