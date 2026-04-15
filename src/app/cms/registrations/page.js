"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import dayjs from "dayjs";
import {
  Box,
  Typography,
  Chip,
  IconButton,
  TextField,
  Stack,
  Tooltip,
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Divider,
  Avatar,
  MenuItem,
  Pagination,
  Select,
  InputLabel,
  CircularProgress,
  Alert,
  FormControl,
  Tabs,
  Tab,
  Switch,
  FormControlLabel,
  RadioGroup,
  Radio,
  useTheme,
  Collapse,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useColorMode } from "@/contexts/ThemeContext";
import { useMessage } from "@/contexts/MessageContext";
import { useSocket } from "@/contexts/SocketContext";
import { useAuth } from "@/contexts/AuthContext";
import { pdf } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { exportAllBadges } from "@/utils/exportBadges";
import {
  getCountryCodeByIsoCode,
  formatPhoneNumberForDisplay,
  DEFAULT_ISO_CODE,
  DEFAULT_COUNTRY_CODE,
} from "@/utils/countryCodes";
import CountryCodeSelector from "@/components/CountryCodeSelector";
import { isPhoneField } from "@/utils/validationUtils";
import { getDefaultBadgeTemplate } from "@/services/badgeService";
import { getCustomFields } from "@/services/customFieldService";
import BadgePDF from "@/components/badges/BadgePDF";
import ICONS from "@/utils/iconUtil";
import DateTimeFieldFlatpickr from "@/components/forms/DateTimeFieldFlatpickr";
import AppCard from "@/components/cards/AppCard";
import DialogHeader from "@/components/modals/DialogHeader";
import FilterModal from "@/components/modals/FilterModal";
import ListToolbar from "@/components/ListToolbar";
import LoadingState from "@/components/LoadingState";
import NoDataAvailable from "@/components/NoDataAvailable";
import PurposeOfVisitInput from "@/components/PurposeOfVisitInput";
import ResponsiveCardGrid from "@/components/ResponsiveCardGrid";
import {
  getRegistrations,
  updateStatus,
  getRegistrationById,
  updateRegistration,
  getRegistrationActivityLogs,
} from "@/services/registrationService";
import { getAccessLevels } from "@/services/accessLevelService";
import { getDepartments } from "@/services/departmentService";
import { getAllOrders as getKitchenOrders } from "@/services/kitchenService";
import {
  formatDate,
  formatTime,
  formatDateTimeWithLocale,
  getLocalDate,
  getLocalTime,
} from "@/utils/dateUtils";
// ── Status config ─────────────────────────────────────────────────────────────

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

const TERMINAL_STATUSES = new Set(["visit_ended", "rejected", "expired"]);

const ACTIVITY_LABELS = {
  submitted: "Submitted",
  admin_approved: "Dept. Approved",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
  nda_signed: "NDA Signed",
  qr_generated: "QR Generated",
  scanned: "QR Scanned",
  badge_printed: "Badge Printed",
  checked_in: "Checked In",
  checked_out: "Checked Out",
  visit_ended: "Visit Ended",
};

const ACTIVITY_COLORS = {
  submitted: "grey",
  admin_approved: "info",
  approved: "success",
  rejected: "error",
  cancelled: "grey",
  nda_signed: "primary",
  qr_generated: "primary",
  scanned: "primary",
  badge_printed: "primary",
  checked_in: "success",
  checked_out: "warning",
  visit_ended: "grey",
};

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = ["00", "15", "30", "45"];
const PERIODS = ["AM", "PM"];

const toTitleCase = (value) =>
  String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const buildScheduleText = (fromStr, toStr, emptyLabel = "Not scheduled yet") => {
  if (!fromStr && !toStr) return emptyLabel;
  const dateFromFormatted = formatDate(fromStr);
  const dateToFormatted = formatDate(toStr);
  let dateText = dateFromFormatted || "—";
  if (dateToFormatted && dateFromFormatted !== dateToFormatted) {
    dateText = `${dateFromFormatted} to ${dateToFormatted}`;
  }
  const timeFrom = formatTime(fromStr);
  const timeTo = formatTime(toStr);
  const timeParts = [timeFrom, timeTo].filter(Boolean);
  if (!timeParts.length) return dateText;
  return `${dateText}, ${timeParts.join(" - ")}`;
};

const normalizeFieldIdentifier = (value) =>
  String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");

const DEFAULT_FIELD_IDENTIFIERS = new Set([
  "fullname", "name", "email", "emailaddress", "phone",
  "phonenumber", "mobile", "contact", "purposeofvisit",
]);

const getVisibleFieldValues = (registration) =>
  (Array.isArray(registration?.fieldValues) ? registration.fieldValues : []).filter((fieldValue) => {
    const normalizedKey = normalizeFieldIdentifier(
      fieldValue?.customField?.fieldKey || fieldValue?.customField?.label,
    );
    const stringValue = String(fieldValue?.value ?? "").trim();
    return Boolean(stringValue) && !DEFAULT_FIELD_IDENTIFIERS.has(normalizedKey);
  });

const formatFieldDisplayValue = (value, inputType) => {
  if (inputType === "country" && value && typeof value === "string") {
    return getCountryCodeByIsoCode(value)?.country || value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter(Boolean).join(", ") || "-";
  }
  if (value && typeof value === "object") {
    return Object.values(value).map((item) => String(item ?? "").trim()).filter(Boolean).join(", ") || "-";
  }
  return String(value ?? "").trim() || "-";
};

// ── Allowed transitions per status and role ───────────────────────────────────

function getAllowedTransitions(currentStatus, role, allowMultiCheckin) {
  if (TERMINAL_STATUSES.has(currentStatus)) return [];
  const isSA = role === "superadmin";
  const isAdmin = role === "admin" || isSA;
  const isStaff = role === "staff" || isAdmin;

  switch (currentStatus) {
    case "pending":
      return [
        ...(isAdmin ? ["rejected", "cancelled"] : []),
      ];
    case "admin_approved":
      return [
        ...(isAdmin ? ["rejected", "cancelled"] : []),
      ];
    case "approved":
      return [
        ...(isStaff ? ["checked_in"] : []),
        ...(isAdmin ? ["cancelled"] : []),
      ];
    case "checked_in":
      return [...(isStaff ? ["checked_out"] : [])];
    case "checked_out":
      return [
        ...(isStaff && allowMultiCheckin ? ["checked_in"] : []),
        ...(isAdmin ? ["visit_ended"] : []),
      ];
    default:
      return [];
  }
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CmsRegistrationsPage() {
  const { mode } = useColorMode();
  const isDark = mode === "dark";
  const { user: currentUser } = useAuth();
  const userRole = currentUser?.role;
  const isSuperAdmin = userRole === "superadmin";

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [requestDateFilter, setRequestDateFilter] = useState("");
  const [requestTimeFilter, setRequestTimeFilter] = useState({ hour12: "", minute: "00", ampm: "AM", enabled: false });
  const [approvedDateFilter, setApprovedDateFilter] = useState("");
  const [approvedTimeFilter, setApprovedTimeFilter] = useState({ hour12: "", minute: "00", ampm: "AM", enabled: false });

  // Preset date range filter (sent to backend as createdAt range)
  const [datePreset, setDatePreset] = useState("all"); // "all" | "today" | "week" | "month" | "year" | "custom"
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [selected, setSelected] = useState(null);
  const [selectedTab, setSelectedTab] = useState("details");
  const [actionLoading, setActionLoading] = useState(false);
  const [fetchingProfile, setFetchingProfile] = useState(false);
  const [filterModalOpen, setFilterModalOpen] = useState(false);

  // Status transition modal
  const [statusModal, setStatusModal] = useState({ open: false, targetStatus: null });
  const [statusPayload, setStatusPayload] = useState({});
  const [statusPayloadErrors, setStatusPayloadErrors] = useState({});

  // Confirm modal (cancel / checkin / checkout / visit_ended)
  const [confirmModal, setConfirmModal] = useState({ open: false, targetStatus: null, message: "" });

  // Timeline modal
  const [timelineModal, setTimelineModal] = useState({ open: false });
  const [timelineLogs, setTimelineLogs] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineRegistrationId, setTimelineRegistrationId] = useState(null);

  // Edit modal
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [editCountryIsoCodes, setEditCountryIsoCodes] = useState({});
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editTab, setEditTab] = useState(0);

  // Supporting data
  const [accessLevels, setAccessLevels] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [activeCustomFields, setActiveCustomFields] = useState([]);

  const [exportingBadges, setExportingBadges] = useState(false);
  const [badgeTemplate, setBadgeTemplate] = useState(null);

  const [kitchenOrders, setKitchenOrders] = useState([]);
  const [kitchenOrdersLoading, setKitchenOrdersLoading] = useState(false);

  const { showMessage } = useMessage();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(12);

  // Compute from/to (YYYY-MM-DD Oman time) from the selected preset
  const getDateRangeFromPreset = (preset, cFrom, cTo) => {
    const omanNow = new Date(Date.now() + 4 * 60 * 60 * 1000);
    const pad = (n) => String(n).padStart(2, "0");
    const fmt = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    const today = fmt(omanNow);
    if (preset === "today") return { from: today, to: today };
    if (preset === "week") {
      const weekAgo = new Date(omanNow); weekAgo.setUTCDate(weekAgo.getUTCDate() - 6);
      return { from: fmt(weekAgo), to: today };
    }
    if (preset === "month") {
      const monthAgo = new Date(omanNow); monthAgo.setUTCMonth(monthAgo.getUTCMonth() - 1);
      return { from: fmt(monthAgo), to: today };
    }
    if (preset === "year") {
      const yearStart = `${omanNow.getUTCFullYear()}-01-01`;
      return { from: yearStart, to: today };
    }
    if (preset === "custom") return { from: cFrom || undefined, to: cTo || undefined };
    return { from: undefined, to: undefined }; // "all"
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const { from, to } = getDateRangeFromPreset(datePreset, customFrom, customTo);
      const res = await getRegistrations(statusFilter, { from, to });
      setData(res || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchDefaultBadgeTemplate();
    getAccessLevels().then((res) => setAccessLevels(Array.isArray(res) ? res : []));
    getDepartments().then((res) => setDepartments(Array.isArray(res) ? res : []));
    getCustomFields().then((fields) => setActiveCustomFields(Array.isArray(fields) ? fields.filter((f) => f.isActive) : []));
  }, [statusFilter, datePreset, customFrom, customTo]);

  const fetchDefaultBadgeTemplate = async () => {
    const template = await getDefaultBadgeTemplate();
    if (template && !template.error) setBadgeTemplate(template);
  };

  const { on } = useSocket();

  useEffect(() => {
    const unsubNew = on("registration:new", () => fetchData());
    const unsubUpdated = on("registration:updated", (updatedReg) => {
      // Replace the item in the list in-place — avoids full refetch and flash
      setData((prev) => {
        const idx = prev.findIndex((r) => r.id === updatedReg.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = updatedReg;
          return next;
        }
        // Not in the list (e.g. filtered out) — just re-fetch
        fetchData();
        return prev;
      });
      if (selected?.id === updatedReg.id) {
        getRegistrationById(updatedReg.id).then((fullDetail) => {
          setSelected(fullDetail);
          fetchKitchenOrders(updatedReg.id);
        });
      }
    });
    
    const unsubKitchenStatus = on("kitchen-order:updated", (updatedOrder) => {
      if (selected && (updatedOrder.registrationId === selected.id || updatedOrder.registration_id === selected.id)) {
        fetchKitchenOrders(selected.id);
      }
    });

    const unsubKitchenNew = on("kitchen-order:new", (newOrder) => {
      if (selected && (newOrder.registrationId === selected.id || newOrder.registration_id === selected.id)) {
        fetchKitchenOrders(selected.id);
      }
    });

    return () => { 
      unsubNew?.(); 
      unsubUpdated?.(); 
      unsubKitchenStatus?.();
      unsubKitchenNew?.();
    };
  }, [selected?.id, on]);

  useEffect(() => {
    if (selected) {
      setSelectedTab("details");
      fetchKitchenOrders(selected.id);
    }
  }, [selected?.id]);

  const fetchKitchenOrders = async (regId) => {
    setKitchenOrdersLoading(true);
    try {
      const res = await getKitchenOrders({ registrationId: regId });
      setKitchenOrders(Array.isArray(res) ? res : []);
    } finally {
      setKitchenOrdersLoading(false);
    }
  };

  const closeProfileDialog = () => setSelected(null);

  const handleOpenProfile = useCallback(async (row) => {
    setFetchingProfile(true);
    try {
      const fullDetail = await getRegistrationById(row.id);
      setSelected(fullDetail);
    } finally {
      setFetchingProfile(false);
    }
  }, []);

  // ── Status transition helpers ─────────────────────────────────────────────

  const openStatusTransition = (targetStatus) => {
    const needsModal = ["admin_approved", "approved", "rejected"].includes(targetStatus);
    const needsConfirm = ["cancelled", "checked_in", "checked_out", "visit_ended"].includes(targetStatus);

    if (needsModal) {
      // Pre-fill dates from existing data
      const preFrom = selected?.approved_from || selected?.requested_from || "";
      const preTo = selected?.approved_to || selected?.requested_to || "";
      setStatusPayload({
        accessLevelId: selected?.access_level_id || selected?.accessLevelId || "",
        approvedFrom: preFrom,
        approvedTo: preTo,
        allowMultiCheckin: selected?.allow_multi_checkin ?? false,
        rejectionReason: "",
      });
      setStatusPayloadErrors({});
      setStatusModal({ open: true, targetStatus });
      return;
    }

    if (needsConfirm) {
      const isTerminal = targetStatus === "visit_ended";
      const messages = {
        cancelled: "Are you sure you want to cancel this registration?",
        checked_in: "Confirm check-in for this visitor?",
        checked_out: "Confirm check-out for this visitor?",
        visit_ended:
          "⚠️ You are about to mark this visit as ended. This is a terminal status — no further changes will be possible. Are you sure?",
      };
      setConfirmModal({ open: true, targetStatus, message: messages[targetStatus], isTerminal });
      return;
    }
  };

  const validateStatusPayload = (targetStatus) => {
    const e = {};
    if (targetStatus === "admin_approved") {
      if (!statusPayload.accessLevelId) e.accessLevelId = "Access level is required";
    }
    if (targetStatus === "rejected") {
      if (!statusPayload.rejectionReason?.trim()) e.rejectionReason = "Rejection reason is required";
    }
    return e;
  };

  const executeStatusChange = async (targetStatus, payload = {}) => {
    if (!selected?.id) return;
    setActionLoading(true);
    try {
      await updateStatus(selected.id, { status: targetStatus, ...payload });
      const updated = await getRegistrationById(selected.id);
      setSelected(updated);
      await fetchData();
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusModalConfirm = async () => {
    const { targetStatus } = statusModal;
    const e = validateStatusPayload(targetStatus);
    if (Object.keys(e).length) { setStatusPayloadErrors(e); return; }

    const payload = {};
    if (targetStatus === "rejected") {
      payload.rejectionReason = statusPayload.rejectionReason.trim();
    } else {
      if (statusPayload.accessLevelId) payload.accessLevelId = statusPayload.accessLevelId;
      if (statusPayload.approvedFrom) payload.approvedFrom = statusPayload.approvedFrom;
      if (statusPayload.approvedTo) payload.approvedTo = statusPayload.approvedTo;
      payload.allowMultiCheckin = statusPayload.allowMultiCheckin ?? false;
    }

    setStatusModal({ open: false, targetStatus: null });
    await executeStatusChange(targetStatus, payload);
  };

  const handleConfirmModalConfirm = async () => {
    const { targetStatus } = confirmModal;
    setConfirmModal({ open: false, targetStatus: null, message: "" });
    await executeStatusChange(targetStatus);
  };

  // ── Timeline ──────────────────────────────────────────────────────────────

  const openTimeline = async (registrationId, visitorName) => {
    setTimelineRegistrationId(registrationId);
    setTimelineLogs([]);
    setTimelineModal({ open: true, visitorName });
    setTimelineLoading(true);
    try {
      const logs = await getRegistrationActivityLogs(registrationId);
      setTimelineLogs(Array.isArray(logs) ? logs : []);
    } finally {
      setTimelineLoading(false);
    }
  };

  // ── Edit registration ─────────────────────────────────────────────────────

  const buildEditForm = (reg) => {
    const fvMap = {};
    if (Array.isArray(reg.fieldValues)) {
      reg.fieldValues.forEach((fv) => {
        const key = fv.customField?.fieldKey || fv.customField?.field_key;
        if (key) fvMap[key] = fv.value;
      });
    }
    const hasApproved = !!(reg.approved_from || reg.approved_to);
    return {
      id: reg.id,
      departmentId: reg.department_id || reg.departmentId || "",
      purposeOfVisit: reg.purpose_of_visit || reg.purposeOfVisit || "",
      scheduleFrom: hasApproved ? (reg.approved_from || "") : (reg.requested_from || ""),
      scheduleTo: hasApproved ? (reg.approved_to || "") : (reg.requested_to || ""),
      hasApproved,
      accessLevelId: hasApproved ? (reg.access_level_id || reg.accessLevelId || "") : "",
      allowMultiCheckin: hasApproved ? (reg.allow_multi_checkin ?? reg.allowMultiCheckin ?? false) : false,
      fieldValues: fvMap,
    };
  };

  const buildEditCountryIsoCodes = (reg, fields) => {
    const isoCodes = {};
    if (!fields) return isoCodes;
    const fvMap = {};
    if (Array.isArray(reg.fieldValues)) {
      reg.fieldValues.forEach((fv) => {
        const key = fv.customField?.fieldKey || fv.customField?.field_key;
        if (key) fvMap[key] = fv.value;
      });
    }
    fields.forEach((field) => {
      if (isPhoneField(field)) {
        // Use the registration's stored isoCode if available, otherwise default
        isoCodes[field.fieldKey] = (reg.phoneIsoCode || reg.phone_iso_code || DEFAULT_ISO_CODE).toLowerCase();
      }
    });
    return isoCodes;
  };

  const handleCardEdit = useCallback(async (row) => {
    setFetchingProfile(true);
    try {
      const fullDetail = await getRegistrationById(row.id);
      setEditForm(buildEditForm(fullDetail));
      setEditCountryIsoCodes(buildEditCountryIsoCodes(fullDetail, activeCustomFields));
      setEditTab(0);
      setEditModal(true);
    } finally {
      setFetchingProfile(false);
    }
  }, [activeCustomFields]);

  const openEditModal = (reg = selected) => {
    if (!reg) return;
    setEditForm(buildEditForm(reg));
    setEditCountryIsoCodes(buildEditCountryIsoCodes(reg, activeCustomFields));
    setEditTab(0);
    setEditModal(true);
  };

  const handleEditSubmit = async () => {
    if (!editForm.id) return;
    setEditSubmitting(true);
    try {
      // Derive phoneIsoCode from the first phone-type custom field that has a value
      const phoneField = activeCustomFields.find((f) => isPhoneField(f));
      const phoneIsoCode = phoneField ? (editCountryIsoCodes[phoneField.fieldKey] || DEFAULT_ISO_CODE) : undefined;

      const payload = {
        purposeOfVisit: editForm.purposeOfVisit,
        departmentId: editForm.departmentId || undefined,
        fieldValues: editForm.fieldValues,
        ...(phoneIsoCode ? { phoneIsoCode } : {}),
      };
      if (editForm.hasApproved) {
        if (editForm.scheduleFrom) payload.approvedFrom = editForm.scheduleFrom;
        if (editForm.scheduleTo) payload.approvedTo = editForm.scheduleTo;
        if (editForm.accessLevelId) payload.accessLevelId = editForm.accessLevelId;
        payload.allowMultiCheckin = editForm.allowMultiCheckin ?? false;
      } else {
        if (editForm.scheduleFrom) payload.requestedFrom = editForm.scheduleFrom;
        if (editForm.scheduleTo) payload.requestedTo = editForm.scheduleTo;
      }
      await updateRegistration(editForm.id, payload);
      if (selected?.id === editForm.id) {
        const updated = await getRegistrationById(editForm.id);
        setSelected(updated);
      }
      await fetchData();
      setEditModal(false);
    } finally {
      setEditSubmitting(false);
    }
  };

  // ── Badge printing ────────────────────────────────────────────────────────

  const handlePrintBadge = async (registration) => {
    if (!registration?.qr_token) {
      showMessage("No QR token available for this registration", "warning");
      return;
    }
    const qrCodeDataUrl = await QRCode.toDataURL(registration.qr_token || "N/A", {
      width: 300, margin: 1, color: { dark: "#000000", light: "#ffffff" },
    });
    const rawFieldValues = registration.field_values || registration.fieldValues || [];
    const fieldValues = {};
    if (Array.isArray(rawFieldValues)) {
      rawFieldValues.forEach((fv) => {
        const key = fv.customField?.fieldKey || fv.custom_field?.field_key;
        if (key) fieldValues[key] = fv.value;
      });
    } else if (typeof rawFieldValues === "object") {
      Object.assign(fieldValues, rawFieldValues);
    }
    const badgeData = {
      fullName: fieldValues["full_name"] || fieldValues["name"] || registration.full_name || "Unnamed Visitor",
      company: fieldValues["company_name"] || fieldValues["organization"] || fieldValues["company"] || registration.organisation || registration.companyName || registration.user?.companyName || "",
      email: fieldValues["email"] || fieldValues["email_address"] || registration.email || "",
      phone: fieldValues["phone"] || fieldValues["phone_number"] || fieldValues["mobile"] || registration.phone || "",
      purposeOfVisit: fieldValues["purpose_of_visit"] || fieldValues["purpose"] || registration.purpose_of_visit || "",
      hostName: registration.host_name || "",
      requestedDate: getLocalDate(registration.requested_from),
      requestedTimeFrom: getLocalTime(registration.requested_from),
      requestedTimeTo: getLocalTime(registration.requested_to),
      badgeIdentifier: registration.badge_identifier || "",
      token: registration.qr_token || "N/A",
      showQrOnBadge: true,
      fieldValues,
    };
    const doc = <BadgePDF data={badgeData} qrCodeDataUrl={qrCodeDataUrl} customizations={badgeTemplate?.layoutJson} />;
    const blob = await pdf(doc).toBlob();
    const blobUrl = URL.createObjectURL(blob);
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
      const printWindow = window.open(blobUrl, "_blank");
      if (!printWindow) { showMessage("Please allow pop-ups to print the badge.", "warning"); return; }
      printWindow.onload = () => { printWindow.focus(); printWindow.print(); };
      return;
    }
    const width = Math.floor(window.outerWidth * 0.9);
    const height = Math.floor(window.outerHeight * 0.9);
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const printWindow = window.open("", "_blank", `width=${width},height=${height},left=${left},top=${top},resizable=no,scrollbars=no,status=no`);
    if (!printWindow) { showMessage("Please allow pop-ups to print the badge.", "warning"); return; }
    printWindow.document.write(`<html><head><title>Print Badge - ${badgeData.fullName}</title><style>html,body{margin:0;padding:0;height:100%;overflow:hidden;background:#fff;}iframe{width:100%;height:100%;border:none;}</style></head><body><iframe src="${blobUrl}" onload="this.contentWindow.focus();this.contentWindow.print();"></iframe></body></html>`);
    printWindow.document.close();
  };

  const handleExportAllBadges = async () => {
    if (!filtered.length) { showMessage("No registrations to export", "warning"); return; }
    setExportingBadges(true);
    await exportAllBadges(filtered, badgeTemplate, `badges_${new Date().toISOString().split("T")[0]}.pdf`);
    setExportingBadges(false);
    showMessage("Badges exported successfully", "success");
  };

  // ── Filtering / pagination ────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const matched = Array.isArray(data) ? data.filter((r) => {
      const matchSearch = [r.full_name, r.email, r.purpose_of_visit].join(" ").toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || r.status === statusFilter;

      const filterBySchedule = (filterDate, filterTime, fromField, toField) => {
        if (!filterDate && !filterTime.enabled) return true;
        const fromDateStr = getLocalDate(fromField);
        const toDateStr = getLocalDate(toField);
        if (filterDate) {
          const fDate = typeof filterDate === "string" ? filterDate : getLocalDate(filterDate);
          if (fDate < fromDateStr || fDate > toDateStr) return false;
        }
        if (filterTime.enabled && filterTime.hour12) {
          const fTime24 = `${String(filterTime.ampm === "PM" ? (parseInt(filterTime.hour12) % 12) + 12 : parseInt(filterTime.hour12) % 12).padStart(2, "0")}:${filterTime.minute}:00`;
          const fromTime = getLocalTime(fromField) + ":00";
          const toTime = getLocalTime(toField) + ":00";
          if (fromDateStr === toDateStr) {
            if (fTime24 < fromTime || fTime24 > toTime) return false;
          } else {
            const fDate = typeof filterDate === "string" ? filterDate : getLocalDate(filterDate);
            if (fDate === fromDateStr && fTime24 < fromTime) return false;
            if (fDate === toDateStr && fTime24 > toTime) return false;
          }
        }
        return true;
      };

      const matchRequest = filterBySchedule(requestDateFilter, requestTimeFilter, r.requested_from, r.requested_to);
      const matchApproved = filterBySchedule(approvedDateFilter, approvedTimeFilter, r.approved_from, r.approved_to);
      return matchSearch && matchStatus && matchRequest && matchApproved;
    }) : [];

    const uniqueByVisitor = [];
    const seenEmails = new Set();
    const sortedMatched = [...matched].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    for (const r of sortedMatched) {
      const visitorKey = r.email?.toLowerCase() || r.id;
      if (!seenEmails.has(visitorKey)) {
        seenEmails.add(visitorKey);
        uniqueByVisitor.push(r);
      }
    }
    return uniqueByVisitor;
  }, [data, search, statusFilter, requestDateFilter, requestTimeFilter, approvedDateFilter, approvedTimeFilter]);

  const pagedRows = useMemo(() => filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage), [filtered, page, rowsPerPage]);

  const previousVisits = useMemo(() => {
    if (!Array.isArray(selected?.history)) return [];
    const { from, to } = getDateRangeFromPreset(datePreset, customFrom, customTo);
    return selected.history
      .filter((v) => {
        if (!v?.id || v.id === selected.id) return false;
        if (from || to) {
          const createdAt = v.created_at ? new Date(v.created_at) : null;
          if (!createdAt) return true;
          if (from && createdAt < new Date(`${from}T00:00:00.000+04:00`)) return false;
          if (to   && createdAt > new Date(`${to}T23:59:59.999+04:00`))   return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [selected, datePreset, customFrom, customTo]);

  const additionalFieldValues = useMemo(() => getVisibleFieldValues(selected), [selected]);

  const allowedTransitions = useMemo(
    () => getAllowedTransitions(selected?.status, userRole, selected?.allow_multi_checkin ?? selected?.allowMultiCheckin),
    [selected?.status, userRole, selected?.allow_multi_checkin, selected?.allowMultiCheckin],
  );

  const activeFiltersCount =
    (statusFilter !== "all" ? 1 : 0) +
    (datePreset !== "all" ? 1 : 0) +
    (requestDateFilter ? 1 : 0) +
    (requestTimeFilter.enabled ? 1 : 0) +
    (approvedDateFilter ? 1 : 0) +
    (approvedTimeFilter.enabled ? 1 : 0);

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
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
          <Typography variant="h5" fontWeight="bold">Registrations</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, opacity: 0.8 }}>
            View and manage all visitor registrations across your system.
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ mb: 3 }} />

      {/* ── Preset date range filter bar ────────────────────────────────────── */}
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ mb: 2, gap: 1 }}>
        {[
          { key: "all", label: "All Time" },
          { key: "today", label: "Today" },
          { key: "week", label: "This Week" },
          { key: "month", label: "This Month" },
          { key: "year", label: "This Year" },
          { key: "custom", label: "Custom" },
        ].map(({ key, label }) => (
          <Chip
            key={key}
            label={label}
            size="small"
            clickable
            color={datePreset === key ? "primary" : "default"}
            variant={datePreset === key ? "filled" : "outlined"}
            onClick={() => { setDatePreset(key); setPage(0); }}
            sx={{ fontWeight: 700, borderRadius: 2 }}
          />
        ))}
        {datePreset === "custom" && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap", gap: 1 }}>
            <TextField
              type="date"
              size="small"
              label="From"
              InputLabelProps={{ shrink: true }}
              value={customFrom}
              onChange={(e) => { setCustomFrom(e.target.value); setPage(0); }}
              sx={{ width: 160 }}
              inputProps={{ max: customTo || undefined }}
            />
            <TextField
              type="date"
              size="small"
              label="To"
              InputLabelProps={{ shrink: true }}
              value={customTo}
              onChange={(e) => { setCustomTo(e.target.value); setPage(0); }}
              sx={{ width: 160 }}
              inputProps={{ min: customFrom || undefined }}
            />
          </Stack>
        )}
      </Stack>

      <ListToolbar
        selectedCount={0}
        showingCount={pagedRows.length}
        totalCount={filtered.length}
        sx={{
          gridTemplateColumns: {
            xs: "1fr",
            md: (search || statusFilter !== "all" || requestDateFilter || approvedDateFilter || requestTimeFilter.enabled || approvedTimeFilter.enabled)
              ? "minmax(0, 0.6fr) minmax(280px, 400px) minmax(0, 1.4fr)"
              : "minmax(0, 1fr) minmax(280px, 420px) minmax(0, 1fr)",
          },
        }}
        searchSlot={
          <TextField
            fullWidth
            size="small"
            variant="outlined"
            placeholder="Search name, email, purpose..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            InputProps={{ startAdornment: <ICONS.search fontSize="small" sx={{ mr: 1, opacity: 0.6 }} /> }}
            sx={{ maxWidth: { md: 380 } }}
          />
        }
        actionsSlot={
          <>
            <Button variant="outlined" startIcon={<ICONS.filter />} onClick={() => setFilterModalOpen(true)} sx={{ minWidth: { md: 120 }, whiteSpace: "nowrap", height: 40 }}>
              Filters {activeFiltersCount > 0 && `(${activeFiltersCount})`}
            </Button>
            {data.length > 0 && (
              <Button
                variant="outlined"
                color="primary"
                disabled={exportingBadges || filtered.length === 0}
                startIcon={exportingBadges ? <CircularProgress size={20} color="inherit" /> : <ICONS.print />}
                onClick={handleExportAllBadges}
                sx={{ minWidth: 140, whiteSpace: "nowrap" }}
              >
                {exportingBadges ? "Exporting..." : "Export Badges"}
              </Button>
            )}
            {(search || statusFilter !== "all" || requestDateFilter || approvedDateFilter) && (
              <Tooltip title="Clear All Filters">
                <Button
                  size="small"
                  color="secondary"
                  startIcon={<ICONS.close />}
                  onClick={() => {
                    setSearch(""); setStatusFilter("all"); setDatePreset("all");
                    setCustomFrom(""); setCustomTo("");
                    setRequestDateFilter("");
                    setRequestTimeFilter({ ...requestTimeFilter, enabled: false });
                    setApprovedDateFilter(""); setApprovedTimeFilter({ ...approvedTimeFilter, enabled: false });
                    setPage(0);
                  }}
                >
                  Clear
                </Button>
              </Tooltip>
            )}
            <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 160 } }}>
              <InputLabel>Records per page</InputLabel>
              <Select value={rowsPerPage} onChange={handleChangeRowsPerPage} label="Records per page">
                {[6, 12, 24, 48].map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
              </Select>
            </FormControl>
          </>
        }
      />

      {loading ? (
        <LoadingState />
      ) : (
        <>
          {pagedRows.length === 0 ? (
            <NoDataAvailable title="No records found" description="Try adjusting your filters or search query." />
          ) : (
            <ResponsiveCardGrid>
              {pagedRows.map((row) => {
                const config = STATUS_CONFIG[row.status] || { label: row.status, color: "default", icon: <ICONS.info fontSize="small" /> };
                return (
                  <AppCard key={row.id} sx={{ opacity: fetchingProfile ? 0.7 : 1, height: "100%", width: "100%" }}>
                    <Box
                      sx={{
                        background: isDark ? "linear-gradient(to right, rgba(255,255,255,0.05), rgba(255,255,255,0.08))" : "linear-gradient(to right, #f5f5f5, #fafafa)",
                        borderBottom: "1px solid", borderColor: "divider", p: 2,
                      }}
                    >
                      <Stack spacing={0.6}>
                        <Stack direction="row" alignItems="center" sx={{ gap: 1 }}>
                          <Avatar sx={{ width: 40, height: 40, bgcolor: isDark ? "#fff" : "#000", color: isDark ? "#000" : "#fff", fontSize: "1rem", fontWeight: 800 }}>
                            {row.full_name?.split(" ").map((n) => n[0]).slice(0, 2).join("") || "?"}
                          </Avatar>
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography variant="subtitle1" fontWeight={800} noWrap sx={{ lineHeight: 1.2 }}>{row.full_name}</Typography>
                          </Box>
                        </Stack>
                        <Typography variant="caption" sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "text.secondary" }}>
                          <ICONS.time fontSize="inherit" sx={{ opacity: 0.7 }} />
                          {formatDateTimeWithLocale(row.created_at)}
                        </Typography>
                      </Stack>
                      <Stack direction="row" alignItems="center" spacing={0.6} sx={{ mt: 1 }}>
                        <Chip label={config.label} color={config.color} size="small" icon={config.icon} sx={{ fontWeight: 800, borderRadius: 1.5, height: 24 }} />
                      </Stack>
                    </Box>

                    <Box sx={{ flexGrow: 1, px: 2, py: 1.5 }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", py: 0.8, borderBottom: "1px solid", borderColor: "divider" }}>
                        <Typography variant="body2" sx={{ display: "flex", alignItems: "center", gap: 0.6, color: "text.secondary" }}>
                          <ICONS.emailOutline fontSize="small" sx={{ opacity: 0.6 }} /> Email
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, ml: 2, flex: 1, textAlign: "right", color: "text.primary" }}>
                          {row.email || "—"}
                        </Typography>
                      </Box>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", py: 0.8, borderBottom: "1px solid", borderColor: "divider" }}>
                        <Typography variant="body2" sx={{ display: "flex", alignItems: "center", gap: 0.6, color: "text.secondary" }}>
                          <ICONS.info fontSize="small" sx={{ opacity: 0.6 }} /> Purpose
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, ml: 2, flex: 1, textAlign: "right", color: "text.primary" }}>
                          {row.purpose_of_visit || "—"}
                        </Typography>
                      </Box>
                      {(row.requested_from || row.requested_to) && (
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", py: 0.8 }}>
                          <Typography variant="body2" sx={{ display: "flex", alignItems: "center", gap: 0.6, color: "text.secondary" }}>
                            <ICONS.event fontSize="small" sx={{ opacity: 0.6 }} />
                            {(row.status !== "pending" && row.status !== "rejected" && (row.approved_from || row.approved_to)) ? "Approved Schedule" : "Requested Schedule"}
                          </Typography>
                          <Box sx={{ ml: 2, flex: 1, textAlign: "right" }}>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: "text.primary" }}>
                              {(() => {
                                const showApproved = row.status !== "pending" && row.status !== "rejected" && (row.approved_from || row.approved_to);
                                const fromStr = showApproved ? row.approved_from : row.requested_from;
                                const toStr = showApproved ? row.approved_to : row.requested_to;
                                if (!fromStr) return "—";
                                const df = formatDate(fromStr);
                                const dt = formatDate(toStr);
                                return dt && df !== dt ? `${df} to ${dt}` : df || "—";
                              })()}
                            </Typography>
                          </Box>
                        </Box>
                      )}
                    </Box>

                    <Box sx={{ p: 1.5, borderTop: "1px solid", borderColor: "divider", bgcolor: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)", display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 1 }}>
                      <Tooltip title="Print Badge">
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); handlePrintBadge(row); }} sx={{ color: "success.main" }}>
                          <ICONS.print fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {isSuperAdmin && (
                        <Tooltip title="Edit Registration">
                          <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleCardEdit(row); }} sx={{ color: "warning.main" }}>
                            <ICONS.edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="View Details">
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleOpenProfile(row); }} sx={{ color: "primary.main" }}>
                          <ICONS.view fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </AppCard>
                );
              })}
            </ResponsiveCardGrid>
          )}

          <Box display="flex" justifyContent="center" mt={4}>
            {filtered.length > rowsPerPage && (
              <Pagination
                count={Math.ceil(filtered.length / rowsPerPage)}
                page={page + 1}
                onChange={(e, v) => setPage(v - 1)}
                color="primary"
              />
            )}
          </Box>
        </>
      )}

      {/* ── Filter Modal ────────────────────────────────────────────────────── */}
      <FilterModal open={filterModalOpen} onClose={() => setFilterModalOpen(false)} title="Filter Registrations">
        <Stack spacing={3}>
          <Box>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, ml: 1 }}>Status</Typography>
            <TextField select fullWidth value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }} InputProps={{ sx: { borderRadius: 3 } }}>
              <MenuItem value="all">Any Status</MenuItem>
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => <MenuItem key={key} value={key}>{cfg.label}</MenuItem>)}
            </TextField>
          </Box>
          <Box>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, ml: 1 }}>Requested Visit Date</Typography>
            <DateTimeFieldFlatpickr placeholder="Select Date" value={requestDateFilter} onChange={(val) => { setRequestDateFilter(val); setPage(0); }} enableTime={false} />
          </Box>
          <Box>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1, ml: 1 }}>
              <Typography variant="subtitle2" fontWeight={700}>Requested Visit Time</Typography>
              <Chip label={requestTimeFilter.enabled ? "Enabled" : "Disabled"} size="small" color={requestTimeFilter.enabled ? "success" : "default"} onClick={() => setRequestTimeFilter({ ...requestTimeFilter, enabled: !requestTimeFilter.enabled })} sx={{ fontWeight: 800, cursor: "pointer" }} />
            </Stack>
            <Stack direction="row" spacing={1} sx={{ opacity: requestTimeFilter.enabled ? 1 : 0.5, pointerEvents: requestTimeFilter.enabled ? "auto" : "none" }}>
              <TextField select fullWidth label="Hr" size="small" value={requestTimeFilter.hour12} onChange={(e) => setRequestTimeFilter({ ...requestTimeFilter, hour12: e.target.value })} InputProps={{ sx: { borderRadius: 3 } }}>
                {HOURS.map((h) => <MenuItem key={h} value={h}>{h}</MenuItem>)}
              </TextField>
              <TextField select fullWidth label="Min" size="small" value={requestTimeFilter.minute} onChange={(e) => setRequestTimeFilter({ ...requestTimeFilter, minute: e.target.value })} InputProps={{ sx: { borderRadius: 3 } }}>
                {MINUTES.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
              </TextField>
              <TextField select fullWidth label="AM/PM" size="small" value={requestTimeFilter.ampm} onChange={(e) => setRequestTimeFilter({ ...requestTimeFilter, ampm: e.target.value })} InputProps={{ sx: { borderRadius: 3 } }}>
                {PERIODS.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
              </TextField>
            </Stack>
          </Box>
          <Divider />
          <Box>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, ml: 1 }}>Approved Visit Date</Typography>
            <DateTimeFieldFlatpickr placeholder="Select Date" value={approvedDateFilter} onChange={(val) => { setApprovedDateFilter(val); setPage(0); }} enableTime={false} />
          </Box>
          <Box>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1, ml: 1 }}>
              <Typography variant="subtitle2" fontWeight={700}>Approved Visit Time</Typography>
              <Chip label={approvedTimeFilter.enabled ? "Enabled" : "Disabled"} size="small" color={approvedTimeFilter.enabled ? "success" : "default"} onClick={() => setApprovedTimeFilter({ ...approvedTimeFilter, enabled: !approvedTimeFilter.enabled })} sx={{ fontWeight: 800, cursor: "pointer" }} />
            </Stack>
            <Stack direction="row" spacing={1} sx={{ opacity: approvedTimeFilter.enabled ? 1 : 0.5, pointerEvents: approvedTimeFilter.enabled ? "auto" : "none" }}>
              <TextField select fullWidth label="Hr" size="small" value={approvedTimeFilter.hour12} onChange={(e) => setApprovedTimeFilter({ ...approvedTimeFilter, hour12: e.target.value })} InputProps={{ sx: { borderRadius: 3 } }}>
                {HOURS.map((h) => <MenuItem key={h} value={h}>{h}</MenuItem>)}
              </TextField>
              <TextField select fullWidth label="Min" size="small" value={approvedTimeFilter.minute} onChange={(e) => setApprovedTimeFilter({ ...approvedTimeFilter, minute: e.target.value })} InputProps={{ sx: { borderRadius: 3 } }}>
                {MINUTES.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
              </TextField>
              <TextField select fullWidth label="AM/PM" size="small" value={approvedTimeFilter.ampm} onChange={(e) => setApprovedTimeFilter({ ...approvedTimeFilter, ampm: e.target.value })} InputProps={{ sx: { borderRadius: 3 } }}>
                {PERIODS.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
              </TextField>
            </Stack>
          </Box>
          <Button variant="contained" fullWidth startIcon={<ICONS.filter />} onClick={() => setFilterModalOpen(false)} sx={{ mt: 2, height: 48, borderRadius: 3, fontWeight: 800 }}>Apply</Button>
          <Button variant="text" fullWidth color="inherit" startIcon={<ICONS.clear />} onClick={() => { setStatusFilter("all"); setDatePreset("all"); setCustomFrom(""); setCustomTo(""); setRequestDateFilter(""); setRequestTimeFilter({ hour12: "", minute: "00", ampm: "AM", enabled: false }); setApprovedDateFilter(""); setApprovedTimeFilter({ hour12: "", minute: "00", ampm: "AM", enabled: false }); setFilterModalOpen(false); setPage(0); }} sx={{ fontWeight: 700, opacity: 0.6 }}>Clear</Button>
        </Stack>
      </FilterModal>

      {/* ── Visitor Detail Dialog ────────────────────────────────────────────── */}
      <Dialog open={!!selected} onClose={closeProfileDialog} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 4, overflow: "hidden", variant: "frosted" } }}>
        <DialogHeader title="Visitor Details" onClose={closeProfileDialog} />
        <Divider />
        <DialogContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
          {selected && (() => {
            const sc = STATUS_CONFIG[selected.status] || { label: selected.status, color: "default" };
            const isTerminal = TERMINAL_STATUSES.has(selected.status);
            const allowMultiCheckin = selected.allow_multi_checkin ?? selected.allowMultiCheckin ?? false;

            return (
              <Stack spacing={3}>
                {/* Visitor header */}
                <Box sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 3, bgcolor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", border: "1px solid", borderColor: "divider" }}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Avatar sx={{ width: 56, height: 56, bgcolor: isDark ? "#fff" : "#000", color: isDark ? "#000" : "#fff", fontSize: "1.2rem", fontWeight: 700 }}>
                      {selected.full_name?.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                    </Avatar>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="h6" fontWeight={800}>{selected.full_name}</Typography>
                      <Stack direction="row" spacing={2} sx={{ mt: 0.4, flexWrap: "wrap", gap: 1 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 0.5, wordBreak: "break-all" }}>
                          <ICONS.emailOutline fontSize="inherit" /> {selected.email || "No email"}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                          <ICONS.phone fontSize="inherit" /> {selected.phone ? formatPhoneNumberForDisplay(selected.phone, selected.phoneIsoCode || selected.phone_iso_code) : "No phone"}
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap", gap: 0.5 }}>
                        <Chip label={sc.label} color={sc.color} size="small" sx={{ fontWeight: 700, height: 22, fontSize: "0.65rem" }} />
                        {allowMultiCheckin && (
                          <Chip label="Multi Check-in Allowed" color="primary" size="small" variant="outlined" sx={{ fontWeight: 600, height: 22, fontSize: "0.65rem" }} />
                        )}
                        {selected.status === "visit_ended" && (
                          <Chip label="Visit Concluded" color="default" size="small" sx={{ fontWeight: 600, height: 22, fontSize: "0.65rem" }} />
                        )}
                        {!selected.adminApprovedByUserId && selected.status === "pending" && userRole !== "superadmin" && (
                          <Chip label="Awaiting Dept. Approval" color="warning" size="small" variant="outlined" sx={{ fontWeight: 600, height: 22, fontSize: "0.65rem" }} />
                        )}
                      </Stack>
                    </Box>
                  </Stack>
                </Box>

                {/* Tabs */}
                <Tabs value={selectedTab} onChange={(_, v) => setSelectedTab(v)} variant="fullWidth" sx={{ minHeight: 46, bgcolor: (theme) => alpha(theme.palette.text.primary, isDark ? 0.06 : 0.04), borderRadius: 999, p: 0.5, "& .MuiTabs-indicator": { display: "none" } }}>
                  {[
                    { value: "details", icon: <ICONS.info fontSize="small" />, label: "Details" },
                    { value: "history", icon: <ICONS.history fontSize="small" />, label: "History" },
                  ].map(({ value, icon, label }) => (
                    <Tab key={value} value={value} icon={icon} iconPosition="start" label={label} sx={{ minHeight: 38, borderRadius: 999, fontWeight: 800, textTransform: "none", "&.Mui-selected": { bgcolor: "background.paper", color: "text.primary", boxShadow: isDark ? "0 8px 20px rgba(0,0,0,0.24)" : "0 6px 14px rgba(0,0,0,0.08)" } }} />
                  ))}
                </Tabs>

                {/* Details tab */}
                {selectedTab === "details" ? (
                  <Stack spacing={3}>
                    <Box sx={{ px: { xs: 0, sm: 1 } }}>
                      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: { xs: 2, md: "16px 32px" } }}>
                        <InfoItem label="Requested Schedule" value={buildScheduleText(selected.requested_from, selected.requested_to, "Not provided")} icon={<ICONS.event fontSize="small" />} />
                        <InfoItem label="Approved Schedule" value={buildScheduleText(selected.approved_from, selected.approved_to, "Pending approval")} icon={<ICONS.checkCircle fontSize="small" />} />
                        <InfoItem label="Purpose of Visit" value={selected.purpose_of_visit} icon={<ICONS.info fontSize="small" />} />
                        {selected.department?.name && (
                          <InfoItem label="Department" value={selected.department.name} icon={<ICONS.apartment fontSize="small" />} />
                        )}
                        {selected.access_level?.name || selected.accessLevel?.name ? (
                          <InfoItem label="Access Level" value={selected.access_level?.name || selected.accessLevel?.name} icon={<ICONS.key fontSize="small" />} />
                        ) : null}
                      </Box>
                    </Box>

                    {additionalFieldValues.length > 0 && (
                      <Box>
                        <Divider sx={{ mb: 2 }} />
                        <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 700, color: "text.secondary", textTransform: "uppercase", fontSize: "0.7rem", letterSpacing: 0.5 }}>
                          Additional Information
                        </Typography>
                        <Box sx={{ px: { xs: 0, sm: 1 } }}>
                          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: { xs: 1.5, md: "16px 32px" } }}>
                            {additionalFieldValues.map((fv) => (
                              <Box key={fv.id} sx={{ p: 1.75, borderRadius: 2.5, border: "1px solid", borderColor: "divider", bgcolor: isDark ? "rgba(255,255,255,0.01)" : "rgba(0,0,0,0.01)" }}>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, textTransform: "uppercase", fontSize: "0.6rem" }}>
                                  {fv.customField?.label || fv.customField?.fieldKey || "Field"}
                                </Typography>
                                <Typography variant="body2" fontWeight={600} sx={{ mt: 0.4 }}>{formatFieldDisplayValue(fv.value, fv.customField?.inputType)}</Typography>
                              </Box>
                            ))}
                          </Box>
                        </Box>
                      </Box>
                    )}

                    {selected.status === "rejected" && (selected.rejection_reason || selected.adminRejectionReason) && (
                      <Alert severity="error" variant="outlined" sx={{ borderRadius: 2.5 }}>
                        <Typography variant="caption" fontWeight={700} display="block">REJECTION REASON</Typography>
                        <Typography variant="body2">{selected.rejection_reason || selected.adminRejectionReason}</Typography>
                      </Alert>
                    )}

                    {/* Timeline button */}
                    <Box>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<ICONS.list fontSize="small" />}
                        onClick={() => openTimeline(selected.id, selected.full_name)}
                        sx={{ borderRadius: 30 }}
                      >
                        View Timeline
                      </Button>
                    </Box>

                    <Divider sx={{ my: 1 }} />
                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 700, color: "text.secondary", textTransform: "uppercase", fontSize: "0.7rem", display: "flex", alignItems: "center", gap: 1 }}>
                        <ICONS.restaurant sx={{ fontSize: "1rem" }} /> Kitchen Orders
                      </Typography>
                      <KitchenOrderList orders={kitchenOrders} loading={kitchenOrdersLoading} isDark={isDark} />
                    </Box>
                  </Stack>
                ) : previousVisits.length ? (
                  <Stack spacing={2}>
                    {previousVisits.map((visit) => (
                      <PreviousVisitCard
                        key={visit.id}
                        visit={visit}
                        onViewTimeline={() => openTimeline(visit.id, selected.full_name)}
                      />
                    ))}
                  </Stack>
                ) : (
                  <NoDataAvailable title="No previous history" description="This visitor does not have any earlier registrations yet." compact minHeight={220} />
                )}
              </Stack>
            );
          })()}
        </DialogContent>
        <Divider />

        {/* Dialog actions — status transitions + edit */}
        {selected && (
          <DialogActions sx={{ p: 2.5, alignItems: "stretch", bgcolor: (theme) => alpha(theme.palette.common.black, theme.palette.mode === "dark" ? 0.12 : 0.02) }}>
            <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="flex-end" useFlexGap sx={{ width: "100%" }}>
                {TERMINAL_STATUSES.has(selected.status) ? (
                  <Chip label="No further changes — terminal status" size="small" color="default" sx={{ fontWeight: 600, borderRadius: 2 }} />
                ) : allowedTransitions.length === 0 ? (
                  <Typography variant="caption" color="text.secondary">No actions available for your role</Typography>
                ) : (
                  allowedTransitions.map((targetStatus) => {
                    const cfg = STATUS_CONFIG[targetStatus] || { label: toTitleCase(targetStatus), color: "primary" };
                    const btnColors = {
                      admin_approved: "info",
                      approved: "success",
                      rejected: "error",
                      cancelled: "warning",
                      checked_in: "success",
                      checked_out: "warning",
                      visit_ended: "error",
                    };
                    return (
                      <Button
                        key={targetStatus}
                        variant={targetStatus === "visit_ended" ? "contained" : "outlined"}
                        color={btnColors[targetStatus] || "primary"}
                        size="small"
                        disabled={actionLoading}
                        startIcon={actionLoading ? <CircularProgress size={14} color="inherit" /> : cfg.icon}
                        onClick={() => openStatusTransition(targetStatus)}
                        sx={{ borderRadius: 30, fontWeight: 700, whiteSpace: "nowrap" }}
                      >
                        {cfg.label}
                      </Button>
                    );
                  })
                )}
              </Stack>
          </DialogActions>
        )}
      </Dialog>

      {/* ── Status Transition Modal ──────────────────────────────────────────── */}
      <Dialog open={statusModal.open} onClose={() => setStatusModal({ open: false, targetStatus: null })} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4, overflow: "hidden" } }}>
        <DialogHeader
          title={
            statusModal.targetStatus === "rejected" ? "Reject Registration"
            : statusModal.targetStatus === "admin_approved" ? "Dept. Approve Registration"
            : "Approve Registration"
          }
          onClose={() => setStatusModal({ open: false, targetStatus: null })}
        />
        <Divider />
        <DialogContent sx={{ p: 3 }}>
          <Stack spacing={2.5}>
            {statusModal.targetStatus === "rejected" ? (
              <TextField
                label="Rejection Reason *"
                fullWidth
                multiline
                minRows={3}
                value={statusPayload.rejectionReason || ""}
                onChange={(e) => setStatusPayload({ ...statusPayload, rejectionReason: e.target.value })}
                error={Boolean(statusPayloadErrors.rejectionReason)}
                helperText={statusPayloadErrors.rejectionReason}
                InputProps={{ sx: { borderRadius: 2 } }}
              />
            ) : (
              <>
                <FormControl fullWidth error={Boolean(statusPayloadErrors.accessLevelId)}>
                  <InputLabel>Access Level *</InputLabel>
                  <Select
                    value={statusPayload.accessLevelId || ""}
                    label="Access Level *"
                    onChange={(e) => setStatusPayload({ ...statusPayload, accessLevelId: e.target.value })}
                    sx={{ borderRadius: 2 }}
                  >
                    {accessLevels.filter((al) => al.isActive !== false).map((al) => (
                      <MenuItem key={al.id} value={al.id}>{al.name}</MenuItem>
                    ))}
                  </Select>
                  {statusPayloadErrors.accessLevelId && (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>{statusPayloadErrors.accessLevelId}</Typography>
                  )}
                </FormControl>

                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: "uppercase", letterSpacing: 0.5, display: "block", mb: 1 }}>
                    Approved From
                  </Typography>
                  <DateTimeFieldFlatpickr
                    value={statusPayload.approvedFrom || ""}
                    onChange={(val) => setStatusPayload({ ...statusPayload, approvedFrom: val })}
                    placeholder="Approved start date & time"
                  />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: "uppercase", letterSpacing: 0.5, display: "block", mb: 1 }}>
                    Approved To
                  </Typography>
                  <DateTimeFieldFlatpickr
                    value={statusPayload.approvedTo || ""}
                    onChange={(val) => setStatusPayload({ ...statusPayload, approvedTo: val })}
                    placeholder="Approved end date & time"
                  />
                </Box>

                <FormControlLabel
                  control={
                    <Switch
                      checked={statusPayload.allowMultiCheckin ?? false}
                      onChange={(e) => setStatusPayload({ ...statusPayload, allowMultiCheckin: e.target.checked })}
                      color="success"
                    />
                  }
                  label="Allow Multiple Check-ins"
                />
                {(statusPayload.allowMultiCheckin) && (
                  <Alert severity="info" sx={{ borderRadius: 2 }}>
                    Visitor can check in and out multiple times throughout the approved period.
                  </Alert>
                )}
              </>
            )}
          </Stack>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ p: 2.5, gap: 1 }}>
          <Button variant="outlined" onClick={() => setStatusModal({ open: false, targetStatus: null })} sx={{ borderRadius: 30 }}>Cancel</Button>
          <Button
            variant="contained"
            color={statusModal.targetStatus === "rejected" ? "error" : "primary"}
            onClick={handleStatusModalConfirm}
            disabled={actionLoading}
            startIcon={actionLoading ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{ borderRadius: 30 }}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Confirm Modal (cancel / checkin / checkout / visit_ended) ──────────── */}
      <Dialog open={confirmModal.open} onClose={() => setConfirmModal({ open: false, targetStatus: null, message: "" })} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 4, overflow: "hidden" } }}>
        <DialogHeader
          title={
            confirmModal.targetStatus === "cancelled" ? "Cancel Registration"
            : confirmModal.targetStatus === "checked_in" ? "Confirm Check-in"
            : confirmModal.targetStatus === "checked_out" ? "Confirm Check-out"
            : "End Visit"
          }
          onClose={() => setConfirmModal({ open: false, targetStatus: null, message: "" })}
        />
        <Divider />
        <DialogContent sx={{ p: 3 }}>
          <Typography variant="body2">{confirmModal.message}</Typography>
          {confirmModal.isTerminal && (
            <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>
              This action cannot be reversed. The visit will be permanently concluded.
            </Alert>
          )}
        </DialogContent>
        <Divider />
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button variant="outlined" onClick={() => setConfirmModal({ open: false, targetStatus: null, message: "" })} sx={{ borderRadius: 30 }}>Cancel</Button>
          <Button
            variant="contained"
            color={confirmModal.isTerminal ? "error" : "primary"}
            onClick={handleConfirmModalConfirm}
            disabled={actionLoading}
            startIcon={actionLoading ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{ borderRadius: 30 }}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Timeline Modal ────────────────────────────────────────────────────── */}
      <Dialog open={timelineModal.open} onClose={() => setTimelineModal({ open: false })} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4, overflow: "hidden" } }}>
        <DialogHeader title={`Activity Timeline${timelineModal.visitorName ? ` — ${timelineModal.visitorName}` : ""}`} onClose={() => setTimelineModal({ open: false })} />
        <Divider />
        <DialogContent sx={{ p: 3, minHeight: 200 }}>
          {timelineLoading ? (
            <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>
          ) : timelineLogs.length === 0 ? (
            <NoDataAvailable title="No activity yet" description="No activity logs found for this registration." compact minHeight={120} />
          ) : (
            <Box sx={{ "& .MuiTimelineItem-root:before": { flex: 0, padding: 0 } }}>
              {timelineLogs.map((log, index) => {
                // Priority: loaded relation → stored actorName (survives user deletion) → fallbacks
                const actorLabel = log.activityType === "submitted"
                  ? null
                  : log.actorUser
                  ? log.actorUser.fullName
                  : log.actorName
                  ? log.actorName
                  : log.actorUserId
                  ? "[Unknown User]"
                  : "System";
                const actorIsVisitor = !log.actorUser && log.activityType === "submitted";
                const visitorName = timelineModal.visitorName || "Visitor";
                const color = ACTIVITY_COLORS[log.activityType] || "grey";

                return (
                  <Box key={log.id} sx={{ display: "flex", gap: 2, mb: index < timelineLogs.length - 1 ? 0 : 0 }}>
                    {/* Left: dot + line */}
                    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", pt: 0.5, minWidth: 24 }}>
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: "50%",
                          flexShrink: 0,
                          bgcolor: color === "grey" ? "text.disabled"
                            : color === "error" ? "error.main"
                            : color === "success" ? "success.main"
                            : color === "warning" ? "warning.main"
                            : color === "info" ? "info.main"
                            : "primary.main",
                        }}
                      />
                      {index < timelineLogs.length - 1 && (
                        <Box sx={{ width: 1, flex: 1, minHeight: 24, bgcolor: "divider", mt: 0.5 }} />
                      )}
                    </Box>

                    {/* Right: content */}
                    <Box sx={{ pb: 2.5, flex: 1, minWidth: 0 }}>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Typography variant="body2" fontWeight={700}>
                          {ACTIVITY_LABELS[log.activityType] || toTitleCase(log.activityType)}
                        </Typography>
                        {actorIsVisitor ? (
                          <Chip label={visitorName} size="small" variant="outlined" color="default" sx={{ height: 18, fontSize: "0.6rem", fontWeight: 700 }} />
                        ) : actorLabel ? (
                          <Chip label={actorLabel === "System" ? "System" : actorLabel} size="small" variant="outlined" color={actorLabel === "System" ? "default" : "primary"} sx={{ height: 18, fontSize: "0.6rem", fontWeight: 700 }} />
                        ) : null}
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {formatDateTimeWithLocale(log.createdAt)}
                      </Typography>
                      {log.notes && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontStyle: "italic" }}>
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

      {/* ── Edit Registration Modal (SuperAdmin) ─────────────────────────────── */}
      <Dialog open={editModal} onClose={() => setEditModal(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4, overflow: "hidden" } }}>
        <DialogHeader title="Edit Registration" onClose={() => setEditModal(false)} />
        <Divider />
        <DialogContent sx={{ p: 0 }}>
          {/* ── Tabs ── */}
          <Box sx={{ px: 2.5, pt: 2, pb: 0 }}>
            <Tabs
              value={editTab}
              onChange={(_, v) => setEditTab(v)}
              variant="fullWidth"
              sx={{
                minHeight: 40,
                bgcolor: "action.hover",
                borderRadius: 999,
                p: 0.5,
                "& .MuiTabs-indicator": { display: "none" },
                "& .MuiTabs-flexContainer": { gap: 0 },
              }}
            >
              {["Visit Details", "Visitor Info"].map((label) => (
                <Tab
                  key={label}
                  label={label}
                  sx={{
                    minHeight: 34,
                    borderRadius: 999,
                    fontWeight: 700,
                    fontSize: "0.8rem",
                    textTransform: "none",
                    "&.Mui-selected": {
                      bgcolor: "background.paper",
                      color: "text.primary",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    },
                  }}
                />
              ))}
            </Tabs>
          </Box>

          {/* ── Tab 0: Visit Details ── */}
          <Box role="tabpanel" hidden={editTab !== 0} sx={{ p: 2.5 }}>
            {editTab === 0 && (
              <Stack spacing={2.5}>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: "uppercase", letterSpacing: 0.5, display: "block", mb: 1 }}>
                    {editForm.hasApproved ? "Approved From" : "Requested From"}
                  </Typography>
                  <DateTimeFieldFlatpickr
                    value={editForm.scheduleFrom || ""}
                    onChange={(val) => setEditForm({ ...editForm, scheduleFrom: val })}
                    placeholder={editForm.hasApproved ? "Approved start date & time" : "Requested start date & time"}
                  />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: "uppercase", letterSpacing: 0.5, display: "block", mb: 1 }}>
                    {editForm.hasApproved ? "Approved To" : "Requested To"}
                  </Typography>
                  <DateTimeFieldFlatpickr
                    value={editForm.scheduleTo || ""}
                    onChange={(val) => setEditForm({ ...editForm, scheduleTo: val })}
                    placeholder={editForm.hasApproved ? "Approved end date & time" : "Requested end date & time"}
                  />
                </Box>
                <FormControl fullWidth>
                  <InputLabel>Department</InputLabel>
                  <Select
                    value={editForm.departmentId || ""}
                    label="Department"
                    onChange={(e) => setEditForm({ ...editForm, departmentId: e.target.value })}
                    sx={{ borderRadius: 2 }}
                  >
                    <MenuItem value=""><em>None</em></MenuItem>
                    {departments.map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
                  </Select>
                </FormControl>
                {editForm.hasApproved && (
                  <>
                    <FormControl fullWidth>
                      <InputLabel>Access Level</InputLabel>
                      <Select
                        value={editForm.accessLevelId || ""}
                        label="Access Level"
                        onChange={(e) => setEditForm({ ...editForm, accessLevelId: e.target.value })}
                        sx={{ borderRadius: 2 }}
                      >
                        <MenuItem value=""><em>None</em></MenuItem>
                        {accessLevels.filter((al) => al.isActive !== false).map((al) => (
                          <MenuItem key={al.id} value={al.id}>{al.name}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={editForm.allowMultiCheckin ?? false}
                          onChange={(e) => setEditForm({ ...editForm, allowMultiCheckin: e.target.checked })}
                          color="success"
                        />
                      }
                      label="Allow Multiple Check-ins"
                    />
                  </>
                )}
              </Stack>
            )}
          </Box>

          {/* ── Tab 1: Visitor Info ── */}
          <Box role="tabpanel" hidden={editTab !== 1} sx={{ p: 2.5 }}>
            {editTab === 1 && (
              <Stack spacing={2.5}>
                <PurposeOfVisitInput
                  value={editForm.purposeOfVisit || ""}
                  onChange={(val) => setEditForm({ ...editForm, purposeOfVisit: val })}
                />
                {activeCustomFields.map((field) => {
                  const val = editForm.fieldValues?.[field.fieldKey] ?? "";
                  const setVal = (v) => setEditForm((prev) => ({ ...prev, fieldValues: { ...prev.fieldValues, [field.fieldKey]: v } }));
                  const opts = Array.isArray(field.optionsJson) ? field.optionsJson : [];

                  if (["list", "select", "dropdown"].includes(field.inputType)) {
                    return (
                      <FormControl key={field.fieldKey} fullWidth>
                        <InputLabel>{field.label}</InputLabel>
                        <Select value={val} label={field.label} onChange={(e) => setVal(e.target.value)} sx={{ borderRadius: 2 }}>
                          <MenuItem value=""><em>None</em></MenuItem>
                          {opts.map((opt) => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
                        </Select>
                      </FormControl>
                    );
                  }

                  if (field.inputType === "radio") {
                    return (
                      <Box key={field.fieldKey}>
                        <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: "uppercase", letterSpacing: 0.5, display: "block", mb: 0.5 }}>
                          {field.label}
                        </Typography>
                        <RadioGroup row value={val} onChange={(e) => setVal(e.target.value)}>
                          {opts.map((opt) => (
                            <FormControlLabel key={opt} value={opt} control={<Radio size="small" />} label={opt} />
                          ))}
                        </RadioGroup>
                      </Box>
                    );
                  }

                  if (isPhoneField(field)) {
                    const isoCode = editCountryIsoCodes[field.fieldKey] || DEFAULT_ISO_CODE;
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
                                setEditCountryIsoCodes((prev) => ({ ...prev, [field.fieldKey]: iso }))
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
                      type={field.inputType === "email" ? "email" : field.inputType === "number" ? "number" : "text"}
                      InputProps={{ sx: { borderRadius: 2 } }}
                    />
                  );
                })}
              </Stack>
            )}
          </Box>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ p: 2.5, gap: 1 }}>
          <Button variant="outlined" onClick={() => setEditModal(false)} disabled={editSubmitting} sx={{ borderRadius: 30 }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleEditSubmit}
            disabled={editSubmitting}
            startIcon={editSubmitting ? <CircularProgress size={16} color="inherit" /> : <ICONS.save />}
            sx={{ borderRadius: 30 }}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function InfoItem({ label, value, icon, sx = {} }) {
  return (
    <Box sx={sx}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
        <Box sx={{ color: "primary.main", display: "flex", alignItems: "center", minWidth: 22, opacity: 0.8 }}>
          {icon}
        </Box>
        <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, textTransform: "uppercase", fontSize: "0.65rem", letterSpacing: 0.5 }}>
          {label}
        </Typography>
      </Stack>
      <Box sx={{ pl: "30px" }}>
        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: "0.85rem", color: "text.primary", lineHeight: 1.4 }}>
          {value || "—"}
        </Typography>
      </Box>
    </Box>
  );
}

function KitchenOrderList({ orders, loading, isDark }) {
  const [expandedIds, setExpandedIds] = useState(new Set());
  const theme = useTheme();

  const toggleExpand = (id) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) return <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress size={30} /></Box>;
  if (!orders?.length) return <NoDataAvailable title="No orders found" description="No kitchen orders have been placed for this visit yet." compact minHeight={150} />;

  return (
    <Stack spacing={2}>
      {orders.map((order) => {
        const sortedHistory = [...(order.status_history || [])].sort((a,b) => new Date(a.changed_at) - new Date(b.changed_at));
        return (
          <Box key={order.id} sx={{ p: 2, borderRadius: 3, border: "1px solid", borderColor: "divider", bgcolor: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)" }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.5 }}>
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={800} sx={{ textTransform: "uppercase" }}>Order Date</Typography>
                <Typography variant="body2" fontWeight={700}>{dayjs(order.created_at).format("MMM D, YYYY - h:mm A")}</Typography>
              </Box>
              <Chip 
                label={order.status.replace("_", " ")} 
                size="small" 
                color={
                  order.status === "delivered" ? "success" :
                  order.status === "cancelled" ? "error" : "primary"
                }
                sx={{ fontWeight: 800, textTransform: "uppercase", fontSize: "0.6rem" }}
              />
            </Stack>
            <Stack spacing={0.5} sx={{ mb: 1.5 }}>
              {order.items?.map((item, idx) => (
                <Typography key={idx} variant="body2" fontWeight={600} sx={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{item.name}</span>
                  <span style={{ opacity: 0.6 }}>×{item.quantity}</span>
                </Typography>
              ))}
            </Stack>

            <Box sx={{ pt: 1, borderTop: "1px dashed", borderColor: "divider" }}>
              <Button
                size="small"
                onClick={() => toggleExpand(order.id)}
                endIcon={<ICONS.down sx={{ transform: expandedIds.has(order.id) ? "rotate(180deg)" : "none", transition: "0.2s" }} />}
                sx={{ textTransform: "none", p: 0, color: "text.secondary", fontSize: "0.7rem", fontWeight: 700, minHeight: 0 }}
              >
                View Timeline
              </Button>
              <Collapse in={expandedIds.has(order.id)}>
                <Box sx={{ pl: 0.5, pt: 2 }}>
                  {sortedHistory.map((h, i) => (
                    <Box key={h.id} sx={{ display: "flex", gap: 1.5, mb: i < sortedHistory.length - 1 ? 1.5 : 0 }}>
                      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mt: 0.5 }}>
                        <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: i === sortedHistory.length - 1 ? "primary.main" : "text.disabled" }} />
                        {i < sortedHistory.length - 1 && <Box sx={{ width: 1, flex: 1, bgcolor: "divider", mt: 0.5, minHeight: 8 }} />}
                      </Box>
                      <Box>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="caption" fontWeight="700" sx={{ textTransform: "capitalize" }}>{h.status.replace("_", " ")}</Typography>
                          <Typography variant="caption" sx={{ fontSize: "0.55rem", opacity: 0.5 }}>{dayjs(h.changed_at).format("MMM D, h:mm A")}</Typography>
                          {h.changed_by && (
                             <Chip label={h.changed_by} size="small" variant="outlined" sx={{ height: 14, fontSize: "0.5rem", fontWeight: 700, borderStyle: "dashed", bgcolor: alpha(theme.palette.primary.main, 0.05) }} />
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
  );
}

function PreviousVisitCard({ visit, onViewTimeline }) {
  const visitFieldValues = getVisibleFieldValues(visit);
  const statusConfig = STATUS_CONFIG[visit.status] || { label: toTitleCase(visit.status), color: "default", icon: <ICONS.history fontSize="small" /> };
  const departmentName = visit.department?.name || visit.departmentName || visit.department_name || "";
  const accessLevelName = visit.access_level?.name || visit.accessLevel?.name || visit.accessLevelName || visit.access_level_name || "";
  const allowMultiCheckin = visit.allow_multi_checkin ?? visit.allowMultiCheckin ?? false;
  const isDark = useColorMode?.()?.mode === "dark" || false;

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showOrders, setShowOrders] = useState(false);

  useEffect(() => {
    if (showOrders && orders.length === 0) {
      setLoading(true);
      getKitchenOrders({ registrationId: visit.id })
        .then(res => setOrders(Array.isArray(res) ? res : []))
        .finally(() => setLoading(false));
    }
  }, [showOrders, visit.id, orders.length]);

  return (
    <Box sx={{ p: 2.25, borderRadius: 3, border: "1px solid", borderColor: "divider", bgcolor: (theme) => theme.palette.mode === "dark" ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)" }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="subtitle1" fontWeight={800}>
            {visit.requested_from ? formatDate(visit.requested_from) : "Previous visit"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Submitted {formatDateTimeWithLocale(visit.created_at)}
          </Typography>
        </Box>
        <Chip label={statusConfig.label} color={statusConfig.color} size="small" icon={statusConfig.icon} sx={{ fontWeight: 700, borderRadius: 2, height: 26 }} />
      </Stack>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: { xs: 1.75, md: "16px 32px" } }}>
        <InfoItem label="Purpose of Visit" value={visit.purpose_of_visit || "-"} icon={<ICONS.info fontSize="small" />} />
        <InfoItem label="Department" value={departmentName || "-"} icon={<ICONS.apartment fontSize="small" />} />
        <InfoItem label="Requested Schedule" value={buildScheduleText(visit.requested_from, visit.requested_to, "Not provided")} icon={<ICONS.event fontSize="small" />} />
        <InfoItem label="Approved Schedule" value={buildScheduleText(visit.approved_from, visit.approved_to, "Not approved")} icon={<ICONS.checkCircle fontSize="small" />} />
        <InfoItem label="Multi Check-in" value={allowMultiCheckin ? "Allowed" : "Not Allowed"} icon={<ICONS.replay fontSize="small" />} />
        <InfoItem label="Access Level" value={accessLevelName || "-"} icon={<ICONS.key fontSize="small" />} />
        {visit.rejection_reason ? (
          <InfoItem label="Rejection Reason" value={visit.rejection_reason} icon={<ICONS.close fontSize="small" />} sx={{ gridColumn: { md: "1 / -1" } }} />
        ) : null}
      </Box>

      {visitFieldValues.length > 0 && (
        <>
          <Divider sx={{ my: 2 }} />
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: { xs: 1.5, md: "16px 32px" } }}>
            {visitFieldValues.map((fieldValue) => (
              <Box key={fieldValue.id} sx={{ p: 1.75, borderRadius: 2.5, border: "1px solid", borderColor: "divider", bgcolor: (theme) => theme.palette.mode === "dark" ? "rgba(255,255,255,0.01)" : "rgba(0,0,0,0.01)" }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, textTransform: "uppercase", fontSize: "0.6rem" }}>
                  {fieldValue.customField?.label || fieldValue.customField?.fieldKey || "Field"}
                </Typography>
                <Typography variant="body2" fontWeight={600} sx={{ mt: 0.4 }}>{formatFieldDisplayValue(fieldValue.value, fieldValue.customField?.inputType)}</Typography>
              </Box>
            ))}
          </Box>
        </>
      )}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 2.5 }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<ICONS.list fontSize="small" />}
          onClick={onViewTimeline}
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
        <Box sx={{ mt: 2, pt: 2, borderTop: "1px dashed", borderColor: "divider" }}>
          <KitchenOrderList orders={orders} loading={loading} isDark={isDark} />
        </Box>
      </Collapse>
    </Box>
  );
}
