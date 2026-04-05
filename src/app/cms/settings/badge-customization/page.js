"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  TextField,
  Pagination,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  Divider,
  CircularProgress,
  IconButton,
  Tooltip,
  Stack,
} from "@mui/material";
import ICONS from "@/utils/iconUtil";
import QRCode from "qrcode";
import RoleGuard from "@/components/auth/RoleGuard";
import PermissionGuard, { usePermission } from "@/components/auth/PermissionGuard";
import RecordMetadata from "@/components/RecordMetadata";
import BadgeCustomizationModal from "@/components/modals/BadgeCustomizationModal";
import BadgePreview from "@/components/BadgePreview";
import {
  getBadgeTemplates,
  createBadgeTemplate,
  updateBadgeTemplate,
  deleteBadgeTemplate,
} from "@/services/badgeService";
import { getCustomFields } from "@/services/customFieldService";
import { useMessage } from "@/contexts/MessageContext";
import { useAuth } from "@/contexts/AuthContext";
import ListToolbar from "@/components/ListToolbar";
import NoDataAvailable from "@/components/NoDataAvailable";
import ResponsiveCardGrid from "@/components/ResponsiveCardGrid";
import AppCard from "@/components/cards/AppCard";

const getAvailableBadgeFields = () => {
  return [
    { inputName: "full_name", label: "Full Name" },
    { inputName: "email", label: "Email" },
    { inputName: "purpose_of_visit", label: "Purpose of Visit" },
    { inputName: "phone", label: "Phone" },
    { inputName: "company", label: "Company" },
    { inputName: "host_name", label: "Host Name" },
    { inputName: "requested_date", label: "Visit Date" },
    { inputName: "requested_time_from", label: "Check-in Time" },
    { inputName: "requested_time_to", label: "Check-out Time" },
  ];
};

export default function BadgeCustomizationPage() {
  const { user } = useAuth();
  const readOnly = user?.role !== "dev";
  const { showMessage } = useMessage();
  const [badgeTemplates, setBadgeTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [customFields, setCustomFields] = useState([]);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(12);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");

  useEffect(() => {
    fetchBadgeTemplates();
    fetchCustomFields();
    generateQRCode();
  }, []);

  const generateQRCode = async () => {
    try {
      const dataUrl = await QRCode.toDataURL("SAMPLE_TOKEN", {
        width: 70,
        margin: 1,
        color: { dark: "#000000", light: "#ffffff" },
      });

      setQrCodeDataUrl(dataUrl);
    } catch (error) {
      console.error("Failed to generate QR code:", error);
    }
  };

  const fetchBadgeTemplates = async () => {
    setLoading(true);
    const templates = await getBadgeTemplates();
    setBadgeTemplates(templates);
    setLoading(false);
  };

  const fetchCustomFields = async () => {
    const fields = await getCustomFields();
    setCustomFields(fields);
  };

  const handleCreateNew = () => {
    setEditingTemplate(null);
    setModalOpen(true);
  };

  const handleEditTemplate = (template) => {
    setEditingTemplate(template);
    setModalOpen(true);
  };

  const handleDeleteTemplate = (template) => {
    setTemplateToDelete(template);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!templateToDelete) return;
    await deleteBadgeTemplate(templateToDelete.id);
    await fetchBadgeTemplates();
    setDeleteDialogOpen(false);
    setTemplateToDelete(null);
  };

  const handleSetActive = async (template) => {
    const alreadyActiveTemplate = badgeTemplates.find(
      (t) => t.isActive && t.id !== template.id,
    );

    if (alreadyActiveTemplate) {
      showMessage(
        "Only one badge template can be active at a time. Please deactivate the current active template first.",
        "error",
      );
      return;
    }
    await updateBadgeTemplate(template.id, {
      name: template.name,
      layoutJson: template.layoutJson,
      isActive: true,
    });
    await fetchBadgeTemplates();
  };

  const handleSetInactive = async (template) => {
    await updateBadgeTemplate(template.id, {
      name: template.name,
      layoutJson: template.layoutJson,
      isActive: false,
    });
    await fetchBadgeTemplates();
  };

  const handleSaveTemplate = async ({ name, customizations }) => {
    if (editingTemplate) {
      await updateBadgeTemplate(editingTemplate.id, {
        name: name || editingTemplate.name,
        layoutJson: customizations,
      });
    } else {
      const isFirstBadge = badgeTemplates.length === 0;
      await createBadgeTemplate({
        name: name || "New Badge Template",
        layoutJson: customizations,
        isActive: isFirstBadge,
      });
    }
    await fetchBadgeTemplates();
    setModalOpen(false);
    setEditingTemplate(null);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const getAllFields = () => {
    const standardFields = getAvailableBadgeFields();
    const customFieldInputs = Array.isArray(customFields)
      ? customFields.map((field) => ({
          inputName: field.fieldKey,
          label: field.label || field.fieldKey,
        }))
      : [];
    return [...standardFields, ...customFieldInputs];
  };

  const filteredTemplates = useMemo(() => {
    const templates = Array.isArray(badgeTemplates) ? badgeTemplates : [];
    if (!searchQuery.trim()) return templates;
    return templates.filter((template) =>
      template.name?.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [badgeTemplates, searchQuery]);

  const pagedTemplates = useMemo(() => {
    return filteredTemplates.slice(
      page * rowsPerPage,
      page * rowsPerPage + rowsPerPage,
    );
  }, [filteredTemplates, page, rowsPerPage]);

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "60vh",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

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
            <Typography variant="h5" fontWeight="bold">
              Badge Customization
            </Typography>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 0.5, opacity: 0.8 }}
            >
              Create and manage badge templates for visitor badges.
            </Typography>
          </Box>

          {!readOnly && (
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
                onClick={handleCreateNew}
              >
                Create
              </Button>
            </Box>
          )}
        </Box>

        <Divider sx={{ mb: 3 }} />
        <ListToolbar
          showingCount={pagedTemplates.length}
          totalCount={filteredTemplates.length}
          searchSlot={
            <TextField
              fullWidth
              size="small"
              variant="outlined"
              placeholder="Search by template name..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(0);
              }}
              InputProps={{
                startAdornment: (
                  <ICONS.search fontSize="small" sx={{ mr: 1, opacity: 0.6 }} />
                ),
              }}
              sx={{ maxWidth: { md: 380 } }}
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

        {/* Badge Templates Grid */}
        <Box sx={{ mt: 3 }}>
          {filteredTemplates.length === 0 ? (
            <NoDataAvailable
              title="No badge templates found"
              description="Try adjusting your search or create a new badge template."
            />
          ) : (
            <>
              <ResponsiveCardGrid gap={{ xs: 3, md: 3.5 }}>
                {pagedTemplates.map((template) => (
                  <AppCard
                    key={template.id}
                    sx={{
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      width: "100%",
                      borderRadius: 4,
                    }}
                  >
                    {/* Wrapper for overflow handling */}
                    <Box
                      sx={{
                        position: "relative",
                        overflow: "visible",
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      {/* Header */}
                      <Box
                        sx={{
                          bgcolor: "action.hover",
                          borderBottom: "1px solid",
                          borderColor: "divider",
                          p: 2,
                        }}
                      >
                        <Stack
                          direction="row"
                          alignItems="center"
                          justifyContent="space-between"
                          spacing={1}
                        >
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography
                              variant="subtitle1"
                              fontWeight={800}
                              noWrap
                            >
                              {template.name}
                            </Typography>
                          </Box>
                          <Chip
                            label={template.isActive ? "Active" : "Inactive"}
                            size="small"
                            color={template.isActive ? "success" : "default"}
                            variant={template.isActive ? "filled" : "outlined"}
                            sx={{
                              fontWeight: 700,
                              fontSize: "0.65rem",
                              height: 22,
                            }}
                          />
                        </Stack>
                      </Box>

                      {/* Content */}
                      <Box sx={{ flexGrow: 1, p: 2 }}>
                        {/* Preview Badge */}
                        <Box sx={{ display: "flex", justifyContent: "center" }}>
                          <BadgePreview
                            template={template}
                            showQr={true}
                            qrCodeDataUrl={qrCodeDataUrl}
                          />
                        </Box>
                      </Box>

                      {/* Actions - Redesigned Footer */}
                      <Box
                        sx={{
                          display: "flex",
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          width: "100%",
                          p: 1.5,
                          borderTop: "1px solid",
                          borderColor: "divider",
                          bgcolor: "action.hover",
                          gap: 1,
                        }}
                      >
                        <RecordMetadata
                          createdByName={template.created_by}
                          updatedByName={template.updated_by}
                          createdAt={template.created_at}
                          updatedAt={template.updated_at}
                          locale="en-GB"
                        />

                        {/* Right side: Activate/Deactivate + Edit/Delete */}
                        {!readOnly && (
                          <Stack direction="row" spacing={1} alignItems="center">
                            {template.isActive ? (
                              <Tooltip title="Remove active status">
                                <IconButton
                                  size="small"
                                  color="warning"
                                  onClick={() => handleSetInactive(template)}
                                >
                                  <ICONS.close fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            ) : (
                              <Tooltip title="Set as active template">
                                <IconButton
                                  size="small"
                                  color="success"
                                  onClick={() => handleSetActive(template)}
                                >
                                  <ICONS.check fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            <Tooltip title="Edit template">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleEditTemplate(template)}
                                sx={{ bgcolor: "action.hover" }}
                              >
                                <ICONS.edit fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip
                              title={
                                template.isActive
                                  ? "Deactivate before deleting"
                                  : "Delete template"
                              }
                            >
                              <span>
                                <IconButton
                                  size="small"
                                  color="error"
                                  disabled={template.isActive}
                                  onClick={() => handleDeleteTemplate(template)}
                                  sx={{ bgcolor: "action.hover" }}
                                >
                                  <ICONS.delete fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </Stack>
                        )}
                      </Box>
                    </Box>
                  </AppCard>
                ))}
              </ResponsiveCardGrid>

              {/* Pagination */}
              <Box display="flex" justifyContent="center" mt={4}>
                {filteredTemplates.length > rowsPerPage && (
                  <Pagination
                    count={Math.ceil(filteredTemplates.length / rowsPerPage)}
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
        </Box>

        {/* Badge Customization Modal */}
        <BadgeCustomizationModal
          open={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setEditingTemplate(null);
          }}
          onSave={handleSaveTemplate}
          badgeCustomizations={editingTemplate?.layoutJson || {}}
          templateName={editingTemplate?.name || ""}
          isEditing={!!editingTemplate}
        />

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
        >
          <DialogTitle>Delete Badge Template</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete the badge template "
              {templateToDelete?.name}"? This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={confirmDelete}
              color="error"
              variant="contained"
              startIcon={<ICONS.delete />}
            >
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </PermissionGuard>
    </RoleGuard>
  );
}
