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
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useColorMode } from "@/contexts/ThemeContext";
import { useMessage } from "@/contexts/MessageContext";
import { useSocket } from "@/contexts/SocketContext";
import { pdf } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { exportAllBadges } from "@/utils/exportBadges";
import { getDefaultBadgeTemplate } from "@/services/badgeService";
import BadgePDF from "@/components/badges/BadgePDF";
import ICONS from "@/utils/iconUtil";
import DateTimeFieldFlatpickr from "@/components/forms/DateTimeFieldFlatpickr";
import AppCard from "@/components/cards/AppCard";
import DialogHeader from "@/components/modals/DialogHeader";
import FilterModal from "@/components/modals/FilterModal";
import ListToolbar from "@/components/ListToolbar";
import LoadingState from "@/components/LoadingState";
import NoDataAvailable from "@/components/NoDataAvailable";
import ResponsiveCardGrid from "@/components/ResponsiveCardGrid";
import {
  getRegistrations,
  updateRegistrationStatus,
  getRegistrationById,
  updateRegistration,
  checkInRegistration,
  checkOutRegistration,
} from "@/services/registrationService";
import {
  formatDate,
  formatTime,
  formatDateTimeWithLocale,
  getLocalDate,
  getLocalTime,
} from "@/utils/dateUtils";
import { validateRequired } from "@/utils/validationUtils";


const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    color: "warning",
    icon: <ICONS.time fontSize="small" />,
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
    icon: <ICONS.close fontSize="small" />,
  },
  expired: {
    label: "Expired",
    color: "default",
    icon: <ICONS.history fontSize="small" />,
  },
};

const MANUAL_STATUS_KEYS = ["pending", "approved", "rejected", "cancelled"];

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = ["00", "15", "30", "45"];
const PERIODS = ["AM", "PM"];

const toTitleCase = (value) =>
  String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const buildScheduleText = (
  fromStr,
  toStr,
  emptyLabel = "Not scheduled yet",
) => {
  if (!fromStr && !toStr) {
    return emptyLabel;
  }

  const dateFromFormatted = formatDate(fromStr);
  const dateToFormatted = formatDate(toStr);
  let dateText = dateFromFormatted || "—";
  
  if (dateToFormatted && dateFromFormatted !== dateToFormatted) {
    dateText = `${dateFromFormatted} to ${dateToFormatted}`;
  }

  const timeFrom = formatTime(fromStr);
  const timeTo = formatTime(toStr);
  const timeParts = [timeFrom, timeTo].filter(Boolean);
  
  if (!timeParts.length) {
    return dateText;
  }

  return `${dateText}, ${timeParts.join(" - ")}`;
};

const normalizeFieldIdentifier = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const DEFAULT_FIELD_IDENTIFIERS = new Set([
  "fullname",
  "name",
  "email",
  "emailaddress",
  "phone",
  "phonenumber",
  "mobile",
  "contact",
  "purposeofvisit",
]);

const getVisibleFieldValues = (registration) =>
  (Array.isArray(registration?.fieldValues)
    ? registration.fieldValues
    : []
  ).filter((fieldValue) => {
    const normalizedKey = normalizeFieldIdentifier(
      fieldValue?.customField?.fieldKey || fieldValue?.customField?.label,
    );

    const stringValue = String(fieldValue?.value ?? "").trim();

    return (
      Boolean(stringValue) && !DEFAULT_FIELD_IDENTIFIERS.has(normalizedKey)
    );
  });

const formatFieldDisplayValue = (value) => {
  if (Array.isArray(value)) {
    const flattenedValue = value
      .map((item) => String(item ?? "").trim())
      .filter(Boolean)
      .join(", ");
    return flattenedValue || "-";
  }

  if (value && typeof value === "object") {
    const flattenedValue = Object.values(value)
      .map((item) => String(item ?? "").trim())
      .filter(Boolean)
      .join(", ");
    return flattenedValue || "-";
  }

  const stringValue = String(value ?? "").trim();
  return stringValue || "-";
};


export default function CmsRegistrationsPage() {
  const { mode } = useColorMode();
  const isDark = mode === "dark";
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [requestDateFilter, setRequestDateFilter] = useState("");
  const [requestTimeFilter, setRequestTimeFilter] = useState({
    hour12: "",
    minute: "00",
    ampm: "AM",
    enabled: false,
  });
  const [approvedDateFilter, setApprovedDateFilter] = useState("");
  const [approvedTimeFilter, setApprovedTimeFilter] = useState({
    hour12: "",
    minute: "00",
    ampm: "AM",
    enabled: false,
  });
  const [selected, setSelected] = useState(null);
  const [selectedTab, setSelectedTab] = useState("details");
  const [actionLoading, setActionLoading] = useState(false);
  const [fetchingProfile, setFetchingProfile] = useState(false);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState("");
  const [rejectionReasonDraft, setRejectionReasonDraft] = useState("");
  const [rejectionReasonError, setRejectionReasonError] = useState("");

  const [exportingBadges, setExportingBadges] = useState(false);
  const [badgeTemplate, setBadgeTemplate] = useState(null);

  const { showMessage } = useMessage();

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(12);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getRegistrations(statusFilter);
      setData(res || []);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    fetchData();
    fetchDefaultBadgeTemplate();
  }, [statusFilter]);

  const fetchDefaultBadgeTemplate = async () => {
    const template = await getDefaultBadgeTemplate();
    if (template && !template.error) {
      setBadgeTemplate(template);
    }
  };

  const { on } = useSocket();

  useEffect(() => {
    const unsubNew = on("registration:new", () => {
      fetchData();
    });

    const unsubUpdated = on("registration:updated", (updatedReg) => {
      fetchData();
      if (selected?.id === updatedReg.id) {
        getRegistrationById(updatedReg.id).then((fullDetail) => {
          setSelected(fullDetail);
        });
      }
    });

    return () => {
      unsubNew?.();
      unsubUpdated?.();
    };
  }, [selected?.id, on]);

  useEffect(() => {
    if (selected) {
      setSelectedTab("details");
    }
  }, [selected?.id]);

  useEffect(() => {
    setPendingStatus(selected?.status || "");
    setRejectionReasonDraft("");
    setRejectionReasonError("");
  }, [selected?.id, selected?.status]);

  const closeProfileDialog = () => {
    setSelected(null);
  };

  const handleOpenProfile = useCallback(async (row) => {
    setFetchingProfile(true);
    try {
      const fullDetail = await getRegistrationById(row.id);
      setSelected(fullDetail);
    } finally {
      setFetchingProfile(false);
    }
  }, []);

  const applyStatusChange = async (nextStatus, rejectionReason = "") => {
    if (!selected || !nextStatus || nextStatus === selected.status) {
      return;
    }

    let request = null;
    let successMessage = "";

    if (nextStatus === "approved") {
      const dateFrom = getLocalDate(selected.requested_from);
      const dateTo = getLocalDate(selected.requested_to);
      const timeFrom = getLocalTime(selected.requested_from) || "09:00";
      const timeTo = getLocalTime(selected.requested_to) || "17:00";
      
      request = () =>
        updateRegistrationStatus(selected.id, "approve", {
          approvedFrom: dateFrom ? dayjs(`${dateFrom}T${timeFrom}:00`).toISOString() : null,
          approvedTo: dateTo ? dayjs(`${dateTo}T${timeTo}:00`).toISOString() : null,
        });
      successMessage = "Registration approved";
    } else if (nextStatus === "rejected") {
      const error = validateRequired(rejectionReason, "Rejection reason");
      if (error) {
        setRejectionReasonError(error);
        return;
      }

      request = () =>
        updateRegistrationStatus(selected.id, "reject", {
          rejectionReason: rejectionReason.trim(),
        });
      successMessage = "Registration rejected";
    } else if (nextStatus === "cancelled") {
      request = () => updateRegistrationStatus(selected.id, "cancel");
      successMessage = "Registration cancelled";
    } else {
      request = () => updateRegistration(selected.id, { status: nextStatus });
      successMessage = `Status updated to ${
        STATUS_CONFIG[nextStatus]?.label || toTitleCase(nextStatus)
      }`;
    }

    setActionLoading(true);
    try {
      setRejectionReasonError("");
      await request();
      await fetchData();
      const updated = await getRegistrationById(selected.id);
      setSelected(updated);
    } finally {
      setActionLoading(false);
    }
  };

  const handleManualStatusChange = async (nextStatus) => {
    if (!selected || !nextStatus) {
      return;
    }

    setPendingStatus(nextStatus);

    if (nextStatus === selected.status) {
      setRejectionReasonDraft("");
      setRejectionReasonError("");
      return;
    }

    if (nextStatus === "rejected") {
      setRejectionReasonError("");
      return;
    }

    setRejectionReasonDraft("");
    setRejectionReasonError("");
    await applyStatusChange(nextStatus);
  };

  const handleRejectSubmit = async () => {
    await applyStatusChange("rejected", rejectionReasonDraft);
  };

  const handleCheckInAction = async () => {
    if (!selected?.id) return;
    setActionLoading(true);
    try {
      const updated = await checkInRegistration(selected.id);
      if (!updated.error) {
        setSelected(updated);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOutAction = async () => {
    if (!selected?.id) return;
    setActionLoading(true);
    try {
      const updated = await checkOutRegistration(selected.id);
      if (!updated.error) {
        setSelected(updated);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handlePrintBadge = async (registration) => {
    if (!registration?.qr_token) {
      showMessage("No QR token available for this registration", "warning");
      return;
    }

    const qrCodeDataUrl = await QRCode.toDataURL(
      registration.qr_token || "N/A",
      {
        width: 300,
        margin: 1,
        color: { dark: "#000000", light: "#ffffff" },
      },
    );

    const badgeData = {
      fullName:
        registration.full_name ||
        registration.user?.full_name ||
        "Unnamed Visitor",
      company:
        registration.company_name || registration.user?.company_name || "",
      email: registration.email || registration.user?.email || "",
      phone: registration.phone || registration.user?.phone || "",
      purposeOfVisit: registration.purpose_of_visit || "",
      hostName: registration.host_name || "",
      requestedDate: getLocalDate(registration.requested_from),
      requestedTimeFrom: getLocalTime(registration.requested_from),
      requestedTimeTo: getLocalTime(registration.requested_to),
      badgeIdentifier: registration.badge_identifier || "",
      token: registration.qr_token || "N/A",
      showQrOnBadge: true,
      fieldValues: registration.fieldValues || {},
    };

    const doc = (
      <BadgePDF
        data={badgeData}
        qrCodeDataUrl={qrCodeDataUrl}
        customizations={badgeTemplate?.layoutJson}
      />
    );
    const blob = await pdf(doc).toBlob();
    const blobUrl = URL.createObjectURL(blob);
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (isMobile) {
      const printWindow = window.open(blobUrl, "_blank");

      if (!printWindow) {
        showMessage("Please allow pop-ups to print the badge.", "warning");
        return;
      }
      printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
      };
      return;
    }

    const width = Math.floor(window.outerWidth * 0.9);
    const height = Math.floor(window.outerHeight * 0.9);
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const printWindow = window.open(
      "",
      "_blank",
      `width=${width},height=${height},left=${left},top=${top},resizable=no,scrollbars=no,status=no`,
    );

    if (!printWindow) {
      showMessage("Please allow pop-ups to print the badge.", "warning");
      return;
    }

    printWindow.document.write(`
        <html>
          <head>
            <title>Print Badge - ${badgeData.fullName}</title>
            <style>
              html, body {
                margin: 0;
                padding: 0;
                height: 100%;
                overflow: hidden;
                background: #fff;
              }
              iframe {
                width: 100%;
                height: 100%;
                border: none;
              }
            </style>
          </head>
          <body>
            <iframe
              src="${blobUrl}"
              onload="this.contentWindow.focus(); this.contentWindow.print();"
            ></iframe>
          </body>
        </html>
      `);
      printWindow.document.close();
  };

  const handleExportAllBadges = async () => {
    if (!filtered.length) {
      showMessage("No registrations to export", "warning");
      return;
    }

    setExportingBadges(true);
    await exportAllBadges(filtered, badgeTemplate, `badges_${new Date().toISOString().split("T")[0]}.pdf`);
    setExportingBadges(false);
    showMessage("Badges exported successfully", "success");
  };


  const filtered = useMemo(() => {
    const matched = Array.isArray(data) ? data.filter((r) => {
      const matchSearch = [r.full_name, r.email, r.purpose_of_visit]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase());
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
          const fTime24 = `${String(
            filterTime.ampm === "PM"
              ? (parseInt(filterTime.hour12) % 12) + 12
              : parseInt(filterTime.hour12) % 12,
          ).padStart(2, "0")}:${filterTime.minute}:00`;
          
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

  const pagedRows = useMemo(() => {
    return filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [filtered, page, rowsPerPage]);

  const previousVisits = useMemo(
    () =>
      Array.isArray(selected?.history)
        ? selected.history
            .filter((visit) => visit?.id && visit.id !== selected.id)
            .sort(
              (left, right) =>
                new Date(right.created_at) - new Date(left.created_at),
            )
        : [],
    [selected],
  );

  const additionalFieldValues = useMemo(
    () => getVisibleFieldValues(selected),
    [selected],
  );

  const statusOptions = useMemo(() => {
    const optionKeys = [...MANUAL_STATUS_KEYS];
    if (selected?.status && !optionKeys.includes(selected.status)) {
      optionKeys.unshift(selected.status);
    }
    return optionKeys;
  }, [selected?.status]);

  const handleChangePage = (event, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const activeFiltersCount =
    (statusFilter !== "all" ? 1 : 0) + 
    (requestDateFilter ? 1 : 0) + 
    (requestTimeFilter.enabled ? 1 : 0) + 
    (approvedDateFilter ? 1 : 0) + 
    (approvedTimeFilter.enabled ? 1 : 0);

  return (
    <Box>
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
            Registrations
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.5, opacity: 0.8 }}
          >
            View and manage all visitor registrations across your system.
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ mb: 3 }} />

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
            <Button
              variant="outlined"
              startIcon={<ICONS.filter />}
              onClick={() => setFilterModalOpen(true)}
              sx={{ 
                minWidth: { md: 120 },
                whiteSpace: "nowrap",
                height: 40 
              }}
            >
              Filters {activeFiltersCount > 0 && `(${activeFiltersCount})`}
            </Button>

            {data.length > 0 && (
              <Button
                variant="outlined"
                color="primary"
                disabled={exportingBadges || filtered.length === 0}
                startIcon={
                  exportingBadges ? (
                    <CircularProgress size={20} color="inherit" />
                  ) : (
                    <ICONS.print />
                  )
                }
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
                    setSearch("");
                    setStatusFilter("all");
                    setRequestDateFilter("");
                    setRequestTimeFilter({ ...requestTimeFilter, enabled: false });
                    setApprovedDateFilter("");
                    setApprovedTimeFilter({ ...approvedTimeFilter, enabled: false });
                    setPage(0);
                  }}
                >
                  Clear
                </Button>
              </Tooltip>
            )}

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

      {loading ? (
        <LoadingState />
      ) : (
        <>
          {pagedRows.length === 0 ? (
            <NoDataAvailable
              title="No records found"
              description="Try adjusting your filters or search query."
            />
          ) : (
            <ResponsiveCardGrid>
              {pagedRows.map((row) => {
                const config = STATUS_CONFIG[row.status] || {
                  label: row.status,
                  color: "default",
                  icon: <ICONS.info fontSize="small" />,
                };
                return (
                  <AppCard
                    key={row.id}
                    sx={{
                      opacity: fetchingProfile ? 0.7 : 1,
                      height: "100%",
                      width: "100%",
                    }}
                  >
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
                      <Stack spacing={0.6}>
                        <Stack
                          direction="row"
                          alignItems="center"
                          sx={{ gap: 1 }}
                        >
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
                            {row.full_name
                              ?.split(" ")
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
                              {row.full_name}
                            </Typography>
                          </Box>
                        </Stack>
                        <Typography
                          variant="caption"
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 0.5,
                            color: "text.secondary",
                          }}
                        >
                          <ICONS.time
                            fontSize="inherit"
                            sx={{ opacity: 0.7 }}
                          />
                          {formatDateTimeWithLocale(row.created_at)}
                        </Typography>
                      </Stack>
                      <Stack
                        direction="row"
                        alignItems="center"
                        spacing={0.6}
                        sx={{ mt: 1 }}
                      >
                        <Chip
                          label={config.label}
                          color={config.color}
                          size="small"
                          icon={config.icon}
                          sx={{
                            fontWeight: 800,
                            borderRadius: 1.5,
                            height: 24,
                          }}
                        />
                      </Stack>
                    </Box>

                    <Box sx={{ flexGrow: 1, px: 2, py: 1.5 }}>
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          py: 0.8,
                          borderBottom: "1px solid",
                          borderColor: "divider",
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
                          {row.email || "—"}
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          py: 0.8,
                          borderBottom: "1px solid",
                          borderColor: "divider",
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
                          <ICONS.info fontSize="small" sx={{ opacity: 0.6 }} />{" "}
                          Purpose
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
                          {row.purpose_of_visit || "—"}
                        </Typography>
                      </Box>
      {(row.requested_from || row.requested_to) && (
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            py: 0.8,
                            borderBottom: "none",
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
                            <ICONS.event
                              fontSize="small"
                              sx={{ opacity: 0.6 }}
                            />{" "}
                            {(() => {
                              const isApproved = row.status !== "pending" && row.status !== "rejected" && (row.approved_from || row.approved_to);
                              return isApproved ? "Approved Schedule" : "Requested Schedule";
                            })()}
                          </Typography>
                          <Box sx={{ ml: 2, flex: 1, textAlign: "right" }}>
                            <Typography
                              variant="body2"
                              sx={{ fontWeight: 600, color: "text.primary" }}
                            >
                              {(() => {
                                const showApproved = row.status !== "pending" && row.status !== "rejected" && (row.approved_from || row.approved_to);
                                const fromStr = showApproved ? row.approved_from : row.requested_from;
                                const toStr = showApproved ? row.approved_to : row.requested_to;

                                if (!fromStr) return "—";
                                
                                const dateFromFormatted = formatDate(fromStr);
                                const dateToFormatted = formatDate(toStr);

                                return dateToFormatted && dateFromFormatted !== dateToFormatted
                                  ? `${dateFromFormatted} to ${dateToFormatted}`
                                  : dateFromFormatted || "—";
                              })()}
                            </Typography>
                            {(() => {
                              const showApproved = row.status !== "pending" && row.status !== "rejected" && (row.approved_from || row.approved_to);
                              const fromStr = showApproved ? row.approved_from : row.requested_from;
                              const toStr = showApproved ? row.approved_to : row.requested_to;
                              
                              const tFrom = formatTime(fromStr);
                              const tTo = formatTime(toStr);

                              return (tFrom || tTo) && (
                                <Typography
                                  variant="caption"
                                  sx={{
                                    fontWeight: 600,
                                    color: "text.secondary",
                                    display: "block",
                                  }}
                                >
                                  {tFrom || "—"} - {tTo || "—"}
                                </Typography>
                              );
                            })()}
                          </Box>
                        </Box>
                      )}
                    </Box>

                    <Box
                      sx={{
                        p: 1.5,
                        borderTop: "1px solid",
                        borderColor: "divider",
                        bgcolor: isDark
                          ? "rgba(255,255,255,0.02)"
                          : "rgba(0,0,0,0.01)",
                        display: "flex",
                        justifyContent: "flex-end",
                        alignItems: "center",
                        gap: 1,
                      }}
                    >
                      <Tooltip title="Print Badge">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePrintBadge(row);
                          }}
                          sx={{ color: "success.main" }}
                        >
                          <ICONS.print fontSize="small" />
                        </IconButton>
                      </Tooltip>

                      <Tooltip title="View Details">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenProfile(row);
                          }}
                          sx={{ color: "primary.main" }}
                        >
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

      {/* Filter Modal */}
      <FilterModal
        open={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        title="Filter Registrations"
      >
        <Stack spacing={3}>
          <Box>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, ml: 1 }}>
              Status
            </Typography>
            <TextField
              select
              fullWidth
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(0);
              }}
              InputProps={{ sx: { borderRadius: 3 } }}
            >
              <MenuItem value="all">Any Status</MenuItem>
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <MenuItem key={key} value={key}>
                  {cfg.label}
                </MenuItem>
              ))}
            </TextField>
          </Box>

          <Box>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, ml: 1 }}>
              Requested Visit Date
            </Typography>
            <DateTimeFieldFlatpickr
              placeholder="Select Date"
              value={requestDateFilter}
              onChange={(val) => {
                setRequestDateFilter(val);
                setPage(0);
              }}
              enableTime={false}
            />
          </Box>

          <Box>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1, ml: 1 }}>
              <Typography variant="subtitle2" fontWeight={700}>
                Requested Visit Time
              </Typography>
              <Chip
                label={requestTimeFilter.enabled ? "Enabled" : "Disabled"}
                size="small"
                color={requestTimeFilter.enabled ? "primary" : "default"}
                onClick={() => setRequestTimeFilter({ ...requestTimeFilter, enabled: !requestTimeFilter.enabled })}
                sx={{ fontWeight: 800, cursor: "pointer" }}
              />
            </Stack>
            <Stack direction="row" spacing={1} sx={{ opacity: requestTimeFilter.enabled ? 1 : 0.5, pointerEvents: requestTimeFilter.enabled ? "auto" : "none" }}>
              <TextField
                select
                fullWidth
                label="Hr"
                size="small"
                value={requestTimeFilter.hour12}
                onChange={(e) => setRequestTimeFilter({ ...requestTimeFilter, hour12: e.target.value })}
                InputProps={{ sx: { borderRadius: 3 } }}
              >
                {HOURS.map((h) => <MenuItem key={h} value={h}>{h}</MenuItem>)}
              </TextField>
              <TextField
                select
                fullWidth
                label="Min"
                size="small"
                value={requestTimeFilter.minute}
                onChange={(e) => setRequestTimeFilter({ ...requestTimeFilter, minute: e.target.value })}
                InputProps={{ sx: { borderRadius: 3 } }}
              >
                {MINUTES.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
              </TextField>
              <TextField
                select
                fullWidth
                label="AM/PM"
                size="small"
                value={requestTimeFilter.ampm}
                onChange={(e) => setRequestTimeFilter({ ...requestTimeFilter, ampm: e.target.value })}
                InputProps={{ sx: { borderRadius: 3 } }}
              >
                {PERIODS.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
              </TextField>
            </Stack>
          </Box>

          <Divider />

          <Box>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, ml: 1 }}>
              Approved Visit Date
            </Typography>
            <DateTimeFieldFlatpickr
              placeholder="Select Date"
              value={approvedDateFilter}
              onChange={(val) => {
                setApprovedDateFilter(val);
                setPage(0);
              }}
              enableTime={false}
            />
          </Box>

          <Box>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1, ml: 1 }}>
              <Typography variant="subtitle2" fontWeight={700}>
                Approved Visit Time
              </Typography>
              <Chip
                label={approvedTimeFilter.enabled ? "Enabled" : "Disabled"}
                size="small"
                color={approvedTimeFilter.enabled ? "primary" : "default"}
                onClick={() => setApprovedTimeFilter({ ...approvedTimeFilter, enabled: !approvedTimeFilter.enabled })}
                sx={{ fontWeight: 800, cursor: "pointer" }}
              />
            </Stack>
            <Stack direction="row" spacing={1} sx={{ opacity: approvedTimeFilter.enabled ? 1 : 0.5, pointerEvents: approvedTimeFilter.enabled ? "auto" : "none" }}>
              <TextField
                select
                fullWidth
                label="Hr"
                size="small"
                value={approvedTimeFilter.hour12}
                onChange={(e) => setApprovedTimeFilter({ ...approvedTimeFilter, hour12: e.target.value })}
                InputProps={{ sx: { borderRadius: 3 } }}
              >
                {HOURS.map((h) => <MenuItem key={h} value={h}>{h}</MenuItem>)}
              </TextField>
              <TextField
                select
                fullWidth
                label="Min"
                size="small"
                value={approvedTimeFilter.minute}
                onChange={(e) => setApprovedTimeFilter({ ...approvedTimeFilter, minute: e.target.value })}
                InputProps={{ sx: { borderRadius: 3 } }}
              >
                {MINUTES.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
              </TextField>
              <TextField
                select
                fullWidth
                label="AM/PM"
                size="small"
                value={approvedTimeFilter.ampm}
                onChange={(e) => setApprovedTimeFilter({ ...approvedTimeFilter, ampm: e.target.value })}
                InputProps={{ sx: { borderRadius: 3 } }}
              >
                {PERIODS.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
              </TextField>
            </Stack>
          </Box>

          <Button
            variant="contained"
            fullWidth
            startIcon={<ICONS.filter />}
            onClick={() => setFilterModalOpen(false)}
            sx={{ mt: 2, height: 48, borderRadius: 3, fontWeight: 800 }}
          >
            Apply
          </Button>

          <Button
            variant="text"
            fullWidth
            color="inherit"
            startIcon={<ICONS.clear />}
            onClick={() => {
              setStatusFilter("all");
              setRequestDateFilter("");
              setRequestTimeFilter({ hour12: "", minute: "00", ampm: "AM", enabled: false });
              setApprovedDateFilter("");
              setApprovedTimeFilter({ hour12: "", minute: "00", ampm: "AM", enabled: false });
              setFilterModalOpen(false);
              setPage(0);
            }}
            sx={{ fontWeight: 700, opacity: 0.6 }}
          >
            Clear
          </Button>
        </Stack>
      </FilterModal>

      <Dialog
        open={!!selected}
        onClose={closeProfileDialog}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 4, overflow: "hidden", variant: "frosted" },
        }}
      >
        <DialogHeader
          title="Visitor Details"
          onClose={closeProfileDialog}
        />
        <Divider />
        <DialogContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
          {selected &&
            (() => {
              const sc = STATUS_CONFIG[selected.status] || {
                label: selected.status,
                color: "default",
              };
              return (
                <Stack spacing={3}>
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
                        {selected.full_name
                          ?.split(" ")
                          .map((name) => name[0])
                          .slice(0, 2)
                          .join("")}
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="h6" fontWeight={800}>
                          {selected.full_name}
                        </Typography>
                        <Stack
                          direction="row"
                          spacing={2}
                          sx={{ mt: 0.4, flexWrap: "wrap", gap: 1 }}
                        >
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
                          >
                            <ICONS.emailOutline fontSize="inherit" /> {selected.email || "No email"}
                          </Typography>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
                          >
                            <ICONS.phone fontSize="inherit" /> {selected.phone || "No phone"}
                          </Typography>
                        </Stack>
                        <Chip
                          label={sc.label}
                          color={sc.color}
                          size="small"
                          sx={{
                            mt: 1.2,
                            fontWeight: 700,
                            height: 22,
                            fontSize: "0.65rem",
                          }}
                        />
                      </Box>
                    </Stack>
                  </Box>

                  <Tabs
                    value={selectedTab}
                    onChange={(_, value) => setSelectedTab(value)}
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
                    <Tab
                      value="details"
                      icon={<ICONS.info fontSize="small" />}
                      iconPosition="start"
                      label="Details"
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
                    <Tab
                      value="history"
                      icon={<ICONS.history fontSize="small" />}
                      iconPosition="start"
                      label="History"
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
                  </Tabs>

                  {selectedTab === "details" ? (
                    <Stack spacing={3}>
                      <Box sx={{ px: { xs: 0, sm: 1 } }}>
                        <Box
                          sx={{
                            display: "grid",
                            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                            gap: { xs: 2, md: "16px 32px" },
                          }}
                        >
                          <InfoItem
                            label="Requested Schedule"
                            value={buildScheduleText(
                              selected.requested_from,
                              selected.requested_to,
                              "Not provided",
                            )}
                            icon={<ICONS.event fontSize="small" />}
                          />
                          <InfoItem
                            label="Approved Schedule"
                            value={buildScheduleText(
                              selected.approved_from,
                              selected.approved_to,
                              "Pending approval",
                            )}
                            icon={<ICONS.checkCircle fontSize="small" />}
                          />
                           <InfoItem
                            label="Purpose of Visit"
                            value={selected.purpose_of_visit}
                            icon={<ICONS.info fontSize="small" />}
                          />
                          {selected.checked_in_at && (
                            <InfoItem
                              label="Check-in Time"
                              value={formatDateTimeWithLocale(selected.checked_in_at)}
                              icon={<ICONS.login fontSize="small" />}
                            />
                          )}
                          {selected.checked_out_at && (
                            <InfoItem
                              label="Check-out Time"
                              value={formatDateTimeWithLocale(selected.checked_out_at)}
                              icon={<ICONS.logout fontSize="small" />}
                            />
                          )}
                        </Box>
                      </Box>

                      {additionalFieldValues.length > 0 && (
                        <Box>
                          <Divider sx={{ mb: 2 }} />
                          <Typography
                            variant="subtitle2"
                            sx={{
                              mb: 1.5,
                              fontWeight: 700,
                              color: "text.secondary",
                              textTransform: "uppercase",
                              fontSize: "0.7rem",
                              letterSpacing: 0.5,
                            }}
                          >
                            Additional Information
                          </Typography>
                          <Box sx={{ px: { xs: 0, sm: 1 } }}>
                            <Box
                              sx={{
                                display: "grid",
                                gridTemplateColumns: {
                                  xs: "1fr",
                                  md: "1fr 1fr",
                                },
                                gap: { xs: 1.5, md: "16px 32px" },
                              }}
                            >
                              {additionalFieldValues.map((fv) => (
                                <Box
                                  key={fv.id}
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
                                    {fv.customField?.label ||
                                      fv.customField?.fieldKey ||
                                      "Field"}
                                  </Typography>
                                  <Typography
                                    variant="body2"
                                    fontWeight={600}
                                    sx={{ mt: 0.4 }}
                                  >
                                    {fv.value || "—"}
                                  </Typography>
                                </Box>
                              ))}
                            </Box>
                          </Box>
                        </Box>
                      )}

                      {selected.status === "rejected" &&
                        selected.rejection_reason && (
                          <Alert
                            severity="error"
                            variant="outlined"
                            sx={{ borderRadius: 2.5 }}
                          >
                            <Typography
                              variant="caption"
                              fontWeight={700}
                              display="block"
                            >
                              REJECTION REASON
                            </Typography>
                            <Typography variant="body2">
                              {selected.rejection_reason}
                            </Typography>
                          </Alert>
                        )}
                    </Stack>
                  ) : previousVisits.length ? (
                    <Stack spacing={2}>
                      {previousVisits.map((visit) => (
                        <PreviousVisitCard key={visit.id} visit={visit} />
                      ))}
                    </Stack>
                  ) : (
                    <NoDataAvailable
                      title="No previous history"
                      description="This visitor does not have any earlier registrations yet."
                      compact
                      minHeight={220}
                    />
                  )}
                </Stack>
              );
            })()}
        </DialogContent>
        <Divider />
        <DialogActions
          sx={{
            p: 2.5,
            alignItems: "stretch",
            bgcolor: (theme) =>
              alpha(
                theme.palette.common.black,
                theme.palette.mode === "dark" ? 0.12 : 0.02,
              ),
          }}
        >
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            alignItems={{ xs: "stretch", sm: "flex-end" }}
            justifyContent="space-between"
            sx={{ width: "100%" }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  mb: 0.5,
                  color: "text.secondary",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Change Status
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Select a new status here. It updates the registration right away.
              </Typography>
            </Box>

            <Stack
              spacing={1.25}
              sx={{
                minWidth: { xs: "100%", sm: 280 },
                width: { xs: "100%", sm: "auto" },
              }}
            >
              <FormControl size="small">
                <InputLabel id="registration-status-select-label">
                  Change status
                </InputLabel>
                <Select
                  labelId="registration-status-select-label"
                  label="Change status"
                  value={pendingStatus || selected?.status || ""}
                  onChange={(e) => handleManualStatusChange(e.target.value)}
                  disabled={actionLoading || !selected || selected?.status === "checked_out"}
                  sx={{
                    borderRadius: 30,
                    bgcolor: "background.paper",
                  }}
                >
                  {statusOptions.map((key) => {
                    const config = STATUS_CONFIG[key] || {
                      label: toTitleCase(key),
                    };
                    const isCurrent = key === selected?.status;
                    const isUnavailable =
                      !MANUAL_STATUS_KEYS.includes(key) && !isCurrent || 
                      (selected?.status === "approved" && key === "pending") ||
                      (selected?.status === "checked_in" && key === "pending") ||
                      (selected?.status === "rejected" && key === "pending") ||
                      selected?.status === "checked_out";

                    return (
                      <MenuItem
                        key={key}
                        value={key}
                        disabled={isUnavailable}
                      >
                        <Stack spacing={0.2}>
                          <Typography variant="body2" fontWeight={700}>
                            {config.label}
                          </Typography>
                          {isCurrent ? (
                            <Typography variant="caption" color="text.secondary">
                              Current status
                            </Typography>
                          ) : null}
                        </Stack>
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>

              {pendingStatus === "rejected" &&
                selected?.status !== "rejected" && (
                  <Stack spacing={1.25}>
                    <TextField
                      fullWidth
                      multiline
                      minRows={2}
                      label="Rejection reason"
                      placeholder="Why is this registration being rejected?"
                      value={rejectionReasonDraft}
                      onChange={(e) => {
                        setRejectionReasonDraft(e.target.value);
                        if (rejectionReasonError) {
                          setRejectionReasonError("");
                        }
                      }}
                      error={Boolean(rejectionReasonError)}
                      helperText={rejectionReasonError}
                      disabled={actionLoading}
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          borderRadius: 3,
                          bgcolor: "background.paper",
                        },
                      }}
                    />
                    <Button
                      variant="contained"
                      color="error"
                      startIcon={
                        actionLoading ? (
                          <CircularProgress size={18} color="inherit" />
                        ) : (
                          <ICONS.close />
                        )
                      }
                      disabled={actionLoading}
                      onClick={handleRejectSubmit}
                      sx={{
                        alignSelf: { xs: "stretch", sm: "flex-end" },
                        borderRadius: 30,
                        px: 3,
                        fontWeight: 700,
                      }}
                    >
                      Reject
                    </Button>
                  </Stack>
                )}

              {/* Check-in/Check-out Section - Only for Approved Registrations */}
              {selected?.status === "approved" && (
                <Stack spacing={1.25}>
                  <Typography
                    variant="caption"
                    sx={{
                      display: "block",
                      color: "text.secondary",
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    Check-in / Check-out
                  </Typography>
                  <Button
                    fullWidth
                    variant="contained"
                    color="success"
                    startIcon={
                      actionLoading ? (
                        <CircularProgress size={18} color="inherit" />
                      ) : (
                        <ICONS.login />
                      )
                    }
                    disabled={actionLoading}
                    onClick={handleCheckInAction}
                    sx={{
                      borderRadius: 30,
                      fontWeight: 700,
                    }}
                  >
                    Check In
                  </Button>
                </Stack>
              )}

              {selected?.status === "checked_in" && (
                <Stack spacing={1.25}>
                  <Typography
                    variant="caption"
                    sx={{
                      display: "block",
                      color: "text.secondary",
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    Check-in / Check-out
                  </Typography>
                  <Button
                    fullWidth
                    variant="contained"
                    color="error"
                    startIcon={
                      actionLoading ? (
                        <CircularProgress size={18} color="inherit" />
                      ) : (
                        <ICONS.logout />
                      )
                    }
                    disabled={actionLoading}
                    onClick={handleCheckOutAction}
                    sx={{
                      borderRadius: 30,
                      fontWeight: 700,
                    }}
                  >
                    Check Out
                  </Button>
                </Stack>
              )}
            </Stack>
          </Stack>
        </DialogActions>
      </Dialog>
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

function PreviousVisitCard({ visit }) {
  const visitFieldValues = getVisibleFieldValues(visit);
  const statusConfig = STATUS_CONFIG[visit.status] || {
    label: toTitleCase(visit.status),
    color: "default",
    icon: <ICONS.history fontSize="small" />,
  };

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
            {visit.requested_date ? formatDate(visit.requested_date) : "Previous visit"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Submitted {formatDateTimeWithLocale(visit.created_at)}
          </Typography>
        </Box>

        <Chip
          label={statusConfig.label}
          color={statusConfig.color}
          size="small"
          icon={statusConfig.icon}
          sx={{ fontWeight: 700, borderRadius: 2, height: 26 }}
        />
      </Stack>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          gap: { xs: 1.75, md: "16px 32px" },
        }}
      >
        <InfoItem
          label="Purpose of Visit"
          value={visit.purpose_of_visit}
          icon={<ICONS.info fontSize="small" />}
        />
        <InfoItem
          label="Requested Schedule"
          value={buildScheduleText(
            visit.requested_from,
            visit.requested_to,
            "Not provided",
          )}
          icon={<ICONS.event fontSize="small" />}
        />
        <InfoItem
          label="Approved Schedule"
          value={buildScheduleText(
            visit.approved_from,
            visit.approved_to,
            "Not approved",
          )}
          icon={<ICONS.checkCircle fontSize="small" />}
        />
        {visit.checked_in_at && (
          <InfoItem
            label="Check-in Time"
            value={formatDateTimeWithLocale(visit.checked_in_at)}
            icon={<ICONS.login fontSize="small" />}
          />
        )}
        {visit.checked_out_at && (
          <InfoItem
            label="Check-out Time"
            value={formatDateTimeWithLocale(visit.checked_out_at)}
            icon={<ICONS.logout fontSize="small" />}
          />
        )}
        {visit.rejection_reason ? (
          <InfoItem
            label="Rejection Reason"
            value={visit.rejection_reason}
            icon={<ICONS.close fontSize="small" />}
            sx={{ gridColumn: { md: "1 / -1" } }}
          />
        ) : null}
      </Box>

      {visitFieldValues.length > 0 && (
        <>
          <Divider sx={{ my: 2 }} />
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
              gap: { xs: 1.5, md: "16px 32px" },
            }}
          >
            {visitFieldValues.map((fieldValue) => (
              <Box
                key={fieldValue.id}
                sx={{
                  p: 1.75,
                  borderRadius: 2.5,
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: (theme) =>
                    theme.palette.mode === "dark"
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
                  {fieldValue.customField?.label ||
                    fieldValue.customField?.fieldKey ||
                    "Field"}
                </Typography>
                <Typography variant="body2" fontWeight={600} sx={{ mt: 0.4 }}>
                  {formatFieldDisplayValue(fieldValue.value)}
                </Typography>
              </Box>
            ))}
          </Box>
        </>
      )}
    </Box>
  );
}
