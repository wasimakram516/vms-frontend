"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Box,
  Typography,
  Button,
  Stack,
  Container,
  Paper,
  Chip,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  TextField,
  IconButton,
  CircularProgress,
  Tooltip,
} from "@mui/material";

import { pdf } from "@react-pdf/renderer";
import QRCode from "qrcode";
import BadgePDF from "@/components/badges/BadgePDF";
import { getDefaultBadgeTemplate } from "@/services/badgeService";

import QrScanner from "@/components/QrScanner";
import RoleGuard from "@/components/auth/RoleGuard";
import ICONS from "@/utils/iconUtil";
import LoadingState from "@/components/LoadingState";
import { useMessage } from "@/contexts/MessageContext";
import { useColorMode } from "@/contexts/ThemeContext";
import { useSocket } from "@/contexts/SocketContext";
import { verifyRegistrationByToken, updateStatus, getRegistrationActivityLogs, mapRegistration } from "@/services/registrationService";
import { formatDate, formatTime } from "@/utils/dateUtils";

const STATUS_CONFIG = {
  pending:       { label: "Pending",         color: "warning" },
  admin_approved:{ label: "Dept. Approved",  color: "info" },
  approved:      { label: "Approved",        color: "success" },
  rejected:      { label: "Rejected",        color: "error" },
  checked_in:    { label: "Checked In",      color: "info" },
  checked_out:   { label: "Checked Out",     color: "default" },
  visit_ended:   { label: "Visit Ended",     color: "default" },
  cancelled:     { label: "Cancelled",       color: "default" },
  expired:       { label: "Expired",         color: "default" },
};

export default function StaffVerifyPage() {
  const { showMessage } = useMessage();
  const { mode } = useColorMode();
  const isDark = mode === "dark";
  const [showScanner, setShowScanner] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [activityLogs, setActivityLogs] = useState([]);
  const scanningRef = useRef(false);
  const [badgeTemplate, setBadgeTemplate] = useState(null);

  useEffect(() => {
    fetchDefaultBadgeTemplate();
  }, []);

  const fetchDefaultBadgeTemplate = async () => {
    const template = await getDefaultBadgeTemplate();
    if (template && !template.error) {
      setBadgeTemplate(template);
    }
  };

  const doVerify = useCallback(async (input) => {
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const res = await verifyRegistrationByToken(input);
      
      if (res?.error) {
        setError(res.message);
      } else if (res) {
        const mapped = mapRegistration(res);
        setResult(mapped);
        // Fetch activity logs for timestamps (check-in, check-out, visit-ended)
        if (res.id && ["checked_in", "checked_out", "visit_ended"].includes(res.status)) {
          const logs = await getRegistrationActivityLogs(res.id);
          setActivityLogs(logs || []);
        } else {
          setActivityLogs([]);
        }
      } else {
        setError("Invalid or unknown token.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleScanSuccess = useCallback(async (scanned) => {
    if (scanningRef.current) return;
    scanningRef.current = true;
    setShowScanner(false);
    await doVerify(scanned);
    setTimeout(() => { scanningRef.current = false; }, 600);
  }, [doVerify]);

  const selfInitiatedRef = useRef(null);

  const handleCheckInAction = async () => {
    if (!result?.id) return;
    setActionLoading(true);
    selfInitiatedRef.current = { id: result.id, status: "checked_in" };
    try {
      const updated = await updateStatus(result.id, { status: "checked_in", clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      if (!updated?.error) {
        setResult(prev => ({ ...prev, status: updated?.status || "checked_in" }));
        const logs = await getRegistrationActivityLogs(result.id);
        setActivityLogs(logs || []);
      }
    } finally {
      setActionLoading(false);
      setTimeout(() => { selfInitiatedRef.current = null; }, 5000);
    }
  };

  const handleCheckOutAction = async () => {
    if (!result?.id) return;
    setActionLoading(true);
    selfInitiatedRef.current = { id: result.id, status: "checked_out" };
    try {
      const updated = await updateStatus(result.id, { status: "checked_out" });
      if (!updated?.error) {
        setResult(prev => ({ ...prev, status: updated?.status || "checked_out" }));
        const logs = await getRegistrationActivityLogs(result.id);
        setActivityLogs(logs || []);
      }
    } finally {
      setActionLoading(false);
      setTimeout(() => { selfInitiatedRef.current = null; }, 5000);
    }
  };

  const handlePrintBadge = async (registration) => {
    if (!registration?.qr_token) {
      showMessage("No QR token available for this registration", "warning");
      return;
    }

    try {
      const qrCodeDataUrl = await QRCode.toDataURL(registration.qr_token || "N/A", {
        width: 300,
        margin: 1,
        color: { dark: "#000000", light: "#ffffff" },
      });

      const badgeData = {
        fullName:
          registration.full_name ||
          registration.visitor?.fullName ||
          registration.user?.full_name ||
          "Unnamed Visitor",
        company:
          registration.organisation ||
          registration.companyName ||
          registration.company_name ||
          registration.visitor?.companyName ||
          registration.visitor?.organisation ||
          registration.user?.companyName ||
          registration.user?.company_name ||
          "",
        email: registration.email || registration.visitor?.email || registration.user?.email || "",
        phone: registration.phone || registration.visitor?.phone || registration.user?.phone || "",
        purposeOfVisit: registration.purpose_of_visit || "",
        hostName: registration.host_name || "",
        requestedDate: registration.requested_from ? formatDate(registration.requested_from) : "",
        requestedTimeFrom: registration.requested_from ? formatTime(registration.requested_from) : "",
        requestedTimeTo: registration.requested_to ? formatTime(registration.requested_to) : "",
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
        return;
      }

      const width = Math.floor(window.outerWidth * 0.9);
      const height = Math.floor(window.outerHeight * 0.9);
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const printWindow = window.open(
        "",
        "_blank",
        `width=${width},height=${height},left=${left},top=${top},resizable=no,scrollbars=no,status=no`
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
    } catch (err) {
      console.error("Print error:", err);
      showMessage("Failed to generate print badge.", "error");
    }
  };

  const reset = () => {
    setToken("");
    setResult(null);
    setError(null);
    setShowScanner(false);
    setManualMode(false);
  };

  const { on } = useSocket();
  // Ref keeps the current registration ID always up-to-date inside the socket
  const currentRegistrationIdRef = useRef(null);
  const currentRegistrationStatusRef = useRef(null);
  useEffect(() => {
    currentRegistrationIdRef.current = result?.id ?? null;
    currentRegistrationStatusRef.current = result?.status ?? null;
  }, [result?.id, result?.status]);

  useEffect(() => {
    const unsub = on("registration:updated", (updatedReg) => {
      // Ignore events that don't belong to the registration currently on screen.
      if (!currentRegistrationIdRef.current || currentRegistrationIdRef.current !== updatedReg.id) return;

      const isAccessible = ["approved", "checked_in", "checked_out"].includes(updatedReg.status);
      const mappedReg = {
        ...mapRegistration(updatedReg),
        notApproved: !isAccessible,
      };
      setResult(mappedReg);

      // Fetch activity logs for timestamps (check-in, check-out, visit-ended)
      if (["checked_in", "checked_out", "visit_ended"].includes(updatedReg.status)) {
        getRegistrationActivityLogs(updatedReg.id).then(logs => setActivityLogs(logs || []));
      }

      const isSelfEcho =
        selfInitiatedRef.current?.id === updatedReg.id &&
        selfInitiatedRef.current?.status === updatedReg.status;

      const statusActuallyChanged = updatedReg.status !== currentRegistrationStatusRef.current;

      if (isSelfEcho) {
        selfInitiatedRef.current = null;
      } else if (statusActuallyChanged) {
        showMessage("This visitor's status has been updated by another operator.", "info");
      }
    });
    return () => unsub?.();
  }, [on, showMessage]);

  const sc = result ? (STATUS_CONFIG[result.status] || { label: result.status, color: "default" }) : null;

  return (
    <RoleGuard allowedRoles={["staff"]} allowedStaffTypes={["gate"]}>
      <Container maxWidth="sm">
        <Box sx={{ py: 4 }}>
          <Typography variant="h4" fontWeight={800} gutterBottom textAlign="center" color="primary.main" sx={{ fontFamily: "'Comfortaa', cursive" }}>
            Gate Check-in
          </Typography>
          <Typography color="text.secondary" textAlign="center" sx={{ mb: 4 }}>
            Scan visitor QR or enter token manually to grant access.
          </Typography>

          <Box sx={{ minHeight: "calc(90vh - 280px)", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
            {!showScanner && !loading && !result && !error && (
              <Paper elevation={0} variant="frosted" sx={{ p: 4, borderRadius: 4, textAlign: "center", width: "100%" }}>
            <Box
              sx={{
                width: 72, height: 72, borderRadius: 3,
                bgcolor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)",
                boxShadow: isDark ? "inset 0 1px 0 rgba(255,255,255,0.06)" : "none",
                color: "text.primary",
                display: "flex", alignItems: "center", justifyContent: "center",
                mx: "auto", mb: 3
              }}
            >
              <ICONS.qrCodeScanner sx={{ fontSize: 40 }} />
            </Box>
            
            {!manualMode ? (
              <Stack spacing={2}>
                <Button 
                  variant="contained" 
                  size="large" 
                  fullWidth 
                  startIcon={<ICONS.qrCodeScanner />} 
                  onClick={() => setShowScanner(true)}
                  sx={{ py: 1.8, borderRadius: 3, fontSize: "1.1rem" }}
                >
                  QR Check-in
                </Button>
                <Button 
                  variant="outlined" 
                  fullWidth 
                  startIcon={<ICONS.key />}
                  onClick={() => setManualMode(true)}
                  sx={{ py: 1.5, borderRadius: 3 }}
                >
                  VIP Fast Track
                </Button>
              </Stack>
            ) : (
              <Stack spacing={3}>
                <TextField 
                  fullWidth 
                  label="Visitor Token" 
                  autoFocus
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") doVerify(token); }}
                  placeholder="e.g. SN-ABC123"
                />
                <Stack direction="row" spacing={1}>
                  <Button variant="text" startIcon={<ICONS.back />} onClick={() => setManualMode(false)} sx={{ flex: 1 }}>Back</Button>
                  <Button variant="contained" startIcon={<ICONS.checkCircle />} onClick={() => doVerify(token)} sx={{ flex: 2 }} disabled={!token.trim()}>Verify</Button>
                </Stack>
              </Stack>
            )}
          </Paper>
        )}

        {showScanner && (
          <QrScanner 
            onScanSuccess={handleScanSuccess}
            onCancel={() => setShowScanner(false)}
            onError={(err) => { showMessage(err, "error"); setShowScanner(false); }}
          />
        )}

        {loading && (
          <LoadingState
            cardMaxWidth={380}
          />
        )}

        {result && (
          <Paper elevation={0} sx={{ p: 3, borderRadius: 4, border: `1px solid ${sc.color === "success" ? (isDark ? "rgba(46,125,50,0.5)" : "rgba(46,125,50,0.3)") : "divider"}`, bgcolor: "background.paper" }}>
            <Stack direction="row" alignItems="center" spacing={2} mb={3}>
              <Box sx={{ bgcolor: `${sc.color}.main`, color: sc.color === "default" ? (isDark ? "#fff" : "rgba(0,0,0,0.7)") : "#fff", p: 1, borderRadius: 2, display: "flex" }}>
                {sc.color === "success" ? <ICONS.checkCircle /> : sc.color === "error" ? <ICONS.errorOutline /> : ["visit_ended", "cancelled", "expired"].includes(result.status) ? <ICONS.logout /> : <ICONS.time />}
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" fontWeight={700}>
                  {result.status === "visit_ended" ? "Visit Concluded" : result.status === "rejected" ? "Visit Rejected" : result.status === "cancelled" ? "Visit Cancelled" : result.status === "expired" ? "Visit Expired" : "Verification Success"}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip label={sc.label} color={sc.color} size="small" sx={{ fontWeight: 600 }} />
                  {result.overstay && (
                    <Chip label="Overstay Detected" color="error" size="small" sx={{ fontWeight: 800 }} />
                  )}
                </Stack>
              </Box>
              {["admin_approved", "approved", "checked_in", "checked_out"].includes(result.status) && (
                <Tooltip title="Print Badge">
                  <IconButton
                    onClick={() => handlePrintBadge(result)}
                    sx={{ color: "success.main" }}
                  >
                    <ICONS.print />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>

            <Divider sx={{ mb: 2 }} />

            {["pending", "admin_approved"].includes(result.status) && (
              <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
                Not yet approved
              </Alert>
            )}
            {result.status === "visit_ended" && (
              <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
                This visit has already been concluded. No further actions available.
              </Alert>
            )}
            {result.status === "rejected" && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                {(result.rejectionReason || result.rejection_reason)
                  ? `This registration was rejected for the following reason: ${result.rejectionReason || result.rejection_reason}`
                  : "This registration was rejected."}
              </Alert>
            )}
            {result.status === "cancelled" && (
              <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
                This visit has been cancelled. No further actions available.
              </Alert>
            )}
            {result.status === "expired" && (
              <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
                This registration has expired. No further actions available.
              </Alert>
            )}

            {/* Field Display Logic */}
            <List dense disablePadding>
              {(() => {
                const status = result.status;
                const isPending = ["pending", "admin_approved"].includes(status);
                const isApproved = status === "approved";
                const isCheckedIn = status === "checked_in";
                const isCheckedOut = status === "checked_out";
                const isEnded = status === "visit_ended";
                const isRejected = status === "rejected";
                const isCancelled = status === "cancelled";
                const isExpired = status === "expired";
                const fieldValues = Array.isArray(result.fieldValues)
                  ? result.fieldValues
                  : Array.isArray(result.visitor?.fieldValues)
                    ? result.visitor.fieldValues
                    : [];

                const normalizeKey = (value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
                const renderFieldValue = (value) => {
                  if (value == null || value === "") return null;
                  if (typeof value === "object") {
                    return value.name || value.label || value.value || JSON.stringify(value);
                  }
                  return String(value);
                };
                const findCustomFieldValue = (aliases) => {
                  const normalizedAliases = aliases.map(normalizeKey);
                  const match = fieldValues.find((fv) => {
                    const key = normalizeKey(fv?.customField?.fieldKey || fv?.customField?.name);
                    const label = normalizeKey(fv?.customField?.label);
                    return normalizedAliases.includes(key) || normalizedAliases.includes(label);
                  });
                  return renderFieldValue(match?.value);
                };

                // Final field extraction with fallback to visitor summary
                const visitorName = findCustomFieldValue(["fullname", "name", "visitorname"]) || result.visitor?.fullName || result.full_name || result.user?.fullName || "N/A";
                const company = findCustomFieldValue(["company", "organisation", "organization", "employer", "firm"]) || result.visitor?.companyName || result.visitor?.organisation || result.organisation || result.companyName || result.user?.companyName || null;
                const purpose = findCustomFieldValue(["purposeofvisit", "purpose", "visitpurpose"]) || result.visitor?.purposeOfVisit || result.purpose_of_visit || null;
                const department = findCustomFieldValue(["department", "dept", "division", "unit", "section", "team", "businessunit"]) || result.visitor?.department?.name || result.visitor?.department || result.department?.name || result.department || null;
                const accessLevel = findCustomFieldValue(["accesslevel", "access level", "access", "clearance", "securitylevel", "badgelevel", "accesstype", "zone"]) || result.visitor?.accessLevel?.name || result.visitor?.accessLevel || result.accessLevel?.name || result.accessLevel || null;
                const idTypeFromField = findCustomFieldValue(["idtype", "identificationtype", "documenttype", "doctype", "id document type"]);
                const omanIdValue = findCustomFieldValue(["omanid", "omanidnumber", "omannationalid", "nationalid", "civilid", "idcardnumber"]);
                const passportValue = findCustomFieldValue(["passport", "passportnumber", "passportno", "passportid"]);
                const genericIdValue = findCustomFieldValue(["idnumber", "idno", "identificationnumber", "documentnumber"]);

                const resolvedId = (() => {
                  const normalizedType = normalizeKey(idTypeFromField);

                  if (normalizedType.includes("oman") && (omanIdValue || genericIdValue)) {
                    return { type: "Oman ID", value: omanIdValue || genericIdValue };
                  }
                  if (normalizedType.includes("passport") && (passportValue || genericIdValue)) {
                    return { type: "Passport", value: passportValue || genericIdValue };
                  }
                  if (omanIdValue) {
                    return { type: "Oman ID", value: omanIdValue };
                  }
                  if (passportValue) {
                    return { type: "Passport", value: passportValue };
                  }
                  if (idTypeFromField && genericIdValue) {
                    return { type: idTypeFromField, value: genericIdValue };
                  }
                  if (genericIdValue) {
                    return { type: "ID", value: genericIdValue };
                  }
                  return null;
                })();

                // Get latest check-in time from logs
                const checkInLogs = (activityLogs || []).filter((log) => log?.activityType === "checked_in");
                const latestCheckInLog = checkInLogs.reduce((latest, current) => {
                  if (!latest) return current;

                  const latestTime = new Date(latest?.metadata?.checkedInAt || latest?.createdAt || 0).getTime();
                  const currentTime = new Date(current?.metadata?.checkedInAt || current?.createdAt || 0).getTime();

                  return currentTime > latestTime ? current : latest;
                }, null);
                const checkInTime = latestCheckInLog?.metadata?.checkedInAt || latestCheckInLog?.createdAt;
                const expectedCheckout = (() => {
                  if (!result.approved_to) return "—";
                  const approvedTo = new Date(result.approved_to);
                  const now = new Date();
                  const expected = new Date(now);
                  expected.setHours(
                    approvedTo.getHours(),
                    approvedTo.getMinutes(),
                    approvedTo.getSeconds(),
                    approvedTo.getMilliseconds()
                  );
                  return `${formatDate(expected)} ${formatTime(expected)}`;
                })();

                const checkOutLogs = (activityLogs || []).filter((log) => log?.activityType === "checked_out");
                const latestCheckOutLog = checkOutLogs.reduce((latest, current) => {
                  if (!latest) return current;
                  const latestTime = new Date(latest?.metadata?.checkedOutAt || latest?.createdAt || 0).getTime();
                  const currentTime = new Date(current?.metadata?.checkedOutAt || current?.createdAt || 0).getTime();
                  return currentTime > latestTime ? current : latest;
                }, null);
                const checkOutTime = latestCheckOutLog?.metadata?.checkedOutAt || latestCheckOutLog?.createdAt;

                const endedLog = (activityLogs || []).find((log) => log?.activityType === "visit_ended");
                const visitEndedAt = endedLog?.metadata?.endedAt || result.visitEndedAt || result.visit_ended_at;

                const fields = [];
                const displayedLabels = new Set();
                const pushField = (label, value, icon = ICONS.info) => {
                  const rendered = renderFieldValue(value);
                  if (rendered == null) return;
                  fields.push({ icon, label, value: rendered });
                  displayedLabels.add(normalizeKey(label));
                };

                // Visit Ended: full info + checkout time + visit end time
                if (isEnded) {
                  pushField("Name", visitorName, ICONS.person);
                  pushField("Company", company, ICONS.business);
                  pushField("Purpose", purpose, ICONS.info);
                  pushField("Department", department, ICONS.business);
                  pushField("ID Type", resolvedId?.type, ICONS.badge);
                  pushField("ID Number", resolvedId?.value, ICONS.vpnKey);
                  pushField(
                    "Approved Date",
                    `${result.approved_from ? formatDate(result.approved_from) : "—"} to ${result.approved_to ? formatDate(result.approved_to) : "—"}`,
                    ICONS.event
                  );
                  pushField(
                    "Approved Time",
                    `${result.approved_from ? formatTime(result.approved_from) : "—"} to ${result.approved_to ? formatTime(result.approved_to) : "—"}`,
                    ICONS.time
                  );
                  pushField("Access Level", accessLevel, ICONS.security);
                  if (checkOutTime) pushField("Checked Out At", `${formatDate(checkOutTime)} ${formatTime(checkOutTime)}`, ICONS.logout);
                  if (visitEndedAt) pushField("Visit Ended At", `${formatDate(visitEndedAt)} ${formatTime(visitEndedAt)}`, ICONS.logout);
                }
                // Rejected/Cancelled/Expired: full info + rejection reason if available
                else if (isRejected || isCancelled || isExpired) {
                  pushField("Name", visitorName, ICONS.person);
                  pushField("Company", company, ICONS.business);
                  pushField("Purpose", purpose, ICONS.info);
                  pushField("Department", department, ICONS.business);
                  pushField("ID Type", resolvedId?.type, ICONS.badge);
                  pushField("ID Number", resolvedId?.value, ICONS.vpnKey);
                  if (result.approved_from || result.approved_to) {
                    pushField(
                      "Approved Date",
                      `${result.approved_from ? formatDate(result.approved_from) : "—"} to ${result.approved_to ? formatDate(result.approved_to) : "—"}`,
                      ICONS.event
                    );
                    pushField(
                      "Approved Time",
                      `${result.approved_from ? formatTime(result.approved_from) : "—"} to ${result.approved_to ? formatTime(result.approved_to) : "—"}`,
                      ICONS.time
                    );
                  }
                  pushField("Access Level", accessLevel, ICONS.security);
                  if (isRejected) {
                    const reason = result.rejectionReason || result.rejection_reason;
                    if (reason) pushField("Rejection Reason", reason, ICONS.info);
                  }
                }
                // Approved/CheckedOut: full approved details + checkout time for checked_out
                else if (isApproved || isCheckedOut) {
                  pushField("Name", visitorName, ICONS.person);
                  pushField("Company", company, ICONS.business);
                  pushField("Purpose", purpose, ICONS.info);
                  pushField("Department", department, ICONS.business);
                  pushField("ID Type", resolvedId?.type, ICONS.badge);
                  pushField("ID Number", resolvedId?.value, ICONS.vpnKey);
                  pushField(
                    "Approved Date",
                    `${result.approved_from ? formatDate(result.approved_from) : "—"} to ${result.approved_to ? formatDate(result.approved_to) : "—"}`,
                    ICONS.event
                  );
                  pushField(
                    "Approved Time",
                    `${result.approved_from ? formatTime(result.approved_from) : "—"} to ${result.approved_to ? formatTime(result.approved_to) : "—"}`,
                    ICONS.time
                  );
                  pushField("Access Level", accessLevel, ICONS.security);
                  if (isCheckedOut && checkOutTime) pushField("Checked Out At", `${formatDate(checkOutTime)} ${formatTime(checkOutTime)}`, ICONS.logout);
                }
                // Pending/AdminApproved: visitor name, purpose of visit, department
                else if (isPending) {
                  pushField("Name", visitorName, ICONS.person);
                  pushField("Purpose", purpose, ICONS.info);
                  pushField("Department", department, ICONS.business);
                  pushField("ID Type", resolvedId?.type, ICONS.badge);
                  pushField("ID Number", resolvedId?.value, ICONS.vpnKey);
                }
                // CheckedIn: Show check-in timestamp, expected checkout time
                else if (isCheckedIn) {
                  pushField("Name", visitorName, ICONS.person);
                  pushField("Company", company, ICONS.business);
                  pushField("Purpose", purpose, ICONS.info);
                  pushField("Department", department, ICONS.business);
                  pushField("ID Type", resolvedId?.type, ICONS.badge);
                  pushField("ID Number", resolvedId?.value, ICONS.vpnKey);
                  pushField(
                    "Approved Date",
                    `${result.approved_from ? formatDate(result.approved_from) : "—"} to ${result.approved_to ? formatDate(result.approved_to) : "—"}`,
                    ICONS.event
                  );
                  pushField(
                    "Approved Time",
                    `${result.approved_from ? formatTime(result.approved_from) : "—"} to ${result.approved_to ? formatTime(result.approved_to) : "—"}`,
                    ICONS.time
                  );
                  pushField("Access Level", accessLevel, ICONS.security);
                  pushField("Check-in Time", checkInTime ? `${formatDate(checkInTime)} ${formatTime(checkInTime)}` : "—", ICONS.login);
                  pushField("Expected Checkout", expectedCheckout, ICONS.logout);
                }

                return fields.map((item, idx) => (
                  <ListItem key={`${item.label}-${idx}`} disablePadding sx={{ py: 0.8 }}>
                    <ListItemIcon sx={{ minWidth: 36, color: "primary.main" }}>
                      {(() => {
                        const IconComponent = item.icon || ICONS.info;
                        return <IconComponent fontSize="small" />;
                      })()}
                    </ListItemIcon>
                    <ListItemText 
                      primary={item.label} 
                      secondary={item.value} 
                      primaryTypographyProps={{ variant: "caption", color: "text.secondary", fontWeight: 600 }}
                      secondaryTypographyProps={{ variant: "body1", color: "text.primary", fontWeight: 500 }}
                    />
                  </ListItem>
                ));
              })()}
            </List>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} mt={4}>
              {(() => {
                const status = result.status;
                const isPending = ["pending", "admin_approved"].includes(status);
                const isApproved = status === "approved";
                const isCheckedIn = status === "checked_in";
                const isCheckedOut = status === "checked_out";
                const isEnded = status === "visit_ended";
                const isMulti = result.allow_multi_checkin ?? result.allowMultiCheckin;

                return (
                  <>
                    {isPending && (
                      <Button
                        fullWidth
                        variant="contained"
                        disabled
                        startIcon={<ICONS.time />}
                        sx={{ 
                          fontSize: "0.85rem",
                          bgcolor: isDark ? "rgba(255,255,255,0.08) !important" : "rgba(0,0,0,0.06) !important",
                          color: isDark ? "rgba(255,255,255,0.4) !important" : "rgba(0,0,0,0.4) !important",
                          border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                        }}
                      >
                        Awaiting Approval
                      </Button>
                    )}

                    {isApproved && (
                      <Button
                        fullWidth
                        variant="contained"
                        color="success"
                        startIcon={actionLoading ? <CircularProgress size={20} /> : <ICONS.login />}
                        onClick={handleCheckInAction}
                        disabled={actionLoading}
                      >
                        Check In
                      </Button>
                    )}

                    {isCheckedIn && (
                      <Button
                        fullWidth
                        variant="contained"
                        color="error"
                        startIcon={actionLoading ? <CircularProgress size={20} /> : <ICONS.logout />}
                        onClick={handleCheckOutAction}
                        disabled={actionLoading}
                      >
                        Check Out
                      </Button>
                    )}

                    {isCheckedOut && isMulti && (
                      <Button
                        fullWidth
                        variant="contained"
                        color="success"
                        startIcon={actionLoading ? <CircularProgress size={20} /> : <ICONS.login />}
                        onClick={handleCheckInAction}
                        disabled={actionLoading}
                      >
                        Check In Again
                      </Button>
                    )}
                    <Button 
                      fullWidth 
                      variant="outlined" 
                      startIcon={<ICONS.close />} 
                      onClick={reset}
                    >
                      Close
                    </Button>
                  </>
                );
              })()}
            </Stack>
          </Paper>
        )}

        {error && (
          <Paper elevation={0} sx={{ p: 4, borderRadius: 4, border: `1px solid ${isDark ? "rgba(211,47,47,0.5)" : "rgba(211,47,47,0.2)"}`, textAlign: "center", bgcolor: "background.paper", width: "100%" }}>
            <ICONS.errorOutline sx={{ fontSize: 64, color: "error.main", mb: 2 }} />
            <Typography variant="h6" fontWeight={700} color="error.main" gutterBottom>Verification Failed</Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>{error}</Typography>
            <Button variant="contained" color="error" fullWidth startIcon={<ICONS.refresh />} onClick={reset} sx={{ borderRadius: 3 }}>Retry</Button>
          </Paper>
        )}
          </Box>
        </Box>
      </Container>
    </RoleGuard>
  );
}
