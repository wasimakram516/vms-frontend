"use client";

import { useState, useEffect } from "react";
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
import ICONS from "@/utils/iconUtil";
import AppCard from "@/components/cards/AppCard";
import RichTextEditor from "@/components/RichTextEditor";
import LoadingState from "@/components/LoadingState";
import NoDataAvailable from "@/components/NoDataAvailable";
import ResponsiveCardGrid from "@/components/ResponsiveCardGrid";
import ConfirmationDialog from "@/components/modals/ConfirmationDialog";
import DialogHeader from "@/components/modals/DialogHeader";
import RoleGuard from "@/components/auth/RoleGuard";
import {
  getNdaTemplates,
  createNdaTemplate,
  updateNdaTemplate,
  activateNdaTemplate,
  deactivateNdaTemplate,
  deleteNdaTemplate,
} from "@/services/ndaTemplateService";

const emptyForm = () => ({
  name: "",
  preamble: "",
  body: "",
  visitorRecordTitle: "",
  visitorRecordNote: "",
  footer: "",
});

function TabPanel({ children, value, index }) {
  return (
    <Box role="tabpanel" hidden={value !== index} sx={{ pt: 2 }}>
      {value === index && children}
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

  const openCreate = () => {
    setForm(emptyForm());
    setEditId(null);
    setTab(0);
    setDialogOpen(true);
  };

  const openEdit = (tpl) => {
    setForm({
      name: tpl.name || "",
      preamble: tpl.preamble || "",
      body: tpl.body || "",
      visitorRecordTitle: tpl.visitorRecordTitle || "",
      visitorRecordNote: tpl.visitorRecordNote || "",
      footer: tpl.footer || "",
    });
    setEditId(tpl.id);
    setTab(0);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      showMessage("Template name is required.", "error");
      return;
    }
    if (!form.body.trim()) {
      showMessage("Body content is required.", "error");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        preamble: form.preamble,
        body: form.body,
        visitorRecordTitle: form.visitorRecordTitle.trim() || undefined,
        visitorRecordNote: form.visitorRecordNote || undefined,
        footer: form.footer || undefined,
      };

      if (editId) {
        await updateNdaTemplate(editId, payload);
      } else {
        await createNdaTemplate(payload);
      }
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
    <RoleGuard allowedRoles={["superadmin"]}>
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
          <Box>
            <Button variant="contained" startIcon={<ICONS.add />} onClick={openCreate}>
              Create Template
            </Button>
          </Box>
        </Box>

        <Divider sx={{ mb: 3 }} />

        {loading ? (
          <LoadingState />
        ) : templates.length === 0 ? (
          <NoDataAvailable
            title="No NDA templates yet"
            description="Create your first NDA template to use it in visitor emails and the registration popup."
          />
        ) : (
          <ResponsiveCardGrid>
            {templates.map((tpl) => (
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
                      __html: tpl.preamble || "<em>No preamble</em>",
                    }}
                  />
                </Box>

                {/* Card footer — actions */}
                <Box
                  sx={{
                    p: 1.5,
                    borderTop: "1px solid",
                    borderColor: "divider",
                    bgcolor: "action.hover",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  {tpl.isActive ? (
                    <Tooltip title="Remove active status">
                      <Button
                        size="small"
                        variant="outlined"
                        color="warning"
                        startIcon={<ICONS.close fontSize="small" />}
                        onClick={() => setDeactivateTarget(tpl)}
                        sx={{ borderRadius: 30, fontSize: "0.7rem" }}
                      >
                        Deactivate
                      </Button>
                    </Tooltip>
                  ) : (
                    <Tooltip title="Set as active template">
                      <Button
                        size="small"
                        variant="outlined"
                        color="success"
                        startIcon={<ICONS.check fontSize="small" />}
                        onClick={() => setActivateTarget(tpl)}
                        sx={{ borderRadius: 30, fontSize: "0.7rem" }}
                      >
                        Activate
                      </Button>
                    </Tooltip>
                  )}
                  <Stack direction="row" spacing={1}>
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => openEdit(tpl)}
                      sx={{ bgcolor: "action.hover" }}
                    >
                      <ICONS.edit fontSize="small" />
                    </IconButton>
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
                  </Stack>
                </Box>
              </AppCard>
            ))}
          </ResponsiveCardGrid>
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
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3 }}>
              <TextField
                fullWidth
                label="Template Heading"
                placeholder="e.g. Non-Disclosure Agreement"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                helperText="Displayed as the large heading at the top of the PDF"
              />
              <TextField
                fullWidth
                label="Visitor Record Heading"
                placeholder="VISITOR RECORD"
                value={form.visitorRecordTitle}
                onChange={(e) => setForm((p) => ({ ...p, visitorRecordTitle: e.target.value }))}
                helperText="Defaults to 'VISITOR RECORD' if left empty"
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
    </RoleGuard>
  );
}
