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
  LinearProgress,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";

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
import { verifyRegistrationByToken, updateStatus, getRegistrationActivityLogs, mapRegistration, verifyRegistrationById, createVipRevisit, getCurrentlyInside } from "@/services/registrationService";
import { getWorkingHours } from "@/services/hostService";
import { formatDate, formatTime } from "@/utils/dateUtils";
import VipFastTrackModal from "./VipFastTrackModal";

const STATUS_CONFIG = {
  pending:       { label: "Pending",         color: "warning", icon: <ICONS.time fontSize="small" /> },
  admin_approved:{ label: "Dept. Approved",  color: "info",    icon: <ICONS.checkCircleOutline fontSize="small" /> },
  approved:      { label: "Approved",        color: "success", icon: <ICONS.checkCircle fontSize="small" /> },
  rejected:      { label: "Rejected",        color: "error",   icon: <ICONS.close fontSize="small" /> },
  checked_in:    { label: "Checked In",      color: "info",    icon: <ICONS.login fontSize="small" /> },
  checked_out:   { label: "Checked Out",     color: "default", icon: <ICONS.logout fontSize="small" /> },
  visit_ended:   { label: "Visit Ended",     color: "default", icon: <ICONS.stop fontSize="small" /> },
  cancelled:     { label: "Cancelled",       color: "default", icon: <ICONS.cancel fontSize="small" /> },
  expired:       { label: "Expired",         color: "default", icon: <ICONS.history fontSize="small" /> },
};

export default function StaffVerifyPage() {
  const theme = useTheme();
  const { showMessage } = useMessage();
  const { mode } = useColorMode();
  const isDark = mode === "dark";
  const [showScanner, setShowScanner] = useState(false);
  const [vipModalOpen, setVipModalOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== "undefined" ? navigator.onLine : true);
  const [scannerFailed, setScannerFailed] = useState(false);
  const [workingHours, setWorkingHours] = useState(null);
  const [outsideHoursWarning, setOutsideHoursWarning] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [activityLogs, setActivityLogs] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [idSearch, setIdSearch] = useState("");
  const [isSearchingById, setIsSearchingById] = useState(false);
  const scanningRef = useRef(false);
  const idSearchRef = useRef(null);
  const [badgeTemplate, setBadgeTemplate] = useState(null);

  // Assembly mode
  const [assemblyMode, setAssemblyMode] = useState(false);
  const [assemblyVisitors, setAssemblyVisitors] = useState([]);
  const [assemblyLoading, setAssemblyLoading] = useState(false);
  const [accountedIds, setAccountedIds] = useState(new Set());

  const enterAssemblyMode = async () => {
    setAssemblyMode(true);
    setAssemblyLoading(true);
    setAccountedIds(new Set());
    try {
      const visitors = await getCurrentlyInside();
      setAssemblyVisitors(visitors || []);
    } finally {
      setAssemblyLoading(false);
    }
  };

  const exitAssemblyMode = () => {
    setAssemblyMode(false);
    setAssemblyVisitors([]);
    setAccountedIds(new Set());
  };

  const toggleAccounted = (id) => {
    setAccountedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    fetchDefaultBadgeTemplate();
    getWorkingHours().then((wh) => { if (wh) setWorkingHours(wh); });
  }, []);

  useEffect(() => {
    const goOnline  = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online",  goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online",  goOnline);
      window.removeEventListener("offline", goOffline);
    };
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

  const handleIdSearch = async (e) => {
    if (e) e.preventDefault();
    if (!idSearch.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setSearchResults([]);
    setIsSearchingById(true);

    try {
      const res = await verifyRegistrationById(idSearch);
      if (res?.error) {
        setError(res.message);
      } else if (res && Array.isArray(res) && res.length > 0) {
        if (res.length === 1) {
          handleSelectVisitor(res[0]);
        } else {
          setSearchResults(res);
        }
      } else {
        setError("No registration found with this ID.");
      }
    } catch (err) {
      console.error("ID search error:", err);
      setError("An unexpected error occurred during search.");
    } finally {
      setLoading(false);
      setIsSearchingById(false);
    }
  };

  const handleSelectVisitor = async (visitor) => {
    const mapped = mapRegistration(visitor);
    setResult(mapped);
    setSearchResults([]);
    if (visitor.id && ["checked_in", "checked_out", "visit_ended"].includes(visitor.status)) {
      const logs = await getRegistrationActivityLogs(visitor.id);
      setActivityLogs(logs || []);
    } else {
      setActivityLogs([]);
    }
  };

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
        flagIfOutsideHours("check_in");
      }
    } finally {
      setActionLoading(false);
      setTimeout(() => { selfInitiatedRef.current = null; }, 5000);
    }
  };

  const handleVipRevisit = async () => {
    if (!result?.id) return;
    setActionLoading(true);
    try {
      const newReg = await createVipRevisit(result.id);
      if (newReg && !newReg.error) {
        const mapped = mapRegistration(newReg);
        setResult(mapped);
        const logs = await getRegistrationActivityLogs(newReg.id);
        if (logs && !logs.error) setActivityLogs(logs);
        showMessage("VIP visitor checked in successfully", "success");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOutAction = async () => {
    if (!result?.id) return;
    setActionLoading(true);
    selfInitiatedRef.current = { id: result.id, status: "checked_out" };
    try {
      const updated = await updateStatus(result.id, { status: "checked_out", clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      if (!updated?.error) {
        setResult(prev => ({ ...prev, status: updated?.status || "checked_out" }));
        const logs = await getRegistrationActivityLogs(result.id);
        setActivityLogs(logs || []);
        flagIfOutsideHours("check_out");
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

  const flagIfOutsideHours = (type) => {
    if (!workingHours?.enabled) return;
    const localHour = new Date().getHours();
    if (localHour < workingHours.start || localHour >= workingHours.end) {
      setOutsideHoursWarning(type);
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
    setShowScanner(false);
    setScannerFailed(false);
    setOutsideHoursWarning(null);
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

  if (assemblyMode) {
    const total = assemblyVisitors.length;
    const accounted = accountedIds.size;
    const progress = total > 0 ? Math.round((accounted / total) * 100) : 0;
    const allAccounted = total > 0 && accounted === total;

    return (
      <RoleGuard allowedRoles={["staff"]} allowedStaffTypes={["gate"]}>
        <Box sx={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 1300,
          bgcolor: "background.default",
          overflow: "auto",
          py: 3,
          px: 3,
        }}>
            {/* Header */}
            <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: 3, bgcolor: "error.main", color: "#fff", textAlign: "center" }}>
              <Stack direction="row" alignItems="center" justifyContent="center" spacing={1} mb={0.5}>
                <ICONS.warning sx={{ fontSize: 22 }} />
                <Typography variant="h6" fontWeight={800} sx={{ letterSpacing: 1 }}>
                  ASSEMBLY MODE
                </Typography>
              </Stack>
              <Typography variant="caption" sx={{ opacity: 0.85 }}>
                Evacuation Roll-Call — mark each visitor as accounted for
              </Typography>
            </Paper>

            {/* Counter */}
            <Paper elevation={0} variant="frosted" sx={{ p: 2.5, mb: 3, borderRadius: 3 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
                <Typography variant="body2" color="text.secondary" fontWeight={600}>
                  Accounted For
                </Typography>
                <Chip
                  label={`${accounted} / ${total}`}
                  color={allAccounted ? "success" : accounted > 0 ? "warning" : "default"}
                  sx={{ fontWeight: 800, fontSize: "0.95rem", px: 1 }}
                />
              </Stack>
              <LinearProgress
                variant="determinate"
                value={progress}
                color={allAccounted ? "success" : "warning"}
                sx={{ borderRadius: 2, height: 8 }}
              />
              {allAccounted && (
                <Typography variant="caption" color="success.main" fontWeight={700} sx={{ mt: 1, display: "block" }}>
                  All visitors accounted for
                </Typography>
              )}
            </Paper>

            {/* Visitor list */}
            {assemblyLoading ? (
              <Box sx={{ textAlign: "center", py: 6 }}>
                <CircularProgress color="error" />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  Loading checked-in visitors…
                </Typography>
              </Box>
            ) : total === 0 ? (
              <Paper elevation={0} variant="frosted" sx={{ p: 4, borderRadius: 3, textAlign: "center" }}>
                <ICONS.checkCircle sx={{ fontSize: 48, color: "success.main", mb: 1 }} />
                <Typography fontWeight={700} color="success.main">No visitors currently inside</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  The facility is clear.
                </Typography>
              </Paper>
            ) : (
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                  gap: 1.5,
                  mb: 3,
                }}
              >
                {assemblyVisitors.map((v) => {
                  const isAccounted = accountedIds.has(v.id);
                  const name = v.full_name || v.visitor?.fullName || "Visitor";
                  const company = v.organisation || v.visitor?.organisation || v.visitor?.companyName || null;
                  const dept = v.department?.name || v.visitor?.department || null;
                  const accessZones = v.access_levels?.length
                    ? v.access_levels.map((al) => al.name).filter(Boolean).join(", ")
                    : (v.access_level?.name || v.visitor?.accessLevel || null);
                  const subtitle = [company, dept, accessZones].filter(Boolean).join(" · ") || "No details";

                  return (
                    <Paper
                      key={v.id}
                      elevation={0}
                      variant="frosted"
                      sx={{
                        p: 1.5,
                        borderRadius: 3,
                        border: "1px solid",
                        borderColor: isAccounted
                          ? "success.main"
                          : isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)",
                        bgcolor: isAccounted
                          ? (isDark ? "rgba(46,125,50,0.15)" : "rgba(46,125,50,0.06)")
                          : "background.paper",
                        transition: "all 0.2s",
                        display: "flex",
                        flexDirection: "column",
                        gap: 1,
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography fontWeight={700} fontSize="0.875rem" noWrap>
                          {name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.4 }}>
                          {subtitle}
                        </Typography>
                      </Box>
                      <Button
                        fullWidth
                        variant={isAccounted ? "contained" : "outlined"}
                        color={isAccounted ? "success" : "inherit"}
                        size="small"
                        startIcon={isAccounted ? <ICONS.checkCircle /> : <ICONS.checkCircleOutline />}
                        onClick={() => toggleAccounted(v.id)}
                        sx={{ borderRadius: 2, fontSize: "0.78rem", mt: "auto" }}
                      >
                        {isAccounted ? "Accounted" : "Mark Safe"}
                      </Button>
                    </Paper>
                  );
                })}
              </Box>
            )}

            {/* Exit button */}
            <Button
              fullWidth
              variant="outlined"
              color="error"
              startIcon={<ICONS.close />}
              onClick={exitAssemblyMode}
              sx={{ borderRadius: 3, py: 1.5 }}
            >
              Exit Assembly Mode
            </Button>
        </Box>
      </RoleGuard>
    );
  }

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

          {/* Offline banner */}
          {!isOnline && (
            <Alert
              severity="error"
              icon={<ICONS.wifiOff />}
              sx={{ mb: 3, borderRadius: 2, fontWeight: 600 }}
            >
              No internet connection — QR verification unavailable. Use ID search or contact administration.
            </Alert>
          )}

          {/* Search by ID functionality */}
          <Box component="form" onSubmit={handleIdSearch} sx={{ mb: 4 }}>
            {scannerFailed && (
              <Alert
                severity="warning"
                onClose={() => setScannerFailed(false)}
                sx={{ mb: 1.5, borderRadius: 2 }}
              >
                Scanner unavailable — use ID number search below.
              </Alert>
            )}
            <Stack direction="row" spacing={1}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search by ID Number"
                value={idSearch}
                onChange={(e) => setIdSearch(e.target.value)}
                inputProps={{ inputMode: "text" }}
                inputRef={idSearchRef}
                disabled={loading}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 3,
                    bgcolor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                  }
                }}
              />
              <Button
                variant="contained"
                onClick={handleIdSearch}
                disabled={loading || !idSearch.trim()}
                sx={{ borderRadius: 3, px: 3, minWidth: 100 }}
              >
                {isSearchingById && loading ? <CircularProgress size={20} color="inherit" /> : "Search"}
              </Button>
            </Stack>
          </Box>

          <Box sx={{ minHeight: "calc(90vh - 350px)", display: "flex", flexDirection: "column", justifyContent: "flex-start", alignItems: "center" }}>
            {!showScanner && !loading && !result && !error && searchResults.length > 0 && (
              <Box sx={{ width: "100%", mt: 2 }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  Multiple Matches Found
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                   Multiple visitors share this ID number. Please select the correct person:
                </Typography>
                <Stack spacing={2}>
                  {searchResults.map((visitor) => (
                    <Paper
                      key={visitor.id}
                      elevation={0}
                      variant="frosted"
                      sx={{
                        p: 2,
                        borderRadius: 3,
                        cursor: "pointer",
                        transition: "all 0.2s",
                        border: "1px solid",
                        borderColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
                        '&:hover': {
                          bgcolor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                          transform: "translateY(-2px)",
                          borderColor: theme.palette.primary.main,
                        }
                      }}
                      onClick={() => handleSelectVisitor(visitor)}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Box>
                          <Typography sx={{ fontWeight: 600 }}>
                            {visitor.full_name && visitor.full_name !== "N/A" ? visitor.full_name : (visitor.visitor?.fullName || "Visitor")}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {(visitor.organisation && visitor.organisation !== "N/A" ? visitor.organisation : (visitor.visitor?.organisation !== "N/A" ? visitor.visitor?.organisation : "No Organization"))} 
                            {" • "}
                            {(visitor.department?.name || visitor.visitor?.department || "No Department")}
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: "right" }}>
                           <Chip
                              label={STATUS_CONFIG[visitor.status]?.label || visitor.status}
                              color={STATUS_CONFIG[visitor.status]?.color || "default"}
                              icon={STATUS_CONFIG[visitor.status]?.icon}
                              size="small"
                              sx={{ borderRadius: 1 }}
                           />
                        </Box>
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
                <Button 
                   fullWidth 
                   variant="outlined" 
                   sx={{ mt: 4, borderRadius: 3 }}
                   onClick={() => setSearchResults([])}
                >
                  Clear Results
                </Button>
              </Box>
            )}

            {!showScanner && !loading && !result && !error && searchResults.length === 0 && (
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
            
            <Stack spacing={2}>
              <Button
                variant="contained"
                size="large"
                fullWidth
                startIcon={<ICONS.qrCodeScanner />}
                onClick={() => setShowScanner(true)}
                disabled={!isOnline}
                sx={{ py: 1.8, borderRadius: 3, fontSize: "1.1rem" }}
              >
                QR Check-in
              </Button>
              <Button
                variant="outlined"
                fullWidth
                startIcon={<ICONS.key />}
                onClick={() => setVipModalOpen(true)}
                sx={{ py: 1.5, borderRadius: 3 }}
              >
                VIP Fast Track
              </Button>
              <Button
                variant="outlined"
                fullWidth
                color="error"
                startIcon={<ICONS.warning />}
                onClick={enterAssemblyMode}
                sx={{ py: 1.5, borderRadius: 3 }}
              >
                Assembly Mode
              </Button>
            </Stack>
          </Paper>
        )}

        {showScanner && (
          <QrScanner
            onScanSuccess={handleScanSuccess}
            onCancel={() => setShowScanner(false)}
            onError={(err) => {
              showMessage(err, "error");
              setShowScanner(false);
              setScannerFailed(true);
              setTimeout(() => idSearchRef.current?.focus(), 100);
            }}
          />
        )}

        <VipFastTrackModal
          open={vipModalOpen}
          onClose={() => setVipModalOpen(false)}
          onCheckedIn={() => setVipModalOpen(false)}
        />

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
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Chip label={sc.label} color={sc.color} size="small" icon={sc.icon} sx={{ fontWeight: 600 }} />
                  {(result.is_vip_fast_track || result.isVipFastTrack) && (
                    <Chip icon={<ICONS.star style={{ fontSize: 14 }} />} label="VIP Fast Track" color="warning" size="small" sx={{ fontWeight: 800 }} />
                  )}
                  {result.overstay && (
                    <Chip label="Overstay Detected" color="error" size="small" sx={{ fontWeight: 800 }} />
                  )}
                  {(result.is_vip || result.isVip) && (
                    <Chip icon={<ICONS.star style={{ fontSize: 14 }} />} label="VIP" size="small" sx={{ fontWeight: 800, bgcolor: "success.main", color: isDark ? "#000" : "#fff", "& .MuiChip-icon": { color: isDark ? "#000" : "#fff" } }} />
                  )}
                  {(result.allow_parking || result.allowParking) && (
                    <Chip icon={<ICONS.parking style={{ fontSize: 14 }} />} label="Parking Allowed" size="small" sx={{ fontWeight: 800, bgcolor: isDark ? "#CE93D8" : "#6A0DAD", color: isDark ? "#000" : "#fff", "& .MuiChip-icon": { color: isDark ? "#000" : "#fff" } }} />
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

            {outsideHoursWarning && (
              <Alert severity="warning" icon={<ICONS.time fontSize="small" />} sx={{ mb: 2, borderRadius: 2, fontWeight: 600 }}>
                This {outsideHoursWarning === "check_in" ? "check-in" : "check-out"} was performed outside working hours and has been flagged for review.
              </Alert>
            )}
            {["pending", "admin_approved"].includes(result.status) && (
              <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
                Not yet approved
              </Alert>
            )}
            {result.status === "visit_ended" && !(result.is_vip_fast_track || result.isVipFastTrack) && (
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
                  if (!result.approved_to) return null;
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
                  pushField(resolvedId?.type ? `${resolvedId.type} Number` : "ID Number", resolvedId?.value, ICONS.vpnKey);
                  if (result.approved_from || result.approved_to) {
                    pushField("Approved Date", `${result.approved_from ? formatDate(result.approved_from) : "—"} to ${result.approved_to ? formatDate(result.approved_to) : "—"}`, ICONS.event);
                    pushField("Approved Time", `${result.approved_from ? formatTime(result.approved_from) : "—"} to ${result.approved_to ? formatTime(result.approved_to) : "—"}`, ICONS.time);
                  }
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
                  pushField(resolvedId?.type ? `${resolvedId.type} Number` : "ID Number", resolvedId?.value, ICONS.vpnKey);
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
                  pushField(resolvedId?.type ? `${resolvedId.type} Number` : "ID Number", resolvedId?.value, ICONS.vpnKey);
                  if (result.approved_from || result.approved_to) {
                    pushField("Approved Date", `${result.approved_from ? formatDate(result.approved_from) : "—"} to ${result.approved_to ? formatDate(result.approved_to) : "—"}`, ICONS.event);
                    pushField("Approved Time", `${result.approved_from ? formatTime(result.approved_from) : "—"} to ${result.approved_to ? formatTime(result.approved_to) : "—"}`, ICONS.time);
                  }
                  pushField("Access Level", accessLevel, ICONS.security);
                  if (isCheckedOut && checkOutTime) pushField("Checked Out At", `${formatDate(checkOutTime)} ${formatTime(checkOutTime)}`, ICONS.logout);
                }
                // Pending/AdminApproved: visitor name, purpose of visit, department
                else if (isPending) {
                  pushField("Name", visitorName, ICONS.person);
                  pushField("Purpose", purpose, ICONS.info);
                  pushField("Department", department, ICONS.business);
                  pushField("ID Type", resolvedId?.type, ICONS.badge);
                  pushField(resolvedId?.type ? `${resolvedId.type} Number` : "ID Number", resolvedId?.value, ICONS.vpnKey);
                }
                // CheckedIn: Show check-in timestamp, expected checkout time
                else if (isCheckedIn) {
                  pushField("Name", visitorName, ICONS.person);
                  pushField("Company", company, ICONS.business);
                  pushField("Purpose", purpose, ICONS.info);
                  pushField("Department", department, ICONS.business);
                  pushField("ID Type", resolvedId?.type, ICONS.badge);
                  pushField(resolvedId?.type ? `${resolvedId.type} Number` : "ID Number", resolvedId?.value, ICONS.vpnKey);
                  if (result.approved_from || result.approved_to) {
                    pushField("Approved Date", `${result.approved_from ? formatDate(result.approved_from) : "—"} to ${result.approved_to ? formatDate(result.approved_to) : "—"}`, ICONS.event);
                    pushField("Approved Time", `${result.approved_from ? formatTime(result.approved_from) : "—"} to ${result.approved_to ? formatTime(result.approved_to) : "—"}`, ICONS.time);
                  }
                  pushField("Access Level", accessLevel, ICONS.security);
                  if (checkInTime) pushField("Check-in Time", `${formatDate(checkInTime)} ${formatTime(checkInTime)}`, ICONS.login);
                  pushField("Expected Checkout", expectedCheckout, ICONS.logout);
                }

                pushField("Vehicle Plate", result.vehicle_plate || result.vehiclePlate, ICONS.parking);

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
                const isVipEnded = isEnded && (result.is_vip_fast_track || result.isVipFastTrack);

                return (
                  <>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<ICONS.close />}
                      onClick={reset}
                    >
                      Close
                    </Button>

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
                    {isVipEnded && (
                      <Button
                        fullWidth
                        variant="contained"
                        color="warning"
                        startIcon={actionLoading ? <CircularProgress size={20} /> : <ICONS.star />}
                        onClick={handleVipRevisit}
                        disabled={actionLoading}
                      >
                        VIP Check In
                      </Button>
                    )}
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
