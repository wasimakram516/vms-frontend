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
  Grid,
  Chip,
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
import PermissionGuard, {
  usePermission,
} from "@/components/auth/PermissionGuard";
import PermissionRouteGuard from "@/components/auth/PermissionRouteGuard";
import { canAccessResource } from "@/utils/permissions";
import {
  getHost,
  createHost,
  updateHost,
  deleteHost,
} from "@/services/hostService";
import { uploadMediaFiles } from "@/utils/mediaUpload";
import CountryCodeSelector from "@/components/CountryCodeSelector";
import {
  DEFAULT_ISO_CODE,
  getCountryCodeByIsoCode,
  getCountryAndPhoneByFullPhone,
} from "@/utils/countryCodes";
import {
  validateRequired,
  validateEmail,
  validateUrl,
  validatePhone,
} from "@/utils/validationUtils";
import { filterPhoneInput, onKeyPressPhone } from "@/utils/phoneUtils";
import { formatDateTimeWithLocale } from "@/utils/dateUtils";

// Convert 24h (0-23) to 12h + AM/PM
const h24ToH12 = (h24) => ({
  h12: h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24,
  ampm: h24 < 12 ? "AM" : "PM",
});
// Convert 12h + AM/PM to 24h (0-23)
const h12ToH24 = (h12, ampm) =>
  ampm === "PM" ? (h12 === 12 ? 12 : h12 + 12) : h12 === 12 ? 0 : h12;

const emptyForm = () => ({
  name: "",
  email: "",
  phone: "",
  address: "",
  mapUrl: "",
  website: "",
  logoUrl: "",
  contactPersonName: "",
  contactPersonEmail: "",
  contactPersonPhone: "",
  isKitchenModuleEnabled: true,
  ndaNotificationEmail: "",
  exitTimeoutEnabled: false,
  exitTimeoutMinutes: 60,
  checkInBufferMinutes: 60,
  notifyOutsideWorkingHours: false,
  workingHoursStart: 8,
  workingHoursStartMinute: 0,
  workingHoursStartAmPm: "AM",
  workingHoursEnd: 5,
  workingHoursEndMinute: 0,
  workingHoursEndAmPm: "PM",
  workingDays: [0, 1, 2, 3, 4],
  weekendDays: [5, 6],
  notifyOutsideWorkingDays: false,
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
      sx={{
        textTransform: "uppercase",
        letterSpacing: 0.6,
        display: "block",
        mb: 0.5,
        mt: 2,
      }}
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
        primaryTypographyProps={{
          variant: "caption",
          color: "text.secondary",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: 0.4,
        }}
        secondaryTypographyProps={{
          variant: "body2",
          color: secondary ? "text.primary" : "text.disabled",
          fontWeight: 500,
        }}
      />
    </ListItem>
  );
}

export default function HostDetailsPage() {
  const { user } = useAuth();
  const isSuperAdminOrHost = user?.role === "superadmin";
  const canUpdate = canAccessResource(user, "host-details", {
    hardcodeAllowed: isSuperAdminOrHost,
    action: "update",
  });
  const canDelete = canAccessResource(user, "host-details", {
    hardcodeAllowed: isSuperAdminOrHost,
    action: "delete",
  });
  const canCreate = canAccessResource(user, "host-details", {
    hardcodeAllowed: isSuperAdminOrHost,
    action: "create",
  });
  const [host, setHost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [formErrors, setFormErrors] = useState({});
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

  useEffect(() => {
    fetchData();
  }, []);

  const openCreate = () => {
    setForm(emptyForm());
    setIsoCodes(emptyIsoCodes());
    setFormErrors({});
    setLogoFile(null);
    setLogoPreview("");
    setIsEdit(false);
    setDialogOpen(true);
  };

  const openEdit = () => {
    const { isoCode: phoneIso, phone: phoneNo } = getCountryAndPhoneByFullPhone(
      host.phone,
    );
    const { isoCode: cpPhoneIso, phone: cpPhoneNo } =
      getCountryAndPhoneByFullPhone(host.contactPersonPhone);

    setIsoCodes({ phone: phoneIso, contactPersonPhone: cpPhoneIso });
    setForm({
      name: host.name || "",
      email: host.email || "",
      phone: phoneNo,
      address: host.address || "",
      mapUrl: host.mapUrl || "",
      website: host.website || "",
      logoUrl: host.logoUrl || "",
      contactPersonName: host.contactPersonName || "",
      contactPersonEmail: host.contactPersonEmail || "",
      contactPersonPhone: cpPhoneNo,
      isKitchenModuleEnabled: host.isKitchenModuleEnabled ?? true,
      ndaNotificationEmail: host.ndaNotificationEmail || "",
      exitTimeoutEnabled: host.exitTimeoutEnabled ?? false,
      exitTimeoutMinutes: host.exitTimeoutMinutes ?? 60,
      checkInBufferMinutes: host.checkInBufferMinutes ?? 60,
      notifyOutsideWorkingHours: host.notifyOutsideWorkingHours ?? false,
      ...(() => {
        const { h12: sH12, ampm: sAmPm } = h24ToH12(
          host.workingHoursStart ?? 8,
        );
        const { h12: eH12, ampm: eAmPm } = h24ToH12(host.workingHoursEnd ?? 17);
        return {
          workingHoursStart: sH12,
          workingHoursStartMinute: host.workingHoursStartMinute ?? 0,
          workingHoursStartAmPm: sAmPm,
          workingHoursEnd: eH12,
          workingHoursEndMinute: host.workingHoursEndMinute ?? 0,
          workingHoursEndAmPm: eAmPm,
        };
      })(),
      workingDays: host.workingDays ?? [0, 1, 2, 3, 4],
      weekendDays: host.weekendDays ?? [5, 6],
      notifyOutsideWorkingDays: host.notifyOutsideWorkingDays ?? false,
    });
    setLogoFile(null);
    setLogoPreview(host.logoUrl || "");
    setFormErrors({});
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

  const validateForm = () => {
    const errors = {};

    const nameError = validateRequired(form.name, "Organization name");
    if (nameError) errors.name = nameError;

    const emailError =
      validateEmail(form.email, "Email") ||
      validateRequired(form.email, "Email");
    if (emailError) errors.email = emailError;

    if (form.website) {
      const urlError = validateUrl(form.website, "Website");
      if (urlError) errors.website = urlError;
    }

    if (form.mapUrl) {
      const mapUrlError = validateUrl(form.mapUrl, "Map Location URL");
      if (mapUrlError) errors.mapUrl = mapUrlError;
    }

    if (form.contactPersonEmail) {
      const cpEmailError = validateEmail(
        form.contactPersonEmail,
        "Contact Email",
      );
      if (cpEmailError) errors.contactPersonEmail = cpEmailError;
    }

    if (form.phone) {
      const phoneError = validatePhone(form.phone, isoCodes.phone);
      if (phoneError) errors.phone = phoneError;
    }

    if (form.contactPersonPhone) {
      const cpPhoneError = validatePhone(
        form.contactPersonPhone,
        isoCodes.contactPersonPhone,
      );
      if (cpPhoneError) errors.contactPersonPhone = cpPhoneError;
    }

    return errors;
  };

  const handleSave = async () => {
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setFormErrors(validationErrors);
      Object.values(validationErrors).forEach((err) =>
        showMessage(err, "error"),
      );
      return;
    }
    setFormErrors({});

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
        address: form.address.trim() || null,
        mapUrl: form.mapUrl.trim() || null,
        website: form.website.trim() || undefined,
        logoUrl: finalLogoUrl || undefined,
        contactPersonName: form.contactPersonName.trim() || undefined,
        contactPersonEmail: form.contactPersonEmail.trim() || undefined,
        contactPersonPhone: buildPhone(
          form.contactPersonPhone,
          "contactPersonPhone",
        ),
        isKitchenModuleEnabled: form.isKitchenModuleEnabled,
        ndaNotificationEmail: form.ndaNotificationEmail.trim() || undefined,
        exitTimeoutEnabled: form.exitTimeoutEnabled,
        exitTimeoutMinutes: Number(form.exitTimeoutMinutes) || 0,
        checkInBufferMinutes: Number(form.checkInBufferMinutes) || 0,
        notifyOutsideWorkingHours: form.notifyOutsideWorkingHours,
        workingHoursStart: h12ToH24(
          Number(form.workingHoursStart),
          form.workingHoursStartAmPm,
        ),
        workingHoursStartMinute: Number(form.workingHoursStartMinute),
        workingHoursEnd: h12ToH24(
          Number(form.workingHoursEnd),
          form.workingHoursEndAmPm,
        ),
        workingHoursEndMinute: Number(form.workingHoursEndMinute),
        workingDays: form.workingDays,
        weekendDays: form.weekendDays,
        notifyOutsideWorkingDays: form.notifyOutsideWorkingDays,
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
    <PermissionRouteGuard
      resource="host-details"
      hardcodeAllowed={isSuperAdminOrHost}
    >
      <PermissionGuard
        fullAccessRoles={
          canUpdate || canDelete || canCreate
            ? ["superadmin", user?.role].filter(Boolean)
            : ["superadmin"]
        }
        readOnlyRoles={
          !(canUpdate || canDelete || canCreate) ? ["admin", "staff"] : []
        }
      >
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
                Organization Details
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.5, opacity: 0.8 }}
              >
                Organization profile displayed on visitor-facing communications
                and documents.
              </Typography>
            </Box>
            {host && (canUpdate || canDelete) && (
              <Stack direction="row" spacing={1}>
                {canDelete && (
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<ICONS.delete fontSize="small" />}
                    onClick={() => setDeleteOpen(true)}
                    sx={{ borderRadius: 30 }}
                  >
                    Delete
                  </Button>
                )}
                {canUpdate && (
                  <Button
                    variant="contained"
                    startIcon={<ICONS.edit fontSize="small" />}
                    onClick={openEdit}
                    sx={{ borderRadius: 30 }}
                  >
                    Edit
                  </Button>
                )}
              </Stack>
            )}
          </Box>

          <Divider sx={{ mb: 3 }} />

          {loading ? (
            <LoadingState />
          ) : !host ? (
            <Box>
              <NoDataAvailable
                title="No organization profile yet"
                description="Set up your organization profile to display it on visitor communications and documents."
              />
              {canCreate && (
                <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
                  <Button
                    variant="contained"
                    startIcon={<ICONS.add />}
                    onClick={openCreate}
                  >
                    Create Organization Profile
                  </Button>
                </Box>
              )}
            </Box>
          ) : (
            <Box>
              {/* Logo + name header */}
              <Stack
                direction="row"
                spacing={2}
                alignItems="center"
                sx={{ mb: 2 }}
              >
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

              <Grid container spacing={3} sx={{ mt: 0.5 }} alignItems="stretch">
                {/* Left column */}
                <Grid
                  size={{ xs: 12, md: 6 }}
                  sx={{
                    borderRight: { md: "1px solid" },
                    borderColor: { md: "divider" },
                    pr: { md: 3 },
                  }}
                >
                  <SectionLabel>Organization</SectionLabel>
                  <List dense disablePadding>
                    <DetailItem
                      icon={ICONS.email}
                      primary="Email"
                      secondary={host.email}
                    />
                    <DetailItem
                      icon={ICONS.phone}
                      primary="Phone"
                      secondary={host.phone}
                    />
                    <DetailItem
                      icon={ICONS.location}
                      primary="Address"
                      secondary={host.address}
                    />
                    <DetailItem
                      icon={ICONS.location}
                      primary="Map Location URL"
                      secondary={
                        host.mapUrl ? (
                          <a
                            href={host.mapUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ wordBreak: "break-all", color: "inherit" }}
                          >
                            {host.mapUrl}
                          </a>
                        ) : null
                      }
                    />
                    <DetailItem
                      icon={ICONS.Language}
                      primary="Website"
                      secondary={host.website}
                    />
                  </List>

                  <Divider sx={{ mt: 2 }} />
                  <SectionLabel>NDA Notifications</SectionLabel>
                  <List dense disablePadding>
                    <DetailItem
                      icon={ICONS.email}
                      primary="NDA Notification Email"
                      secondary={host.ndaNotificationEmail}
                    />
                  </List>

                  <Divider sx={{ mt: 2 }} />
                  <SectionLabel>System Modules</SectionLabel>
                  <List dense disablePadding>
                    <ListItem disablePadding sx={{ py: 0.6 }}>
                      <ListItemIcon
                        sx={{ minWidth: 36, color: "text.secondary" }}
                      >
                        <ICONS.diningTable fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Kitchen Module"
                        primaryTypographyProps={{
                          variant: "caption",
                          color: "text.secondary",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: 0.4,
                        }}
                        secondaryTypographyProps={{ component: "div" }}
                        secondary={
                          <Chip
                            label={
                              host.isKitchenModuleEnabled
                                ? "Enabled"
                                : "Disabled"
                            }
                            size="small"
                            color={
                              host.isKitchenModuleEnabled
                                ? "success"
                                : "default"
                            }
                            variant="outlined"
                            sx={{
                              mt: 0.5,
                              fontWeight: 600,
                              fontSize: "0.72rem",
                            }}
                          />
                        }
                      />
                    </ListItem>
                    <ListItem disablePadding sx={{ py: 0.6 }}>
                      <ListItemIcon
                        sx={{ minWidth: 36, color: "text.secondary" }}
                      >
                        <ICONS.time fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Check-in Buffer"
                        primaryTypographyProps={{
                          variant: "caption",
                          color: "text.secondary",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: 0.4,
                        }}
                        secondaryTypographyProps={{ component: "div" }}
                        secondary={
                          <Chip
                            label={`±${host.checkInBufferMinutes ?? 60} min`}
                            size="small"
                            color="success"
                            variant="outlined"
                            sx={{
                              mt: 0.5,
                              fontWeight: 600,
                              fontSize: "0.72rem",
                            }}
                          />
                        }
                      />
                    </ListItem>
                    <ListItem disablePadding sx={{ py: 0.6 }}>
                      <ListItemIcon
                        sx={{ minWidth: 36, color: "text.secondary" }}
                      >
                        <ICONS.time fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Overstay"
                        primaryTypographyProps={{
                          variant: "caption",
                          color: "text.secondary",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: 0.4,
                        }}
                        secondaryTypographyProps={{ component: "div" }}
                        secondary={
                          <Stack
                            direction="row"
                            spacing={0.5}
                            sx={{ mt: 0.5, flexWrap: "wrap" }}
                          >
                            {host.exitTimeoutEnabled ? (
                              <Chip
                                label="Notifications ON"
                                size="small"
                                color="warning"
                                variant="outlined"
                                sx={{ fontWeight: 600, fontSize: "0.6rem" }}
                              />
                            ) : (
                              <Chip
                                label="Notifications OFF"
                                size="small"
                                variant="outlined"
                                sx={{ fontWeight: 600, fontSize: "0.6rem" }}
                              />
                            )}
                            <Chip
                              label={`${host.exitTimeoutMinutes ?? 60} min grace`}
                              size="small"
                              color="default"
                              variant="outlined"
                              sx={{ fontWeight: 600, fontSize: "0.6rem" }}
                            />
                          </Stack>
                        }
                      />
                    </ListItem>
                    {(() => {
                      const DAY_ABB = [
                        "Sun",
                        "Mon",
                        "Tue",
                        "Wed",
                        "Thu",
                        "Fri",
                        "Sat",
                      ];
                      const { h12: sH12, ampm: sAmPm } = h24ToH12(
                        host.workingHoursStart ?? 8,
                      );
                      const { h12: eH12, ampm: eAmPm } = h24ToH12(
                        host.workingHoursEnd ?? 17,
                      );
                      const startLabel = `${sH12}:${String(host.workingHoursStartMinute ?? 0).padStart(2, "0")} ${sAmPm}`;
                      const endLabel = `${eH12}:${String(host.workingHoursEndMinute ?? 0).padStart(2, "0")} ${eAmPm}`;
                      return (
                        <>
                          <ListItem disablePadding sx={{ py: 0.6 }}>
                            <ListItemIcon
                              sx={{ minWidth: 36, color: "text.secondary" }}
                            >
                              <ICONS.event fontSize="small" />
                            </ListItemIcon>
                            <ListItemText
                              primary="Working Days"
                              primaryTypographyProps={{
                                variant: "caption",
                                color: "text.secondary",
                                fontWeight: 600,
                                textTransform: "uppercase",
                                letterSpacing: 0.4,
                              }}
                              secondaryTypographyProps={{ component: "div" }}
                              secondary={
                                <Box
                                  sx={{
                                    mt: 0.5,
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: 0.5,
                                  }}
                                >
                                  {(host.workingDays ?? [0, 1, 2, 3, 4]).map(
                                    (d) => (
                                      <Chip
                                        key={d}
                                        label={DAY_ABB[d]}
                                        size="small"
                                        color="primary"
                                        variant="outlined"
                                        sx={{
                                          fontWeight: 600,
                                          fontSize: "0.72rem",
                                        }}
                                      />
                                    ),
                                  )}
                                </Box>
                              }
                            />
                          </ListItem>
                          <ListItem disablePadding sx={{ py: 0.6 }}>
                            <ListItemIcon
                              sx={{ minWidth: 36, color: "text.secondary" }}
                            >
                              <ICONS.event fontSize="small" />
                            </ListItemIcon>
                            <ListItemText
                              primary="Weekend / Off Days"
                              primaryTypographyProps={{
                                variant: "caption",
                                color: "text.secondary",
                                fontWeight: 600,
                                textTransform: "uppercase",
                                letterSpacing: 0.4,
                              }}
                              secondaryTypographyProps={{ component: "div" }}
                              secondary={
                                <Box
                                  sx={{
                                    mt: 0.5,
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: 0.5,
                                    alignItems: "center",
                                  }}
                                >
                                  {(host.weekendDays ?? [5, 6]).map((d) => (
                                    <Chip
                                      key={d}
                                      label={DAY_ABB[d]}
                                      size="small"
                                      color="warning"
                                      variant="outlined"
                                      sx={{
                                        fontWeight: 600,
                                        fontSize: "0.72rem",
                                      }}
                                    />
                                  ))}
                                  <Chip
                                    label={
                                      host.notifyOutsideWorkingDays
                                        ? "Notify: ON"
                                        : "Notify: OFF"
                                    }
                                    size="small"
                                    color={
                                      host.notifyOutsideWorkingDays
                                        ? "success"
                                        : "default"
                                    }
                                    variant="outlined"
                                    sx={{
                                      fontWeight: 600,
                                      fontSize: "0.72rem",
                                    }}
                                  />
                                </Box>
                              }
                            />
                          </ListItem>
                          <ListItem disablePadding sx={{ py: 0.6 }}>
                            <ListItemIcon
                              sx={{ minWidth: 36, color: "text.secondary" }}
                            >
                              <ICONS.time fontSize="small" />
                            </ListItemIcon>
                            <ListItemText
                              primary="Working Hours"
                              primaryTypographyProps={{
                                variant: "caption",
                                color: "text.secondary",
                                fontWeight: 600,
                                textTransform: "uppercase",
                                letterSpacing: 0.4,
                              }}
                              secondaryTypographyProps={{ component: "div" }}
                              secondary={
                                <Box
                                  sx={{
                                    mt: 0.5,
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: 0.5,
                                    alignItems: "center",
                                  }}
                                >
                                  <Chip
                                    label={`${startLabel} – ${endLabel}`}
                                    size="small"
                                    color="info"
                                    variant="outlined"
                                    sx={{
                                      fontWeight: 600,
                                      fontSize: "0.72rem",
                                    }}
                                  />
                                  <Chip
                                    label={
                                      host.notifyOutsideWorkingHours
                                        ? "Notify: ON"
                                        : "Notify: OFF"
                                    }
                                    size="small"
                                    color={
                                      host.notifyOutsideWorkingHours
                                        ? "success"
                                        : "default"
                                    }
                                    variant="outlined"
                                    sx={{
                                      fontWeight: 600,
                                      fontSize: "0.72rem",
                                    }}
                                  />
                                </Box>
                              }
                            />
                          </ListItem>
                        </>
                      );
                    })()}
                  </List>
                </Grid>

                {/* Right column */}
                <Grid size={{ xs: 12, md: 6 }}>
                  <SectionLabel>Contact Person</SectionLabel>
                  <List dense disablePadding>
                    <DetailItem
                      icon={ICONS.person}
                      primary="Name"
                      secondary={host.contactPersonName}
                    />
                    <DetailItem
                      icon={ICONS.email}
                      primary="Email"
                      secondary={host.contactPersonEmail}
                    />
                    <DetailItem
                      icon={ICONS.phone}
                      primary="Phone"
                      secondary={host.contactPersonPhone}
                    />
                  </List>

                  <Divider sx={{ mt: 2 }} />
                  <SectionLabel>Logs</SectionLabel>
                  <List dense disablePadding>
                    <DetailItem
                      icon={ICONS.person}
                      primary="Created"
                      secondary={`${host.created_by || "N/A"} · ${host.created_at ? formatDateTimeWithLocale(host.created_at, "en-GB") : "N/A"}`}
                    />
                    <DetailItem
                      icon={ICONS.sync}
                      primary="Updated"
                      secondary={`${host.updated_by || "N/A"} · ${host.updated_at ? formatDateTimeWithLocale(host.updated_at, "en-GB") : "N/A"}`}
                    />
                  </List>
                </Grid>
              </Grid>
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
              title={
                isEdit
                  ? "Edit Organization Profile"
                  : "Create Organization Profile"
              }
              onClose={() => setDialogOpen(false)}
            />
            <Divider />

            <DialogContent sx={{ pt: 3 }}>
              {/* Logo upload */}
              <Box
                sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}
              >
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
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      display="block"
                      sx={{ mb: 0.5 }}
                    >
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
              <Typography
                variant="caption"
                fontWeight={700}
                color="primary.main"
                sx={{
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  display: "block",
                  mb: 1.5,
                }}
              >
                Organization
              </Typography>
              <Stack spacing={2} sx={{ mb: 3 }}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField
                    fullWidth
                    label="Organization Name *"
                    value={form.name}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, name: e.target.value }))
                    }
                  />
                  <TextField
                    fullWidth
                    label="Email *"
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, email: e.target.value }))
                    }
                  />
                </Stack>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField
                    fullWidth
                    label="Phone"
                    value={form.phone}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        phone: filterPhoneInput(e.target.value),
                      }))
                    }
                    onKeyPress={onKeyPressPhone}
                    error={!!formErrors.phone}
                    helperText={formErrors.phone}
                    InputProps={{
                      startAdornment: (
                        <CountryCodeSelector
                          value={isoCodes.phone}
                          onChange={(iso) =>
                            setIsoCodes((p) => ({ ...p, phone: iso }))
                          }
                        />
                      ),
                    }}
                  />
                  <TextField
                    fullWidth
                    label="Website"
                    placeholder="https://example.com"
                    value={form.website}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, website: e.target.value }))
                    }
                  />
                </Stack>
                <TextField
                  fullWidth
                  label="Address"
                  multiline
                  rows={2}
                  value={form.address}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, address: e.target.value }))
                  }
                />
                <TextField
                  fullWidth
                  label="Map Location URL"
                  placeholder="https://maps.app.goo.gl/..."
                  value={form.mapUrl}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, mapUrl: e.target.value }))
                  }
                  error={!!formErrors.mapUrl}
                  helperText={
                    formErrors.mapUrl ||
                    "Google Maps or similar link included in approval emails and calendar invites."
                  }
                />
              </Stack>

              {/* NDA Notifications */}
              <Typography
                variant="caption"
                fontWeight={700}
                color="primary.main"
                sx={{
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  display: "block",
                  mb: 1.5,
                }}
              >
                NDA Notifications
              </Typography>
              <TextField
                fullWidth
                label="NDA Notification Email"
                type="email"
                placeholder="e.g. nda@sinan.om"
                value={form.ndaNotificationEmail}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    ndaNotificationEmail: e.target.value,
                  }))
                }
                helperText="A copy of every signed NDA will be sent to this address. Leave blank to disable."
                sx={{ mb: 3 }}
              />

              {/* Contact person fields */}
              <Typography
                variant="caption"
                fontWeight={700}
                color="primary.main"
                sx={{
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  display: "block",
                  mb: 1.5,
                }}
              >
                Contact Person
              </Typography>
              <Stack spacing={2}>
                <TextField
                  fullWidth
                  label="Contact Person Name"
                  value={form.contactPersonName}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      contactPersonName: e.target.value,
                    }))
                  }
                />
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField
                    fullWidth
                    label="Contact Email"
                    type="email"
                    value={form.contactPersonEmail}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        contactPersonEmail: e.target.value,
                      }))
                    }
                  />
                  <TextField
                    fullWidth
                    label="Contact Phone"
                    value={form.contactPersonPhone}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        contactPersonPhone: filterPhoneInput(e.target.value),
                      }))
                    }
                    onKeyPress={onKeyPressPhone}
                    error={!!formErrors.contactPersonPhone}
                    helperText={formErrors.contactPersonPhone}
                    InputProps={{
                      startAdornment: (
                        <CountryCodeSelector
                          value={isoCodes.contactPersonPhone}
                          onChange={(iso) =>
                            setIsoCodes((p) => ({
                              ...p,
                              contactPersonPhone: iso,
                            }))
                          }
                        />
                      ),
                    }}
                  />
                </Stack>
              </Stack>

              {/* System Modules */}
              <Divider sx={{ mt: 3, mb: 2 }} />
              <Typography
                variant="caption"
                fontWeight={700}
                color="primary.main"
                sx={{
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  display: "block",
                  mb: 1.5,
                }}
              >
                System Modules
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.isKitchenModuleEnabled}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        isKitchenModuleEnabled: e.target.checked,
                      }))
                    }
                    color="success"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      Kitchen Module
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Enable or disable the kitchen orders module system-wide.
                    </Typography>
                  </Box>
                }
              />
              <FormControlLabel
                sx={{ mt: 1 }}
                control={
                  <Switch
                    checked={form.exitTimeoutEnabled}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        exitTimeoutEnabled: e.target.checked,
                      }))
                    }
                    color="warning"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      Overstay Notifications
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Send email alerts to SuperAdmins, Gate Staff, and
                      Department Administrators when a checked-in visitor
                      exceeds their approved departure time. Also notifies via
                      in-app snackbar. Overstay flagging in activity logs works
                      regardless of this toggle.
                    </Typography>
                  </Box>
                }
              />
              <TextField
                label="Grace period (minutes)"
                type="number"
                size="small"
                value={form.exitTimeoutMinutes}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    exitTimeoutMinutes: e.target.value,
                  }))
                }
                onBlur={(e) => {
                  const v = Math.max(
                    1,
                    Math.min(1440, Number(e.target.value) || 60),
                  );
                  setForm((p) => ({ ...p, exitTimeoutMinutes: v }));
                }}
                inputProps={{ min: 1, max: 1440 }}
                helperText="Extra time added to the visitor's deadline before overstay is flagged in logs. Works independently of the notification toggle. Midnight rule overrides this. Min 1, max 1440 (24h)."
                sx={{ mt: 1.5, maxWidth: 260 }}
              />
              <TextField
                label="Check-in buffer (minutes)"
                type="number"
                size="small"
                value={form.checkInBufferMinutes}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    checkInBufferMinutes: e.target.value,
                  }))
                }
                onBlur={(e) => {
                  const v = Math.max(
                    0,
                    Math.min(1440, Number(e.target.value) || 0),
                  );
                  setForm((p) => ({ ...p, checkInBufferMinutes: v }));
                }}
                inputProps={{ min: 0, max: 1440 }}
                helperText="Allow check-in this many minutes before/after the approved window. 0 = strict enforcement."
                sx={{ mt: 1.5, maxWidth: 260 }}
              />

              {/* ── Working Hours / Days config ──────────────────────────────── */}
              {(() => {
                const DAY_LABELS = [
                  "Sun",
                  "Mon",
                  "Tue",
                  "Wed",
                  "Thu",
                  "Fri",
                  "Sat",
                ];
                const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
                const toggleWorkingDay = (idx) => {
                  setForm((p) => {
                    const inWorking = (p.workingDays ?? []).includes(idx);
                    const inWeekend = (p.weekendDays ?? []).includes(idx);
                    if (inWorking) {
                      return {
                        ...p,
                        workingDays: p.workingDays.filter((d) => d !== idx),
                      };
                    }
                    // Moving to working — remove from weekend if present
                    return {
                      ...p,
                      workingDays: [...(p.workingDays ?? []), idx].sort(
                        (a, b) => a - b,
                      ),
                      weekendDays: inWeekend
                        ? (p.weekendDays ?? []).filter((d) => d !== idx)
                        : (p.weekendDays ?? []),
                    };
                  });
                };
                const toggleWeekendDay = (idx) => {
                  setForm((p) => {
                    const inWeekend = (p.weekendDays ?? []).includes(idx);
                    const inWorking = (p.workingDays ?? []).includes(idx);
                    if (inWeekend) {
                      return {
                        ...p,
                        weekendDays: p.weekendDays.filter((d) => d !== idx),
                      };
                    }
                    return {
                      ...p,
                      weekendDays: [...(p.weekendDays ?? []), idx].sort(
                        (a, b) => a - b,
                      ),
                      workingDays: inWorking
                        ? (p.workingDays ?? []).filter((d) => d !== idx)
                        : (p.workingDays ?? []),
                    };
                  });
                };

                return (
                  <>
                    {/* Working Days */}
                    <Typography
                      variant="caption"
                      fontWeight={700}
                      color="text.secondary"
                      sx={{
                        display: "block",
                        mt: 2,
                        mb: 0.5,
                        textTransform: "uppercase",
                        fontSize: "0.65rem",
                      }}
                    >
                      Working Days
                    </Typography>
                    <Stack
                      direction="row"
                      flexWrap="wrap"
                      sx={{ gap: 0.75, mb: 1 }}
                    >
                      {DAY_LABELS.map((label, idx) => {
                        const active = (form.workingDays ?? []).includes(idx);
                        return (
                          <Box
                            key={idx}
                            onClick={() => toggleWorkingDay(idx)}
                            sx={{
                              px: 1.5,
                              py: 0.5,
                              borderRadius: 30,
                              cursor: "pointer",
                              userSelect: "none",
                              border: "1px solid",
                              fontWeight: 700,
                              fontSize: "0.75rem",
                              borderColor: active ? "primary.main" : "divider",
                              bgcolor: active
                                ? "primary.main"
                                : "background.paper",
                              color: active
                                ? "primary.contrastText"
                                : "text.secondary",
                              transition: "all 0.12s",
                            }}
                          >
                            {label}
                          </Box>
                        );
                      })}
                    </Stack>

                    {/* Weekend / Off Days */}
                    <Typography
                      variant="caption"
                      fontWeight={700}
                      color="text.secondary"
                      sx={{
                        display: "block",
                        mb: 0.5,
                        textTransform: "uppercase",
                        fontSize: "0.65rem",
                      }}
                    >
                      Weekend / Off Days
                    </Typography>
                    <Stack
                      direction="row"
                      flexWrap="wrap"
                      sx={{ gap: 0.75, mb: 1.5 }}
                    >
                      {DAY_LABELS.map((label, idx) => {
                        const active = (form.weekendDays ?? []).includes(idx);
                        return (
                          <Box
                            key={idx}
                            onClick={() => toggleWeekendDay(idx)}
                            sx={{
                              px: 1.5,
                              py: 0.5,
                              borderRadius: 30,
                              cursor: "pointer",
                              userSelect: "none",
                              border: "1px solid",
                              fontWeight: 700,
                              fontSize: "0.75rem",
                              borderColor: active ? "warning.main" : "divider",
                              bgcolor: active
                                ? "warning.main"
                                : "background.paper",
                              color: active
                                ? "warning.contrastText"
                                : "text.secondary",
                              transition: "all 0.12s",
                            }}
                          >
                            {label}
                          </Box>
                        );
                      })}
                    </Stack>

                    {/* Time pickers */}
                    <Stack
                      direction="row"
                      spacing={2}
                      sx={{ mt: 1.5, flexWrap: "wrap", gap: 1.5 }}
                    >
                      <Box>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          fontWeight={600}
                          sx={{ display: "block", mb: 0.5 }}
                        >
                          Start time
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <TextField
                            select
                            size="small"
                            label="Hour"
                            value={Number(form.workingHoursStart)}
                            onChange={(e) =>
                              setForm((p) => ({
                                ...p,
                                workingHoursStart: Number(e.target.value),
                              }))
                            }
                            sx={{ minWidth: 72 }}
                            SelectProps={{ native: true }}
                          >
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(
                              (h) => (
                                <option key={h} value={h}>
                                  {String(h).padStart(2, "0")}
                                </option>
                              ),
                            )}
                          </TextField>
                          <TextField
                            select
                            size="small"
                            label="Min"
                            value={Number(form.workingHoursStartMinute)}
                            onChange={(e) =>
                              setForm((p) => ({
                                ...p,
                                workingHoursStartMinute: Number(e.target.value),
                              }))
                            }
                            sx={{ minWidth: 72 }}
                            SelectProps={{ native: true }}
                          >
                            {MINUTES.map((m) => (
                              <option key={m} value={m}>
                                {String(m).padStart(2, "0")}
                              </option>
                            ))}
                          </TextField>
                          <TextField
                            select
                            size="small"
                            label="AM/PM"
                            value={form.workingHoursStartAmPm}
                            onChange={(e) =>
                              setForm((p) => ({
                                ...p,
                                workingHoursStartAmPm: e.target.value,
                              }))
                            }
                            sx={{ minWidth: 72 }}
                            SelectProps={{ native: true }}
                          >
                            <option value="AM">AM</option>
                            <option value="PM">PM</option>
                          </TextField>
                        </Stack>
                      </Box>
                      <Box>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          fontWeight={600}
                          sx={{ display: "block", mb: 0.5 }}
                        >
                          End time
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <TextField
                            select
                            size="small"
                            label="Hour"
                            value={Number(form.workingHoursEnd)}
                            onChange={(e) =>
                              setForm((p) => ({
                                ...p,
                                workingHoursEnd: Number(e.target.value),
                              }))
                            }
                            sx={{ minWidth: 72 }}
                            SelectProps={{ native: true }}
                          >
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(
                              (h) => (
                                <option key={h} value={h}>
                                  {String(h).padStart(2, "0")}
                                </option>
                              ),
                            )}
                          </TextField>
                          <TextField
                            select
                            size="small"
                            label="Min"
                            value={Number(form.workingHoursEndMinute)}
                            onChange={(e) =>
                              setForm((p) => ({
                                ...p,
                                workingHoursEndMinute: Number(e.target.value),
                              }))
                            }
                            sx={{ minWidth: 72 }}
                            SelectProps={{ native: true }}
                          >
                            {MINUTES.map((m) => (
                              <option key={m} value={m}>
                                {String(m).padStart(2, "0")}
                              </option>
                            ))}
                          </TextField>
                          <TextField
                            select
                            size="small"
                            label="AM/PM"
                            value={form.workingHoursEndAmPm}
                            onChange={(e) =>
                              setForm((p) => ({
                                ...p,
                                workingHoursEndAmPm: e.target.value,
                              }))
                            }
                            sx={{ minWidth: 72 }}
                            SelectProps={{ native: true }}
                          >
                            <option value="AM">AM</option>
                            <option value="PM">PM</option>
                          </TextField>
                        </Stack>
                      </Box>
                    </Stack>

                    {/* Working Days toggle */}
                    <FormControlLabel
                      sx={{ mt: 1.5 }}
                      control={
                        <Switch
                          checked={form.notifyOutsideWorkingDays}
                          onChange={(e) =>
                            setForm((p) => ({
                              ...p,
                              notifyOutsideWorkingDays: e.target.checked,
                            }))
                          }
                          color="warning"
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2" fontWeight={600}>
                            Working Days Enforcement
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Flag visitors with a warning when booking on a
                            weekend / off day.
                          </Typography>
                        </Box>
                      }
                    />

                    {/* Working Hours toggle */}
                    <FormControlLabel
                      sx={{ mt: 0.5 }}
                      control={
                        <Switch
                          checked={form.notifyOutsideWorkingHours}
                          onChange={(e) =>
                            setForm((p) => ({
                              ...p,
                              notifyOutsideWorkingHours: e.target.checked,
                            }))
                          }
                          color="info"
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2" fontWeight={600}>
                            Working Hours Enforcement
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Flag visitors with a warning when booking, checking
                            in, or checking out outside the configured window.
                          </Typography>
                        </Box>
                      }
                    />
                  </>
                );
              })()}
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
                startIcon={
                  saving ? (
                    <CircularProgress size={18} color="inherit" />
                  ) : (
                    <ICONS.save />
                  )
                }
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
            title="Delete Organization Profile"
            message="Are you sure you want to delete the organization profile? This action cannot be undone."
            confirmButtonText="Delete"
            confirmButtonIcon={<ICONS.delete fontSize="small" />}
          />
        </Box>
      </PermissionGuard>
    </PermissionRouteGuard>
  );
}
