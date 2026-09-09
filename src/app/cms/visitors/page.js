"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
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
import DynamicCustomField from "@/components/DynamicCustomField";
import VisitorDetailsDialog from "@/components/visitors/VisitorDetailsDialog";
import {
  ID_ALIASES,
  ID_TYPE_ALIASES,
  findFieldByAliases,
  collectSubtreeIds,
  computeVisibleFieldIds,
  getChildFieldIds,
  pickId,
  pickIdType,
  pickCountry,
} from "@/utils/customFieldUtils";
import { getVisitorUsers, getVisitorUserById, updateVisitorUser, createVisitorUser, mapUserToFrontend } from "@/services/userService";
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
import { validatePhone } from "@/utils/validationUtils";
import { visitorMatchesQuery } from "@/utils/visitorSearch";
import { formatActorLabel } from "@/utils/actorLabel";

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

// Merge field values across a visitor's full registration history — the
// most recent registration wins, but an older registration can still fill
// in a field (e.g. ID Number) that a later, leaner follow-up visit never
// re-collected. `registrations` is assumed newest-first (regs[0] latest).
function mergeFieldValuesAcrossHistory(registrations) {
  const merged = {};
  [...(registrations || [])].reverse().forEach((reg) => {
    const visible = getVisibleFieldValues(reg);
    Object.entries(visible).forEach(([key, val]) => {
      if (val != null && String(val).trim() !== "") {
        merged[key] = val;
      }
    });
  });
  return merged;
}

export default function VisitorsPage() {
  const { mode } = useColorMode();
  const isDark = mode === "dark";
  const { showMessage } = useMessage();
  const { lang } = useLanguage();
  const { user } = useAuth();
  const isKitchenAdmin =
    user?.role === "admin" && user?.adminType === "kitchen";
  const canCreateVisitor = canAccessResource(user, "visitors", {
    hardcodeAllowed: true,
    action: "create",
  });
  const canReadInternalNote = canAccessResource(user, "internal-notes", {
    action: "read",
  });

  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isListRefreshing, setIsListRefreshing] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(12);
  const [totalCount, setTotalCount] = useState(0);

  const [selected, setSelected] = useState(null);
  const [editModal, setEditModal] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [exportingXlsx, setExportingXlsx] = useState(false);
  const [activeCustomFields, setActiveCustomFields] = useState([]);
  const accountIdNoRef = useRef(null);
  const accountIdTypeRef = useRef(null);
  const [editCountryIsoCodes, setEditCountryIsoCodes] = useState({});
  const [phoneErrors, setPhoneErrors] = useState({});

  const [createModal, setCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    phoneIsoCode: DEFAULT_ISO_CODE,
  });
  const [createErrors, setCreateErrors] = useState({});
  const [createIdValues, setCreateIdValues] = useState({});
  const [createIdErrors, setCreateIdErrors] = useState({});
  const [createSubmitting, setCreateSubmitting] = useState(false);

  // ── Dynamic ID fields (from custom fields, dependent visibility like /register) ──
  const createIdSubtreeFields = useMemo(() => {
    if (!activeCustomFields.length) return [];
    const idTypeParent = findFieldByAliases(activeCustomFields, ID_TYPE_ALIASES);
    let subtreeIds;
    if (idTypeParent) {
      subtreeIds = collectSubtreeIds(idTypeParent, activeCustomFields);
    } else {
      const standalone = findFieldByAliases(activeCustomFields, ID_ALIASES);
      subtreeIds = standalone ? new Set([standalone.id]) : new Set();
    }
    if (!subtreeIds.size) return [];
    const visibleIds = computeVisibleFieldIds(activeCustomFields, createIdValues);
    return activeCustomFields.filter(
      (f) => subtreeIds.has(f.id) && visibleIds.has(f.id),
    );
  }, [activeCustomFields, createIdValues]);

  const createForcedRequiredIds = useMemo(() => {
    const forced = new Set();
    if (!activeCustomFields.length) return forced;
    const visibleIds = computeVisibleFieldIds(activeCustomFields, createIdValues);
    activeCustomFields.filter((f) => visibleIds.has(f.id)).forEach((parent) => {
      const deps = parent.dependentsJson || parent.dependents_json;
      if (!deps) return;
      const val = createIdValues[parent.fieldKey || parent.field_key];
      if (val && deps[val]?.areAllRequired) {
        getChildFieldIds(deps[val]).forEach((id) => forced.add(id));
      }
    });
    return forced;
  }, [activeCustomFields, createIdValues]);

  const fetchVisitors = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setIsListRefreshing(true);
    try {
      const BATCH_SIZE = 50;
      const result = await getVisitorUsers({ page: 1, limit: BATCH_SIZE });
      setAllRows(result.data || []);
      setTotalCount(result.total || 0);
      if (result.total > BATCH_SIZE) {
        setIsStreaming(true);
      }
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

      // When switching the ID-type select, re-seed the account's document
      // number into the newly-visible child ID field so it stays filled.
      if (field && accountIdNoRef.current) {
        const norm = (s = "") => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
        const isIdType = findFieldByAliases([field], ID_TYPE_ALIASES);
        if (isIdType && value) {
          const idKeySet = new Set(ID_ALIASES.map((a) => norm(a)));
          const depCfg = field.dependentsJson?.[value];
          const childIds = Array.isArray(depCfg) ? depCfg : depCfg?.fieldIds || [];
          for (const childId of childIds) {
            const child = activeCustomFields.find((f) => f.id === childId);
            const ckey = child?.fieldKey || child?.field_key;
            if (child && ckey && idKeySet.has(norm(ckey))) {
              updated[ckey] = accountIdNoRef.current;
            }
          }
        }
      }

      const nk = key.toLowerCase().replace(/[^a-z]/g, "");
      const userFieldMap = {
        fullname: "fullName",
        full_name: "fullName",
        email: "email",
        phone: "phone",
      };
      const extra = userFieldMap[nk] ? { [userFieldMap[nk]]: value } : {};
      return { ...prev, fieldValues: updated, ...extra };
    });
  };

  // ── Socket listeners for visitor create/update ──
  const { on } = useSocket();

  // ── Socket progressive loading ──
  useEffect(() => {
    const unsub = on("visitors:progress", (payload) => {
      if (payload.data?.length) {
        const mapped = payload.data.map(mapUserToFrontend);
        setAllRows((prev) => {
          const existing = new Set(prev.map((v) => v.id));
          const fresh = mapped.filter((v) => !existing.has(v.id));
          return fresh.length ? [...prev, ...fresh] : prev;
        });
      }
      if (payload.loaded >= payload.total) {
        setIsStreaming(false);
      }
    });
    return unsub;
  }, [on]);

  useEffect(() => {
    const unsubNew = on("visitor:new", (newVisitor) => {
      if (!newVisitor?.id) {
        fetchVisitors({ silent: true });
        return;
      }
      setAllRows((prev) => {
        const exists = prev.some((v) => v.id === newVisitor.id);
        if (exists) return prev;
        return [newVisitor, ...prev];
      });
    });

    const unsubUpdated = on("visitor:updated", (updatedVisitor) => {
      if (!updatedVisitor?.id) return;
      setAllRows((prev) =>
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

  const filtered = useMemo(
    () => allRows.filter((v) => visitorMatchesQuery(v, search)),
    [allRows, search],
  );

  const pagedRows = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, page, rowsPerPage]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));

  const handleOpenDetail = (visitor) => {
    setSelected(visitor);
  };

  const closeProfileDialog = () => setSelected(null);

  // Deep-link from the Recent Activity page (/?visitor=<userId>) — open that
  // visitor's details overlay on load.
  const searchParams = useSearchParams();
  const deepVisitorId = searchParams?.get("visitor") || null;
  const openedDeepVisitorRef = useRef(null);
  useEffect(() => {
    if (!deepVisitorId || openedDeepVisitorRef.current === deepVisitorId) return;
    openedDeepVisitorRef.current = deepVisitorId;
    handleOpenDetail({ id: deepVisitorId });
  }, [deepVisitorId]);

  const handleEdit = async (visitor) => {
    let fvMap = {};
    let latestRegId = null;
    try {
      const regs = await getRegistrations(null, {}, visitor.id);
      const list = Array.isArray(regs) ? regs : [];
      const latest = list.length > 0 ? list[0] : null;
      if (latest) latestRegId = latest.id;

      // Merge across the visitor's full registration history — a field like
      // ID Number might only have been captured on an older registration,
      // not the latest one, if a later follow-up visit didn't re-collect it.
      // Mirrors handleOpenDetail's merge so Edit and View stay consistent.
      fvMap = mergeFieldValuesAcrossHistory(list);

      // Final fallback to the shared visitor profile for the base identity
      // fields, in case no registration in history carries them at all.
      if (!fvMap.full_name && visitor.fullName) fvMap.full_name = visitor.fullName;
      if (!fvMap.email && visitor.email) fvMap.email = visitor.email;
      if (!fvMap.phone && visitor.phone) fvMap.phone = visitor.phone;

      // Seed the account-level document number + type into the edit form's ID-type
      // select and its dependent ID field, so Edit is consistent with the card/
      // Details header. The ID custom field is a child of the ID-type select —
      // it only renders once a matching type is chosen.
      accountIdNoRef.current = visitor.idNo || null;
      accountIdTypeRef.current = visitor.idType || null;

      if (visitor.idNo) {
        const norm = (s = "") => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
        const idTypeParent = findFieldByAliases(activeCustomFields, ID_TYPE_ALIASES);
        const typeKey = idTypeParent?.fieldKey || idTypeParent?.field_key;
        if (idTypeParent && typeKey && !fvMap[typeKey]) {
          const opts = Array.isArray(idTypeParent.optionsJson)
            ? idTypeParent.optionsJson
            : [];
          // Resolve a selectable type: prefer one matching the stored bucket,
          // else the first option.
          let chosenType = null;
          if (accountIdTypeRef.current && opts.length) {
            const bucket = norm(accountIdTypeRef.current);
            chosenType =
              opts.find((o) => {
                const on = norm(o);
                return on === bucket || on.includes(bucket) || bucket.includes(on);
              }) || opts[0];
          } else if (opts.length) {
            chosenType = opts[0];
          }
          if (chosenType) {
            fvMap[typeKey] = chosenType;
            // Put the document number into the ID child field for that type.
            const depCfg = idTypeParent.dependentsJson?.[chosenType];
            const childIds = Array.isArray(depCfg) ? depCfg : depCfg?.fieldIds || [];
            const idKeySet = new Set(
              ID_ALIASES.map((a) => norm(a)),
            );
            for (const childId of childIds) {
              const child = activeCustomFields.find((f) => f.id === childId);
              const ckey = child?.fieldKey || child?.field_key;
              if (child && ckey && idKeySet.has(norm(ckey))) {
                fvMap[ckey] = visitor.idNo;
              }
            }
          }
        } else if (!idTypeParent) {
          // No type select — seed any standalone ID field directly.
          const idKeySet = new Set(
            ID_ALIASES.map((a) => String(a).toLowerCase().replace(/[^a-z0-9]/g, "")),
          );
          for (const f of activeCustomFields) {
            const key = f.fieldKey || f.field_key;
            const k = String(key || "").toLowerCase().replace(/[^a-z0-9]/g, "");
            if (idKeySet.has(k) && !fvMap[key]) fvMap[key] = visitor.idNo;
          }
        }
      }

      setEditCountryIsoCodes(
        buildEditCountryIsoCodes(latest || {}, activeCustomFields),
      );
    } catch {}
    setEditModal({ ...visitor, _latestRegId: latestRegId });
    setPhoneErrors({});
    setEditForm({
      fullName: fvMap["full_name"] || visitor.fullName || "",
      email: fvMap["email"] || visitor.email || "",
      phone: fvMap["phone"] || visitor.phone || "",
      phoneIsoCode: visitor.phoneIsoCode || visitor.phone_iso_code || "",
      status: visitor.status || "active",
      fieldValues: fvMap,
    });
  };

  const handleSaveEdit = async () => {
    if (!editModal) return;
    const activePhoneErrors = Object.values(phoneErrors).filter(Boolean);
    if (activePhoneErrors.length > 0) {
      showMessage("Please fix invalid phone numbers before saving.", "warning");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        full_name: editForm.fullName ?? editModal.fullName,
        email: editForm.email ?? "",
        phone: editForm.phone ?? "",
        phoneIsoCode: editForm.phoneIsoCode || "",
        status: editForm.status || "active",
        idNo: pickId(editForm?.fieldValues) || undefined,
        idType: pickIdType(editForm?.fieldValues) || undefined,
        idCountry: pickCountry(editForm?.fieldValues) || undefined,
      };
      const userResult = await updateVisitorUser(editModal.id, payload);
      if (userResult?.error) return;
      if (editModal._latestRegId) {
        const fieldValues = editForm?.fieldValues;
        if (fieldValues && Object.keys(fieldValues).length > 0) {
          const regResult = await updateRegistration(editModal._latestRegId, {
            fieldValues,
          });
          if (regResult?.error) return;
        }
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

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(1);
  };

  const openCreateDialog = () => {
    setCreateForm({
      full_name: "",
      email: "",
      phone: "",
      phoneIsoCode: DEFAULT_ISO_CODE,
    });
    setCreateErrors({});
    setCreateIdValues({});
    setCreateIdErrors({});
    setCreateModal(true);
  };

  const handleCreateChange = (key, value) => {
    setCreateForm((prev) => ({ ...prev, [key]: value }));
    if (createErrors[key]) {
      setCreateErrors((prev) => ({ ...prev, [key]: null }));
    }
  };

  const handleCreateIdChange = (key, value) => {
    setCreateIdValues((prev) => {
      const updated = { ...prev, [key]: value };
      const field = activeCustomFields.find(
        (f) => (f.fieldKey || f.field_key) === key,
      );
      if (field) clearHiddenChildren(field, value, updated, activeCustomFields);
      return updated;
    });
    if (createIdErrors[key]) {
      setCreateIdErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleSubmitCreate = async () => {
    const errors = {};
    const fullName = createForm.full_name.trim();
    const email = createForm.email.trim();
    const phone = createForm.phone.trim();
    const isoCode = createForm.phoneIsoCode || DEFAULT_ISO_CODE;

    if (!fullName) errors.full_name = "Full name is required";
    if (!email && !phone) {
    } else if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = "Invalid email address";
    }

    if (phone) {
      const phoneErr = validatePhone(phone, isoCode);
      if (phoneErr) errors.phone = phoneErr;
    }

    const idErrors = {};
    createIdSubtreeFields.forEach((f) => {
      const key = f.fieldKey || f.field_key;
      const isRequired =
        f.isRequired || f.is_required || createForcedRequiredIds.has(f.id);
      const val = createIdValues[key];
      const empty =
        val == null ||
        (typeof val === "string" && !val.trim()) ||
        (Array.isArray(val) && val.length === 0);
      if (isRequired && empty) idErrors[key] = `${f.label} is required`;
    });

    if (Object.keys(errors).length > 0 || Object.keys(idErrors).length > 0) {
      setCreateErrors(errors);
      setCreateIdErrors(idErrors);
      const bothIdentityMissing = !email && !phone;
      showMessage(
        bothIdentityMissing
          ? "Email or phone is required"
          : "Please fill in the required fields.",
        "warning",
      );
      return;
    }

    setCreateSubmitting(true);
    try {
      const result = await createVisitorUser({
        full_name: fullName,
        email,
        phone: phone || undefined,
        phoneIsoCode: isoCode || undefined,
        idNo: pickId(createIdValues) || undefined,
        idType: pickIdType(createIdValues) || undefined,
        idCountry: pickCountry(createIdValues) || undefined,
      });
      if (result?.error) return;
      showMessage("Visitor created", "success");
      setCreateModal(false);
      fetchVisitors(true);
    } finally {
      setCreateSubmitting(false);
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
            flexDirection: { xs: "column", sm: "row" },
            justifyContent: "space-between",
            alignItems: { xs: "stretch", sm: "center" },
            mt: 2,
            mb: 1,
            gap: 2,
          }}
        >
          <Box>
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
          {canCreateVisitor && (
            <Button
              variant="contained"
              startIcon={<ICONS.add />}
              onClick={openCreateDialog}
              sx={{
                whiteSpace: "nowrap",
                height: 40,
                borderRadius: 30,
                fontWeight: 700,
                px: 2.5,
                width: { xs: "100%", sm: "auto" },
              }}
            >
              Create
            </Button>
          )}
        </Box>

        <Divider sx={{ mb: 3 }} />

        <ListToolbar
          showingCount={pagedRows.length}
          totalCount={totalCount || filtered.length}
          searchSlot={
            <TextField
              fullWidth
              size="small"
              variant="outlined"
              placeholder="Search visitors..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              InputProps={{
                startAdornment: (
                  <ICONS.search fontSize="small" sx={{ mr: 1, opacity: 0.6 }} />
                ),
              }}
              sx={{ maxWidth: { md: 600 } }}
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
                {(visitor.idNo) && (
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
                      {visitor.idType || "ID"}
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
                      {visitor.idNo}
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
              page={page}
              onChange={(_, p) => setPage(p)}
              color="primary"
              size="small"
            />
          </Box>
        )}

        {/* Visitor details overlay (shared component) */}
        <VisitorDetailsDialog
          open={!!selected}
          visitorId={selected?.id}
          seed={selected}
          onClose={closeProfileDialog}
          canReadInternalNote={canReadInternalNote}
        />

        {/* ── Edit Visitor Dialog ── */}
        <Dialog
          open={!!editModal}
          onClose={() => setEditModal(null)}
          maxWidth="md"
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
                    const phoneErr = phoneErrors[field.fieldKey] || "";
                    return (
                      <TextField
                        key={field.fieldKey}
                        label={field.label}
                        fullWidth
                        value={val}
                        onChange={(e) => {
                          const digitsOnly = e.target.value.replace(/\D/g, "");
                          setVal(digitsOnly);
                          const err = digitsOnly
                            ? validatePhone(digitsOnly, isoCode) || ""
                            : "";
                          setPhoneErrors((prev) => ({
                            ...prev,
                            [field.fieldKey]: err,
                          }));
                        }}
                        type="tel"
                        error={!!phoneErr}
                        helperText={phoneErr || "Enter your phone number"}
                        InputProps={{
                          sx: { borderRadius: 2 },
                          startAdornment: (
                            <CountryCodeSelector
                              value={isoCode}
                              onChange={(iso) => {
                                setEditCountryIsoCodes((prev) => ({
                                  ...prev,
                                  [field.fieldKey]: iso,
                                }));
                                const currentVal = editForm?.fieldValues?.[field.fieldKey] || "";
                                const err = currentVal
                                  ? validatePhone(currentVal, iso) || ""
                                  : "";
                                setPhoneErrors((prev) => ({
                                  ...prev,
                                  [field.fieldKey]: err,
                                }));
                              }}
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
              startIcon={<ICONS.cancel />}
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
              Save
            </Button>
          </DialogActions>
        </Dialog>

        {/* ── Create Visitor Dialog ── */}
        <Dialog
          open={createModal}
          onClose={() => setCreateModal(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{ sx: { borderRadius: 4, overflow: "hidden" } }}
        >
          <DialogHeader title="Add Visitor" onClose={() => setCreateModal(false)} />
          <Divider />
          <DialogContent sx={{ p: 2.5 }}>
            <Stack spacing={2.5}>
              <TextField
                label="Full name"
                fullWidth
                value={createForm.full_name}
                onChange={(e) => handleCreateChange("full_name", e.target.value)}
                error={!!createErrors.full_name}
                helperText={createErrors.full_name || ""}
                InputProps={{ sx: { borderRadius: 2 } }}
              />
              <TextField
                label="Email"
                fullWidth
                type="email"
                value={createForm.email}
                onChange={(e) => handleCreateChange("email", e.target.value)}
                error={!!createErrors.email}
                helperText={createErrors.email || ""}
                InputProps={{ sx: { borderRadius: 2 } }}
              />
              <TextField
                label="Phone"
                fullWidth
                type="tel"
                value={createForm.phone}
                onChange={(e) => {
                  const digitsOnly = e.target.value.replace(/\D/g, "");
                  handleCreateChange("phone", digitsOnly);
                  if (createErrors.phone) {
                    setCreateErrors((prev) => ({ ...prev, phone: null }));
                  }
                }}
                error={!!createErrors.phone}
                helperText={createErrors.phone || ""}
                InputProps={{
                  sx: { borderRadius: 2 },
                  startAdornment: (
                    <CountryCodeSelector
                      value={createForm.phoneIsoCode}
                      onChange={(iso) =>
                        handleCreateChange("phoneIsoCode", iso)
                      }
                      lang={lang}
                      dir="ltr"
                    />
                  ),
                }}
              />
              {createIdSubtreeFields.length > 0 && (
                <Stack spacing={2.5}>
                  {createIdSubtreeFields.map((f) => {
                    const key = f.fieldKey || f.field_key;
                    const isRequired =
                      f.isRequired ||
                      f.is_required ||
                      createForcedRequiredIds.has(f.id);
                    return (
                      <DynamicCustomField
                        key={f.id || key}
                        field={f}
                        value={
                          createIdValues[key] !== undefined
                            ? createIdValues[key]
                            : ""
                        }
                        error={createIdErrors[key] || ""}
                        isRequired={isRequired}
                        onChange={handleCreateIdChange}
                        phoneIsoCode={DEFAULT_ISO_CODE}
                        lang={lang}
                      />
                    );
                  })}
                </Stack>
              )}
            </Stack>
          </DialogContent>
          <Divider />
          <DialogActions
            sx={{ p: 2.5, gap: 1, flexDirection: { xs: "column", sm: "row" } }}
          >
            <Button
              variant="outlined"
              onClick={() => setCreateModal(false)}
              disabled={createSubmitting}
              startIcon={<ICONS.cancel />}
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
              onClick={handleSubmitCreate}
              disabled={createSubmitting}
              startIcon={
                createSubmitting ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <ICONS.add />
                )
              }
              sx={{ borderRadius: 30, width: { xs: "100%", sm: "auto" } }}
            >
              Create
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </PermissionRouteGuard>
  );
}
