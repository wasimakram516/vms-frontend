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
} from "@mui/material";
import ICONS from "@/utils/iconUtil";

const INPUT_TYPES = ["text", "textarea", "number", "phone", "email", "select", "radio", "checkbox", "date", "time", "file"];

const MOCK_FIELDS = [
  { id: "1", field_key: "full_name",    label: "Full Name",        input_type: "text",   is_required: true,  is_active: true,  sort_order: 1 },
  { id: "2", field_key: "email",        label: "Email",            input_type: "email",  is_required: true,  is_active: true,  sort_order: 2 },
  { id: "3", field_key: "phone",        label: "Phone Number",     input_type: "phone",  is_required: false, is_active: true,  sort_order: 3 },
  { id: "4", field_key: "company",      label: "Company",          input_type: "text",   is_required: false, is_active: true,  sort_order: 4 },
  { id: "5", field_key: "visit_purpose",label: "Visit Purpose",    input_type: "select", is_required: true,  is_active: true,  sort_order: 5, options_json: ["Meeting", "Delivery", "Interview", "Other"] },
  { id: "6", field_key: "id_number",    label: "ID",input_type: "text",   is_required: false, is_active: false, sort_order: 6 },
];

const emptyForm = () => ({
  field_key: "", label: "", input_type: "text", is_required: false, is_active: true, sort_order: 99, options: "",
});

export default function CmsFieldsPage() {
  const [fields, setFields] = useState(MOCK_FIELDS);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [editId, setEditId] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const openAdd = () => {
    setForm(emptyForm());
    setEditId(null);
    setDialogOpen(true);
  };

  const openEdit = (field) => {
    setForm({
      field_key: field.field_key,
      label: field.label,
      input_type: field.input_type,
      is_required: field.is_required,
      is_active: field.is_active,
      sort_order: field.sort_order,
      options: (field.options_json || []).join(", "),
    });
    setEditId(field.id);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.field_key.trim() || !form.label.trim()) return;

    const payload = {
      field_key: form.field_key.trim().toLowerCase().replace(/\s+/g, "_"),
      label: form.label.trim(),
      input_type: form.input_type,
      is_required: form.is_required,
      is_active: form.is_active,
      sort_order: Number(form.sort_order) || 99,
      options_json: ["select", "radio", "checkbox"].includes(form.input_type)
        ? form.options.split(",").map((o) => o.trim()).filter(Boolean)
        : [],
    };

    if (editId) {
      setFields((prev) => prev.map((f) => f.id === editId ? { ...f, ...payload } : f));
      showToast("Field updated.");
    } else {
      setFields((prev) => [...prev, { id: String(Date.now()), ...payload }]);
      showToast("Field created.");
    }

    setDialogOpen(false);
    setEditId(null);
    setForm(emptyForm());
  };

  const handleDelete = () => {
    setFields((prev) => prev.filter((f) => f.id !== deleteTarget.id));
    showToast(`"${deleteTarget.label}" deleted.`, "error");
    setDeleteTarget(null);
  };

  const needsOptions = ["select", "radio", "checkbox"].includes(form.input_type);

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

      {toast && (
        <Alert severity={toast.type === "error" ? "error" : "success"} sx={{ mb: 2, borderRadius: 2 }} onClose={() => setToast(null)}>
          {toast.msg}
        </Alert>
      )}

      <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid rgba(0,0,0,0.07)", overflow: "hidden" }}>
        <TableContainer>
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
              {fields.sort((a, b) => a.sort_order - b.sort_order).map((field) => (
                <TableRow key={field.id} hover>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">{field.sort_order}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{field.label}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace" color="text.secondary">{field.field_key}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={field.input_type} size="small" variant="outlined" sx={{ fontFamily: "monospace", fontSize: "0.7rem" }} />
                  </TableCell>
                  <TableCell>
                    <Chip label={field.is_required ? "Yes" : "No"} size="small" color={field.is_required ? "error" : "default"} />
                  </TableCell>
                  <TableCell>
                    <Chip label={field.is_active ? "Active" : "Inactive"} size="small" color={field.is_active ? "success" : "default"} />
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
        </TableContainer>
      </Paper>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography fontWeight={700}>{editId ? "Edit Field" : "Add Field"}</Typography>
            <IconButton size="small" onClick={() => setDialogOpen(false)}><ICONS.close fontSize="small" /></IconButton>
          </Stack>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2, display: "flex", flexDirection: "column", gap: 2 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              fullWidth label="Label" placeholder="e.g. Full Name"
              value={form.label}
              onChange={(e) => { setForm((p) => ({ ...p, label: e.target.value, field_key: editId ? p.field_key : e.target.value.toLowerCase().replace(/\s+/g, "_") })); }}
            />
            <TextField
              fullWidth label="Field Key" placeholder="e.g. full_name"
              value={form.field_key}
              onChange={(e) => setForm((p) => ({ ...p, field_key: e.target.value.toLowerCase().replace(/\s+/g, "_") }))}
            />
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              select fullWidth label="Input Type" value={form.input_type}
              onChange={(e) => setForm((p) => ({ ...p, input_type: e.target.value }))}
            >
              {INPUT_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </TextField>
            <TextField
              fullWidth label="Sort Order" type="number" value={form.sort_order}
              onChange={(e) => setForm((p) => ({ ...p, sort_order: e.target.value }))}
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
              control={<Switch checked={form.is_required} onChange={(e) => setForm((p) => ({ ...p, is_required: e.target.checked }))} color="error" />}
              label="Required"
            />
            <FormControlLabel
              control={<Switch checked={form.is_active} onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))} color="success" />}
              label="Active"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button variant="outlined" onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            startIcon={<ICONS.save />}
            onClick={handleSave}
            disabled={!form.label.trim() || !form.field_key.trim()}
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
