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
  Grid,
  CircularProgress,
  Menu,
  Checkbox,
  Pagination,
  FormControl,
  Select,
  InputLabel,
  InputAdornment,
  alpha,
} from "@mui/material";
import { useColorMode } from "@/contexts/ThemeContext";
import { useMessage } from "@/contexts/MessageContext";
import ICONS from "@/utils/iconUtil";
import { getCustomFields, createCustomField, updateCustomField, deleteCustomField } from "@/services/customFieldService";

import AppCard from "@/components/cards/AppCard";

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
  const { mode } = useColorMode();
  const isDark = mode === "dark";
  const { showMessage } = useMessage();
  const [saving, setSaving] = useState(false);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(12);

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
    const used = new Set(fields.map(f => Number(f.sortOrder)));
    let nextSortOrder = 1;
    while (used.has(nextSortOrder)) {
      nextSortOrder++;
    }
    setForm({ ...emptyForm(), sortOrder: nextSortOrder });
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
          <Typography variant="h5" fontWeight="bold">Registration Fields</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, opacity: 0.8 }}>
            Global dynamic fields used in the public visitor registration form.
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
          <Button 
            variant="contained" 
            startIcon={<ICONS.add />} 
            onClick={openAdd} 
          >
            Add Field
          </Button>
        </Box>
      </Box>

      <Divider sx={{ mb: 3 }} />

      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center" mb={4}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 800, color: "text.secondary", textTransform: "uppercase", letterSpacing: 1.5 }}>
            {fields.length} TOTAL CUSTOM FIELDS
          </Typography>
        </Box>
        
        <Stack direction="row" spacing={1.5} sx={{ width: { xs: "100%", md: "auto" } }}>
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
        </Stack>
      </Stack>

      {loading ? (
        <Stack alignItems="center" justifyContent="center" sx={{ py: 15 }}>
          <CircularProgress size={32} thickness={5} />
          <Typography variant="body2" sx={{ mt: 2, fontWeight: 600, opacity: 0.6 }}>Loading fields...</Typography>
        </Stack>
      ) : (
        <>
          <Grid container spacing={4} justifyContent="center">
            {pagedFields.length === 0 ? (
              <Grid item xs={12}>
                <Box sx={{ py: 12, textAlign: "center", bgcolor: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)", borderRadius: 6, border: "2px dashed", borderColor: "divider" }}>
                  <ICONS.empty sx={{ fontSize: 60, opacity: 0.2, mb: 2 }} />
                  <Typography variant="h6" fontWeight={700}>No fields found</Typography>
                  <Typography variant="body2" color="text.secondary">Start by adding a new custom registration field.</Typography>
                </Box>
              </Grid>
            ) : (
              pagedFields.map((field) => (
                <Grid 
                  item 
                  xs={12} sm={6} md={4} 
                  key={field.id}
                  sx={{ display: { xs: "flex", sm: "block" }, width: { xs: "100%", sm: "auto" } }}
                >
                  <AppCard 
                    sx={{ 
                      height: "100%",
                      width: "100%",
                      maxWidth: 380,
                      mx: "auto"
                    }}
                  >
                    {/* Header with gradient + ID */}
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
                       <Stack direction="row" alignItems="center" sx={{ gap: 1 }}>
                         <Box sx={{ 
                           width: 40, height: 40, 
                           borderRadius: 2, bgcolor: "primary.main", color: "primary.contrastText", 
                           display: "flex", alignItems: "center", justifyContent: "center",
                           fontWeight: 800, fontSize: "1rem"
                         }}>
                           {field.sortOrder}
                         </Box>
                         <Box sx={{ minWidth: 0, flex: 1 }}>
                           <Typography variant="subtitle1" fontWeight={800} noWrap sx={{ lineHeight: 1.2 }}>
                             {field.label}
                           </Typography>
                           <Typography variant="caption" fontFamily="monospace" color="text.secondary" sx={{ opacity: 0.7 }}>
                             {field.fieldKey}
                           </Typography>
                         </Box>
                       </Stack>
                    </Box>

                    {/* Dynamic Fields */}
                    <Box sx={{ flexGrow: 1, px: 2, py: 1.5 }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", py: 0.8, borderBottom: "1px solid", borderColor: "divider" }}>
                        <Typography variant="caption" sx={{ fontWeight: 800, color: "text.secondary", textTransform: "uppercase" }}>
                          Field Type
                        </Typography>
                        <Chip 
                          label={field.inputType.toUpperCase()} 
                          size="small" 
                          variant="tonal" 
                          sx={{ fontWeight: 800, borderRadius: 1, fontSize: "0.65rem", height: 22 }} 
                        />
                      </Box>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", py: 0.8, borderBottom: "none" }}>
                         <Stack direction="row" spacing={1}>
                           <Chip 
                             label={field.isRequired ? "Required" : "Optional"} 
                             size="small" 
                             color={field.isRequired ? "error" : "default"}
                             variant={field.isRequired ? "filled" : "outlined"}
                             sx={{ fontWeight: 800, fontSize: "0.65rem", height: 20 }} 
                           />
                           <Chip 
                             label={field.isActive ? "Active" : "Hidden"} 
                             size="small" 
                             color={field.isActive ? "success" : "default"}
                             variant={field.isActive ? "filled" : "outlined"}
                             sx={{ fontWeight: 800, fontSize: "0.65rem", height: 20 }} 
                           />
                         </Stack>
                      </Box>
                    </Box>

                    {/* Actions / Footer */}
                    <Box sx={{ p: 1.5, borderTop: "1px solid", borderColor: "divider", bgcolor: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)", display: "flex", justifyContent: "flex-end", gap: 1 }}>
                      <IconButton 
                        size="small" 
                        color="primary" 
                        onClick={() => openEdit(field)}
                        sx={{ bgcolor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)" }}
                      >
                        <ICONS.edit fontSize="small" />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        color="error" 
                        onClick={() => setDeleteTarget(field)}
                        sx={{ bgcolor: isDark ? "rgba(255,100,100,0.05)" : "rgba(255,0,0,0.03)" }}
                      >
                        <ICONS.delete fontSize="small" />
                      </IconButton>
                    </Box>
                  </AppCard>
                </Grid>
              ))
            )}
          </Grid>

          <Box display="flex" justifyContent="center" mt={4}>
            {fields.length > rowsPerPage && (
              <Pagination
                count={Math.ceil(fields.length / rowsPerPage)}
                page={page + 1}
                onChange={(e, v) => setPage(v - 1)}
                color="primary"
              />
            )}
          </Box>
        </>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4, variant: "frosted" } }}>
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
          <Button variant="outlined" onClick={() => setDialogOpen(false)} sx={{ borderRadius: 30 }}>Cancel</Button>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <ICONS.save />}
            onClick={handleSave}
            disabled={saving || !form.label.trim() || !form.fieldKey.trim()}
            sx={{ borderRadius: 30 }}
          >
            {editId ? "Save Changes" : "Create Field"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 4, variant: "frosted" } }}>
        <DialogTitle>Delete Field</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Are you sure you want to delete the field <strong>&quot;{deleteTarget?.label}&quot;</strong>? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button onClick={() => setDeleteTarget(null)} sx={{ borderRadius: 30 }}>Cancel</Button>
          <Button variant="contained" color="error" startIcon={<ICONS.delete />} onClick={handleDelete} sx={{ borderRadius: 30 }}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
