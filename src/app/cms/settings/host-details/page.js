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
} from "@mui/material";
import { useMessage } from "@/contexts/MessageContext";
import ICONS from "@/utils/iconUtil";
import LoadingState from "@/components/LoadingState";
import NoDataAvailable from "@/components/NoDataAvailable";
import ConfirmationDialog from "@/components/modals/ConfirmationDialog";
import DialogHeader from "@/components/modals/DialogHeader";
import MediaUploadProgress from "@/components/MediaUploadProgress";
import RoleGuard from "@/components/auth/RoleGuard";
import { getHost, createHost, updateHost, deleteHost } from "@/services/hostService";
import { uploadMediaFiles } from "@/utils/mediaUpload";
import CountryCodeSelector from "@/components/CountryCodeSelector";
import { DEFAULT_ISO_CODE, getCountryCodeByIsoCode } from "@/utils/countryCodes";

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
  const [host, setHost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [isEdit, setIsEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isoCodes, setIsoCodes] = useState(emptyIsoCodes());

  // Logo: pending file + preview (not uploaded until save)
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");

  // Upload progress dialog
  const [uploadProgress, setUploadProgress] = useState([]);
  const [showUploadProgress, setShowUploadProgress] = useState(false);

  const fileInputRef = useRef(null);
  const { showMessage } = useMessage();

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
    setDialogOpen(true);
  };

  const openEdit = () => {
    // Strip country code prefix from stored phone for display in field
    const stripCode = (fullPhone, isoCode) => {
      if (!fullPhone) return "";
      const country = getCountryCodeByIsoCode(isoCode);
      const code = country?.code || "";
      return fullPhone.startsWith(code) ? fullPhone.slice(code.length) : fullPhone.replace(/^\+\d{1,4}/, "");
    };

    const phoneIso = DEFAULT_ISO_CODE;
    const cpPhoneIso = DEFAULT_ISO_CODE;

    setIsoCodes({ phone: phoneIso, contactPersonPhone: cpPhoneIso });
    setForm({
      name: host.name || "",
      email: host.email || "",
      phone: stripCode(host.phone, phoneIso),
      address: host.address || "",
      website: host.website || "",
      logoUrl: host.logoUrl || "",
      contactPersonName: host.contactPersonName || "",
      contactPersonEmail: host.contactPersonEmail || "",
      contactPersonPhone: stripCode(host.contactPersonPhone, cpPhoneIso),
    });
    setLogoFile(null);
    setLogoPreview(host.logoUrl || "");
    setIsEdit(true);
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

  const handleSave = async () => {
    if (!form.name.trim()) { showMessage("Organization name is required.", "error"); return; }
    if (!form.email.trim()) { showMessage("Email is required.", "error"); return; }

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
      };

      if (isEdit) {
        await updateHost(payload);
      } else {
        await createHost(payload);
      }

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
              Host Details
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, opacity: 0.8 }}>
              Organization profile displayed on visitor-facing communications and documents.
            </Typography>
          </Box>
          {host && (
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
            <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
              <Button variant="contained" startIcon={<ICONS.add />} onClick={openCreate}>
                Create Host Profile
              </Button>
            </Box>
          </Box>
        ) : (
          <Box>
            {/* Logo + name header */}
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
              <Avatar
                src={host.logoUrl}
                alt={host.name}
                variant="rounded"
                sx={{ width: 64, height: 64, bgcolor: "primary.main", fontSize: "1.5rem", flexShrink: 0 }}
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
                sx={{ width: 64, height: 64, bgcolor: "action.selected", fontSize: "1.6rem", flexShrink: 0 }}
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
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                />
                <TextField
                  fullWidth
                  label="Email *"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                />
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  fullWidth
                  label="Phone"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value.replace(/\D/g, "") }))}
                  InputProps={{
                    startAdornment: (
                      <CountryCodeSelector
                        value={isoCodes.phone}
                        onChange={(iso) => setIsoCodes((p) => ({ ...p, phone: iso }))}
                      />
                    ),
                  }}
                />
                <TextField
                  fullWidth
                  label="Website"
                  placeholder="https://example.com"
                  value={form.website}
                  onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))}
                />
              </Stack>
              <TextField
                fullWidth
                label="Address"
                multiline
                rows={2}
                value={form.address}
                onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
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
                onChange={(e) => setForm((p) => ({ ...p, contactPersonName: e.target.value }))}
              />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  fullWidth
                  label="Contact Email"
                  type="email"
                  value={form.contactPersonEmail}
                  onChange={(e) => setForm((p) => ({ ...p, contactPersonEmail: e.target.value }))}
                />
                <TextField
                  fullWidth
                  label="Contact Phone"
                  value={form.contactPersonPhone}
                  onChange={(e) => setForm((p) => ({ ...p, contactPersonPhone: e.target.value.replace(/\D/g, "") }))}
                  InputProps={{
                    startAdornment: (
                      <CountryCodeSelector
                        value={isoCodes.contactPersonPhone}
                        onChange={(iso) => setIsoCodes((p) => ({ ...p, contactPersonPhone: iso }))}
                      />
                    ),
                  }}
                />
              </Stack>
            </Stack>
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
    </RoleGuard>
  );
}
