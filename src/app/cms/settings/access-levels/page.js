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
import PermissionRouteGuard from "@/components/auth/PermissionRouteGuard";
import { useAuth } from "@/contexts/AuthContext";
import { canAccessResource } from "@/utils/permissions";
import RecordMetadata from "@/components/RecordMetadata";
import {
  getAccessLevels,
  createAccessLevel,
  updateAccessLevel,
  deleteAccessLevel,
} from "@/services/accessLevelService";

function AccessLevelsContent() {
  const { user } = useAuth();
  const { readOnly } = usePermission();
  const canCreate = canAccessResource(user, "access-levels", { hardcodeAllowed: user?.role === "superadmin" || user?.role === "dev", action: "create" });
  const canUpdate = canAccessResource(user, "access-levels", { hardcodeAllowed: user?.role === "superadmin" || user?.role === "dev", action: "update" });
  const canDelete = canAccessResource(user, "access-levels", { hardcodeAllowed: user?.role === "superadmin" || user?.role === "dev", action: "delete" });
  const [accessLevels, setAccessLevels] = useState([]);
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
      const res = await getAccessLevels();
      setAccessLevels(Array.isArray(res) ? res : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = accessLevels.filter((al) =>
    [al.name, al.description].join(" ").toLowerCase().includes(search.toLowerCase())
  );

  const nextOrder = accessLevels.length > 0
    ? Math.max(...accessLevels.map((al) => al.order ?? 0)) + 1
    : 1;

  const openCreate = () => {
    setForm({ name: "", description: "", order: nextOrder, isActive: true });
    setErrors({});
    setIsEditMode(false);
    setSelectedId(null);
    setModalOpen(true);
  };

  const openEdit = (al) => {
    setForm({
      name: al.name,
      description: al.description || "",
      order: al.order ?? 0,
      isActive: al.isActive ?? true,
    });
    setErrors({});
    setIsEditMode(true);
    setSelectedId(al.id);
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
        await updateAccessLevel(selectedId, form);
      } else {
        await createAccessLevel(form);
      }
      setModalOpen(false);
      await fetchData();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    await deleteAccessLevel(itemToDelete.id);
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
            Access Levels
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, opacity: 0.8 }}>
            {readOnly
              ? "Access levels assigned to approved visits."
              : "Manage access levels that admins assign to approved visitor registrations."}
          </Typography>
        </Box>
        {canCreate && (
          <Button
            variant="contained"
            startIcon={<ICONS.add />}
            onClick={openCreate}
            sx={{ borderRadius: 30, whiteSpace: "nowrap" }}
          >
            New Access Level
          </Button>
        )}
      </Box>

      <Divider sx={{ mb: 3 }} />

      <ListToolbar
        showingCount={filtered.length}
        totalCount={accessLevels.length}
        searchSlot={
          <TextField
            fullWidth
            size="small"
            placeholder="Search access levels..."
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
          title="No access levels found"
          description={search ? "Try a different search." : "Create your first access level to get started."}
        />
      ) : (
        <ResponsiveCardGrid>
          {filtered.map((al) => (
            <AppCard key={al.id}>
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
                    <ICONS.key fontSize="small" />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle1" fontWeight={700} noWrap>
                      {al.name}
                    </Typography>
                    {al.order !== undefined && (
                      <Typography variant="caption" color="text.secondary">
                        Order: {al.order}
                      </Typography>
                    )}
                  </Box>
                </Stack>
                <Chip
                  label={al.isActive ? "Active" : "Inactive"}
                  color={al.isActive ? "success" : "default"}
                  size="small"
                  sx={{ fontWeight: 700, flexShrink: 0 }}
                />
              </Box>

              <Box sx={{ flexGrow: 1, px: 2, py: 1.5 }}>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                  {al.description || "No description provided."}
                </Typography>
              </Box>

              <Box
                sx={{
                  p: 1.2,
                  borderTop: "1px solid",
                  borderColor: "divider",
                  bgcolor: "action.hover",
                  display: "flex",
                  flexDirection: "column",
                  gap: 1,
                }}
              >
                <Box sx={{ width: "100%", overflow: "hidden" }}>
                  <RecordMetadata
                    createdByName={al.createdBy?.fullName || al.createdById}
                    updatedByName={al.updatedBy?.fullName || al.updatedById}
                    createdAt={al.createdAt}
                    updatedAt={al.updatedAt}
                    locale="en-GB"
                    sx={{ px: 0, py: 0 }}
                  />
                </Box>
                <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                    {canUpdate && (
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => openEdit(al)} sx={{ color: "primary.main" }}>
                        <ICONS.edit fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    )}
                    {canDelete && (
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        onClick={() => { setItemToDelete(al); setDeleteConfirmOpen(true); }}
                        sx={{ color: "error.main" }}
                      >
                        <ICONS.delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    )}
                  </Stack>
              </Box>
            </AppCard>
          ))}
        </ResponsiveCardGrid>
      )}

      {/* Create / Edit Dialog */}
      <Dialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 4, overflow: "hidden" } }}
      >
        <DialogHeader
          title={isEditMode ? "Edit Access Level" : "New Access Level"}
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
                  <Typography variant="body2">Active</Typography>
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
        title="Delete Access Level"
        message={`Are you sure you want to delete "${itemToDelete?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        confirmColor="error"
      />
    </Box>
  );
}

export default function AccessLevelsPage() {
  const { user } = useAuth();
  const hardcodeAllowed = user?.role === "superadmin" || user?.role === "admin";
  return (
    <PermissionRouteGuard resource="access-levels" hardcodeAllowed={hardcodeAllowed}>
      <PermissionGuard fullAccessRoles={["superadmin"]} readOnlyRoles={["admin"]}>
        <AccessLevelsContent />
      </PermissionGuard>
    </PermissionRouteGuard>
  );
}
