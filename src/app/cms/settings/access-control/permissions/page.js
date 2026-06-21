"use client";

import {
  Box,
  Typography,
  Button,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Chip,
  Stack,
  Pagination,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  CircularProgress,
  Switch,
  FormControlLabel,
} from "@mui/material";
import { useEffect, useState } from "react";
import AppCard from "@/components/cards/AppCard";
import ResponsiveCardGrid from "@/components/ResponsiveCardGrid";
import ListToolbar from "@/components/ListToolbar";
import NoDataAvailable from "@/components/NoDataAvailable";
import PermissionRouteGuard from "@/components/auth/PermissionRouteGuard";
import { useAuth } from "@/contexts/AuthContext";
import { canAccessResource } from "@/utils/permissions";
import ConfirmationDialog from "@/components/modals/ConfirmationDialog";
import ICONS from "@/utils/iconUtil";
import RecordMetadata from "@/components/RecordMetadata";
import {
  listPermissions,
  createPermission,
  updatePermission,
  deletePermission,
} from "@/services/permissionService";

const ACTIONS = ["read", "create", "update", "delete"];

export default function PermissionsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "superadmin";
  const canCreate = canAccessResource(user, "access-control", {
    hardcodeAllowed: user?.role === "superadmin" || user?.role === "dev",
    action: "create",
  });
  const canUpdate = canAccessResource(user, "access-control", {
    hardcodeAllowed: user?.role === "superadmin" || user?.role === "dev",
    action: "update",
  });
  const canDelete = canAccessResource(user, "access-control", {
    hardcodeAllowed: user?.role === "superadmin" || user?.role === "dev",
    action: "delete",
  });
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(9);
  const [page, setPage] = useState(0);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createResource, setCreateResource] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createIsActive, setCreateIsActive] = useState(true);
  const [creating, setCreating] = useState(false);

  // Activate / deactivate
  const [activateTarget, setActivateTarget] = useState(null);
  const [deactivateTarget, setDeactivateTarget] = useState(null);

  // Edit dialog
  const [editPerm, setEditPerm] = useState(null);
  const [editResource, setEditResource] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const data = await listPermissions();
      if (!data?.error) setPermissions(Array.isArray(data) ? data : []);
      setLoading(false);
    })();
  }, []);

  const filtered = permissions.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.resource.toLowerCase().includes(q) ||
      (p.description || "").toLowerCase().includes(q)
    );
  });
  const paged = filtered.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage,
  );

  async function handleCreate(e) {
    e.preventDefault();
    if (!createResource.trim()) return;
    setCreating(true);
    const result = await createPermission({
      resource: createResource.trim(),
      description: createDesc,
      isActive: createIsActive,
    });
    if (!result?.error) {
      setPermissions((prev) => [result, ...prev]);
      setCreateOpen(false);
      setCreateResource("");
      setCreateDesc("");
      setCreateIsActive(true);
      setPage(0);
    }
    setCreating(false);
  }

  async function handleEdit(e) {
    e.preventDefault();
    if (!editPerm) return;
    setSaving(true);
    const result = await updatePermission(editPerm.id, {
      resource: editResource,
      description: editDesc,
      isActive: editIsActive,
    });
    if (!result?.error) {
      setPermissions((prev) =>
        prev.map((p) => (p.id === editPerm.id ? result : p)),
      );
      setEditPerm(null);
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const result = await deletePermission(deleteTarget.id);
    if (!result?.error) {
      setPermissions((prev) => prev.filter((p) => p.id !== deleteTarget.id));
    }
    setDeleteTarget(null);
  }

  async function handleActivate() {
    const result = await updatePermission(activateTarget.id, {
      isActive: true,
    });
    if (!result?.error) {
      setPermissions((prev) =>
        prev.map((p) => (p.id === activateTarget.id ? result : p)),
      );
    }
    setActivateTarget(null);
  }

  async function handleDeactivate() {
    const result = await updatePermission(deactivateTarget.id, {
      isActive: false,
    });
    if (!result?.error) {
      setPermissions((prev) =>
        prev.map((p) => (p.id === deactivateTarget.id ? result : p)),
      );
    }
    setDeactivateTarget(null);
  }

  return (
    <PermissionRouteGuard
      resource="access-control"
      hardcodeAllowed={isSuperAdmin}
    >
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
          }}
        >
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5" fontWeight="bold">
              Permissions
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Create, edit, and delete permission resources. Each resource
              always carries the four standard actions.
            </Typography>
          </Box>
          {canCreate && (
            <Button
              variant="contained"
              startIcon={<ICONS.add />}
              onClick={() => setCreateOpen(true)}
              sx={{
                whiteSpace: "nowrap",
                height: 40,
                borderRadius: 2,
                fontWeight: 700,
              }}
            >
              New Permission
            </Button>
          )}
        </Box>

        <Divider sx={{ mb: 3 }} />

        <ListToolbar
          showingCount={paged.length}
          totalCount={filtered.length}
          itemLabel="permissions"
          searchSlot={
            <TextField
              variant="outlined"
              fullWidth
              size="small"
              placeholder="Search permissions..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              slotProps={{
                input: {
                  startAdornment: (
                    <ICONS.search
                      fontSize="small"
                      sx={{ mr: 1, opacity: 0.6 }}
                    />
                  ),
                },
              }}
              sx={{ maxWidth: { md: 360 } }}
            />
          }
          actionsSlot={
            <FormControl
              size="small"
              sx={{ minWidth: { xs: "100%", sm: 160 } }}
            >
              <InputLabel>Records per page</InputLabel>
              <Select
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(Number(e.target.value));
                  setPage(0);
                }}
                label="Records per page"
              >
                {[9, 18, 36].map((n) => (
                  <MenuItem key={n} value={n}>
                    {n}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          }
        />

        <Box sx={{ mt: 3 }}>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
              <CircularProgress />
            </Box>
          ) : filtered.length === 0 ? (
            <NoDataAvailable
              title="No permissions found"
              description={
                search
                  ? "Try adjusting your search."
                  : "No permissions defined yet. Create one to get started."
              }
            />
          ) : (
            <>
              <ResponsiveCardGrid>
                {paged.map((perm) => (
                  <AppCard key={perm.id} sx={{ height: "100%", width: "100%" }}>
                    <Box
                      sx={{
                        bgcolor: "action.hover",
                        borderBottom: "1px solid",
                        borderColor: "divider",
                        p: 2,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Box
                          sx={{
                            width: 30,
                            height: 30,
                            borderRadius: "50%",
                            bgcolor: "primary.light",
                            color: "primary.contrastText",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <ICONS.key sx={{ fontSize: 16 }} />
                        </Box>
                        <Chip
                          label={perm.resource}
                          size="small"
                          sx={{
                            fontWeight: 700,
                            textTransform: "uppercase",
                            fontSize: "0.7rem",
                            borderRadius: 999,
                          }}
                        />
                      </Stack>
                      <Chip
                        label={perm.isActive ? "Active" : "Inactive"}
                        size="small"
                        color={perm.isActive ? "success" : "default"}
                        variant={perm.isActive ? "filled" : "outlined"}
                        sx={{
                          fontWeight: 700,
                          fontSize: "0.65rem",
                          height: 22,
                        }}
                      />
                    </Box>

                    <Box sx={{ p: 2.5, flexGrow: 1 }}>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          mb: 1.5,
                          minHeight: 36,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {perm.description || "No description provided."}
                      </Typography>
                      <Stack direction="row" flexWrap="wrap" gap={0.5}>
                        {ACTIONS.map((a) => (
                          <Chip
                            key={a}
                            label={a}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: "0.65rem", borderRadius: 999 }}
                          />
                        ))}
                      </Stack>
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
                          createdByName={perm.createdBy}
                          updatedByName={perm.updatedBy}
                          createdAt={perm.createdAt}
                          updatedAt={perm.updatedAt}
                          locale="en-GB"
                          sx={{ px: 0, py: 0 }}
                        />
                      </Box>
                      {(canUpdate || canDelete) && (
                        <Stack
                          direction="row"
                          spacing={1}
                          justifyContent="flex-end"
                          alignItems="center"
                        >
                          {canUpdate && (
                            <>
                              {perm.isActive ? (
                                <Tooltip title="Deactivate">
                                  <IconButton
                                    size="small"
                                    color="warning"
                                    onClick={() => setDeactivateTarget(perm)}
                                    sx={{ bgcolor: "action.hover" }}
                                  >
                                    <ICONS.close fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              ) : (
                                <Tooltip title="Activate">
                                  <IconButton
                                    size="small"
                                    color="success"
                                    onClick={() => setActivateTarget(perm)}
                                    sx={{ bgcolor: "action.hover" }}
                                  >
                                    <ICONS.check fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                              <Tooltip title="Edit">
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    setEditPerm(perm);
                                    setEditResource(perm.resource);
                                    setEditDesc(perm.description || "");
                                    setEditIsActive(perm.isActive !== false);
                                  }}
                                  sx={{
                                    color: "text.secondary",
                                    bgcolor: "action.hover",
                                  }}
                                >
                                  <ICONS.edit fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                          {canDelete && (
                            <Tooltip title="Delete">
                              <IconButton
                                size="small"
                                onClick={() => setDeleteTarget(perm)}
                                sx={{
                                  color: "error.main",
                                  bgcolor: "action.hover",
                                }}
                              >
                                <ICONS.delete fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Stack>
                      )}
                    </Box>
                  </AppCard>
                ))}
              </ResponsiveCardGrid>

              {filtered.length > rowsPerPage && (
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    mt: 4,
                    mb: 2,
                  }}
                >
                  <Pagination
                    count={Math.ceil(filtered.length / rowsPerPage)}
                    page={page + 1}
                    onChange={(_, val) => setPage(val - 1)}
                    color="primary"
                    shape="rounded"
                    showFirstButton
                    showLastButton
                  />
                </Box>
              )}
            </>
          )}
        </Box>

        {/* Create dialog */}
        <Dialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ fontWeight: 700 }}>New Permission</DialogTitle>
          <DialogContent dividers>
            <Box
              component="form"
              id="create-perm-form"
              onSubmit={handleCreate}
              sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: 1 }}
            >
              <TextField
                label="Resource"
                placeholder="e.g. users, visits, reports"
                value={createResource}
                onChange={(e) => setCreateResource(e.target.value)}
                required
                fullWidth
                size="small"
              />
              <TextField
                label="Description"
                placeholder="Optional explanation of what this permission covers"
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                fullWidth
                size="small"
                multiline
                rows={2}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={createIsActive}
                    onChange={(e) => setCreateIsActive(e.target.checked)}
                    color="success"
                  />
                }
                label="Active"
              />
              <Typography variant="body2" color="text.secondary">
                Actions <strong>read, create, update, delete</strong> are added
                automatically.
              </Typography>
            </Box>
          </DialogContent>
          <DialogActions
            sx={{
              px: 3,
              pb: 2,
              gap: 1,
              flexDirection: { xs: "column-reverse", sm: "row" },
            }}
          >
            <Button
              variant="outlined"
              onClick={() => setCreateOpen(false)}
              fullWidth
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="create-perm-form"
              variant="contained"
              fullWidth
              disabled={creating || !createResource.trim()}
            >
              {creating ? "Creating..." : "Create"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Edit dialog */}
        <Dialog
          open={!!editPerm}
          onClose={() => setEditPerm(null)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ fontWeight: 700 }}>Edit Permission</DialogTitle>
          <DialogContent dividers>
            <Box
              component="form"
              id="edit-perm-form"
              onSubmit={handleEdit}
              sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: 1 }}
            >
              <TextField
                label="Resource"
                value={editResource}
                onChange={(e) => setEditResource(e.target.value)}
                required
                fullWidth
                size="small"
              />
              <TextField
                label="Description"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                fullWidth
                size="small"
                multiline
                rows={2}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={editIsActive}
                    onChange={(e) => setEditIsActive(e.target.checked)}
                    color="success"
                  />
                }
                label="Active"
              />
            </Box>
          </DialogContent>
          <DialogActions
            sx={{
              px: 3,
              pb: 2,
              gap: 1,
              flexDirection: { xs: "column-reverse", sm: "row" },
            }}
          >
            <Button
              variant="outlined"
              onClick={() => setEditPerm(null)}
              fullWidth
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="edit-perm-form"
              variant="contained"
              fullWidth
              disabled={saving}
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Deactivate confirm */}
        <ConfirmationDialog
          open={!!deactivateTarget}
          onConfirm={handleDeactivate}
          onCancel={() => setDeactivateTarget(null)}
          title="Deactivate Permission"
          message={`Deactivate permission "${deactivateTarget?.resource}"? The resource will no longer be managed by the permission system — all authenticated users will have access.`}
          confirmButtonText="Deactivate"
          confirmButtonColor="warning"
        />

        {/* Activate confirm */}
        <ConfirmationDialog
          open={!!activateTarget}
          onConfirm={handleActivate}
          onCancel={() => setActivateTarget(null)}
          title="Activate Permission"
          message={`Activate permission "${activateTarget?.resource}"? The resource will become managed by the permission system again.`}
          confirmButtonText="Activate"
          confirmButtonColor="success"
        />

        {/* Delete confirm */}
        <ConfirmationDialog
          open={!!deleteTarget}
          title="Delete Permission"
          message={`Delete permission "${deleteTarget?.resource}"? This will also remove all role and user assignments for this resource.`}
          confirmButtonText="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      </Box>
    </PermissionRouteGuard>
  );
}
