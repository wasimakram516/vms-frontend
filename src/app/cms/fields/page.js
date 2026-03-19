"use client";

import { useState, useEffect } from "react";
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
  MenuItem,
  Switch,
  FormControlLabel,
  Chip,
  Alert,
  Divider,
  TablePagination,
  CircularProgress,
} from "@mui/material";
import { useMessage } from "@/contexts/MessageContext";
import ICONS from "@/utils/iconUtil";
import { getCustomFields, createCustomField, updateCustomField, deleteCustomField } from "@/services/customFieldService";

const INPUT_TYPES = ["text", "textarea", "number", "phone", "email", "select", "radio", "checkbox", "date", "time", "file"];

const emptyForm = () => ({
  fieldKey: "", label: "", inputType: "text", isRequired: false, isActive: true, sortOrder: 99, options: "",
});

export default function CmsFieldsPage() {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [editId, setEditId] = useState(null);
  const { showMessage } = useMessage();
  const [saving, setSaving] = useState(false);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const fetchData = async () => {
    setLoading(true);
    try {
      const f = await getCustomFields();
      setFields(f);
    } catch (err) {
      console.error("Failed to load fields", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openAdd = () => {
    setForm(emptyForm());
    setEditId(null);
    setDialogOpen(true);
  };

  const openEdit = (field) => {
    setForm({
      fieldKey: field.fieldKey,
      label: field.label,
      inputType: field.inputType,
      isRequired: field.isRequired,
      isActive: field.isActive,
      sortOrder: field.sortOrder,
      options: (field.optionsJson || []).join(", "),
    });
    setEditId(field.id);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const optionsJson = ["select", "radio", "checkbox"].includes(form.inputType)
      ? form.options.split(",").map((o) => o.trim()).filter(Boolean)
      : [];

    if (["select", "radio", "checkbox"].includes(form.inputType) && optionsJson.length < 2) {
      showMessage("Please provide at least 2 options for this field type.", "error");
      return;
    }

    setSaving(true);

    const payload = {
      fieldKey: form.fieldKey.trim().toLowerCase().replace(/\s+/g, "_"),
      label: form.label.trim(),
      inputType: form.inputType,
      isRequired: form.isRequired,
      isActive: form.isActive,
      sortOrder: Number(form.sortOrder) || 99,
      optionsJson,
    };

    try {
      if (editId) {
        await updateCustomField(editId, payload);
        showMessage("Field updated.", "success");
      } else {
        await createCustomField(payload);
        showMessage("Field created.", "success");
      }
      fetchData();
      setDialogOpen(false);
      setEditId(null);
      setForm(emptyForm());
    } catch (err) {
      showMessage(err.response?.data?.message || "Failed to save field", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteCustomField(deleteTarget.id);
      showMessage(`"${deleteTarget.label}" deleted.`, "success");
      fetchData();
      setDeleteTarget(null);
    } catch (err) {
      showMessage("Failed to delete field", "error");
    }
  };

  const handleChangePage = (event, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const pagedFields = [...fields]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const needsOptions = ["select", "radio", "checkbox"].includes(form.inputType);

  return (
    <Box>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} mb={3} gap={1}>
        <Box>
          <Typography variant="h4" fontWeight={800}>Registration Fields</Typography>
          <Typography color="text.secondary" variant="body2" mt={0.5}>
            Global dynamic fields used in the public visitor registration form.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<ICONS.add />} onClick={openAdd} sx={{ alignSelf: { xs: "flex-start" } }}>
          Add Field
        </Button>
      </Stack>

      <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid rgba(0,0,0,0.07)", overflow: "hidden" }}>
        <TableContainer sx={{ minHeight: 400 }}>
          {loading ? (
             <Stack alignItems="center" justifyContent="center" sx={{ py: 10 }}>
                <CircularProgress size={32} />
             </Stack>
          ) : (
            <Table>
              <TableHead sx={{ bgcolor: "rgba(0,0,0,0.02)" }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, width: 40 }}>#</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Label</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Key</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Required</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Active</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pagedFields.length === 0 ? (
                   <TableRow>
                     <TableCell colSpan={7} align="center" sx={{ py: 8, color: "text.secondary" }}>
                        No fields defined. Start by adding one!
                     </TableCell>
                   </TableRow>
                ) : pagedFields.map((field) => (
                  <TableRow key={field.id} hover>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">{field.sortOrder}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{field.label}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace" color="text.secondary">{field.fieldKey}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={field.inputType} size="small" variant="outlined" sx={{ fontFamily: "monospace", fontSize: "0.7rem" }} />
                    </TableCell>
                    <TableCell>
                      <Chip label={field.isRequired ? "Yes" : "No"} size="small" color={field.isRequired ? "error" : "default"} />
                    </TableCell>
                    <TableCell>
                      <Chip label={field.isActive ? "Active" : "Inactive"} size="small" color={field.isActive ? "success" : "default"} />
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => openEdit(field)}>
                            <ICONS.edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={() => setDeleteTarget(field)}>
                            <ICONS.delete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={fields.length}
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

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography fontWeight={700} component="span">{editId ? "Edit Field" : "Add Field"}</Typography>
            <IconButton size="small" onClick={() => setDialogOpen(false)}><ICONS.close fontSize="small" /></IconButton>
          </Stack>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2, display: "flex", flexDirection: "column", gap: 2 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              fullWidth label="Label" placeholder="e.g. Full Name"
              value={form.label}
              onChange={(e) => { setForm((p) => ({ ...p, label: e.target.value, fieldKey: editId ? p.fieldKey : e.target.value.toLowerCase().replace(/\s+/g, "_") })); }}
            />
            <TextField
              fullWidth label="Field Key" placeholder="e.g. full_name"
              value={form.fieldKey}
              onChange={(e) => setForm((p) => ({ ...p, fieldKey: e.target.value.toLowerCase().replace(/\s+/g, "_") }))}
            />
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              select fullWidth label="Input Type" value={form.inputType}
              onChange={(e) => setForm((p) => ({ ...p, inputType: e.target.value }))}
            >
              {INPUT_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </TextField>
            <TextField
              fullWidth label="Sort Order" type="number" value={form.sortOrder}
              onChange={(e) => setForm((p) => ({ ...p, sortOrder: e.target.value }))}
            />
          </Stack>

          {needsOptions && (
            <TextField
              fullWidth label="Options (comma separated)"
              placeholder="e.g. Meeting, Delivery, Interview, Other"
              value={form.options}
              onChange={(e) => setForm((p) => ({ ...p, options: e.target.value }))}
              helperText="Enter options separated by commas"
            />
          )}

          <Stack direction="row" spacing={3}>
            <FormControlLabel
              control={<Switch checked={form.isRequired} onChange={(e) => setForm((p) => ({ ...p, isRequired: e.target.checked }))} color="error" />}
              label="Required"
            />
            <FormControlLabel
              control={<Switch checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} color="success" />}
              label="Active"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button variant="outlined" onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <ICONS.save />}
            onClick={handleSave}
            disabled={saving || !form.label.trim() || !form.fieldKey.trim()}
          >
            {editId ? "Save Changes" : "Create Field"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle>Delete Field</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Are you sure you want to delete the field <strong>&quot;{deleteTarget?.label}&quot;</strong>? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button variant="outlined" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="contained" color="error" startIcon={<ICONS.delete />} onClick={handleDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
