"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Box,
  Typography,
  Divider,
  Button,
  IconButton,
  Dialog,
  DialogContent,
  DialogActions,
  TextField,
  Pagination,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Chip,
  CircularProgress,
  Tabs,
  Tab,
  Tooltip,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import { useMessage } from "@/contexts/MessageContext";
import { useAuth } from "@/contexts/AuthContext";
import ICONS from "@/utils/iconUtil";
import AppCard from "@/components/cards/AppCard";
import ListToolbar from "@/components/ListToolbar";
import RichTextEditor from "@/components/RichTextEditor";
import LoadingState from "@/components/LoadingState";
import NoDataAvailable from "@/components/NoDataAvailable";
import ResponsiveCardGrid from "@/components/ResponsiveCardGrid";
import ConfirmationDialog from "@/components/modals/ConfirmationDialog";
import DialogHeader from "@/components/modals/DialogHeader";
import RoleGuard from "@/components/auth/RoleGuard";
import PermissionGuard from "@/components/auth/PermissionGuard";
import { canAccessResource } from "@/utils/permissions";
import RecordMetadata from "@/components/RecordMetadata";
import {
  getNdaTemplates,
  createNdaTemplate,
  updateNdaTemplate,
  activateNdaTemplate,
  deactivateNdaTemplate,
  deleteNdaTemplate,
} from "@/services/ndaTemplateService";
import { validateRequired } from "@/utils/validationUtils";
import { htmlToNdaDoc, ndaDocToHtml } from "@/utils/ndaDocUtils";

const emptyForm = () => ({
  name: "",
  preamble: "",
  body: "",
  visitorRecordTitle: "",
  visitorRecordNote: "",
  footer: "",
  validityDurationMonths: 60,
});

function monthsToYearsLabel(months) {
  const num = parseInt(months, 10);
  if (!num || num < 1) return "";
  const years = num / 12;
  if (years === Math.floor(years)) return `≈ ${years} ${years === 1 ? "year" : "years"}`;
  return `≈ ${years.toFixed(1)} years`;
}

function TabPanel({ children, value, index }) {
  return (
    <Box role="tabpanel" sx={{ pt: 2, display: value !== index ? 'none' : 'block' }}>
      {children}
    </Box>
  );
}

function FieldLabel({ children }) {
  return (
    <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mb: 0.5, display: "block", textTransform: "uppercase", letterSpacing: 0.5 }}>
      {children}
    </Typography>
  );
}

export default function NdaTemplatesPage() {
  const { user } = useAuth();
  const canCreate = canAccessResource(user, "nda-forms", { hardcodeAllowed: user?.role === "superadmin" || user?.role === "dev", action: "create" });
  const canUpdate = canAccessResource(user, "nda-forms", { hardcodeAllowed: user?.role === "superadmin" || user?.role === "dev", action: "update" });
  const canDelete = canAccessResource(user, "nda-forms", { hardcodeAllowed: user?.role === "superadmin" || user?.role === "dev", action: "delete" });
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [activateTarget, setActivateTarget] = useState(null);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState(0);
  const [formErrors, setFormErrors] = useState({});

  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(12);
  const PAGE_SIZE = rowsPerPage;

  const { showMessage } = useMessage();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await getNdaTemplates();
      setTemplates(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return templates;
    return templates.filter((t) => (t.name || "").toLowerCase().includes(q));
  }, [templates, searchQuery]);

  const paged = useMemo(
    () => filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [filtered, page]
  );

  const openCreate = () => {
    setForm(emptyForm());
    setFormErrors({});
    setEditId(null);
    setTab(0);
    setDialogOpen(true);
  };

  const openEdit = (tpl) => {
    setFormErrors({});
    setForm({
      name: tpl.name || "",
      // Convert stored JSON blocks → HTML for the rich text editor
      preamble: Array.isArray(tpl.preamble) ? ndaDocToHtml(tpl.preamble) : (tpl.preamble || ""),
      body: Array.isArray(tpl.body) ? ndaDocToHtml(tpl.body) : (tpl.body || ""),
      visitorRecordTitle: tpl.visitorRecordTitle || "",
      visitorRecordNote: Array.isArray(tpl.visitorRecordNote) ? ndaDocToHtml(tpl.visitorRecordNote) : (tpl.visitorRecordNote || ""),
      footer: Array.isArray(tpl.footer) ? ndaDocToHtml(tpl.footer) : (tpl.footer || ""),
      validityDurationMonths: tpl.validityDurationMonths ?? 60,
    });
    setEditId(tpl.id);
    setTab(0);
    setDialogOpen(true);
  };

  const validateForm = () => {
    const errors = {};

    const nameError = validateRequired(form.name, "Template name");
    if (nameError) errors.name = nameError;

    const bodyError = validateRequired(form.body, "Body content");
    if (bodyError) errors.body = bodyError;

    const months = parseInt(form.validityDurationMonths, 10);
    if (!form.validityDurationMonths && form.validityDurationMonths !== 0) {
      errors.validityDurationMonths = "Validity duration is required";
    } else if (isNaN(months) || months < 1) {
      errors.validityDurationMonths = "Validity duration must be at least 1 month";
    }

    return errors;
  };

  const handleSave = async () => {
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setFormErrors(validationErrors);
      Object.values(validationErrors).forEach(err => showMessage(err, "error"));
      return;
    }
    setFormErrors({});

    setSaving(true);
    try {
      // Convert HTML from the editor → structured JSON blocks before saving
      const payload = {
        name: form.name.trim(),
        preamble: htmlToNdaDoc(form.preamble),
        body: htmlToNdaDoc(form.body),
        visitorRecordTitle: form.visitorRecordTitle.trim() || undefined,
        visitorRecordNote: form.visitorRecordNote ? htmlToNdaDoc(form.visitorRecordNote) : undefined,
        footer: form.footer ? htmlToNdaDoc(form.footer) : undefined,
        validityDurationMonths: parseInt(form.validityDurationMonths, 10) || 60,
      };

      const result = editId
        ? await updateNdaTemplate(editId, payload)
        : await createNdaTemplate(payload);

      // withApiHandler returns { error: true } on failure instead of throwing — check it explicitly
      if (result?.error) return;

      await fetchData();
      setDialogOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    await deleteNdaTemplate(deleteTarget.id);
    await fetchData();
    setDeleteTarget(null);
  };

  const handleActivate = async () => {
    await activateNdaTemplate(activateTarget.id);
    await fetchData();
    setActivateTarget(null);
  };

  const handleDeactivate = async () => {
    await deactivateNdaTemplate(deactivateTarget.id);
    await fetchData();
    setDeactivateTarget(null);
  };

  return (
    <RoleGuard allowedRoles={["dev"]}>
    <PermissionGuard fullAccessRoles={["dev"]} readOnlyRoles={[]}>
      <Box>
        {/* Page header */}
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
            <Typography variant="h5" fontWeight="bold" sx={{ mb: 0.5 }}>
              NDA Templates
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ opacity: 0.8 }}>
              Manage Non-Disclosure Agreement templates. Only one template can be active at a time.
            </Typography>
          </Box>
          {canCreate && (
            <Box>
              <Button variant="contained" startIcon={<ICONS.add />} onClick={openCreate}>
                Create Template
              </Button>
            </Box>
          )}
        </Box>

        <Divider sx={{ mb: 3 }} />

        {loading ? (
          <LoadingState />
        ) : (
          <>
            <ListToolbar
              showingCount={paged.length}
              totalCount={filtered.length}
              itemLabel="templates"
              searchSlot={
                <TextField
                  fullWidth
                  size="small"
                  variant="outlined"
                  placeholder="Search by name..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
                  InputProps={{ startAdornment: <ICONS.search fontSize="small" sx={{ mr: 1, opacity: 0.6 }} /> }}
                  sx={{ maxWidth: { md: 380 } }}
                />
              }
              actionsSlot={
                <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 160 } }}>
                  <InputLabel>Records per page</InputLabel>
                  <Select
                    value={rowsPerPage}
                    onChange={(e) => { setRowsPerPage(e.target.value); setPage(0); }}
                    label="Records per page"
                  >
                    {[6, 12, 24, 48].map((n) => (
                      <MenuItem key={n} value={n}>{n}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              }
            />

            {paged.length === 0 ? (
              <NoDataAvailable
                title={searchQuery ? "No results found" : "No NDA templates yet"}
                description={searchQuery ? "Try adjusting your search." : "Create your first NDA template to use it in visitor emails and the registration popup."}
              />
            ) : (
              <ResponsiveCardGrid>
                {paged.map((tpl) => (
              <AppCard key={tpl.id} sx={{ height: "100%", width: "100%" }}>
                {/* Card header */}
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
                        {tpl.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Version {tpl.version}
                      </Typography>
                    </Box>
                    <Chip
                      label={tpl.isActive ? "Active" : "Inactive"}
                      size="small"
                      color={tpl.isActive ? "success" : "default"}
                      variant={tpl.isActive ? "filled" : "outlined"}
                      sx={{ fontWeight: 700, fontSize: "0.65rem", height: 22 }}
                    />
                  </Stack>
                </Box>

                {/* Card body — preview snippet */}
                <Box sx={{ flexGrow: 1, px: 2, py: 1.5 }}>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      lineHeight: 1.6,
                      fontSize: "0.8rem",
                    }}
                    dangerouslySetInnerHTML={{
                      __html: Array.isArray(tpl.preamble)
                        ? (ndaDocToHtml(tpl.preamble) || "<em>No preamble</em>")
                        : (tpl.preamble || "<em>No preamble</em>"),
                    }}
                  />
                </Box>

                {/* Card footer — actions and metadata */}
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
                      createdByName={tpl.created_by}
                      updatedByName={tpl.updated_by}
                      createdAt={tpl.created_at}
                      updatedAt={tpl.updated_at}
                      locale="en-GB"
                      sx={{ px: 0, py: 0 }}
                    />
                  </Box>
                  {(canUpdate || canDelete) && (
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      {canUpdate && (
                      <>
                      {tpl.isActive ? (
                        <Tooltip title="Deactivate">
                          <IconButton
                            size="small"
                            color="warning"
                            onClick={() => setDeactivateTarget(tpl)}
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
                            onClick={() => setActivateTarget(tpl)}
                            sx={{ bgcolor: "action.hover" }}
                          >
                            <ICONS.check fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => openEdit(tpl)}
                        sx={{ bgcolor: "action.hover" }}
                      >
                        <ICONS.edit fontSize="small" />
                      </IconButton>
                      </>
                      )}
                      {canDelete && (
                      <Tooltip title={tpl.isActive ? "Deactivate before deleting" : "Delete template"}>
                        <span>
                          <IconButton
                            size="small"
                            color="error"
                            disabled={tpl.isActive}
                            onClick={() => setDeleteTarget(tpl)}
                            sx={{ bgcolor: "action.hover" }}
                          >
                            <ICONS.delete fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      )}
                    </Stack>
                  )}
                </Box>
              </AppCard>
            ))}
              </ResponsiveCardGrid>
            )}

            <Box display="flex" justifyContent="center" mt={4}>
              {filtered.length > PAGE_SIZE && (
                <Pagination
                  count={Math.ceil(filtered.length / PAGE_SIZE)}
                  page={page + 1}
                  onChange={(_, v) => setPage(v - 1)}
                  color="primary"
                />
              )}
            </Box>
          </>
        )}

        {/* Create / Edit dialog */}
        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          maxWidth="lg"
          fullWidth
          PaperProps={{ sx: { borderRadius: 4 } }}
        >
          <DialogHeader
            title={editId ? "Edit NDA Template" : "Create NDA Template"}
            onClose={() => setDialogOpen(false)}
          />
          <Divider />

          <DialogContent sx={{ pt: 2 }}>
            {/* Basic info — always visible */}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3 }} alignItems="flex-start">
              <TextField
                sx={{ flex: 1 }}
                label="Template Heading"
                placeholder="e.g. Non-Disclosure Agreement"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                helperText="Displayed as the large heading at the top of the PDF"
              />
              <TextField
                sx={{ flex: 1 }}
                label="NDA Validity Duration (months)"
                type="number"
                inputProps={{ min: 1 }}
                value={form.validityDurationMonths}
                onChange={(e) => {
                  setForm((p) => ({ ...p, validityDurationMonths: e.target.value }));
                  if (formErrors.validityDurationMonths) setFormErrors((p) => ({ ...p, validityDurationMonths: undefined }));
                }}
                error={!!formErrors.validityDurationMonths}
                helperText={
                  formErrors.validityDurationMonths ||
                  (monthsToYearsLabel(form.validityDurationMonths)
                    ? `${monthsToYearsLabel(form.validityDurationMonths)} — re-acceptance required after this period`
                    : "Enter a value of at least 1 month")
                }
              />
            </Stack>

            {/* Tabbed rich text sections */}
            <Tabs
              value={tab}
              onChange={(_, v) => setTab(v)}
              variant={isMobile ? "scrollable" : "fullWidth"}
              scrollButtons={false}
              sx={{
                minHeight: 46,
                bgcolor: "action.hover",
                borderRadius: 999,
                p: 0.5,
                "& .MuiTabs-indicator": { display: "none" },
                "& .MuiTabs-flexContainer": { gap: isMobile ? 0.5 : 0 },
              }}
            >
              {["Preamble", "Body", "Visitor Note", "Footer"].map((label) => (
                <Tab
                  key={label}
                  label={label}
                  sx={{
                    minHeight: 38,
                    minWidth: isMobile ? 110 : "auto",
                    borderRadius: 999,
                    fontWeight: 800,
                    fontSize: "0.8rem",
                    textTransform: "none",
                    "&.Mui-selected": {
                      bgcolor: "background.paper",
                      color: "text.primary",
                      boxShadow: "0 6px 14px rgba(0,0,0,0.08)",
                    },
                  }}
                />
              ))}
            </Tabs>

            <TabPanel value={tab} index={0}>
              <FieldLabel>Preamble — binding notice box displayed at the top of the PDF</FieldLabel>
              <RichTextEditor
                value={form.preamble}
                onChange={(html) => setForm((p) => ({ ...p, preamble: html }))}
                placeholder="Enter the binding notice text…"
                minHeight="180px"
                maxHeight="360px"
              />
            </TabPanel>

            <TabPanel value={tab} index={1}>
              <FieldLabel>Body — main NDA sections and clauses</FieldLabel>
              <RichTextEditor
                value={form.body}
                onChange={(html) => setForm((p) => ({ ...p, body: html }))}
                placeholder="Enter the NDA body content (sections, clauses, obligations)…"
                minHeight="300px"
                maxHeight="480px"
              />
            </TabPanel>

            <TabPanel value={tab} index={2}>
              <TextField
                fullWidth
                label="Visitor Record Heading"
                placeholder="VISITOR RECORD"
                value={form.visitorRecordTitle}
                onChange={(e) => setForm((p) => ({ ...p, visitorRecordTitle: e.target.value }))}
                helperText="Defaults to 'VISITOR RECORD' if left empty"
                sx={{ mb: 2 }}
              />
              <FieldLabel>Visitor Record Note — italic note shown below the VISITOR RECORD heading</FieldLabel>
              <RichTextEditor
                value={form.visitorRecordNote}
                onChange={(html) => setForm((p) => ({ ...p, visitorRecordNote: html }))}
                placeholder="e.g. Acceptance is deemed given electronically upon submission…"
                minHeight="140px"
                maxHeight="280px"
              />
            </TabPanel>

            <TabPanel value={tab} index={3}>
              <FieldLabel>Footer — confirmation line printed at the bottom of the PDF</FieldLabel>
              <RichTextEditor
                value={form.footer}
                onChange={(html) => setForm((p) => ({ ...p, footer: html }))}
                placeholder="e.g. By submitting the access permit request, the Visitor confirms acceptance…"
                minHeight="140px"
                maxHeight="280px"
              />
            </TabPanel>
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
              startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <ICONS.save />}
              onClick={handleSave}
              disabled={saving || !form.name.trim()}
              sx={{ borderRadius: 30 }}
            >
              {editId ? "Save Changes" : "Create"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Deactivate confirmation */}
        <ConfirmationDialog
          open={!!deactivateTarget}
          onClose={() => setDeactivateTarget(null)}
          onConfirm={handleDeactivate}
          title="Deactivate Template"
          message={`Deactivate "${deactivateTarget?.name}"? Visitors won't see an NDA popup until another template is activated.`}
          confirmButtonText="Deactivate"
          confirmButtonIcon={<ICONS.close fontSize="small" />}
        />

        {/* Activate confirmation */}
        <ConfirmationDialog
          open={!!activateTarget}
          onClose={() => setActivateTarget(null)}
          onConfirm={handleActivate}
          title="Activate Template"
          message={`Set "${activateTarget?.name}" as the active NDA template? This will deactivate the current active template.`}
          confirmButtonText="Activate"
          confirmButtonIcon={<ICONS.check fontSize="small" />}
        />

        {/* Delete confirmation */}
        <ConfirmationDialog
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          title="Delete Template"
          message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
          confirmButtonText="Delete"
          confirmButtonIcon={<ICONS.delete fontSize="small" />}
        />
      </Box>
    </PermissionGuard>
    </RoleGuard>
  );
}
