"use client";

import { useState, useEffect, useRef } from "react";
import {
  Box,
  Typography,
  Divider,
  Button,
  Stack,
  Avatar,
  Dialog,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  IconButton,
  Tooltip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Switch,
  FormControlLabel,
} from "@mui/material";
import { useMessage } from "@/contexts/MessageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import ICONS from "@/utils/iconUtil";
import LoadingState from "@/components/LoadingState";
import NoDataAvailable from "@/components/NoDataAvailable";
import ConfirmationDialog from "@/components/modals/ConfirmationDialog";
import DialogHeader from "@/components/modals/DialogHeader";
import MediaUploadProgress from "@/components/MediaUploadProgress";
import PermissionGuard, { usePermission } from "@/components/auth/PermissionGuard";
import RecordMetadata from "@/components/RecordMetadata";
import { getHost, createHost, updateHost, deleteHost } from "@/services/hostService";
import { uploadMediaFiles } from "@/utils/mediaUpload";
import CountryCodeSelector from "@/components/CountryCodeSelector";
import { DEFAULT_ISO_CODE, getCountryCodeByIsoCode, getCountryAndPhoneByFullPhone } from "@/utils/countryCodes";
import { validateRequired, validateEmail, validateUrl, validatePhone } from "@/utils/validationUtils";
import { filterPhoneInput, onKeyPressPhone } from "@/utils/phoneUtils";


const emptyForm = () => ({
  name: "",
  email: "",
  phone: "",
  address: "",
  website: "",
  logoUrl: "",
  contactPersonName: "",
  contactPersonEmail: "",
  contactPersonPhone: "",
  isKitchenModuleEnabled: true,
});

const emptyIsoCodes = () => ({
  phone: DEFAULT_ISO_CODE,
  contactPersonPhone: DEFAULT_ISO_CODE,
});

function SectionLabel({ children }) {
  return (
    <Typography
      variant="caption"
      fontWeight={700}
      color="primary.main"
      sx={{ textTransform: "uppercase", letterSpacing: 0.6, display: "block", mb: 0.5, mt: 2 }}
    >
      {children}
    </Typography>
  );
}

function DetailItem({ icon: Icon, primary, secondary }) {
  return (
    <ListItem disablePadding sx={{ py: 0.6 }}>
      <ListItemIcon sx={{ minWidth: 36, color: "text.secondary" }}>
        <Icon fontSize="small" />
      </ListItemIcon>
      <ListItemText
        primary={primary}
        secondary={secondary || "N/A"}
        primaryTypographyProps={{ variant: "caption", color: "text.secondary", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}
        secondaryTypographyProps={{ variant: "body2", color: secondary ? "text.primary" : "text.disabled", fontWeight: 500 }}
      />
    </ListItem>
  );
}

export default function HostDetailsPage() {
  const { user } = useAuth();
  const readOnly = user?.role !== "superadmin";
  const [host, setHost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [isEdit, setIsEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isoCodes, setIsoCodes] = useState(emptyIsoCodes());
  const [errors, setErrors] = useState({});

  // Logo: pending file + preview (not uploaded until save)
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");

  // Upload progress dialog
  const [uploadProgress, setUploadProgress] = useState([]);
  const [showUploadProgress, setShowUploadProgress] = useState(false);

  const fileInputRef = useRef(null);
  const { showMessage } = useMessage();
  const { refreshSettings } = useSettings();

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await getHost();
      setHost(data || null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setForm(emptyForm());
    setIsoCodes(emptyIsoCodes());
    setLogoFile(null);
    setLogoPreview("");
    setIsEdit(false);
    setErrors({});
    setDialogOpen(true);
  };

  const openEdit = () => {
    const { isoCode: phoneIso, phone: phoneNo } = getCountryAndPhoneByFullPhone(host.phone);
    const { isoCode: cpPhoneIso, phone: cpPhoneNo } = getCountryAndPhoneByFullPhone(host.contactPersonPhone);

    setIsoCodes({ phone: phoneIso, contactPersonPhone: cpPhoneIso });
    setForm({
      name: host.name || "",
      email: host.email || "",
      phone: phoneNo,
      address: host.address || "",
      website: host.website || "",
      logoUrl: host.logoUrl || "",
      contactPersonName: host.contactPersonName || "",
      contactPersonEmail: host.contactPersonEmail || "",
      contactPersonPhone: cpPhoneNo,
      isKitchenModuleEnabled: host.isKitchenModuleEnabled ?? true,
    });
    setLogoFile(null);
    setLogoPreview(host.logoUrl || "");
    setIsEdit(true);
    setErrors({});
    setDialogOpen(true);
  };

  const handleLogoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showMessage("Please select an image file.", "error");
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview("");
    setForm((p) => ({ ...p, logoUrl: "" }));
  };

  const validateForm = () => {
    const errors = {};
    
    const nameError = validateRequired(form.name, "Organization name");
    if (nameError) errors.name = nameError;
    
    const emailError = validateEmail(form.email, "Email") || validateRequired(form.email, "Email");
    if (emailError) errors.email = emailError;
    
    if (form.website) {
      const urlError = validateUrl(form.website, "Website");
      if (urlError) errors.website = urlError;
    }
    
    if (form.contactPersonEmail) {
      const cpEmailError = validateEmail(form.contactPersonEmail, "Contact Email");
      if (cpEmailError) errors.contactPersonEmail = cpEmailError;
    }
    
    // Add phone validation
    const phoneError = validatePhone(form.phone, isoCodes.phone);
    if (phoneError) errors.phone = phoneError;
    
    const cpPhoneError = validatePhone(form.contactPersonPhone, isoCodes.contactPersonPhone);
    if (cpPhoneError) errors.contactPersonPhone = cpPhoneError;
    
    return errors;
  };

  const handleSave = async () => {
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      showMessage(Object.values(validationErrors)[0], "error");
      return;
    }

    setSaving(true);
    let finalLogoUrl = form.logoUrl;

    try {
      // Upload logo first if a new file was selected
      if (logoFile) {
        const uploadEntry = {
          label: logoFile.name,
          percent: 0,
          loaded: 0,
          total: logoFile.size,
          error: null,
          url: null,
        };
        setUploadProgress([uploadEntry]);
        setShowUploadProgress(true);

        try {
          const [url] = await uploadMediaFiles({
            files: [logoFile],
            onProgress: ([u]) => setUploadProgress([{ ...uploadEntry, ...u }]),
          });
          finalLogoUrl = url;
        } catch (err) {
          setUploadProgress((prev) => [{ ...prev[0], error: err.message }]);
          setSaving(false);
          return; // keep progress dialog open showing the error
        }

        setShowUploadProgress(false);
      }

      const buildPhone = (digits, isoKey) => {
        const d = digits.trim();
        if (!d) return undefined;
        const country = getCountryCodeByIsoCode(isoCodes[isoKey]);
        const code = country?.code || "";
        return d.startsWith("+") ? d : `${code}${d}`;
      };

      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: buildPhone(form.phone, "phone"),
        address: form.address.trim() || undefined,
        website: form.website.trim() || undefined,
        logoUrl: finalLogoUrl || undefined,
        contactPersonName: form.contactPersonName.trim() || undefined,
        contactPersonEmail: form.contactPersonEmail.trim() || undefined,
        contactPersonPhone: buildPhone(form.contactPersonPhone, "contactPersonPhone"),
        isKitchenModuleEnabled: form.isKitchenModuleEnabled,
      };

      if (isEdit) {
        await updateHost(payload);
      } else {
        await createHost(payload);
      }

      await refreshSettings();
      await fetchData();
      setDialogOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    await deleteHost();
    await fetchData();
    setDeleteOpen(false);
  };

  return (
    <PermissionGuard fullAccessRoles={["superadmin"]} readOnlyRoles={["admin"]}>
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
              Host Details
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, opacity: 0.8 }}>
              Organization profile displayed on visitor-facing communications and documents.
            </Typography>
          </Box>
          {host && !readOnly && (
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                color="error"
                startIcon={<ICONS.delete fontSize="small" />}
                onClick={() => setDeleteOpen(true)}
                sx={{ borderRadius: 30 }}
              >
                Delete
              </Button>
              <Button
                variant="contained"
                startIcon={<ICONS.edit fontSize="small" />}
                onClick={openEdit}
                sx={{ borderRadius: 30 }}
              >
                Edit
              </Button>
            </Stack>
          )}
        </Box>

        <Divider sx={{ mb: 3 }} />

        {loading ? (
          <LoadingState />
        ) : !host ? (
          <Box>
            <NoDataAvailable
              title="No host profile yet"
              description="Set up your organization profile to display it on visitor communications and documents."
            />
            {!readOnly && (
              <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
                <Button variant="contained" startIcon={<ICONS.add />} onClick={openCreate}>
                  Create Host Profile
                </Button>
              </Box>
            )}
          </Box>
        ) : (
          <Box>
            {/* Logo + name header */}
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
              <Avatar
                src={host.logoUrl}
                alt={host.name}
                variant="rounded"
                sx={{
                  width: 64,
                  height: 64,
                  bgcolor: "rgba(0,0,0,0.08)",
                  fontSize: "1.5rem",
                  flexShrink: 0,
                }}
              >
                {host.name?.[0]?.toUpperCase()}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h6" fontWeight={800}>
                  {host.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {host.email}
                </Typography>
              </Box>
            </Stack>

            <Divider />

            {/* Organization details */}
            <SectionLabel>Organization</SectionLabel>
            <List dense disablePadding>
              <DetailItem icon={ICONS.email} primary="Email" secondary={host.email} />
              <DetailItem icon={ICONS.phone} primary="Phone" secondary={host.phone} />
              <DetailItem icon={ICONS.location} primary="Address" secondary={host.address} />
              <DetailItem icon={ICONS.Language} primary="Website" secondary={host.website} />
            </List>

            {/* Contact person */}
            <Divider sx={{ mt: 1 }} />
            <SectionLabel>Contact Person</SectionLabel>
            <List dense disablePadding>
              <DetailItem icon={ICONS.person} primary="Name" secondary={host.contactPersonName} />
              <DetailItem icon={ICONS.email} primary="Email" secondary={host.contactPersonEmail} />
              <DetailItem icon={ICONS.phone} primary="Phone" secondary={host.contactPersonPhone} />
            </List>

            {/* System Modules */}
            <Divider sx={{ mt: 1 }} />
            <SectionLabel>System Modules</SectionLabel>
            <List dense disablePadding>
              <DetailItem 
                icon={ICONS.diningTable} 
                primary="Kitchen Module" 
                secondary={host.isKitchenModuleEnabled ? "Enabled" : "Disabled"} 
              />
            </List>

            {/* Logs */}
            <Divider sx={{ mt: 2 }} />
            <SectionLabel>Logs</SectionLabel>
            <Box sx={{ mt: 1 }}>
              <RecordMetadata
                createdByName={host.created_by}
                updatedByName={host.updated_by}
                createdAt={host.created_at}
                updatedAt={host.updated_at}
                locale="en-GB"
              />
            </Box>
          </Box>
        )}

        {/* Create / Edit dialog */}
        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{ sx: { borderRadius: 4 } }}
        >
          <DialogHeader
            title={isEdit ? "Edit Host Profile" : "Create Host Profile"}
            onClose={() => setDialogOpen(false)}
          />
          <Divider />

          <DialogContent sx={{ pt: 3 }}>
            {/* Logo upload */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
              <Avatar
                src={logoPreview}
                alt="Logo"
                variant="rounded"
                sx={{
                  width: 64,
                  height: 64,
                  bgcolor: "rgba(0,0,0,0.08)",
                  fontSize: "1.6rem",
                  flexShrink: 0,
                }}
              >
                <ICONS.image />
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" fontWeight={600} gutterBottom>
                  Organization Logo
                </Typography>
                {logoFile && (
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                    {logoFile.name} — will upload on save
                  </Typography>
                )}
                <Stack direction="row" spacing={1} alignItems="center">
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<ICONS.upload fontSize="small" />}
                    onClick={() => fileInputRef.current?.click()}
                    sx={{ borderRadius: 30, fontSize: "0.75rem" }}
                  >
                    {logoPreview ? "Change Logo" : "Upload Logo"}
                  </Button>
                  {logoPreview && (
                    <Tooltip title="Remove logo">
                      <IconButton size="small" onClick={handleRemoveLogo}>
                        <ICONS.close fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={handleLogoSelect}
                />
              </Box>
            </Box>

            {/* Organization fields */}
            <Typography variant="caption" fontWeight={700} color="primary.main" sx={{ textTransform: "uppercase", letterSpacing: 0.5, display: "block", mb: 1.5 }}>
              Organization
            </Typography>
            <Stack spacing={2} sx={{ mb: 3 }}>
               <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  fullWidth
                  label="Organization Name *"
                  value={form.name}
                  error={Boolean(errors.name)}
                  helperText={errors.name}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, name: e.target.value }));
                    if (errors.name) setErrors(prev => ({ ...prev, name: null }));
                  }}
                />
                <TextField
                  fullWidth
                  label="Email *"
                  type="email"
                  value={form.email}
                  error={Boolean(errors.email)}
                  helperText={errors.email}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, email: e.target.value }));
                    if (errors.email) setErrors(prev => ({ ...prev, email: null }));
                  }}
                />
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  fullWidth
                  label="Phone"
                  value={form.phone}
                  error={Boolean(errors.phone)}
                  helperText={errors.phone}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, phone: filterPhoneInput(e.target.value) }));
                    if (errors.phone) setErrors(prev => ({ ...prev, phone: null }));
                  }}
                  onKeyPress={onKeyPressPhone}
                  InputProps={{
                    startAdornment: (
                      <CountryCodeSelector
                        value={isoCodes.phone}
                        onChange={(iso) => {
                          setIsoCodes((p) => ({ ...p, phone: iso }));
                          if (form.phone) {
                            const err = validatePhone(form.phone, iso);
                            setErrors(p => ({ ...p, phone: err }));
                          }
                        }}
                      />
                    ),
                  }}
                />
                <TextField
                  fullWidth
                  label="Website"
                  placeholder="https://example.com"
                  value={form.website}
                  error={Boolean(errors.website)}
                  helperText={errors.website}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, website: e.target.value }));
                    if (errors.website) setErrors(prev => ({ ...prev, website: null }));
                  }}
                />
              </Stack>
              <TextField
                fullWidth
                label="Address"
                multiline
                rows={2}
                value={form.address}
                error={Boolean(errors.address)}
                helperText={errors.address}
                onChange={(e) => {
                  setForm((p) => ({ ...p, address: e.target.value }));
                  if (errors.address) setErrors(prev => ({ ...prev, address: null }));
                }}
              />
            </Stack>

            {/* Contact person fields */}
            <Typography variant="caption" fontWeight={700} color="primary.main" sx={{ textTransform: "uppercase", letterSpacing: 0.5, display: "block", mb: 1.5 }}>
              Contact Person
            </Typography>
            <Stack spacing={2}>
              <TextField
                fullWidth
                label="Contact Person Name"
                value={form.contactPersonName}
                error={Boolean(errors.contactPersonName)}
                helperText={errors.contactPersonName}
                onChange={(e) => {
                  setForm((p) => ({ ...p, contactPersonName: e.target.value }));
                  if (errors.contactPersonName) setErrors(prev => ({ ...prev, contactPersonName: null }));
                }}
              />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  fullWidth
                  label="Contact Email"
                  type="email"
                  value={form.contactPersonEmail}
                  error={Boolean(errors.contactPersonEmail)}
                  helperText={errors.contactPersonEmail}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, contactPersonEmail: e.target.value }));
                    if (errors.contactPersonEmail) setErrors(prev => ({ ...prev, contactPersonEmail: null }));
                  }}
                />
                <TextField
                  fullWidth
                  label="Contact Phone"
                  value={form.contactPersonPhone}
                  error={Boolean(errors.contactPersonPhone)}
                  helperText={errors.contactPersonPhone}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, contactPersonPhone: filterPhoneInput(e.target.value) }));
                    if (errors.contactPersonPhone) setErrors(prev => ({ ...prev, contactPersonPhone: null }));
                  }}
                  onKeyPress={onKeyPressPhone}
                  InputProps={{
                    startAdornment: (
                      <CountryCodeSelector
                        value={isoCodes.contactPersonPhone}
                        onChange={(iso) => {
                          setIsoCodes((p) => ({ ...p, contactPersonPhone: iso }));
                          if (form.contactPersonPhone) {
                            const err = validatePhone(form.contactPersonPhone, iso);
                            setErrors(p => ({ ...p, contactPersonPhone: err }));
                          }
                        }}
                      />
                    ),
                  }}
                />
              </Stack>
            </Stack>
 
            {/* System Modules */}
            <Divider sx={{ mt: 3, mb: 2 }} />
            <Typography variant="caption" fontWeight={700} color="primary.main" sx={{ textTransform: "uppercase", letterSpacing: 0.5, display: "block", mb: 1.5 }}>
              System Modules
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={form.isKitchenModuleEnabled}
                  onChange={(e) => setForm((p) => ({ ...p, isKitchenModuleEnabled: e.target.checked }))}
                />
              }
              label={
                <Box>
                  <Typography variant="body2" fontWeight={600}>Kitchen Module</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Enable or disable the kitchen orders module system-wide.
                  </Typography>
                </Box>
              }
            />
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
              disabled={saving || !form.name.trim() || !form.email.trim()}
              sx={{ borderRadius: 30 }}
            >
              {isEdit ? "Save Changes" : "Create"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Upload progress */}
        <MediaUploadProgress
          open={showUploadProgress}
          uploads={uploadProgress}
          onClose={() => setShowUploadProgress(false)}
        />

        {/* Delete confirmation */}
        <ConfirmationDialog
          open={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          onConfirm={handleDelete}
          title="Delete Host Profile"
          message="Are you sure you want to delete the host profile? This action cannot be undone."
          confirmButtonText="Delete"
          confirmButtonIcon={<ICONS.delete fontSize="small" />}
        />
      </Box>
    </PermissionGuard>
  );
}
