"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Box,
  Typography,
  IconButton,
  Stack,
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Switch,
  FormControlLabel,
  Chip,
  Divider,
  CircularProgress,
  Pagination,
  FormControl,
  Select,
  InputLabel,
  OutlinedInput,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import { useColorMode } from "@/contexts/ThemeContext";
import { useMessage } from "@/contexts/MessageContext";
import ICONS from "@/utils/iconUtil";
import {
  getCustomFields,
  createCustomField,
  updateCustomField,
  deleteCustomField,
} from "@/services/customFieldService";

import AppCard from "@/components/cards/AppCard";
import ListToolbar from "@/components/ListToolbar";
import LoadingState from "@/components/LoadingState";
import NoDataAvailable from "@/components/NoDataAvailable";
import ResponsiveCardGrid from "@/components/ResponsiveCardGrid";
import ConfirmationDialog from "@/components/modals/ConfirmationDialog";
import DialogHeader from "@/components/modals/DialogHeader";
import RecordMetadata from "@/components/RecordMetadata";

const INPUT_TYPES = [
  "text",
  "textarea",
  "number",
  "phone",
  "email",
  "select",
  "radio",
  "checkbox",
  "date",
  "time",
  "file",
  "country",
];
const SUPPORTED_INPUT_TYPES = new Set(INPUT_TYPES);
const HAS_OPTIONS = ["select", "radio", "checkbox"];
const HAS_DEPENDENTS = ["select", "radio"];

const emptyForm = () => ({
  fieldKey: "",
  label: "",
  inputType: "text",
  isRequired: false,
  isActive: true,
  isUnique: false,
  isVipFastTrack: false,
  sortOrder: 99,
  options: "",
  dependentsJson: {},
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
      setFields(Array.isArray(f) ? f : []);
    } catch (err) {
      console.error("Failed to load fields", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Fields available as dependent targets (all except the one being edited)
  const dependentCandidates = useMemo(
    () => fields.filter((f) => f.id !== editId),
    [fields, editId]
  );

  // Reverse map: childFieldId → [{ parentLabel, triggerValue }]
  const childToParents = useMemo(() => {
    const map = {};
    fields.forEach((f) => {
      const deps = f.dependentsJson || f.dependents_json || {};
      Object.entries(deps).forEach(([triggerValue, config]) => {
        const ids = Array.isArray(config) ? config : (config?.fieldIds || []);
        ids.forEach((childId) => {
          if (!map[childId]) map[childId] = [];
          map[childId].push({ parentLabel: f.label, triggerValue });
        });
      });
    });
    return map;
  }, [fields]);

  // Parsed option list from comma-separated string
  const parsedOptions = useMemo(
    () =>
      form.options
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean),
    [form.options]
  );

  const openAdd = () => {
    const used = new Set(fields.map((f) => Number(f.sortOrder)));
    let nextSortOrder = 1;
    while (used.has(nextSortOrder)) nextSortOrder++;
    setForm({ ...emptyForm(), sortOrder: nextSortOrder });
    setEditId(null);
    setDialogOpen(true);
  };

  const openEdit = (field) => {
    setForm({
      fieldKey: field.fieldKey,
      label: field.label,
      inputType: SUPPORTED_INPUT_TYPES.has(field.inputType)
        ? field.inputType
        : "text",
      isRequired: !!field.isRequired,
      isActive: field.isActive !== false,
      isUnique: !!field.isUnique,
      isVipFastTrack: field.isVipFastTrack ?? false,
      sortOrder: field.sortOrder,
      options: (field.optionsJson || []).join(", "),
      dependentsJson: field.dependentsJson || {},
    });
    setEditId(field.id);
    setDialogOpen(true);
  };

  // Keep dependentsJson keys in sync when options change
  const handleOptionsChange = (value) => {
    const newOptions = value
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
    setForm((p) => {
      const cleaned = {};
      for (const opt of newOptions) {
        cleaned[opt] = p.dependentsJson?.[opt] || { fieldIds: [], isUniqueTogether: false, areAllRequired: false };
      }
      return { ...p, options: value, dependentsJson: cleaned };
    });
  };

  // Update which child fields are shown for a given option value
  const handleDependentsChange = (optionValue, selectedFieldIds) => {
    setForm((p) => {
      const current = p.dependentsJson?.[optionValue] || {};
      const isOldFormat = Array.isArray(current);
      return {
        ...p,
        dependentsJson: {
          ...p.dependentsJson,
          [optionValue]: isOldFormat
            ? { fieldIds: selectedFieldIds, isUniqueTogether: false }
            : { ...current, fieldIds: selectedFieldIds },
        },
      };
    });
  };

  const handleUniqueTogetherToggle = (optionValue, isChecked) => {
    setForm((p) => {
      const current = p.dependentsJson?.[optionValue] || {};
      const isOldFormat = Array.isArray(current);
      return {
        ...p,
        dependentsJson: {
          ...p.dependentsJson,
          [optionValue]: isOldFormat
            ? { fieldIds: current, isUniqueTogether: isChecked, areAllRequired: false }
            : { ...current, isUniqueTogether: isChecked },
        },
      };
    });
  };

  const handleAreAllRequiredToggle = (optionValue, isChecked) => {
    setForm((p) => {
      const current = p.dependentsJson?.[optionValue] || {};
      const isOldFormat = Array.isArray(current);
      return {
        ...p,
        dependentsJson: {
          ...p.dependentsJson,
          [optionValue]: isOldFormat
            ? { fieldIds: current, isUniqueTogether: false, areAllRequired: isChecked }
            : { ...current, areAllRequired: isChecked },
        },
      };
    });
  };

  const handleSave = async () => {
    if (!SUPPORTED_INPUT_TYPES.has(form.inputType)) {
      showMessage(
        `The "${form.inputType}" field type is not supported. Please use one of the available field types.`,
        "error"
      );
      return;
    }

    const optionsJson = HAS_OPTIONS.includes(form.inputType)
      ? form.options
          .split(",")
          .map((o) => o.trim())
          .filter(Boolean)
      : [];

    if (HAS_OPTIONS.includes(form.inputType) && optionsJson.length < 2) {
      showMessage("Please provide at least 2 options for this field type.", "error");
      return;
    }

    // Only save dependentsJson for select/radio; clear for others
    const dependentsJson = HAS_DEPENDENTS.includes(form.inputType)
      ? Object.fromEntries(
          Object.entries(form.dependentsJson || {}).filter(([_, config]) => {
            const ids = Array.isArray(config) ? config : config.fieldIds;
            return ids && ids.length > 0;
          }).map(([opt, config]) => {
            if (Array.isArray(config)) {
              return [opt, { fieldIds: config, isUniqueTogether: false, areAllRequired: false }];
            }
            return [opt, config];
          })
        )
      : null;

    setSaving(true);
    const payload = {
      fieldKey: form.fieldKey.trim().toLowerCase().replace(/\s+/g, "_"),
      label: form.label.trim(),
      inputType: form.inputType,
      isRequired: form.isRequired,
      isActive: form.isActive,
      isUnique: form.isUnique,
      isVipFastTrack: form.isVipFastTrack,
      sortOrder: Number(form.sortOrder) || 99,
      optionsJson,
      dependentsJson: Object.keys(dependentsJson || {}).length ? dependentsJson : null,
    };

    try {
      if (editId) {
        await updateCustomField(editId, payload);
      } else {
        await createCustomField(payload);
      }
      fetchData();
      setDialogOpen(false);
      setEditId(null);
      setForm(emptyForm());
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    await deleteCustomField(deleteTarget.id);
    fetchData();
    setDeleteTarget(null);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const pagedFields = [...fields]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const needsOptions = HAS_OPTIONS.includes(form.inputType);
  const needsDependents = HAS_DEPENDENTS.includes(form.inputType) && parsedOptions.length >= 2;

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
            Registration Fields
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, opacity: 0.8 }}>
            Global dynamic fields used in the public visitor registration form.
          </Typography>
        </Box>
        <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 1, width: { xs: "100%", sm: "auto" } }}>
          <Button variant="contained" startIcon={<ICONS.add />} onClick={openAdd}>
            Create
          </Button>
        </Box>
      </Box>

      <Divider sx={{ mb: 3 }} />

      <ListToolbar
        showingCount={pagedFields.length}
        totalCount={fields.length}
        actionsSlot={
          <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 160 } }}>
            <InputLabel>Records per page</InputLabel>
            <Select value={rowsPerPage} onChange={handleChangeRowsPerPage} label="Records per page">
              {[6, 12, 24, 48].map((n) => (
                <MenuItem key={n} value={n}>{n}</MenuItem>
              ))}
            </Select>
          </FormControl>
        }
      />

      {loading ? (
        <LoadingState />
      ) : (
        <>
          {pagedFields.length === 0 ? (
            <NoDataAvailable
              title="No fields found"
              description="Start by adding a new custom registration field."
            />
          ) : (
            <ResponsiveCardGrid>
              {pagedFields.map((field) => (
                <AppCard key={field.id} sx={{ height: "100%", width: "100%" }}>
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
                      <Box
                        sx={{
                          width: 40, height: 40, borderRadius: 2,
                          bgcolor: "primary.main", color: "primary.contrastText",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontWeight: 800, fontSize: "1rem",
                        }}
                      >
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

                  <Box sx={{ flexGrow: 1, px: 2, py: 1.5 }}>
                    <Box
                      sx={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        py: 0.8, borderBottom: "1px solid", borderColor: "divider",
                      }}
                    >
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
                    {field.dependentsJson && Object.keys(field.dependentsJson).length > 0 && (
                      <Box
                        sx={{
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          py: 0.8, borderBottom: "1px solid", borderColor: "divider",
                        }}
                      >
                        <Typography variant="caption" sx={{ fontWeight: 800, color: "text.secondary", textTransform: "uppercase" }}>
                          Triggers
                        </Typography>
                        <Chip
                          label={`${Object.values(field.dependentsJson).reduce((acc, config) => {
                            const ids = Array.isArray(config) ? config : (config?.fieldIds || []);
                            return acc + ids.length;
                          }, 0)} child field(s)`}
                          size="small"
                          color="info"
                          variant="tonal"
                          sx={{ fontWeight: 800, borderRadius: 1, fontSize: "0.65rem", height: 22 }}
                        />
                      </Box>
                    )}
                    {childToParents[field.id]?.length > 0 && (
                      <Box sx={{ py: 0.8, borderBottom: "1px solid", borderColor: "divider" }}>
                        <Typography variant="caption" sx={{ fontWeight: 800, color: "text.secondary", textTransform: "uppercase", display: "block", mb: 0.5 }}>
                          Shown when
                        </Typography>
                        <Stack direction="row" flexWrap="wrap" gap={0.5}>
                          {childToParents[field.id].map(({ parentLabel, triggerValue }, i) => (
                            <Chip
                              key={i}
                              label={`${parentLabel} = "${triggerValue}"`}
                              size="small"
                              color="warning"
                              variant="outlined"
                              sx={{ fontWeight: 700, fontSize: "0.6rem", height: 20 }}
                            />
                          ))}
                        </Stack>
                      </Box>
                    )}
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", py: 0.8 }}>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
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
                        {field.isUnique && (
                          <Chip
                            label="Unique"
                            size="small"
                            color="info"
                            variant="filled"
                            sx={{ fontWeight: 800, fontSize: "0.65rem", height: 20 }}
                          />
                        )}
                        {field.isVipFastTrack && (
                          <Chip
                            label="VIP Fast Track"
                            size="small"
                            color="warning"
                            variant="filled"
                            icon={<ICONS.star style={{ fontSize: "0.75rem" }} />}
                            sx={{ fontWeight: 800, fontSize: "0.65rem", height: 20 }}
                          />
                        )}
                      </Stack>
                    </Box>
                  </Box>

                  <Box
                    sx={{
                      p: 1.2,
                      borderTop: "1px solid",
                      borderColor: "divider",
                      bgcolor: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 1,
                    }}
                  >
                    <Box sx={{ width: "100%", overflow: "hidden" }}>
                      <RecordMetadata
                        createdByName={field.created_by}
                        updatedByName={field.updated_by}
                        createdAt={field.created_at}
                        updatedAt={field.updated_at}
                        locale="en-GB"
                        sx={{ px: 0, py: 0 }}
                      />
                    </Box>
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <IconButton
                        size="small" color="primary" onClick={() => openEdit(field)}
                        sx={{ bgcolor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)" }}
                      >
                        <ICONS.edit fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small" color="error" onClick={() => setDeleteTarget(field)}
                        sx={{ bgcolor: isDark ? "rgba(255,100,100,0.05)" : "rgba(255,0,0,0.03)" }}
                      >
                        <ICONS.delete fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Box>
                </AppCard>
              ))}
            </ResponsiveCardGrid>
          )}

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
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 4, variant: "frosted" } }}
      >
        <DialogHeader
          title={editId ? "Edit Field" : "Add Field"}
          onClose={() => setDialogOpen(false)}
        />
        <Divider />
        <DialogContent sx={{ pt: 2, display: "flex", flexDirection: "column", gap: 2 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              fullWidth
              label="Label"
              placeholder="e.g. Full Name"
              value={form.label}
              onChange={(e) => {
                setForm((p) => ({
                  ...p,
                  label: e.target.value,
                  fieldKey: editId
                    ? p.fieldKey
                    : e.target.value.toLowerCase().replace(/\s+/g, "_"),
                }));
              }}
            />
            <TextField
              fullWidth
              label="Field Key"
              placeholder="e.g. full_name"
              value={form.fieldKey}
              onChange={(e) =>
                setForm((p) => ({ ...p, fieldKey: e.target.value.toLowerCase().replace(/\s+/g, "_") }))
              }
            />
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              select
              fullWidth
              label="Input Type"
              value={form.inputType}
              onChange={(e) =>
                setForm((p) => ({ ...p, inputType: e.target.value, dependentsJson: {} }))
              }
            >
              {INPUT_TYPES.map((t) => (
                <MenuItem key={t} value={t}>{t}</MenuItem>
              ))}
            </TextField>
            <TextField
              fullWidth
              label="Sort Order"
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm((p) => ({ ...p, sortOrder: e.target.value }))}
            />
          </Stack>

          {needsOptions && (
            <TextField
              fullWidth
              label="Options (comma separated)"
              placeholder="e.g. Oman ID, Passport"
              value={form.options}
              onChange={(e) => handleOptionsChange(e.target.value)}
              helperText="Enter options separated by commas"
            />
          )}

          {/* Dependent Fields Configuration */}
          {needsDependents && (
            <Box>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
                Dependent Fields
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
                Choose which fields appear when each option is selected. Leave empty for no dependents.
              </Typography>
              {dependentCandidates.length === 0 ? (
                <Alert severity="info" sx={{ borderRadius: 2 }}>
                  No other fields available yet. Create more fields first.
                </Alert>
              ) : (
                <Stack spacing={1}>
                  {parsedOptions.map((opt) => {
                    const config = form.dependentsJson?.[opt] || { fieldIds: [], isUniqueTogether: false };
                    const selectedIds = Array.isArray(config) ? config : (config.fieldIds || []);
                    const isUniqueTogether = Array.isArray(config) ? false : !!config.isUniqueTogether;

                    return (
                      <Accordion
                        key={opt}
                        disableGutters
                        elevation={0}
                        sx={{
                          border: "1px solid",
                          borderColor: "divider",
                          borderRadius: "8px !important",
                          overflow: "hidden",
                          bgcolor: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)",
                          "&:before": { display: "none" },
                        }}
                      >
                        <AccordionSummary
                          expandIcon={<ICONS.expandMore />}
                          sx={{ px: 2, minHeight: 48, "& .MuiAccordionSummary-content": { my: 1, alignItems: "center", justifyContent: "space-between" } }}
                        >
                          <Typography variant="caption" fontWeight={800} color="primary" sx={{ textTransform: "uppercase" }}>
                            {opt}
                          </Typography>
                          <Stack direction="row" spacing={1} sx={{ mr: 1 }}>
                            {selectedIds.length > 0 && (
                              <Chip
                                label={`${selectedIds.length} field(s)`}
                                size="small"
                                variant="outlined"
                                sx={{ height: 20, fontSize: "0.6rem", fontWeight: 800 }}
                              />
                            )}
                            {isUniqueTogether && (
                              <Chip
                                label="Unique Combo"
                                size="small"
                                variant="tonal"
                                color="info"
                                sx={{ height: 20, fontSize: "0.6rem", fontWeight: 800 }}
                              />
                            )}
                            {config.areAllRequired && (
                              <Chip
                                label="Mandatory"
                                size="small"
                                variant="tonal"
                                color="warning"
                                sx={{ height: 20, fontSize: "0.6rem", fontWeight: 800 }}
                              />
                            )}
                          </Stack>
                        </AccordionSummary>
                        <AccordionDetails sx={{ px: 2, pt: 0, pb: 2 }}>
                          <Stack spacing={1.5}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Show these fields</InputLabel>
                              <Select
                                multiple
                                value={selectedIds}
                                onChange={(e) => handleDependentsChange(opt, e.target.value)}
                                input={<OutlinedInput label="Show these fields" />}
                                renderValue={(selected) =>
                                  selected
                                    .map((id) => dependentCandidates.find((f) => f.id === id)?.label || id)
                                    .join(", ")
                                }
                              >
                                {dependentCandidates.map((f) => (
                                  <MenuItem key={f.id} value={f.id}>
                                    <Box>
                                      <Typography variant="body2">{f.label}</Typography>
                                      <Typography variant="caption" color="text.secondary" fontFamily="monospace">
                                        {f.fieldKey}
                                      </Typography>
                                    </Box>
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                            <Stack 
                              direction={{ xs: "column", md: "row" }} 
                              spacing={2} 
                              sx={{ mt: 1 }}
                            >
                              <FormControlLabel
                                sx={{ ml: 0, flex: 1, alignItems: "flex-start" }}
                                control={
                                  <Switch
                                    size="small"
                                    checked={isUniqueTogether}
                                    onChange={(e) => handleUniqueTogetherToggle(opt, e.target.checked)}
                                    color="info"
                                    sx={{ mt: 0.5 }}
                                  />
                                }
                                label={
                                  <Box>
                                    <Typography variant="caption" fontWeight={800} color="info.main" sx={{ display: "block", lineHeight: 1.2 }}>
                                      Prevent duplicate combinations
                                    </Typography>
                                    <Typography variant="caption" display="block" color="text.secondary" sx={{ fontSize: "0.7rem", mt: 0.2, lineHeight: 1.1 }}>
                                      Ensures this specific set of answers hasn't been registered before.
                                    </Typography>
                                  </Box>
                                }
                              />
                              <FormControlLabel
                                sx={{ ml: 0, flex: 1, alignItems: "flex-start" }}
                                control={
                                  <Switch
                                    size="small"
                                    checked={!!config.areAllRequired}
                                    onChange={(e) => handleAreAllRequiredToggle(opt, e.target.checked)}
                                    color="warning"
                                    sx={{ mt: 0.5 }}
                                  />
                                }
                                label={
                                  <Box>
                                    <Typography variant="caption" fontWeight={800} color="warning.main" sx={{ display: "block", lineHeight: 1.2 }}>
                                      Force these to be Mandatory
                                    </Typography>
                                    <Typography variant="caption" display="block" color="text.secondary" sx={{ fontSize: "0.7rem", mt: 0.2, lineHeight: 1.1 }}>
                                      Mark all selected fields as required when this option is chosen.
                                    </Typography>
                                  </Box>
                                }
                              />
                            </Stack>
                          </Stack>
                        </AccordionDetails>
                      </Accordion>
                    );
                  })}
                </Stack>
              )}
            </Box>
          )}

          <Box sx={{ display: "flex", flexWrap: "wrap", columnGap: 3, rowGap: 0.5, alignItems: "center" }}>
            <FormControlLabel
              control={
                <Switch
                  checked={form.isRequired}
                  onChange={(e) => setForm((p) => ({ ...p, isRequired: e.target.checked }))}
                  color="success"
                />
              }
              label="Required"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.isActive}
                  onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                  color="success"
                />
              }
              label="Active"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.isUnique}
                  onChange={(e) => setForm((p) => ({ ...p, isUnique: e.target.checked }))}
                  color="success"
                />
              }
              label="Unique"
            />
            <Box sx={{ flexBasis: "100%", height: 0 }} />
            <FormControlLabel
              control={
                <Switch
                  checked={form.isVipFastTrack}
                  onChange={(e) => setForm((p) => ({ ...p, isVipFastTrack: e.target.checked }))}
                  color="success"
                />
              }
              label="VIP Fast Track"
            />
          </Box>

        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<ICONS.cancel />}
            onClick={() => setDialogOpen(false)}
            sx={{ borderRadius: 30 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <ICONS.save />}
            onClick={handleSave}
            disabled={saving || !form.label.trim() || !form.fieldKey.trim()}
            sx={{ borderRadius: 30 }}
          >
            {editId ? "Save" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmationDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Field"
        message={`Are you sure you want to delete the field "${deleteTarget?.label}"? This action cannot be undone.`}
        confirmButtonText="Delete"
        confirmButtonIcon={<ICONS.delete fontSize="small" />}
      />
    </Box>
  );
}
