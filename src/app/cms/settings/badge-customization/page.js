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
import RoleGuard from "@/components/auth/RoleGuard";
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
import { useColorMode } from "@/contexts/ThemeContext";
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
  const { mode } = useColorMode();
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

  useEffect(() => {
    fetchBadgeTemplates();
    fetchCustomFields();
  }, []);

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
      (t) => t.is_active && t.id !== template.id
    );
    
    if (alreadyActiveTemplate) {
      showMessage(
        "Make the other one inactive first in order to make this active",
        "error"
      );
      return;
    }
    
    await updateBadgeTemplate(template.id, {
      name: template.name,
      layout_json: template.layout_json,
      is_active: true,
    });
    await fetchBadgeTemplates();
  };

  const handleSetInactive = async (template) => {
    await updateBadgeTemplate(template.id, {
      name: template.name,
      layout_json: template.layout_json,
      is_active: false,
    });
    await fetchBadgeTemplates();
  };

  const handleSaveTemplate = async (customizations) => {
    if (editingTemplate) {
      await updateBadgeTemplate(editingTemplate.id, {
        name: editingTemplate.name,
        layout_json: customizations,
      });
    } else {
      const isFirstBadge = badgeTemplates.length === 0;
      await createBadgeTemplate({
        name: "New Badge Template",
        layout_json: customizations,
        is_active: isFirstBadge,
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
      ? customFields.map(field => ({
          inputName: field.fieldKey,
          label: field.label || field.fieldKey
        }))
      : [];
    return [...standardFields, ...customFieldInputs];
  };

  const filteredTemplates = useMemo(() => {
    const templates = Array.isArray(badgeTemplates) ? badgeTemplates : [];
    if (!searchQuery.trim()) return templates;
    return templates.filter((template) =>
      template.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [badgeTemplates, searchQuery]);

  const pagedTemplates = useMemo(() => {
    return filteredTemplates.slice(
      page * rowsPerPage,
      page * rowsPerPage + rowsPerPage
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
                      border: template.is_active ? "2px solid" : "1px solid",
                      borderColor: template.is_active ? "primary.main" : "divider",
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    {/* Wrapper for overflow handling */}
                    <Box sx={{ position: "relative", overflow: "visible", height: "100%", display: "flex", flexDirection: "column" }}>
                    {/* Default Badge Badge */}
                    {template.is_active && (
                      <Chip
                        label="ACTIVE"
                        color="primary"
                        size="small"
                        sx={{
                          position: "absolute",
                          top: 12,
                          right: 12,
                          fontWeight: 700,
                          zIndex: 1,
                        }}
                      />
                    )}

                    {/* Header */}
                    <Box
                      sx={{
                        background: mode === "dark"
                          ? "linear-gradient(to right, rgba(255,255,255,0.05), rgba(255,255,255,0.08))"
                          : "linear-gradient(to right, #f5f5f5, #fafafa)",
                        borderBottom: "1px solid",
                        borderColor: "divider",
                        p: 2,
                        pb: 1.5,
                      }}
                    >
                      <Typography variant="h6" fontWeight={700} noWrap>
                        {template.name}
                      </Typography>
                    </Box>

                    {/* Content */}
                    <Box sx={{ flexGrow: 1, p: 2 }}>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 2 }}
                      >
                        {template.is_active
                          ? "This is the active badge template used for all visitor badges."
                          : "Custom badge template. Click to customize or set as active."}
                      </Typography>
                      
                      {/* Preview Badge */}
                      <Box sx={{ display: "flex", justifyContent: "center" }}>
                        <BadgePreview template={template} showQr={true} />
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
                        p: 2,
                        pt: 1.5,
                        borderTop: "1px solid",
                        borderColor: "divider",
                      }}
                    >
                      {/* Active/Inactive Button */}
                      {template.is_active ? (
                        <Button
                          size="small"
                          variant="contained"
                          color="secondary"
                          startIcon={<ICONS.close />}
                          onClick={() => handleSetInactive(template)}
                          sx={{ borderRadius: 30, fontSize: "0.75rem" }}
                        >
                          Set Inactive
                        </Button>
                      ) : (
                        <Button
                          size="small"
                          variant="contained"
                          color="primary"
                          startIcon={<ICONS.check />}
                          onClick={() => handleSetActive(template)}
                          sx={{ borderRadius: 30, fontSize: "0.75rem" }}
                        >
                          Set Active
                        </Button>
                      )}

                      {/* Icon Buttons Row */}
                      <Stack direction="row" spacing={1}>
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
                        <Tooltip title={template.is_active ? "Deactivate before deleting" : "Delete template"}>
                          <span>
                            <IconButton
                              size="small"
                              color="error"
                              disabled={template.is_active}
                              onClick={() => handleDeleteTemplate(template)}
                              sx={{ bgcolor: "action.hover" }}
                            >
                              <ICONS.delete fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Stack>
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
          badgeCustomizations={editingTemplate?.layout_json || {}}
        />

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
          <DialogTitle>Delete Badge Template</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete the badge template "{templateToDelete?.name}"? This action cannot be undone.
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
    </RoleGuard>
  );
}
