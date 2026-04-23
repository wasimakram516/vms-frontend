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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Pagination,
} from "@mui/material";
import { useEffect, useState, useMemo } from "react";
import ICONS from "@/utils/iconUtil";
import LoadingState from "@/components/LoadingState";
import AppCard from "@/components/cards/AppCard";
import ConfirmationDialog from "@/components/modals/ConfirmationDialog";
import DialogHeader from "@/components/modals/DialogHeader";
import ListToolbar from "@/components/ListToolbar";
import NoDataAvailable from "@/components/NoDataAvailable";
import ResponsiveCardGrid from "@/components/ResponsiveCardGrid";
import PermissionGuard, { usePermission } from "@/components/auth/PermissionGuard";
import RecordMetadata from "@/components/RecordMetadata";
import {
  getMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
} from "@/services/kitchenService";
import { useSettings } from "@/contexts/SettingsContext";

function KitchenMenuContent() {
  const { readOnly } = usePermission();
  const { hostSettings, loading: settingsLoading } = useSettings();
  const isKitchenEnabled = hostSettings?.isKitchenModuleEnabled ?? true;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(12);

  const [modalOpen, setModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [activateTarget, setActivateTarget] = useState(null);
  const [deactivateTarget, setDeactivateTarget] = useState(null);

  const [form, setForm] = useState({ name: "", description: "", status: "active" });
  const [errors, setErrors] = useState({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getMenuItems();
      setItems(Array.isArray(res) ? res : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filtered = useMemo(() => {
    return items.filter((item) =>
      [item.name, item.description].join(" ").toLowerCase().includes(search.toLowerCase())
    );
  }, [items, search]);

  const pagedItems = useMemo(() => {
    return filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [filtered, page, rowsPerPage]);

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const openCreate = () => {
    setForm({ name: "", description: "", status: "active" });
    setErrors({});
    setIsEditMode(false);
    setSelectedId(null);
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setForm({
      name: item.name,
      description: item.description || "",
      status: item.status || "active",
    });
    setErrors({});
    setIsEditMode(true);
    setSelectedId(item.id);
    setModalOpen(true);
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Name is required";
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    setSubmitting(true);
    try {
      if (isEditMode) {
        await updateMenuItem(selectedId, form);
      } else {
        await createMenuItem(form);
      }
      setModalOpen(false);
      await fetchData();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    try {
      await deleteMenuItem(itemToDelete.id);
      setDeleteConfirmOpen(false);
      setItemToDelete(null);
      await fetchData();
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  const handleActivate = async () => {
    if (!activateTarget) return;
    try {
      await updateMenuItem(activateTarget.id, { status: "active" });
      setActivateTarget(null);
      await fetchData();
    } catch (error) {
      console.error("Activation failed:", error);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    try {
      await updateMenuItem(deactivateTarget.id, { status: "inactive" });
      setDeactivateTarget(null);
      await fetchData();
    } catch (error) {
      console.error("Deactivation failed:", error);
    }
  };

  if (settingsLoading) return null;

  if (!isKitchenEnabled) {
    return (
      <Box sx={{ py: 10, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Box
          sx={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            bgcolor: "error.main",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            mb: 3,
            boxShadow: "0 8px 16px rgba(211, 47, 47, 0.2)"
          }}
        >
          <ICONS.diningTable sx={{ fontSize: 40 }} />
        </Box>
        <Typography variant="h5" fontWeight="black" gutterBottom sx={{ letterSpacing: -0.5 }}>
          Kitchen module is disabled
        </Typography>
        <Typography variant="body1" color="text.secondary" align="center" sx={{ maxWidth: 450, opacity: 0.8, fontWeight: 500 }}>
          The kitchen module has been turned off in Host Details. Enable it to manage the kitchen menu.
        </Typography>
      </Box>
    );
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
            Kitchen Menu
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, opacity: 0.8 }}>
            {readOnly
              ? "Items available for kitchen orders."
              : "Manage items available in the staff kitchen for ordering."}
          </Typography>
        </Box>
        {!readOnly && (
          <Button
            variant="contained"
            startIcon={<ICONS.add />}
            onClick={openCreate}
            sx={{ borderRadius: 30, whiteSpace: "nowrap" }}
          >
            New Menu Item
          </Button>
        )}
      </Box>

      <Divider sx={{ mb: 3 }} />

      <ListToolbar
        showingCount={pagedItems.length}
        totalCount={filtered.length}
        searchSlot={
          <TextField
            fullWidth
            size="small"
            placeholder="Search menu items..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            InputProps={{
              startAdornment: <ICONS.search fontSize="small" sx={{ mr: 1, opacity: 0.6 }} />,
            }}
            sx={{ maxWidth: { md: 360 } }}
          />
        }
        actionsSlot={
          <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 160 } }}>
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
        }
      />

      {loading ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <NoDataAvailable
          title="No menu items found"
          description={search ? "Try a different search." : "Add your first menu item to get started."}
        />
      ) : (
        <>
          <ResponsiveCardGrid>
            {pagedItems.map((item) => (
              <AppCard key={item.id}>
                <Box
                  sx={{
                    bgcolor: "action.hover",
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    p: 2,
                  }}
                >
                  <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="subtitle1" fontWeight={800} noWrap>
                        {item.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {item.description ? "Menu Item" : "No description"}
                      </Typography>
                    </Box>
                    <Chip
                      label={item.status === "active" ? "Active" : "Inactive"}
                      size="small"
                      color={item.status === "active" ? "success" : "default"}
                      variant={item.status === "active" ? "filled" : "outlined"}
                      sx={{ fontWeight: 700, fontSize: "0.65rem", height: 22 }}
                    />
                  </Stack>
                </Box>

                <Box sx={{ flexGrow: 1, px: 2, py: 1.5 }}>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      lineHeight: 1.6,
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      fontSize: "0.8rem",
                    }}
                  >
                    {item.description || "No description provided."}
                  </Typography>
                </Box>

                {!readOnly && (
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
                        createdByName={item.created_by}
                        updatedByName={item.updated_by}
                        createdAt={item.created_at}
                        updatedAt={item.updated_at}
                        locale="en-GB"
                        sx={{ px: 0, py: 0 }}
                      />
                    </Box>
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      {item.status === "active" ? (
                        <Tooltip title="Deactivate">
                          <IconButton
                            size="small"
                            color="warning"
                            onClick={() => setDeactivateTarget(item)}
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
                            onClick={() => setActivateTarget(item)}
                            sx={{ bgcolor: "action.hover" }}
                          >
                            <ICONS.check fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => openEdit(item)}
                          sx={{ bgcolor: "action.hover" }}
                        >
                          <ICONS.edit fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => {
                            setItemToDelete(item);
                            setDeleteConfirmOpen(true);
                          }}
                          sx={{ bgcolor: "action.hover" }}
                        >
                          <ICONS.delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Box>
                )}
              </AppCard>
            ))}
          </ResponsiveCardGrid>

          {/* Pagination */}
          <Box display="flex" justifyContent="center" mt={4}>
            {filtered.length > rowsPerPage && (
              <Pagination
                count={Math.ceil(filtered.length / rowsPerPage)}
                page={page + 1}
                onChange={(e, v) => setPage(v - 1)}
                color="primary"
                showFirstButton
                showLastButton
              />
            )}
          </Box>
        </>
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
          title={isEditMode ? "Edit Menu Item" : "New Menu Item"}
          onClose={() => setModalOpen(false)}
        />
        <Divider />
        <DialogContent sx={{ p: 3 }}>
          <Stack spacing={2.5}>
            <TextField
              label="Item Name"
              fullWidth
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              error={Boolean(errors.name)}
              helperText={errors.name}
              disabled={submitting}
              placeholder="e.g. Cappuccino, Brownie"
              InputProps={{ sx: { borderRadius: 2 } }}
            />
            <TextField
              label="Description (optional)"
              fullWidth
              multiline
              minRows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              disabled={submitting}
              placeholder="Brief description of the item"
              InputProps={{ sx: { borderRadius: 2 } }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.status === "active"}
                  onChange={(e) =>
                    setForm({ ...form, status: e.target.checked ? "active" : "inactive" })
                  }
                  disabled={submitting}
                  color="success"
                />
              }
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2">Available for ordering</Typography>
                  <Chip
                    label={form.status === "active" ? "Active" : "Inactive"}
                    color={form.status === "active" ? "success" : "default"}
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
          <Button
            variant="outlined"
            onClick={() => setModalOpen(false)}
            disabled={submitting}
            sx={{ borderRadius: 30 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={submitting}
            startIcon={
              submitting ? <CircularProgress size={16} color="inherit" /> : <ICONS.save />
            }
            sx={{ borderRadius: 30 }}
          >
            {isEditMode ? "Save Changes" : "Create Item"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Deactivate confirmation */}
      <ConfirmationDialog
        open={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={handleDeactivate}
        title="Deactivate Menu Item"
        message={`Deactivate "${deactivateTarget?.name}"? It will no longer be available in the ordering interface.`}
        confirmButtonText="Deactivate"
        confirmColor="warning"
      />

      {/* Activate confirmation */}
      <ConfirmationDialog
        open={!!activateTarget}
        onClose={() => setActivateTarget(null)}
        onConfirm={handleActivate}
        title="Activate Menu Item"
        message={`Activate "${activateTarget?.name}" and make it available for ordering?`}
        confirmButtonText="Activate"
        confirmColor="success"
      />

      {/* Delete Confirmation */}
      <ConfirmationDialog
        open={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setItemToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete Menu Item"
        message={`Are you sure you want to delete "${itemToDelete?.name}"? This will remove it from the menu permanently.`}
        confirmButtonText="Delete"
        confirmColor="error"
      />
    </Box>
  );
}

export default function KitchenMenuPage() {
  return (
    <PermissionGuard fullAccessRoles={["superadmin", "admin"]} readOnlyRoles={[]}>
      <KitchenMenuContent />
    </PermissionGuard>
  );
}
