"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import dayjs from "dayjs";
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Divider,
  Avatar,
  Pagination,
  Tabs,
  Tab,
  CircularProgress,
  LinearProgress,
  TextField,
  FormControl,
  Select,
  InputLabel,
  MenuItem,
  RadioGroup,
  Radio,
  FormControlLabel,
  useTheme,
  alpha,
  Collapse,
} from "@mui/material";
import { useColorMode } from "@/contexts/ThemeContext";
import { useMessage } from "@/contexts/MessageContext";
import { useSocket } from "@/contexts/SocketContext";
import { useLanguage } from "@/contexts/LanguageContext";
import CountryCodeSelector from "@/components/CountryCodeSelector";
import CountryPicker from "@/components/CountryPicker";
import { isPhoneField } from "@/utils/validationUtils";
import {
  formatPhoneNumberForDisplay,
  DEFAULT_ISO_CODE,
} from "@/utils/countryCodes";
import { getCustomFields } from "@/services/customFieldService";
import ICONS from "@/utils/iconUtil";
import AppCard from "@/components/cards/AppCard";
import DialogHeader from "@/components/modals/DialogHeader";
import ListToolbar from "@/components/ListToolbar";
import LoadingState from "@/components/LoadingState";
import NoDataAvailable from "@/components/NoDataAvailable";
import ResponsiveCardGrid from "@/components/ResponsiveCardGrid";
import RecordMetadata from "@/components/RecordMetadata";
import { getVisitorUsers, getVisitorUserById, updateVisitorUser } from "@/services/userService";
import {
  getRegistrations,
  getRegistrationActivityLogs,
  exportVisitorHistoryCsv,
  updateRegistration,
} from "@/services/registrationService";
import { getKitchenOrdersForRegistration as getKitchenOrders } from "@/services/kitchenService";
import { formatDate, formatDateTimeWithLocale } from "@/utils/dateUtils";
import { useAuth } from "@/contexts/AuthContext";
import PermissionRouteGuard from "@/components/auth/PermissionRouteGuard";
import { canAccessResource } from "@/utils/permissions";

const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    color: "warning",
    icon: <ICONS.time fontSize="small" />,
  },
  admin_approved: {
    label: "Dept. Approved",
    color: "info",
    icon: <ICONS.checkCircleOutline fontSize="small" />,
  },
  approved: {
    label: "Approved",
    color: "success",
    icon: <ICONS.checkCircle fontSize="small" />,
  },
  rejected: {
    label: "Rejected",
    color: "error",
    icon: <ICONS.close fontSize="small" />,
  },
  checked_in: {
    label: "Checked In",
    color: "info",
    icon: <ICONS.login fontSize="small" />,
  },
  checked_out: {
    label: "Checked Out",
    color: "default",
    icon: <ICONS.logout fontSize="small" />,
  },
  cancelled: {
    label: "Cancelled",
    color: "default",
    icon: <ICONS.cancel fontSize="small" />,
  },
  visit_ended: {
    label: "Visit Ended",
    color: "default",
    icon: <ICONS.stop fontSize="small" />,
  },
  expired: {
    label: "Expired",
    color: "default",
    icon: <ICONS.history fontSize="small" />,
  },
};

const ACTIVITY_LABELS = {
  submitted: "New Registration",
  admin_approved: "Admin Approved",
  approved: "Registration Approved",
  rejected: "Registration Rejected",
  cancelled: "Registration Cancelled",
  nda_signed: "NDA Signed",
  qr_generated: "QR Generated",
  scanned: "QR Scanned",
  badge_printed: "Badge Printed",
  checked_in: "Checked In",
  checked_out: "Checked Out",
  visit_ended: "Visit Ended",
  status_override: "Status Override",
};

const ACTIVITY_COLORS = {
  submitted: "warning",
  admin_approved: "info",
  approved: "success",
  rejected: "error",
  cancelled: "error",
  nda_signed: "info",
  qr_generated: "info",
  scanned: "info",
  badge_printed: "info",
  checked_in: "success",
  checked_out: "info",
  visit_ended: "grey",
  status_override: "warning",
};

function toTitleCase(str) {
  if (!str) return "";
  return str.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildScheduleText(fromStr, toStr, emptyLabel = "Not scheduled yet") {
  if (!fromStr && !toStr) return emptyLabel;
  const f = fromStr ? formatDate(fromStr) : null;
  const t = toStr ? formatDate(toStr) : null;
  return f && t && f !== t ? `${f} to ${t}` : f || t || emptyLabel;
}

const buildEditCountryIsoCodes = (reg, fields) => {
  const isoCodes = {};
  if (!fields) return isoCodes;
  fields.forEach((field) => {
    if (isPhoneField(field)) {
      isoCodes[field.fieldKey] = (
        reg.phoneIsoCode ||
        reg.phone_iso_code ||
        DEFAULT_ISO_CODE
      ).toLowerCase();
    }
  });
  return isoCodes;
};

function getVisibleFieldValues(registration) {
  const raw = registration?.fieldValues || registration?.field_values || [];
  const map = {};
  const nk = (s = "") => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (Array.isArray(raw)) {
    raw.forEach((fv) => {
      const key = fv.customField?.fieldKey || fv.custom_field?.field_key;
      if (!key) return;
      const k = nk(key);
      const l = nk(fv.customField?.label);
      if (
        k.includes("purposeofvisit") ||
        k === "purpose" ||
        l.includes("purposeofvisit") ||
        l === "purpose"
      )
        return;
      if (
        k.includes("pleasespecify") ||
        k.includes("otherspecify") ||
        k.includes("otherpurpose") ||
        l.includes("pleasespecify") ||
        (l.includes("other") && l.includes("specify"))
      )
        return;
      if (
        k === "other" ||
        k.includes("otherdetails") ||
        l === "other" ||
        l.includes("otherdetails")
      )
        return;
      map[key] = fv.value;
    });
  }
  return map;
}

export default function VisitorsPage() {
  const theme = useTheme();
  const { mode } = useColorMode();
  const isDark = mode === "dark";
  const { showMessage } = useMessage();
  const { lang } = useLanguage();
  const { user } = useAuth();
  const isKitchenAdmin =
    user?.role === "admin" && user?.adminType === "kitchen";

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isListRefreshing, setIsListRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(12);

  const [selected, setSelected] = useState(null);
  const [fetchingProfile, setFetchingProfile] = useState(false);
  const [selectedTab, setSelectedTab] = useState("details");
  const [editModal, setEditModal] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [csvExportLoading, setCsvExportLoading] = useState(false);
  const [exportingXlsx, setExportingXlsx] = useState(false);
  const [activeCustomFields, setActiveCustomFields] = useState([]);
  const [editCountryIsoCodes, setEditCountryIsoCodes] = useState({});
  const [timelineModal, setTimelineModal] = useState({
    open: false,
    visitId: null,
    visitorName: "",
  });
  const [timelineLogs, setTimelineLogs] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  const fetchVisitors = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setIsListRefreshing(true);
    try {
      const data = await getVisitorUsers();
      const visitors = Array.isArray(data) ? data : [];
      const enriched = await Promise.all(
        visitors.map(async (v) => {
          try {
            const regs = await getRegistrations(null, {}, v.id);
            if (Array.isArray(regs) && regs.length > 0) {
              const latest = regs[0];
              if (Array.isArray(latest.fieldValues)) {
                latest.fieldValues.forEach((fv) => {
                  const key =
                    fv.customField?.fieldKey || fv.customField?.field_key;
                  const label = fv.customField?.label || "";
                  const k = (key || "").toLowerCase().replace(/[^a-z0-9]/g, "");
                  const isId = [
                    "civilid",
                    "omanid",
                    "omanidnumber",
                    "idnumber",
                    "idnumberoman",
                    "passport",
                    "passportnumber",
                    "nationalid",
                    "nationalidnumber",
                    "eid",
                    "idcard",
                    "idcardnumber",
                    "identificationnumber",
                    "documentnumber",
                  ].includes(k);
                  if (isId && fv.value) {
                    v._idValue = fv.value;
                    v._idLabel = label;
                  }
                  const isCompany = [
                    "company",
                    "companyname",
                    "company_name",
                    "organization",
                    "organisation",
                    "employer",
                  ].includes(k);
                  if (isCompany && fv.value && !v.companyName) {
                    v.companyName = fv.value;
                  }
                });
              }
            }
          } catch {}
          return v;
        }),
      );
      setRows(enriched);
      if (!quiet) setHasLoadedOnce(true);
    } catch {
      if (!quiet) setHasLoadedOnce(true);
    } finally {
      setLoading(false);
      setIsListRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchVisitors();
  }, [fetchVisitors]);

  useEffect(() => {
    getCustomFields()
      .then((fields) =>
        setActiveCustomFields(
          Array.isArray(fields) ? fields.filter((f) => f.isActive) : [],
        ),
      )
      .catch(() => {});
  }, []);

  // ── Dependent field visibility ──
  const allChildFieldIds = useMemo(() => {
    const ids = new Set();
    activeCustomFields.forEach((f) => {
      const deps = f.dependentsJson;
      if (deps) {
        Object.values(deps).forEach((cfg) => {
          const childIds = Array.isArray(cfg) ? cfg : cfg.fieldIds || [];
          childIds.forEach((id) => ids.add(id));
        });
      }
    });
    return ids;
  }, [activeCustomFields]);

  const visibleFieldIds = useMemo(() => {
    const visible = new Set();
    if (!editForm?.fieldValues) return visible;
    const fieldById = Object.fromEntries(
      activeCustomFields.map((f) => [f.id, f]),
    );
    const queue = [];
    activeCustomFields.forEach((f) => {
      if (!allChildFieldIds.has(f.id)) {
        visible.add(f.id);
        queue.push(f);
      }
    });
    while (queue.length > 0) {
      const current = queue.shift();
      const deps = current.dependentsJson;
      if (!deps) continue;
      const currentValue = editForm.fieldValues?.[current.fieldKey];
      if (currentValue && deps[currentValue]) {
        const cfg = deps[currentValue];
        const childIds = Array.isArray(cfg) ? cfg : cfg.fieldIds || [];
        childIds.forEach((childId) => {
          if (!visible.has(childId)) {
            visible.add(childId);
            const child = fieldById[childId];
            if (child) queue.push(child);
          }
        });
      }
    }
    return visible;
  }, [activeCustomFields, allChildFieldIds, editForm?.fieldValues]);

  const purposeDescendantIds = useMemo(() => {
    const ids = new Set();
    activeCustomFields.forEach((f) => {
      const nk = (s = "") => s.toLowerCase().replace(/[^a-z0-9]/g, "");
      const k = nk(f.fieldKey || f.field_key);
      const l = (f.label || "").toLowerCase();
      if (
        k.includes("purposeofvisit") ||
        k === "purpose" ||
        l.includes("purpose of visit")
      ) {
        ids.add(f.id);
        const deps = f.dependentsJson;
        if (deps) {
          Object.values(deps).forEach((cfg) => {
            const childIds = Array.isArray(cfg) ? cfg : cfg.fieldIds || [];
            childIds.forEach((id) => ids.add(id));
          });
        }
      }
    });
    return ids;
  }, [activeCustomFields]);

  const clearHiddenChildren = (parentField, newValue, fvMap) => {
    const deps = parentField?.dependentsJson;
    if (!deps) return;
    Object.entries(deps).forEach(([triggerVal, config]) => {
      if (triggerVal !== newValue) {
        const childIds = Array.isArray(config) ? config : config.fieldIds || [];
        childIds.forEach((childId) => {
          const childField = activeCustomFields.find((f) => f.id === childId);
          if (childField) {
            const childKey = childField.fieldKey || childField.field_key;
            const currentVal = fvMap[childKey];
            delete fvMap[childKey];
            clearHiddenChildren(childField, currentVal, fvMap);
          }
        });
      }
    });
  };

  const handleFieldChange = (key, value) => {
    setEditForm((prev) => {
      const updated = { ...prev.fieldValues, [key]: value };
      const field = activeCustomFields.find(
        (f) => (f.fieldKey || f.field_key) === key,
      );
      if (field) clearHiddenChildren(field, value, updated);
      return { ...prev, fieldValues: updated };
    });
  };

  // ── Socket listeners for visitor create/update ──
  const { on } = useSocket();
  useEffect(() => {
    const unsubNew = on("visitor:new", (newVisitor) => {
      if (!newVisitor?.id) {
        fetchVisitors({ silent: true });
        return;
      }
      setRows((prev) => {
        const exists = prev.some((v) => v.id === newVisitor.id);
        if (exists) return prev;
        return [newVisitor, ...prev];
      });
    });

    const unsubUpdated = on("visitor:updated", (updatedVisitor) => {
      if (!updatedVisitor?.id) return;
      setRows((prev) =>
        prev.map((v) =>
          v.id === updatedVisitor.id ? { ...v, ...updatedVisitor } : v,
        ),
      );
      if (selected?.id === updatedVisitor.id) {
        setSelected((prev) => (prev ? { ...prev, ...updatedVisitor } : prev));
      }
    });

    return () => {
      unsubNew?.();
      unsubUpdated?.();
    };
  }, [on, fetchVisitors, selected?.id]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (v) =>
        (v.fullName || "").toLowerCase().includes(q) ||
        (v.email || "").toLowerCase().includes(q) ||
        (v.phone || "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  const pagedRows = useMemo(() => {
    const start = page * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, page, rowsPerPage]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));

  const handleOpenDetail = async (visitor) => {
    setFetchingProfile(true);
    setSelected(visitor);
    setSelectedTab("details");
    try {
      const full = await getVisitorUserById(visitor.id);
      if (!full) {
        setFetchingProfile(false);
        return;
      }
      const history = await getRegistrations(null, {}, visitor.id);
      full.history = Array.isArray(history) ? history : [];
      full.fields = {};
      const mergedFields = {};
      full.history.forEach((reg) => {
        const visible = getVisibleFieldValues(reg);
        Object.entries(visible).forEach(([key, val]) => {
          if (val != null && String(val).trim() !== "") {
            mergedFields[key] = val;
          }
        });
      });
      full.fields = Object.keys(mergedFields).length ? mergedFields : {};
      setSelected(full);
    } catch {
    } finally {
      setFetchingProfile(false);
    }
  };

  const closeProfileDialog = () => setSelected(null);

  const handleEdit = async (visitor) => {
    const fvMap = {};
    let latestRegId = null;
    try {
      const regs = await getRegistrations(null, {}, visitor.id);
      const latest = Array.isArray(regs) && regs.length > 0 ? regs[0] : null;
      if (latest) {
        latestRegId = latest.id;
        if (Array.isArray(latest.fieldValues)) {
          latest.fieldValues.forEach((fv) => {
            const key = fv.customField?.fieldKey || fv.customField?.field_key;
            if (key) fvMap[key] = fv.value;
          });
        }
      }
      setEditCountryIsoCodes(
        buildEditCountryIsoCodes(latest || {}, activeCustomFields),
      );
    } catch {}
    setEditModal({ ...visitor, _latestRegId: latestRegId });
    setEditForm({
      fullName: visitor.fullName || "",
      email: visitor.email || "",
      phone: visitor.phone || "",
      fieldValues: fvMap,
    });
  };

  const handleSaveEdit = async () => {
    if (!editModal) return;
    setSubmitting(true);
    try {
      const payload = {
        full_name: editForm.fullName ?? editModal.fullName,
      };
      if (editForm.email) payload.email = editForm.email;
      if (editForm.phone) payload.phone = editForm.phone;
      const userResult = await updateVisitorUser(editModal.id, payload);
      if (userResult?.error) return;
      if (editModal._latestRegId && editForm.fieldValues) {
        const regResult = await updateRegistration(editModal._latestRegId, {
          fieldValues: editForm.fieldValues,
        });
        if (regResult?.error) return;
      }
      showMessage("Visitor updated", "success");
      setEditModal(null);
      fetchVisitors(true);
    } catch (e) {
      showMessage(
        e?.response?.data?.message || e?.response?.data?.error || e?.message || "Failed to update visitor",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportCsv = async () => {
    const regId = selected?.history?.[0]?.id;
    if (!regId) {
      showMessage("No visit history to export", "warning");
      return;
    }
    setCsvExportLoading(true);
    try {
      await exportVisitorHistoryCsv(regId);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setCsvExportLoading(false);
    }
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const openTimeline = async (visitId, visitorName) => {
    setTimelineLoading(true);
    setTimelineModal({ open: true, visitId, visitorName });
    try {
      const logs = await getRegistrationActivityLogs(visitId);
      setTimelineLogs(Array.isArray(logs) ? logs : []);
    } catch {
      setTimelineLogs([]);
    } finally {
      setTimelineLoading(false);
    }
  };

  if (loading && !hasLoadedOnce) {
    return <LoadingState cardMaxWidth={400} skeletonLines={3} />;
  }

  return (
    <PermissionRouteGuard resource="visitors" hardcodeAllowed={!isKitchenAdmin}>
      <Box>
        {isListRefreshing && (
          <LinearProgress
            sx={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999 }}
          />
        )}

        <Box
          sx={{
            display: "flex",
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
              Visitors
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 0.5, opacity: 0.8 }}
            >
              Manage and view all visitor profiles across your system.
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ mb: 3 }} />

        <ListToolbar
          showingCount={pagedRows.length}
          totalCount={filtered.length}
          searchSlot={
            <TextField
              fullWidth
              size="small"
              variant="outlined"
              placeholder="Search by name, email or phone..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
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
            <>
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
            </>
          }
        />

        <ResponsiveCardGrid>
          {pagedRows.map((visitor) => (
            <AppCard key={visitor.id} sx={{ height: "100%", width: "100%" }}>
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
                  <Avatar
                    sx={{
                      width: 40,
                      height: 40,
                      bgcolor: isDark ? "#fff" : "#000",
                      color: isDark ? "#000" : "#fff",
                      fontSize: "1rem",
                      fontWeight: 800,
                    }}
                  >
                    {(visitor.fullName || "")
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("") || "?"}
                  </Avatar>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography
                      variant="subtitle1"
                      fontWeight={800}
                      noWrap
                      sx={{ lineHeight: 1.2 }}
                    >
                      {visitor.fullName}
                    </Typography>
                  </Box>
                </Stack>
              </Box>

              <Box
                sx={{
                  flexGrow: 1,
                  px: 2,
                  py: 1.5,
                  "& > :not(:last-child)": {
                    borderBottom: "1px solid",
                    borderColor: "divider",
                  },
                }}
              >
                {visitor._idValue && (
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      py: 0.8,
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.6,
                        color: "text.secondary",
                      }}
                    >
                      <ICONS.key fontSize="small" sx={{ opacity: 0.6 }} />{" "}
                      {visitor._idLabel || "ID"}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        ml: 2,
                        flex: 1,
                        textAlign: "right",
                        color: "text.primary",
                      }}
                    >
                      {visitor._idValue}
                    </Typography>
                  </Box>
                )}
                {visitor.email && (
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      py: 0.8,
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.6,
                        color: "text.secondary",
                      }}
                    >
                      <ICONS.emailOutline
                        fontSize="small"
                        sx={{ opacity: 0.6 }}
                      />{" "}
                      Email
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        ml: 2,
                        flex: 1,
                        textAlign: "right",
                        color: "text.primary",
                      }}
                    >
                      {visitor.email}
                    </Typography>
                  </Box>
                )}
                {visitor.phone && (
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      py: 0.8,
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.6,
                        color: "text.secondary",
                      }}
                    >
                      <ICONS.phone fontSize="small" sx={{ opacity: 0.6 }} />{" "}
                      Phone
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        ml: 2,
                        flex: 1,
                        textAlign: "right",
                        color: "text.primary",
                      }}
                    >
                      {formatPhoneNumberForDisplay(
                        visitor.phone,
                        visitor.iso_code,
                      )}
                    </Typography>
                  </Box>
                )}
                {visitor.companyName && (
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      py: 0.8,
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.6,
                        color: "text.secondary",
                      }}
                    >
                      <ICONS.business fontSize="small" sx={{ opacity: 0.6 }} />{" "}
                      Company
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        ml: 2,
                        flex: 1,
                        textAlign: "right",
                        color: "text.primary",
                      }}
                    >
                      {visitor.companyName}
                    </Typography>
                  </Box>
                )}
              </Box>

              <Box
                sx={{
                  p: 1.2,
                  borderTop: "1px solid",
                  borderColor: "divider",
                  bgcolor: isDark
                    ? "rgba(255,255,255,0.02)"
                    : "rgba(0,0,0,0.01)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 1,
                }}
              >
                <Box sx={{ width: "100%", overflow: "hidden" }}>
                  <RecordMetadata
                    createdByName={visitor.createdBy}
                    updatedByName={visitor.updatedBy}
                    createdAt={visitor.createdAt}
                    updatedAt={visitor.updatedAt}
                    locale="en-GB"
                    sx={{ px: 0, py: 0 }}
                  />
                </Box>
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  {canAccessResource(user, "visitors", {
                    hardcodeAllowed: true,
                    action: "update",
                  }) && (
                    <Tooltip title="Edit visitor">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(visitor);
                        }}
                        sx={{ color: "warning.main" }}
                      >
                        <ICONS.edit fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title="View Details">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDetail(visitor);
                      }}
                      sx={{ color: "primary.main" }}
                    >
                      <ICONS.view fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Box>
            </AppCard>
          ))}
        </ResponsiveCardGrid>

        {filtered.length === 0 && !loading && (
          <NoDataAvailable
            message={
              search ? "No visitors match your search" : "No visitors found"
            }
          />
        )}

        {totalPages > 1 && (
          <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
            <Pagination
              count={totalPages}
              page={page + 1}
              onChange={(_, p) => setPage(p - 1)}
              color="primary"
              size="small"
            />
          </Box>
        )}

        {/* ── Visitor Detail Dialog ── */}
        <Dialog
          open={!!selected}
          onClose={closeProfileDialog}
          maxWidth="md"
          fullWidth
          PaperProps={{ sx: { borderRadius: 4, overflow: "hidden" } }}
        >
          <DialogHeader title="Visitor Details" onClose={closeProfileDialog}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              alignItems={{ xs: "flex-start", sm: "center" }}
              justifyContent="space-between"
              sx={{ flex: 1, gap: 1 }}
            >
              <Typography variant="h6" fontWeight={800}>
                Visitor Details
              </Typography>
              <Tooltip title="Export visit history as CSV">
                <span>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={
                      csvExportLoading ? (
                        <CircularProgress size={13} color="inherit" />
                      ) : (
                        <ICONS.download fontSize="small" />
                      )
                    }
                    onClick={handleExportCsv}
                    disabled={csvExportLoading || !selected}
                    sx={{
                      borderRadius: 30,
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      width: { xs: "100%", sm: "auto" },
                    }}
                  >
                    Export Visit History
                  </Button>
                </span>
              </Tooltip>
            </Stack>
          </DialogHeader>
          <Divider />
          <DialogContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
            {selected &&
              (() => (
                <Stack spacing={3}>
                  {/* Visitor header */}
                  <Box
                    sx={{
                      p: { xs: 2, sm: 2.5 },
                      borderRadius: 3,
                      bgcolor: isDark
                        ? "rgba(255,255,255,0.03)"
                        : "rgba(0,0,0,0.02)",
                      border: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Avatar
                        sx={{
                          width: 56,
                          height: 56,
                          bgcolor: isDark ? "#fff" : "#000",
                          color: isDark ? "#000" : "#fff",
                          fontSize: "1.2rem",
                          fontWeight: 700,
                        }}
                      >
                        {(selected.fullName || "")
                          .split(" ")
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")}
                      </Avatar>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="h6" fontWeight={800}>
                          {selected.fullName}
                        </Typography>
                        <Stack
                          direction="row"
                          spacing={2}
                          sx={{ mt: 0.4, flexWrap: "wrap", gap: 1 }}
                        >
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 0.5,
                              wordBreak: "break-all",
                            }}
                          >
                            <ICONS.emailOutline fontSize="inherit" />{" "}
                            {selected.email || "No email"}
                          </Typography>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 0.5,
                            }}
                          >
                            <ICONS.phone fontSize="inherit" />{" "}
                            {selected.phone
                              ? formatPhoneNumberForDisplay(
                                  selected.phone,
                                  selected.iso_code,
                                )
                              : "No phone"}
                          </Typography>
                        </Stack>
                      </Box>
                    </Stack>
                  </Box>

                  {/* Tabs */}
                  <Tabs
                    value={selectedTab}
                    onChange={(_, v) => setSelectedTab(v)}
                    variant="fullWidth"
                    sx={{
                      minHeight: 46,
                      bgcolor: (theme) =>
                        alpha(theme.palette.text.primary, isDark ? 0.06 : 0.04),
                      borderRadius: 999,
                      p: 0.5,
                      "& .MuiTabs-indicator": { display: "none" },
                    }}
                  >
                    {[
                      {
                        value: "details",
                        icon: <ICONS.info fontSize="small" />,
                        label: "Details",
                      },
                      {
                        value: "history",
                        icon: <ICONS.history fontSize="small" />,
                        label: `History (${(selected.history || []).length})`,
                      },
                    ].map(({ value, icon, label }) => (
                      <Tab
                        key={value}
                        value={value}
                        icon={icon}
                        iconPosition="start"
                        label={label}
                        sx={{
                          minHeight: 38,
                          borderRadius: 999,
                          fontWeight: 800,
                          textTransform: "none",
                          "&.Mui-selected": {
                            bgcolor: "background.paper",
                            color: "text.primary",
                            boxShadow: isDark
                              ? "0 8px 20px rgba(0,0,0,0.24)"
                              : "0 6px 14px rgba(0,0,0,0.08)",
                          },
                        }}
                      />
                    ))}
                  </Tabs>

                  {/* Details tab — only additional fields, no heading */}
                  {selectedTab === "details" ? (
                    <Box>
                      {selected.fields &&
                      Object.keys(selected.fields).length > 0 ? (
                        <Box sx={{ px: { xs: 0, sm: 1 } }}>
                          <Box
                            sx={{
                              display: "grid",
                              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                              gap: { xs: 1.5, md: "16px 32px" },
                            }}
                          >
                            {Object.entries(selected.fields).map(
                              ([key, val]) => (
                                <Box
                                  key={key}
                                  sx={{
                                    p: 1.75,
                                    borderRadius: 2.5,
                                    border: "1px solid",
                                    borderColor: "divider",
                                    bgcolor: isDark
                                      ? "rgba(255,255,255,0.01)"
                                      : "rgba(0,0,0,0.01)",
                                  }}
                                >
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{
                                      fontWeight: 800,
                                      textTransform: "uppercase",
                                      fontSize: "0.6rem",
                                    }}
                                  >
                                    {key}
                                  </Typography>
                                  <Typography
                                    variant="body2"
                                    fontWeight={600}
                                    sx={{ mt: 0.4 }}
                                  >
                                    {String(val ?? "—")}
                                  </Typography>
                                </Box>
                              ),
                            )}
                          </Box>
                        </Box>
                      ) : (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ textAlign: "center", py: 3 }}
                        >
                          No additional information available
                        </Typography>
                      )}
                    </Box>
                  ) : (
                    /* History tab — matches PreviousVisitCard pattern */
                    <Stack spacing={2}>
                      {!selected.history || selected.history.length === 0 ? (
                        <NoDataAvailable
                          title="No visit history"
                          description="This visitor has not made any visits yet."
                          compact
                          minHeight={220}
                        />
                      ) : (
                        selected.history.map((visit) => (
                          <HistoryVisitCard
                            key={visit.id}
                            visit={visit}
                            visitorName={selected.fullName}
                            isDark={isDark}
                            onViewTimeline={openTimeline}
                          />
                        ))
                      )}
                    </Stack>
                  )}
                </Stack>
              ))()}
          </DialogContent>
        </Dialog>

        {/* ── Timeline Modal ── */}
        <Dialog
          open={timelineModal.open}
          onClose={() => setTimelineModal({ open: false })}
          maxWidth="sm"
          fullWidth
          PaperProps={{ sx: { borderRadius: 4, overflow: "hidden" } }}
        >
          <DialogHeader
            title={`Activity Timeline${timelineModal.visitorName ? ` — ${timelineModal.visitorName}` : ""}`}
            onClose={() => setTimelineModal({ open: false })}
          />
          <Divider />
          <DialogContent sx={{ p: 3, minHeight: 200 }}>
            {timelineLoading ? (
              <Box display="flex" justifyContent="center" py={4}>
                <CircularProgress />
              </Box>
            ) : timelineLogs.length === 0 ? (
              <NoDataAvailable
                title="No activity yet"
                description="No activity logs found for this visit."
                compact
                minHeight={120}
              />
            ) : (
              <Box>
                {timelineLogs.map((log, index) => {
                  const color = ACTIVITY_COLORS[log.activityType] || "grey";
                  return (
                    <Box
                      key={log.id}
                      sx={{
                        display: "flex",
                        gap: 2,
                        mb: index < timelineLogs.length - 1 ? 0 : 0,
                      }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          pt: 0.5,
                          minWidth: 24,
                        }}
                      >
                        <Box
                          sx={{
                            width: 12,
                            height: 12,
                            borderRadius: "50%",
                            flexShrink: 0,
                            bgcolor:
                              color === "grey"
                                ? "text.disabled"
                                : color === "error"
                                  ? "error.main"
                                  : color === "success"
                                    ? "success.main"
                                    : color === "warning"
                                      ? "warning.main"
                                      : color === "info"
                                        ? "info.main"
                                        : "primary.main",
                          }}
                        />
                        {index < timelineLogs.length - 1 && (
                          <Box
                            sx={{
                              width: 1,
                              flex: 1,
                              minHeight: 24,
                              bgcolor: "divider",
                              mt: 0.5,
                            }}
                          />
                        )}
                      </Box>
                      <Box sx={{ pb: 2.5, flex: 1, minWidth: 0 }}>
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                          flexWrap="wrap"
                        >
                          <Typography variant="body2" fontWeight={700}>
                            {ACTIVITY_LABELS[log.activityType] ||
                              toTitleCase(log.activityType)}
                          </Typography>
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {formatDateTimeWithLocale(
                            log.metadata?.checkedInAt ||
                              log.metadata?.checkedOutAt ||
                              log.createdAt,
                          )}
                        </Typography>
                        {log.notes && (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mt: 0.5, fontStyle: "italic" }}
                          >
                            {log.notes}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}
          </DialogContent>
        </Dialog>

        {/* ── Edit Visitor Dialog ── */}
        <Dialog
          open={!!editModal}
          onClose={() => setEditModal(null)}
          maxWidth="sm"
          fullWidth
          PaperProps={{ sx: { borderRadius: 4, overflow: "hidden" } }}
        >
          <DialogHeader
            title="Edit Visitor"
            onClose={() => setEditModal(null)}
          />
          <Divider />
          <DialogContent sx={{ p: 2.5 }}>
            <Stack spacing={2.5}>
              {activeCustomFields
                .filter(
                  (f) =>
                    !purposeDescendantIds.has(f.id) &&
                    visibleFieldIds.has(f.id),
                )
                .map((field) => {
                  const val = editForm?.fieldValues?.[field.fieldKey] ?? "";
                  const setVal = (v) => handleFieldChange(field.fieldKey, v);
                  const opts = Array.isArray(field.optionsJson)
                    ? field.optionsJson
                    : [];

                  if (
                    ["list", "select", "dropdown"].includes(field.inputType)
                  ) {
                    return (
                      <FormControl key={field.fieldKey} fullWidth>
                        <InputLabel>{field.label}</InputLabel>
                        <Select
                          value={val}
                          label={field.label}
                          onChange={(e) => setVal(e.target.value)}
                          sx={{ borderRadius: 2 }}
                        >
                          <MenuItem value="">
                            <em>None</em>
                          </MenuItem>
                          {opts.map((opt) => (
                            <MenuItem key={opt} value={opt}>
                              {opt}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    );
                  }

                  if (field.inputType === "radio") {
                    return (
                      <Box key={field.fieldKey}>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          fontWeight={700}
                          sx={{
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                            display: "block",
                            mb: 0.5,
                          }}
                        >
                          {field.label}
                        </Typography>
                        <RadioGroup
                          row
                          value={val}
                          onChange={(e) => setVal(e.target.value)}
                        >
                          {opts.map((opt) => (
                            <FormControlLabel
                              key={opt}
                              value={opt}
                              control={<Radio size="small" />}
                              label={opt}
                            />
                          ))}
                        </RadioGroup>
                      </Box>
                    );
                  }

                  if (field.inputType === "country") {
                    return (
                      <CountryPicker
                        key={field.fieldKey}
                        label={field.label}
                        value={val}
                        onChange={(v) => setVal(v)}
                        lang={lang}
                      />
                    );
                  }

                  if (isPhoneField(field)) {
                    const isoCode =
                      editCountryIsoCodes[field.fieldKey] || DEFAULT_ISO_CODE;
                    return (
                      <TextField
                        key={field.fieldKey}
                        label={field.label}
                        fullWidth
                        value={val}
                        onChange={(e) => {
                          const digitsOnly = e.target.value.replace(/\D/g, "");
                          setVal(digitsOnly);
                        }}
                        type="tel"
                        helperText="Enter your phone number"
                        InputProps={{
                          sx: { borderRadius: 2 },
                          startAdornment: (
                            <CountryCodeSelector
                              value={isoCode}
                              onChange={(iso) =>
                                setEditCountryIsoCodes((prev) => ({
                                  ...prev,
                                  [field.fieldKey]: iso,
                                }))
                              }
                              dir="ltr"
                            />
                          ),
                        }}
                      />
                    );
                  }

                  return (
                    <TextField
                      key={field.fieldKey}
                      label={field.label}
                      fullWidth
                      value={val}
                      onChange={(e) => setVal(e.target.value)}
                      type={
                        field.inputType === "email"
                          ? "email"
                          : field.inputType === "number"
                            ? "number"
                            : "text"
                      }
                      InputProps={{ sx: { borderRadius: 2 } }}
                    />
                  );
                })}
            </Stack>
          </DialogContent>
          <Divider />
          <DialogActions
            sx={{ p: 2.5, gap: 1, flexDirection: { xs: "column", sm: "row" } }}
          >
            <Button
              variant="outlined"
              onClick={() => setEditModal(null)}
              disabled={submitting}
              sx={{
                borderRadius: 30,
                width: { xs: "100%", sm: "auto" },
                order: { xs: 2, sm: 0 },
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSaveEdit}
              disabled={submitting}
              startIcon={
                submitting ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <ICONS.save />
                )
              }
              sx={{ borderRadius: 30, width: { xs: "100%", sm: "auto" } }}
            >
              Save Changes
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </PermissionRouteGuard>
  );
}

function HistoryVisitCard({ visit, visitorName, isDark, onViewTimeline }) {
  const visitFieldValues = getVisibleFieldValues(visit);
  const sc = STATUS_CONFIG[visit.status] || {
    label: toTitleCase(visit.status),
    color: "default",
    icon: <ICONS.history fontSize="small" />,
  };
  const departmentName =
    typeof visit.department === "object" && visit.department
      ? visit.department.name
      : visit.department || "";
  const accessLevelName =
    (typeof visit.accessLevel === "object" && visit.accessLevel
      ? visit.accessLevel.name
      : visit.accessLevel) ||
    (Array.isArray(visit.accessLevels) && visit.accessLevels.length
      ? visit.accessLevels.map((a) => a.name).join(", ")
      : "");
  const allowMultiCheckin = visit.allowMultiCheckin ?? false;
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [showOrders, setShowOrders] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState(new Set());

  useEffect(() => {
    if (showOrders && orders.length === 0) {
      setOrdersLoading(true);
      getKitchenOrders(visit.id)
        .then((res) => setOrders(Array.isArray(res) ? res : []))
        .catch(() => {})
        .finally(() => setOrdersLoading(false));
    }
  }, [showOrders, visit.id]);

  return (
    <Box
      sx={{
        p: 2.25,
        borderRadius: 3,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: (theme) =>
          theme.palette.mode === "dark"
            ? "rgba(255,255,255,0.02)"
            : "rgba(0,0,0,0.015)",
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="subtitle1" fontWeight={800}>
            {visit.requestedFrom ? formatDate(visit.requestedFrom) : "Visit"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Submitted {formatDateTimeWithLocale(visit.createdAt)}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Chip
            label={sc.label}
            color={sc.color}
            size="small"
            icon={sc.icon}
            sx={{ fontWeight: 700, borderRadius: 2, height: 26 }}
          />
        </Stack>
      </Stack>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          gap: { xs: 1.75, md: "16px 32px" },
        }}
      >
        <InfoItem
  label="Visiting Department"
  value={departmentName || "-"}
          icon={<ICONS.apartment fontSize="small" />}
        />
        <InfoItem
          label="Requested Schedule"
          value={buildScheduleText(
            visit.requestedFrom,
            visit.requestedTo,
            "Not provided",
          )}
          icon={<ICONS.event fontSize="small" />}
        />
        <InfoItem
          label="Approved Schedule"
          value={buildScheduleText(
            visit.approvedFrom,
            visit.approvedTo,
            "Not approved",
          )}
          icon={<ICONS.checkCircle fontSize="small" />}
        />
        <InfoItem
          label="Multi Check-in"
          value={allowMultiCheckin ? "Allowed" : "Not Allowed"}
          icon={<ICONS.replay fontSize="small" />}
        />
        <InfoItem
          label="Access Level"
          value={accessLevelName || "-"}
          icon={<ICONS.key fontSize="small" />}
        />
        {visit.rejectionReason ? (
          <InfoItem
            label="Rejection Reason"
            value={visit.rejectionReason}
            icon={<ICONS.close fontSize="small" />}
            sx={{ gridColumn: { md: "1 / -1" } }}
          />
        ) : null}
        {visit.approvalNote ? (
          <InfoItem
            label="Approver Note"
            value={visit.approvalNote}
            icon={<ICONS.info fontSize="small" />}
            sx={{ gridColumn: { md: "1 / -1" } }}
          />
        ) : null}
      </Box>

      {Object.keys(visitFieldValues).length > 0 && (
        <>
          <Divider sx={{ my: 2 }} />
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
              gap: { xs: 1.5, md: "16px 32px" },
            }}
          >
            {Object.entries(visitFieldValues).map(([key, val]) => (
              <Box
                key={key}
                sx={{
                  p: 1.75,
                  borderRadius: 2.5,
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: isDark
                    ? "rgba(255,255,255,0.01)"
                    : "rgba(0,0,0,0.01)",
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    fontWeight: 800,
                    textTransform: "uppercase",
                    fontSize: "0.6rem",
                  }}
                >
                  {key}
                </Typography>
                <Typography variant="body2" fontWeight={600} sx={{ mt: 0.4 }}>
                  {String(val ?? "—")}
                </Typography>
              </Box>
            ))}
          </Box>
        </>
      )}

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        sx={{ mt: 2.5 }}
      >
        <Button
          variant="outlined"
          size="small"
          startIcon={<ICONS.list fontSize="small" />}
          onClick={() => onViewTimeline(visit.id, visitorName)}
          sx={{ borderRadius: 30, textTransform: "none", fontWeight: 700 }}
        >
          Activity Timeline
        </Button>
        <Button
          variant="outlined"
          size="small"
          color="secondary"
          startIcon={<ICONS.restaurant fontSize="small" />}
          onClick={() => setShowOrders(!showOrders)}
          sx={{ borderRadius: 30, textTransform: "none", fontWeight: 700 }}
        >
          {showOrders ? "Hide Orders" : "View Kitchen Orders"}
        </Button>
      </Stack>

      <Collapse in={showOrders}>
        <Box
          sx={{ mt: 2, pt: 2, borderTop: "1px dashed", borderColor: "divider" }}
        >
          {ordersLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress size={30} />
            </Box>
          ) : orders.length === 0 ? (
            <NoDataAvailable
              title="No orders found"
              description="No kitchen orders have been placed for this visit yet."
              compact
              minHeight={150}
            />
          ) : (
            <Stack spacing={2}>
              {orders.map((order) => {
                const sortedHistory = [...(order.status_history || [])].sort(
                  (a, b) => new Date(a.changed_at) - new Date(b.changed_at),
                );
                return (
                  <Box
                    key={order.id}
                    sx={{
                      p: 2,
                      borderRadius: 3,
                      border: "1px solid",
                      borderColor: "divider",
                      bgcolor: isDark
                        ? "rgba(255,255,255,0.02)"
                        : "rgba(0,0,0,0.02)",
                    }}
                  >
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="flex-start"
                      sx={{ mb: 1.5 }}
                    >
                      <Box>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          fontWeight={800}
                          sx={{ textTransform: "uppercase" }}
                        >
                          Order Date
                        </Typography>
                        <Typography variant="body2" fontWeight={700}>
                          {dayjs(order.created_at).format(
                            "MMM D, YYYY - h:mm A",
                          )}
                        </Typography>
                      </Box>
                      <Chip
                        label={order.status.replace("_", " ")}
                        size="small"
                        color={
                          order.status === "delivered"
                            ? "success"
                            : order.status === "cancelled"
                              ? "error"
                              : "primary"
                        }
                        sx={{
                          fontWeight: 800,
                          textTransform: "uppercase",
                          fontSize: "0.6rem",
                        }}
                      />
                    </Stack>
                    <Stack spacing={0.5} sx={{ mb: 1.5 }}>
                      {order.items?.map((item, idx) => (
                        <Typography
                          key={idx}
                          variant="body2"
                          fontWeight={600}
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                          }}
                        >
                          <span>{item.name}</span>
                          <span style={{ opacity: 0.6 }}>×{item.quantity}</span>
                        </Typography>
                      ))}
                    </Stack>
                    <Box
                      sx={{
                        pt: 1,
                        borderTop: "1px dashed",
                        borderColor: "divider",
                      }}
                    >
                      <Button
                        size="small"
                        onClick={() => {
                          setExpandedOrders((prev) => {
                            const next = new Set(prev);
                            if (next.has(order.id)) next.delete(order.id);
                            else next.add(order.id);
                            return next;
                          });
                        }}
                        endIcon={
                          <ICONS.down
                            sx={{
                              transform: expandedOrders?.has(order.id)
                                ? "rotate(180deg)"
                                : "none",
                              transition: "0.2s",
                            }}
                          />
                        }
                        sx={{
                          textTransform: "none",
                          p: 0,
                          color: "text.secondary",
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          minHeight: 0,
                        }}
                      >
                        View Timeline
                      </Button>
                      <Collapse in={expandedOrders?.has(order.id)}>
                        <Box sx={{ pl: 0.5, pt: 2 }}>
                          {sortedHistory.map((h, i) => (
                            <Box
                              key={h.id}
                              sx={{
                                display: "flex",
                                gap: 1.5,
                                mb: i < sortedHistory.length - 1 ? 1.5 : 0,
                              }}
                            >
                              <Box
                                sx={{
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "center",
                                  mt: 0.5,
                                }}
                              >
                                <Box
                                  sx={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: "50%",
                                    bgcolor:
                                      i === sortedHistory.length - 1
                                        ? "primary.main"
                                        : "text.disabled",
                                  }}
                                />
                                {i < sortedHistory.length - 1 && (
                                  <Box
                                    sx={{
                                      width: 1,
                                      flex: 1,
                                      bgcolor: "divider",
                                      mt: 0.5,
                                      minHeight: 8,
                                    }}
                                  />
                                )}
                              </Box>
                              <Box>
                                <Stack
                                  direction="row"
                                  spacing={1}
                                  alignItems="center"
                                >
                                  <Typography
                                    variant="caption"
                                    fontWeight="700"
                                    sx={{ textTransform: "capitalize" }}
                                  >
                                    {h.status.replace("_", " ")}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    sx={{ fontSize: "0.55rem", opacity: 0.5 }}
                                  >
                                    {dayjs(h.changed_at).format(
                                      "MMM D, h:mm A",
                                    )}
                                  </Typography>
                                  {h.changed_by && (
                                    <Chip
                                      label={h.changed_by}
                                      size="small"
                                      variant="outlined"
                                      sx={(theme) => ({
                                        height: 14,
                                        fontSize: "0.5rem",
                                        fontWeight: 700,
                                        borderStyle: "dashed",
                                        bgcolor: alpha(theme.palette.primary.main, 0.05),
                                      })}
                                    />
                                  )}
                                </Stack>
                              </Box>
                            </Box>
                          ))}
                        </Box>
                      </Collapse>
                    </Box>
                  </Box>
                );
              })}
            </Stack>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}

function InfoItem({ label, value, icon, sx = {} }) {
  return (
    <Box sx={sx}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
        <Box
          sx={{
            color: "primary.main",
            display: "flex",
            alignItems: "center",
            minWidth: 22,
            opacity: 0.8,
          }}
        >
          {icon}
        </Box>
        <Typography
          variant="caption"
          sx={{
            color: "text.secondary",
            fontWeight: 700,
            textTransform: "uppercase",
            fontSize: "0.65rem",
            letterSpacing: 0.5,
          }}
        >
          {label}
        </Typography>
      </Stack>
      <Box sx={{ pl: "30px" }}>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            fontSize: "0.85rem",
            color: "text.primary",
            lineHeight: 1.4,
          }}
        >
          {value || "—"}
        </Typography>
      </Box>
    </Box>
  );
}
