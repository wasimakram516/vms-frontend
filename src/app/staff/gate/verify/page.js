"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
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
import useI18nLayout from "@/hooks/useI18nLayout";
import gateStaffTranslations from "@/locales/gateStaff";
import { useAuth } from "@/contexts/AuthContext";
import { canAccessResource } from "@/utils/permissions";
import { useSocket } from "@/contexts/SocketContext";
import {
  verifyRegistrationByToken,
  updateStatus,
  getRegistrationActivityLogs,
  mapRegistration,
  verifyRegistrationById,
  createVipRevisit,
  getCurrentlyInside,
} from "@/services/registrationService";
import { getWorkingHours } from "@/services/hostService";
import { formatDate, formatTime } from "@/utils/dateUtils";
import getStartIconSpacing from "@/utils/getStartIconSpacing";
import getChipIconSpacing from "@/utils/getChipIconSpacing";
import VipFastTrackModal from "./VipFastTrackModal";
import GateTodayView from "@/components/staff/GateTodayView";

const STATUS_CONFIG = {
  pending: {
    labelKey: "statusPending",
    color: "warning",
    icon: <ICONS.time fontSize="small" />,
  },
  admin_approved: {
    labelKey: "statusAdminApproved",
    color: "info",
    icon: <ICONS.checkCircleOutline fontSize="small" />,
  },
  approved: {
    labelKey: "statusApproved",
    color: "success",
    icon: <ICONS.checkCircle fontSize="small" />,
  },
  rejected: {
    labelKey: "statusRejected",
    color: "error",
    icon: <ICONS.close fontSize="small" />,
  },
  checked_in: {
    labelKey: "statusCheckedIn",
    color: "info",
    icon: <ICONS.login fontSize="small" />,
  },
  checked_out: {
    labelKey: "statusCheckedOut",
    color: "default",
    icon: <ICONS.logout fontSize="small" />,
  },
  visit_ended: {
    labelKey: "statusVisitEnded",
    color: "default",
    icon: <ICONS.stop fontSize="small" />,
  },
  cancelled: {
    labelKey: "statusCancelled",
    color: "default",
    icon: <ICONS.cancel fontSize="small" />,
  },
  expired: {
    labelKey: "statusExpired",
    color: "default",
    icon: <ICONS.history fontSize="small" />,
  },
};

export default function StaffVerifyPage() {
  const theme = useTheme();
  const { user } = useAuth();
  const { showMessage } = useMessage();
  const { mode } = useColorMode();
  const { t, dir } = useI18nLayout(gateStaffTranslations);
  // Backend-driven ID types ("Oman ID", "Passport", "ID") → localized display labels
  const translateIdType = (type) =>
    type === "Oman ID"
      ? t.idTypeOmanId
      : type === "Passport"
        ? t.idTypePassport
        : type === "ID"
          ? t.idTypeId
          : type;
  const canCheckin = canAccessResource(user, "verify", { action: "checkin" });
  const canCheckout = canAccessResource(user, "verify", { action: "checkout" });
  const canVipBypass = canAccessResource(user, "verify", { action: "vip-bypass" });
  const canTodayVisitors = canAccessResource(user, "verify", { action: "todays-visitors" });
  const canRead = canAccessResource(user, "verify", { action: "read" });
  const isDark = mode === "dark";
  const [showScanner, setShowScanner] = useState(false);
  const [vipModalOpen, setVipModalOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
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

  // Today's View
  const [todayView, setTodayView] = useState(false);

  // Assembly mode
  const [idVerified, setIdVerified] = useState(false);
  const [showIdVerifyDialog, setShowIdVerifyDialog] = useState(false);

  const [assemblyMode, setAssemblyMode] = useState(false);
  const [assemblyVisitors, setAssemblyVisitors] = useState([]);
  const [assemblyLoading, setAssemblyLoading] = useState(false);
  const [accountedIds, setAccountedIds] = useState(new Set());
  const [assemblySearch, setAssemblySearch] = useState("");

  const enterAssemblyMode = async () => {
    setAssemblyMode(true);
    setAssemblyLoading(true);
    setAccountedIds(new Set());
    setAssemblySearch("");
    try {
      const visitors = await getCurrentlyInside();
      setAssemblyVisitors(Array.isArray(visitors) ? visitors : []);
    } finally {
      setAssemblyLoading(false);
    }
  };

  const exitAssemblyMode = () => {
    setAssemblyMode(false);
    setAssemblyVisitors([]);
    setAccountedIds(new Set());
    setAssemblySearch("");
  };

  const toggleAccounted = (id) => {
    setAccountedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    fetchDefaultBadgeTemplate();
    getWorkingHours().then((wh) => {
      if (wh) setWorkingHours(wh);
    });
  }, []);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        getWorkingHours().then((wh) => {
          if (wh) setWorkingHours(wh);
        });
      }
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      document.removeEventListener("visibilitychange", onVisible);
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
        if (
          res.id &&
          ["checked_in", "checked_out", "visit_ended"].includes(res.status)
        ) {
          const logs = await getRegistrationActivityLogs(res.id);
          setActivityLogs(Array.isArray(logs) ? logs : []);
        } else {
          setActivityLogs([]);
        }
      } else {
        setError(t.gateInvalidToken);
      }
    } finally {
      setLoading(false);
    }
  }, [t]);

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
        setError(t.gateNoRegistrationFound);
      }
    } catch (err) {
      console.error("ID search error:", err);
      setError(t.gateSearchError);
    } finally {
      setLoading(false);
      setIsSearchingById(false);
    }
  };

  const handleSelectVisitor = async (visitor) => {
    const mapped = mapRegistration(visitor);
    setResult(mapped);
    setSearchResults([]);
    if (
      visitor.id &&
      ["checked_in", "checked_out", "visit_ended"].includes(visitor.status)
    ) {
      const logs = await getRegistrationActivityLogs(visitor.id);
      setActivityLogs(Array.isArray(logs) ? logs : []);
    } else {
      setActivityLogs([]);
    }
  };

  const handleScanSuccess = useCallback(
    async (scanned) => {
      if (scanningRef.current) return;
      scanningRef.current = true;
      setShowScanner(false);
      await doVerify(scanned);
      setTimeout(() => {
        scanningRef.current = false;
      }, 600);
    },
    [doVerify],
  );

  const selfInitiatedRef = useRef(null);

  const handleCheckInAction = async () => {
    if (!result?.id) return;
    setActionLoading(true);
    selfInitiatedRef.current = { id: result.id, status: "checked_in" };
    try {
      const updated = await updateStatus(result.id, {
        status: "checked_in",
        clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      if (!updated?.error) {
        setResult((prev) => ({
          ...prev,
          status: updated?.status || "checked_in",
        }));
        const logs = await getRegistrationActivityLogs(result.id);
        setActivityLogs(Array.isArray(logs) ? logs : []);
        flagIfOutsideHours("check_in");
      }
    } finally {
      setActionLoading(false);
      setTimeout(() => {
        selfInitiatedRef.current = null;
      }, 5000);
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
        if (Array.isArray(logs)) setActivityLogs(logs);
        showMessage(t.gateVipCheckedIn, "success");
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
      const updated = await updateStatus(result.id, {
        status: "checked_out",
        clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      if (!updated?.error) {
        // Update self-initiated ref with actual backend status (may be visit_ended if auto-ended)
        if (updated?.status) {
          selfInitiatedRef.current = { id: result.id, status: updated.status };
        }
        setResult((prev) => ({
          ...prev,
          status: updated?.status || "checked_out",
        }));
        const logs = await getRegistrationActivityLogs(result.id);
        setActivityLogs(Array.isArray(logs) ? logs : []);
        flagIfOutsideHours("check_out");
        setIdVerified(false);
      }
    } finally {
      setActionLoading(false);
      setTimeout(() => {
        selfInitiatedRef.current = null;
      }, 5000);
    }
  };

  const handlePrintBadge = async (registration) => {
    if (!registration?.qr_token) {
      showMessage(t.gateNoQrToken, "warning");
      return;
    }

    try {
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
        email:
          registration.email ||
          registration.visitor?.email ||
          registration.user?.email ||
          "",
        phone:
          registration.phone ||
          registration.visitor?.phone ||
          registration.user?.phone ||
          "",
        purposeOfVisit: registration.purpose_of_visit || "",
        hostName: registration.host_name || "",
        requestedDate: registration.requested_from
          ? formatDate(registration.requested_from)
          : "",
        requestedTimeFrom: registration.requested_from
          ? formatTime(registration.requested_from)
          : "",
        requestedTimeTo: registration.requested_to
          ? formatTime(registration.requested_to)
          : "",
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
          showMessage(t.gateAllowPopups, "warning");
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
        `width=${width},height=${height},left=${left},top=${top},resizable=no,scrollbars=no,status=no`,
      );

      if (!printWindow) {
        showMessage(t.gateAllowPopups, "warning");
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
      showMessage(t.gatePrintFailed, "error");
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
    setIdVerified(false);
    setShowIdVerifyDialog(false);
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
    setIdVerified(false);
  }, [result?.id]);

  // Derive resolvedId at component level so auto check-in effects can use it
  const resolvedId = useMemo(() => {
    if (!result) return null;
    const fvs = Array.isArray(result.fieldValues)
      ? result.fieldValues
      : Array.isArray(result.visitor?.fieldValues)
        ? result.visitor.fieldValues
        : [];
    const nk = (v) =>
      String(v ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
    const rv = (v) => {
      if (v == null || v === "") return null;
      if (typeof v === "object") return v.name || v.label || v.value || null;
      return String(v);
    };
    const find = (aliases) => {
      const norm = aliases.map(nk);
      const m = fvs.find(
        (fv) =>
          norm.includes(
            nk(fv?.customField?.fieldKey || fv?.customField?.name),
          ) || norm.includes(nk(fv?.customField?.label)),
      );
      return rv(m?.value);
    };
    const idType = find([
      "idtype",
      "identificationtype",
      "documenttype",
      "doctype",
    ]);
    const omanId = find([
      "omanid",
      "nationalid",
      "civilid",
      "idcardnumber",
      "idnumber",
      "idno",
    ]);
    const passport = find(["passport", "passportnumber", "passportno"]);
    const nkIdType = nk(idType || "");
    if (nkIdType.includes("passport") && (passport || omanId))
      return { type: "Passport", value: passport || omanId };
    if (omanId)
      return {
        type: nkIdType.includes("passport") ? "Passport" : "ID",
        value: omanId,
      };
    if (passport) return { type: "Passport", value: passport };
    return null;
  }, [result]);

  // Auto check-in: visitor scanned — open ID verification prompt if needed
  useEffect(() => {
    if (!result || result.status !== "approved") return;
    if (!canCheckin) return;
    if (result.is_vip_fast_track || result.isVipFastTrack) return;
    if (!result.approved_from) {
      if (resolvedId && !idVerified) {
        setShowIdVerifyDialog(true);
      } else {
        handleCheckInAction();
      }
      return;
    }
    const bufferMs = (workingHours?.checkInBufferMinutes ?? 60) * 60 * 1000;
    const now = Date.now();
    const approvedFromMs = new Date(result.approved_from).getTime();
    if (now >= approvedFromMs - bufferMs && now <= approvedFromMs + bufferMs) {
      if (resolvedId && !idVerified) {
        setShowIdVerifyDialog(true);
      } else {
        handleCheckInAction();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result?.id]);

  // Auto check-in: fires the moment ID is ticked green
  useEffect(() => {
    if (!idVerified || !result || result.status !== "approved") return;
    if (!canCheckin) return;
    if (result.is_vip_fast_track || result.isVipFastTrack) return;
    if (!result.approved_from) {
      handleCheckInAction();
      return;
    }
    const bufferMs = (workingHours?.checkInBufferMinutes ?? 60) * 60 * 1000;
    const now = Date.now();
    const approvedFromMs = new Date(result.approved_from).getTime();
    if (now >= approvedFromMs - bufferMs && now <= approvedFromMs + bufferMs) {
      handleCheckInAction();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idVerified]);

  useEffect(() => {
    const unsub = on("registration:updated", (updatedReg) => {
      // Ignore events that don't belong to the registration currently on screen.
      if (
        !currentRegistrationIdRef.current ||
        currentRegistrationIdRef.current !== updatedReg.id
      )
        return;

      const isAccessible = ["approved", "checked_in", "checked_out"].includes(
        updatedReg.status,
      );
      const mappedReg = {
        ...mapRegistration(updatedReg),
        notApproved: !isAccessible,
      };
      setResult(mappedReg);

      // Fetch activity logs for timestamps (check-in, check-out, visit-ended)
      if (
        ["checked_in", "checked_out", "visit_ended"].includes(updatedReg.status)
      ) {
        getRegistrationActivityLogs(updatedReg.id).then((logs) => {
        if (Array.isArray(logs)) setActivityLogs(logs);
        });
      }

      const isSelfEcho =
        selfInitiatedRef.current?.id === updatedReg.id &&
        selfInitiatedRef.current?.status === updatedReg.status;

      const statusActuallyChanged =
        updatedReg.status !== currentRegistrationStatusRef.current;

      if (isSelfEcho) {
        selfInitiatedRef.current = null;
      } else if (statusActuallyChanged) {
        showMessage(t.gateStatusUpdatedByOther, "info");
      }
    });

    const unsubOverstay = on("overstay:alert", (data) => {
      if (!data?.registrationId) return;
      if (currentRegistrationIdRef.current !== data.registrationId) return;
      // Update overstay flag on current result and refresh activity logs
      setResult((prev) => (prev ? { ...prev, overstay: true } : prev));
      getRegistrationActivityLogs(data.registrationId).then((logs) => {
        if (Array.isArray(logs)) setActivityLogs(logs);
      });
    });

    return () => {
      unsub?.();
      unsubOverstay?.();
    };
  }, [on, showMessage, t]);

  const sc = result
    ? STATUS_CONFIG[result.status] || { color: "default" }
    : null;
  const scLabel = sc ? (sc.labelKey ? t[sc.labelKey] : result.status) : null;

  if (todayView) {
    return (
      <RoleGuard allowedRoles={["staff"]} allowedStaffTypes={["gate"]}>
        <GateTodayView onBack={() => setTodayView(false)} canCheckout={canCheckout} />
      </RoleGuard>
    );
  }

  if (assemblyMode) {
    const total = assemblyVisitors.length;
    const accounted = accountedIds.size;
    const remaining = total - accounted;
    const progress = total > 0 ? Math.round((accounted / total) * 100) : 0;
    const allAccounted = total > 0 && accounted === total;

    const query = assemblySearch.trim().toLowerCase();
    const matchesQuery = (v) => {
      if (!query) return true;
      const name = v.full_name || v.visitor?.fullName || "";
      const company =
        v.organisation || v.visitor?.organisation || v.visitor?.companyName || "";
      const dept = v.department?.name || v.visitor?.department || "";
      return `${name} ${company} ${dept}`.toLowerCase().includes(query);
    };
    // Unaccounted visitors first — they are the ones staff is looking for
    const visibleVisitors = assemblyVisitors
      .filter(matchesQuery)
      .sort(
        (a, b) => Number(accountedIds.has(a.id)) - Number(accountedIds.has(b.id)),
      );

    return (
      <RoleGuard allowedRoles={["staff"]} allowedStaffTypes={["gate"]}>
        <Box sx={{ px: { xs: 2, sm: 3 }, py: 3, ...getStartIconSpacing(dir) }}>
          {/* Emergency header with exit action */}
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2, sm: 2.5 },
              mb: 2.5,
              borderRadius: 3,
              bgcolor: "error.main",
              color: "#fff",
            }}
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              alignItems={{ xs: "flex-start", sm: "center" }}
              justifyContent="space-between"
              spacing={1.5}
            >
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <ICONS.warning sx={{ fontSize: 28 }} />
                <Box>
                  <Typography variant="h6" fontWeight={800} sx={{ letterSpacing: 1, lineHeight: 1.2 }}>
                    {t.assemblyTitle}
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.9 }}>
                    {t.assemblySubtitle}
                  </Typography>
                </Box>
              </Stack>
              <Button
                variant="contained"
                startIcon={<ICONS.close />}
                onClick={exitAssemblyMode}
                sx={{
                  bgcolor: "#fff",
                  color: "error.main",
                  fontWeight: 700,
                  borderRadius: 2,
                  whiteSpace: "nowrap",
                  alignSelf: { xs: "stretch", sm: "auto" },
                  "&:hover": { bgcolor: "rgba(255,255,255,0.85)" },
                }}
              >
                {t.assemblyExit}
              </Button>
            </Stack>
          </Paper>

          {/* Roll-call progress */}
          <Paper
            elevation={0}
            variant="frosted"
            sx={{ p: 2.5, mb: 2.5, borderRadius: 3 }}
          >
            <Stack direction="row" spacing={3} mb={1.5}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h4" fontWeight={800} color="success.main">
                  {accounted}
                </Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  {t.assemblyAccountedFor}
                </Typography>
              </Box>
              <Divider orientation="vertical" flexItem />
              <Box sx={{ flex: 1 }}>
                <Typography
                  variant="h4"
                  fontWeight={800}
                  color={remaining > 0 ? "warning.main" : "text.disabled"}
                >
                  {remaining}
                </Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  {t.assemblyRemaining}
                </Typography>
              </Box>
              <Divider orientation="vertical" flexItem />
              <Box sx={{ flex: 1 }}>
                <Typography variant="h4" fontWeight={800}>
                  {total}
                </Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  {t.todayTotal}
                </Typography>
              </Box>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={progress}
              color={allAccounted ? "success" : "warning"}
              sx={{ borderRadius: 2, height: 8 }}
            />
            {allAccounted && (
              <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 1.25 }}>
                <ICONS.checkCircle sx={{ fontSize: 18, color: "success.main" }} />
                <Typography variant="body2" color="success.main" fontWeight={700}>
                  {t.assemblyAllAccounted}
                </Typography>
              </Stack>
            )}
          </Paper>

          {/* Visitor roll-call list */}
          {assemblyLoading ? (
            <Box sx={{ textAlign: "center", py: 6 }}>
              <CircularProgress color="error" />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                {t.assemblyLoading}
              </Typography>
            </Box>
          ) : total === 0 ? (
            <Paper
              elevation={0}
              variant="frosted"
              sx={{ p: 4, borderRadius: 3, textAlign: "center" }}
            >
              <ICONS.checkCircle
                sx={{ fontSize: 48, color: "success.main", mb: 1 }}
              />
              <Typography fontWeight={700} color="success.main">
                {t.assemblyNoneInside}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.5 }}
              >
                {t.assemblyFacilityClear}
              </Typography>
            </Paper>
          ) : (
            <>
              <TextField
                fullWidth
                size="small"
                placeholder={t.assemblySearchPlaceholder}
                value={assemblySearch}
                onChange={(e) => setAssemblySearch(e.target.value)}
                sx={{
                  mb: 2,
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 3,
                    bgcolor: isDark
                      ? "rgba(255,255,255,0.03)"
                      : "rgba(0,0,0,0.02)",
                  },
                }}
              />
              {visibleVisitors.length === 0 ? (
                <Paper
                  elevation={0}
                  variant="frosted"
                  sx={{ p: 3, borderRadius: 3, textAlign: "center" }}
                >
                  <Typography variant="body2" color="text.secondary">
                    {t.assemblyNoMatches}
                  </Typography>
                </Paper>
              ) : (
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      sm: "repeat(auto-fill, minmax(280px, 1fr))",
                    },
                    gap: 1.5,
                  }}
                >
                  {visibleVisitors.map((v) => {
                    const isAccounted = accountedIds.has(v.id);
                    const name =
                      v.full_name || v.visitor?.fullName || t.gateVisitor;
                    const company =
                      v.organisation ||
                      v.visitor?.organisation ||
                      v.visitor?.companyName ||
                      null;
                    const dept =
                      v.department?.name || v.visitor?.department || null;
                    const accessZones = v.access_levels?.length
                      ? v.access_levels
                          .map((al) => al.name)
                          .filter(Boolean)
                          .join(", ")
                      : v.access_level?.name || v.visitor?.accessLevel || null;
                    const subtitle = [company, dept, accessZones]
                      .filter(Boolean)
                      .join(" · ");

                    return (
                      <Paper
                        key={v.id}
                        elevation={0}
                        variant="frosted"
                        onClick={() => toggleAccounted(v.id)}
                        sx={{
                          p: 2,
                          borderRadius: 3,
                          border: "2px solid",
                          borderColor: isAccounted
                            ? "success.main"
                            : "warning.main",
                          bgcolor: isAccounted
                            ? isDark
                              ? "rgba(46,125,50,0.15)"
                              : "rgba(46,125,50,0.06)"
                            : "background.paper",
                          cursor: "pointer",
                          userSelect: "none",
                          transition: "all 0.15s",
                          display: "flex",
                          alignItems: "center",
                          gap: 2,
                          "&:active": { transform: "scale(0.99)" },
                        }}
                      >
                        <Box
                          sx={{
                            width: 28,
                            height: 28,
                            borderRadius: 1,
                            flexShrink: 0,
                            border: "2px solid",
                            borderColor: isAccounted
                              ? "success.main"
                              : "warning.main",
                            bgcolor: isAccounted ? "success.main" : "transparent",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {isAccounted && (
                            <ICONS.check sx={{ fontSize: 20, color: "#fff" }} />
                          )}
                        </Box>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography fontWeight={700} noWrap>
                            {name}
                          </Typography>
                          {subtitle && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ display: "block", lineHeight: 1.4 }}
                              noWrap
                            >
                              {subtitle}
                            </Typography>
                          )}
                        </Box>
                        <Typography
                          variant="caption"
                          fontWeight={800}
                          color={isAccounted ? "success.main" : "warning.main"}
                          sx={{ flexShrink: 0 }}
                        >
                          {isAccounted ? t.assemblyAccounted : t.assemblyMarkSafe}
                        </Typography>
                      </Paper>
                    );
                  })}
                </Box>
              )}
            </>
          )}
        </Box>
      </RoleGuard>
    );
  }

  return (
    <RoleGuard allowedRoles={["staff"]} allowedStaffTypes={["gate"]}>
      <Container maxWidth="sm">
        <Box
          sx={{
            py: 4,
            ...getStartIconSpacing(dir),
            ...getChipIconSpacing(dir),
          }}
        >
          {!canRead ? (
            <Box sx={{ textAlign: "center", py: 8 }}>
              <Typography variant="h5" fontWeight={700} color="text.secondary">
                {t.gateAccessDenied}
              </Typography>
              <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
                {t.gateAccessDeniedDesc}
              </Typography>
            </Box>
          ) : (
            <>
          <Typography
            variant="h4"
            fontWeight={800}
            gutterBottom
            textAlign="center"
            color="primary.main"
            sx={{ fontFamily: "'Comfortaa', cursive" }}
          >
            {t.gateTitle}
          </Typography>
          <Typography color="text.secondary" textAlign="center" sx={{ mb: 4 }}>
            {t.gateSubtitle}
          </Typography>

          {/* Offline banner */}
          {!isOnline && (
            <Alert
              severity="error"
              icon={<ICONS.wifiOff />}
              sx={{ mb: 3, borderRadius: 2, fontWeight: 600 }}
            >
              {t.gateOffline}
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
                {t.gateScannerUnavailable}
              </Alert>
            )}
            <Stack direction="row" spacing={1}>
              <TextField
                fullWidth
                size="small"
                placeholder={t.gateSearchPlaceholder}
                value={idSearch}
                onChange={(e) => setIdSearch(e.target.value)}
                inputProps={{ inputMode: "text" }}
                inputRef={idSearchRef}
                disabled={loading}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 3,
                    bgcolor: isDark
                      ? "rgba(255,255,255,0.03)"
                      : "rgba(0,0,0,0.02)",
                  },
                }}
              />
              <Button
                variant="contained"
                onClick={handleIdSearch}
                disabled={loading || !idSearch.trim()}
                sx={{ borderRadius: 3, px: 3, minWidth: 100 }}
              >
                {isSearchingById && loading ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  t.gateSearch
                )}
              </Button>
            </Stack>
          </Box>

          <Box
            sx={{
              minHeight: "calc(90vh - 350px)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-start",
              alignItems: "center",
            }}
          >
            {!showScanner &&
              !loading &&
              !result &&
              !error &&
              searchResults.length > 0 && (
                <Box sx={{ width: "100%", mt: 2 }}>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    {t.gateMultipleMatches}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 3 }}
                  >
                    {t.gateMultipleMatchesDesc}
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
                          borderColor: isDark
                            ? "rgba(255,255,255,0.05)"
                            : "rgba(0,0,0,0.05)",
                          "&:hover": {
                            bgcolor: isDark
                              ? "rgba(255,255,255,0.05)"
                              : "rgba(0,0,0,0.03)",
                            transform: "translateY(-2px)",
                            borderColor: theme.palette.primary.main,
                          },
                        }}
                        onClick={() => handleSelectVisitor(visitor)}
                      >
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                        >
                          <Box>
                            <Typography sx={{ fontWeight: 600 }}>
                              {visitor.full_name && visitor.full_name !== "N/A"
                                ? visitor.full_name
                                : visitor.visitor?.fullName || t.gateVisitor}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {visitor.organisation &&
                              visitor.organisation !== "N/A"
                                ? visitor.organisation
                                : visitor.visitor?.organisation !== "N/A"
                                  ? visitor.visitor?.organisation
                                  : t.gateNoOrganization}
                              {" • "}
                              {visitor.department?.name ||
                                visitor.visitor?.department ||
                                t.gateNoDepartment}
                            </Typography>
                          </Box>
                          <Box sx={{ textAlign: "right" }}>
                            <Chip
                              label={
                                STATUS_CONFIG[visitor.status]
                                  ? t[STATUS_CONFIG[visitor.status].labelKey]
                                  : visitor.status
                              }
                              color={
                                STATUS_CONFIG[visitor.status]?.color ||
                                "default"
                              }
                              icon={STATUS_CONFIG[visitor.status]?.icon}
                              size="small"
                              sx={{ borderRadius: 1 }}
                            />
                            {visitor.overstay && (
                              <Chip
                                label={t.gateOverstay}
                                color="error"
                                size="small"
                                sx={{
                                  borderRadius: 1,
                                  ml: 0.5,
                                  fontWeight: 800,
                                }}
                              />
                            )}
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
                    {t.gateClearResults}
                  </Button>
                </Box>
              )}

            {!showScanner &&
              !loading &&
              !result &&
              !error &&
              searchResults.length === 0 && (
                <Paper
                  elevation={0}
                  variant="frosted"
                  sx={{
                    p: 4,
                    borderRadius: 4,
                    textAlign: "center",
                    width: "100%",
                  }}
                >
                  <Box
                    sx={{
                      width: 72,
                      height: 72,
                      borderRadius: 3,
                      bgcolor: isDark
                        ? "rgba(255,255,255,0.07)"
                        : "rgba(0,0,0,0.05)",
                      boxShadow: isDark
                        ? "inset 0 1px 0 rgba(255,255,255,0.06)"
                        : "none",
                      color: "text.primary",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      mx: "auto",
                      mb: 3,
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
                      {t.gateQrCheckin}
                    </Button>
                    {canVipBypass && (
                      <Button
                        variant="outlined"
                        fullWidth
                        startIcon={<ICONS.key />}
                        onClick={() => setVipModalOpen(true)}
                        sx={{ py: 1.5, borderRadius: 3 }}
                      >
                        {t.gateVipFastTrack}
                      </Button>
                    )}
                    {canTodayVisitors && (
                      <Button
                        variant="outlined"
                        fullWidth
                        startIcon={<ICONS.event />}
                        onClick={() => setTodayView(true)}
                        sx={{ py: 1.5, borderRadius: 3 }}
                      >
                        {t.gateTodaysVisitors}
                      </Button>
                    )}
                    <Button
                      variant="outlined"
                      fullWidth
                      color="error"
                      startIcon={<ICONS.warning />}
                      onClick={enterAssemblyMode}
                      sx={{ py: 1.5, borderRadius: 3 }}
                    >
                      {t.gateAssemblyMode}
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

            {loading && <LoadingState cardMaxWidth={380} />}

            {result && (
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: 4,
                  border: `1px solid ${sc.color === "success" ? (isDark ? "rgba(46,125,50,0.5)" : "rgba(46,125,50,0.3)") : "divider"}`,
                  bgcolor: "background.paper",
                }}
              >
                <Stack direction="row" alignItems="center" spacing={2} mb={3}>
                  <Box
                    sx={{
                      bgcolor: `${sc.color}.main`,
                      color:
                        sc.color === "default"
                          ? isDark
                            ? "#fff"
                            : "rgba(0,0,0,0.7)"
                          : "#fff",
                      p: 1,
                      borderRadius: 2,
                      display: "flex",
                    }}
                  >
                    {sc.color === "success" ? (
                      <ICONS.checkCircle />
                    ) : sc.color === "error" ? (
                      <ICONS.errorOutline />
                    ) : ["visit_ended", "cancelled", "expired"].includes(
                        result.status,
                      ) ? (
                      <ICONS.logout />
                    ) : (
                      <ICONS.time />
                    )}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" fontWeight={700}>
                      {result.status === "visit_ended"
                        ? t.gateVisitConcluded
                        : result.status === "rejected"
                          ? t.gateVisitRejected
                          : result.status === "cancelled"
                            ? t.gateVisitCancelled
                            : result.status === "expired"
                              ? t.gateVisitExpired
                              : t.gateVerificationSuccess}
                    </Typography>
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      flexWrap="wrap"
                      useFlexGap
                    >
                      <Chip
                        label={scLabel}
                        color={sc.color}
                        size="small"
                        icon={sc.icon}
                        sx={{ fontWeight: 600 }}
                      />
                      {(result.is_vip_fast_track || result.isVipFastTrack) && (
                        <Chip
                          icon={<ICONS.star style={{ fontSize: 14 }} />}
                          label={t.gateVipFastTrack}
                          color="warning"
                          size="small"
                          sx={{ fontWeight: 800 }}
                        />
                      )}
                      {result.overstay && (
                        <Chip
                          label={t.gateOverstayDetected}
                          color="error"
                          size="small"
                          sx={{ fontWeight: 800 }}
                        />
                      )}
                      {(result.is_vip || result.isVip) && (
                        <Chip
                          icon={<ICONS.star style={{ fontSize: 14 }} />}
                          label={t.gateVip}
                          size="small"
                          sx={{
                            fontWeight: 800,
                            bgcolor: "success.main",
                            color: isDark ? "#000" : "#fff",
                            "& .MuiChip-icon": {
                              color: isDark ? "#000" : "#fff",
                            },
                          }}
                        />
                      )}
                      {(result.allow_parking || result.allowParking) && (
                        <Chip
                          icon={<ICONS.parking style={{ fontSize: 14 }} />}
                          label={t.gateParkingAllowed}
                          size="small"
                          sx={{
                            fontWeight: 800,
                            bgcolor: isDark ? "#CE93D8" : "#6A0DAD",
                            color: isDark ? "#000" : "#fff",
                            "& .MuiChip-icon": {
                              color: isDark ? "#000" : "#fff",
                            },
                          }}
                        />
                      )}
                      {(result.escort_required ??
                        result.escortRequired ??
                        true) && (
                        <Chip
                          icon={<ICONS.security style={{ fontSize: 14 }} />}
                          label={t.gateEscortRequired}
                          size="small"
                          sx={{
                            fontWeight: 800,
                            bgcolor: isDark ? "#FF8A65" : "#E64A19",
                            color: "#fff",
                            "& .MuiChip-icon": { color: "#fff" },
                          }}
                        />
                      )}
                    </Stack>
                  </Box>
                  {[
                    "admin_approved",
                    "approved",
                    "checked_in",
                    "checked_out",
                  ].includes(result.status) && (
                    <Tooltip title={t.gatePrintBadge}>
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
                  <Alert
                    severity="warning"
                    icon={<ICONS.time fontSize="small" />}
                    sx={{ mb: 2, borderRadius: 2, fontWeight: 600 }}
                  >
                    {outsideHoursWarning === "check_in"
                      ? t.gateOutsideHoursCheckin
                      : t.gateOutsideHoursCheckout}
                  </Alert>
                )}
                {result.status === "pending" && (
                  <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
                    {t.gateNotYetApproved}
                  </Alert>
                )}
                {result.status === "visit_ended" &&
                  !(result.is_vip_fast_track || result.isVipFastTrack) && (
                    <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
                      {t.gateVisitConcludedInfo}
                    </Alert>
                  )}
                {result.status === "rejected" && (
                  <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                    {result.rejectionReason || result.rejection_reason
                      ? t.gateRejectedReason.replace(
                          "{{reason}}",
                          result.rejectionReason || result.rejection_reason,
                        )
                      : t.gateRejectedInfo}
                  </Alert>
                )}
                {result.status === "cancelled" && (
                  <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
                    {t.gateCancelledInfo}
                  </Alert>
                )}
                {result.status === "expired" && (
                  <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
                    {t.gateExpiredInfo}
                  </Alert>
                )}

                {/* Field Display Logic */}
                <List dense disablePadding>
                  {(() => {
                    const status = result.status;
                    const isPending = status === "pending";
                    const isApproved = ["approved", "admin_approved"].includes(
                      status,
                    );
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

                    const normalizeKey = (value) =>
                      String(value ?? "")
                        .toLowerCase()
                        .replace(/[^a-z0-9]/g, "");
                    const renderFieldValue = (value) => {
                      if (value == null || value === "") return null;
                      if (typeof value === "object") {
                        return (
                          value.name ||
                          value.label ||
                          value.value ||
                          JSON.stringify(value)
                        );
                      }
                      return String(value);
                    };
                    const findCustomFieldValue = (aliases) => {
                      const normalizedAliases = aliases.map(normalizeKey);
                      const match = fieldValues.find((fv) => {
                        const key = normalizeKey(
                          fv?.customField?.fieldKey || fv?.customField?.name,
                        );
                        const label = normalizeKey(fv?.customField?.label);
                        return (
                          normalizedAliases.includes(key) ||
                          normalizedAliases.includes(label)
                        );
                      });
                      return renderFieldValue(match?.value);
                    };

                    // Final field extraction with fallback to visitor summary
                    const visitorName =
                      findCustomFieldValue([
                        "fullname",
                        "name",
                        "visitorname",
                      ]) ||
                      result.visitor?.fullName ||
                      result.full_name ||
                      result.user?.fullName ||
                      "N/A";
                    const company =
                      findCustomFieldValue([
                        "company",
                        "organisation",
                        "organization",
                        "employer",
                        "firm",
                      ]) ||
                      result.visitor?.companyName ||
                      result.visitor?.organisation ||
                      result.organisation ||
                      result.companyName ||
                      result.user?.companyName ||
                      null;
                    const rawPurpose = findCustomFieldValue([
                      "purposeofvisit",
                      "purpose",
                      "visitpurpose",
                    ]);
                    const purpose =
                      (rawPurpose === "Other"
                        ? findCustomFieldValue([
                            "pleasespecify",
                            "specify",
                            "otherdetails",
                            "purposeotherdetails",
                          ]) || rawPurpose
                        : rawPurpose) ||
                      result.visitor?.purposeOfVisit ||
                      result.purpose_of_visit ||
                      null;
                    const department =
                      findCustomFieldValue([
                        "department",
                        "dept",
                        "division",
                        "unit",
                        "section",
                        "team",
                        "businessunit",
                      ]) ||
                      result.visitor?.department?.name ||
                      result.visitor?.department ||
                      result.department?.name ||
                      result.department ||
                      null;
                    const accessLevel =
                      findCustomFieldValue([
                        "accesslevel",
                        "access level",
                        "access",
                        "clearance",
                        "securitylevel",
                        "badgelevel",
                        "accesstype",
                        "zone",
                      ]) ||
                      result.visitor?.accessLevel?.name ||
                      result.visitor?.accessLevel ||
                      result.accessLevel?.name ||
                      result.accessLevel ||
                      null;
                    const idTypeFromField = findCustomFieldValue([
                      "idtype",
                      "identificationtype",
                      "documenttype",
                      "doctype",
                      "id document type",
                    ]);
                    const omanIdValue = findCustomFieldValue([
                      "omanid",
                      "omanidnumber",
                      "omannationalid",
                      "nationalid",
                      "civilid",
                      "idcardnumber",
                    ]);
                    const passportValue = findCustomFieldValue([
                      "passport",
                      "passportnumber",
                      "passportno",
                      "passportid",
                    ]);
                    const genericIdValue = findCustomFieldValue([
                      "idnumber",
                      "idno",
                      "identificationnumber",
                      "documentnumber",
                    ]);

                    const resolvedId = (() => {
                      const normalizedType = normalizeKey(idTypeFromField);

                      if (
                        normalizedType.includes("oman") &&
                        (omanIdValue || genericIdValue)
                      ) {
                        return {
                          type: "Oman ID",
                          value: omanIdValue || genericIdValue,
                        };
                      }
                      if (
                        normalizedType.includes("passport") &&
                        (passportValue || genericIdValue)
                      ) {
                        return {
                          type: "Passport",
                          value: passportValue || genericIdValue,
                        };
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
                    const checkInLogs = (activityLogs || []).filter(
                      (log) => log?.activityType === "checked_in",
                    );
                    const latestCheckInLog = checkInLogs.reduce(
                      (latest, current) => {
                        if (!latest) return current;

                        const latestTime = new Date(
                          latest?.metadata?.checkedInAt ||
                            latest?.createdAt ||
                            0,
                        ).getTime();
                        const currentTime = new Date(
                          current?.metadata?.checkedInAt ||
                            current?.createdAt ||
                            0,
                        ).getTime();

                        return currentTime > latestTime ? current : latest;
                      },
                      null,
                    );
                    const checkInTime =
                      latestCheckInLog?.metadata?.checkedInAt ||
                      latestCheckInLog?.createdAt;
                    const expectedCheckout = result.currentVisitEnd
                      ? `${formatDate(result.currentVisitEnd)} ${formatTime(result.currentVisitEnd)}`
                      : result.approved_to
                        ? `${formatDate(result.approved_to)} ${formatTime(result.approved_to)}`
                        : null;

                    const checkOutLogs = (activityLogs || []).filter(
                      (log) => log?.activityType === "checked_out",
                    );
                    const latestCheckOutLog = checkOutLogs.reduce(
                      (latest, current) => {
                        if (!latest) return current;
                        const latestTime = new Date(
                          latest?.metadata?.checkedOutAt ||
                            latest?.createdAt ||
                            0,
                        ).getTime();
                        const currentTime = new Date(
                          current?.metadata?.checkedOutAt ||
                            current?.createdAt ||
                            0,
                        ).getTime();
                        return currentTime > latestTime ? current : latest;
                      },
                      null,
                    );
                    const checkOutTime =
                      latestCheckOutLog?.metadata?.checkedOutAt ||
                      latestCheckOutLog?.createdAt;

                    const endedLog = (activityLogs || []).find(
                      (log) => log?.activityType === "visit_ended",
                    );
                    const visitEndedAt =
                      endedLog?.metadata?.endedAt ||
                      result.visitEndedAt ||
                      result.visit_ended_at;

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
                      pushField(t.gateFieldName, visitorName, ICONS.person);
                      pushField(t.gateFieldCompany, company, ICONS.business);
                      pushField(t.gateFieldPurpose, purpose, ICONS.info);
                      pushField(t.department, department, ICONS.business);
                      pushField(t.gateFieldIdType, translateIdType(resolvedId?.type), ICONS.badge);
                      pushField(
                        resolvedId?.type
                          ? t.gateFieldNumberOf.replace(
                              "{{type}}",
                              translateIdType(resolvedId.type),
                            )
                          : t.gateFieldIdNumber,
                        resolvedId?.value,
                        ICONS.vpnKey,
                      );
                      if (result.approved_from || result.approved_to) {
                        pushField(
                          t.gateFieldApprovedDate,
                          `${result.approved_from ? formatDate(result.approved_from) : "—"} ${t.gateRangeTo} ${result.approved_to ? formatDate(result.approved_to) : "—"}`,
                          ICONS.event,
                        );
                        pushField(
                          t.gateFieldApprovedTime,
                          `${result.approved_from ? formatTime(result.approved_from) : "—"} ${t.gateRangeTo} ${result.approved_to ? formatTime(result.approved_to) : "—"}`,
                          ICONS.time,
                        );
                      }
                      pushField(t.gateFieldAccessLevel, accessLevel, ICONS.security);
                      if (checkOutTime)
                        pushField(
                          t.gateFieldCheckedOutAt,
                          `${formatDate(checkOutTime)} ${formatTime(checkOutTime)}`,
                          ICONS.logout,
                        );
                      if (visitEndedAt)
                        pushField(
                          t.gateFieldVisitEndedAt,
                          `${formatDate(visitEndedAt)} ${formatTime(visitEndedAt)}`,
                          ICONS.logout,
                        );
                    }
                    // Rejected/Cancelled/Expired: full info + rejection reason if available
                    else if (isRejected || isCancelled || isExpired) {
                      pushField(t.gateFieldName, visitorName, ICONS.person);
                      pushField(t.gateFieldCompany, company, ICONS.business);
                      pushField(t.gateFieldPurpose, purpose, ICONS.info);
                      pushField(t.department, department, ICONS.business);
                      pushField(t.gateFieldIdType, translateIdType(resolvedId?.type), ICONS.badge);
                      pushField(
                        resolvedId?.type
                          ? t.gateFieldNumberOf.replace(
                              "{{type}}",
                              translateIdType(resolvedId.type),
                            )
                          : t.gateFieldIdNumber,
                        resolvedId?.value,
                        ICONS.vpnKey,
                      );
                      if (result.approved_from || result.approved_to) {
                        pushField(
                          t.gateFieldApprovedDate,
                          `${result.approved_from ? formatDate(result.approved_from) : "—"} ${t.gateRangeTo} ${result.approved_to ? formatDate(result.approved_to) : "—"}`,
                          ICONS.event,
                        );
                        pushField(
                          t.gateFieldApprovedTime,
                          `${result.approved_from ? formatTime(result.approved_from) : "—"} ${t.gateRangeTo} ${result.approved_to ? formatTime(result.approved_to) : "—"}`,
                          ICONS.time,
                        );
                      }
                      pushField(t.gateFieldAccessLevel, accessLevel, ICONS.security);
                      if (isRejected) {
                        const reason =
                          result.rejectionReason || result.rejection_reason;
                        if (reason)
                          pushField(t.gateFieldRejectionReason, reason, ICONS.info);
                      }
                    }
                    // Approved/CheckedOut: full approved details + checkout time for checked_out
                    else if (isApproved || isCheckedOut) {
                      pushField(t.gateFieldName, visitorName, ICONS.person);
                      pushField(t.gateFieldCompany, company, ICONS.business);
                      pushField(t.gateFieldPurpose, purpose, ICONS.info);
                      pushField(t.department, department, ICONS.business);
                      pushField(t.gateFieldIdType, translateIdType(resolvedId?.type), ICONS.badge);
                      pushField(
                        resolvedId?.type
                          ? t.gateFieldNumberOf.replace(
                              "{{type}}",
                              translateIdType(resolvedId.type),
                            )
                          : t.gateFieldIdNumber,
                        resolvedId?.value,
                        ICONS.vpnKey,
                      );
                      if (result.approved_from || result.approved_to) {
                        pushField(
                          t.gateFieldApprovedDate,
                          `${result.approved_from ? formatDate(result.approved_from) : "—"} ${t.gateRangeTo} ${result.approved_to ? formatDate(result.approved_to) : "—"}`,
                          ICONS.event,
                        );
                        pushField(
                          t.gateFieldApprovedTime,
                          `${result.approved_from ? formatTime(result.approved_from) : "—"} ${t.gateRangeTo} ${result.approved_to ? formatTime(result.approved_to) : "—"}`,
                          ICONS.time,
                        );
                      }
                      pushField(t.gateFieldAccessLevel, accessLevel, ICONS.security);
                      if (isCheckedOut && checkOutTime)
                        pushField(
                          t.gateFieldCheckedOutAt,
                          `${formatDate(checkOutTime)} ${formatTime(checkOutTime)}`,
                          ICONS.logout,
                        );
                    }
                    // Pending/AdminApproved: visitor name, purpose of visit, department
                    else if (isPending) {
                      pushField(t.gateFieldName, visitorName, ICONS.person);
                      pushField(t.gateFieldPurpose, purpose, ICONS.info);
                      pushField(t.department, department, ICONS.business);
                      pushField(t.gateFieldIdType, translateIdType(resolvedId?.type), ICONS.badge);
                      pushField(
                        resolvedId?.type
                          ? t.gateFieldNumberOf.replace(
                              "{{type}}",
                              translateIdType(resolvedId.type),
                            )
                          : t.gateFieldIdNumber,
                        resolvedId?.value,
                        ICONS.vpnKey,
                      );
                    }
                    // CheckedIn: Show check-in timestamp, expected checkout time
                    else if (isCheckedIn) {
                      pushField(t.gateFieldName, visitorName, ICONS.person);
                      pushField(t.gateFieldCompany, company, ICONS.business);
                      pushField(t.gateFieldPurpose, purpose, ICONS.info);
                      pushField(t.department, department, ICONS.business);
                      pushField(t.gateFieldIdType, translateIdType(resolvedId?.type), ICONS.badge);
                      pushField(
                        resolvedId?.type
                          ? t.gateFieldNumberOf.replace(
                              "{{type}}",
                              translateIdType(resolvedId.type),
                            )
                          : t.gateFieldIdNumber,
                        resolvedId?.value,
                        ICONS.vpnKey,
                      );
                      if (result.approved_from || result.approved_to) {
                        pushField(
                          t.gateFieldApprovedDate,
                          `${result.approved_from ? formatDate(result.approved_from) : "—"} ${t.gateRangeTo} ${result.approved_to ? formatDate(result.approved_to) : "—"}`,
                          ICONS.event,
                        );
                        pushField(
                          t.gateFieldApprovedTime,
                          `${result.approved_from ? formatTime(result.approved_from) : "—"} ${t.gateRangeTo} ${result.approved_to ? formatTime(result.approved_to) : "—"}`,
                          ICONS.time,
                        );
                      }
                      pushField(t.gateFieldAccessLevel, accessLevel, ICONS.security);
                      if (checkInTime)
                        pushField(
                          t.gateFieldCheckinTime,
                          `${formatDate(checkInTime)} ${formatTime(checkInTime)}`,
                          ICONS.login,
                        );
                      pushField(
                        t.gateFieldExpectedCheckout,
                        expectedCheckout,
                        ICONS.logout,
                      );
                    }

                    pushField(
                      t.gateFieldVehiclePlate,
                      result.vehicle_plate || result.vehiclePlate,
                      ICONS.parking,
                    );

                    return fields.map((item, idx) => (
                      <ListItem
                        key={`${item.label}-${idx}`}
                        disablePadding
                        sx={{ py: 0.8 }}
                      >
                        <ListItemIcon
                          sx={{ minWidth: 36, color: "primary.main" }}
                        >
                          {(() => {
                            const IconComponent = item.icon || ICONS.info;
                            return <IconComponent fontSize="small" />;
                          })()}
                        </ListItemIcon>
                        <ListItemText
                          primary={item.label}
                          secondary={item.value}
                          primaryTypographyProps={{
                            variant: "caption",
                            color: "text.secondary",
                            fontWeight: 600,
                          }}
                          secondaryTypographyProps={{
                            variant: "body1",
                            color: "text.primary",
                            fontWeight: 500,
                          }}
                        />
                      </ListItem>
                    ));
                  })()}
                </List>

                <Stack spacing={2} mt={4}>
                  {(() => {
                    const status = result.status;
                    const isPending = result.status === "pending";
                    const isApproved = ["approved", "admin_approved"].includes(
                      result.status,
                    );
                    const isCheckedIn = result.status === "checked_in";
                    const isCheckedOut = result.status === "checked_out";
                    const isEnded = result.status === "visit_ended";
                    const isMulti =
                      result.allow_multi_checkin ?? result.allowMultiCheckin;
                    const isVipEnded =
                      isEnded &&
                      (result.is_vip_fast_track || result.isVipFastTrack);

                    const _fvs = Array.isArray(result.fieldValues)
                      ? result.fieldValues
                      : Array.isArray(result.visitor?.fieldValues)
                        ? result.visitor.fieldValues
                        : [];
                    const _nk = (v) =>
                      String(v ?? "")
                        .toLowerCase()
                        .replace(/[^a-z0-9]/g, "");
                    const _rv = (v) => {
                      if (v == null || v === "") return null;
                      if (typeof v === "object")
                        return v.name || v.label || v.value || null;
                      return String(v);
                    };
                    const _find = (aliases) => {
                      const norm = aliases.map(_nk);
                      const m = _fvs.find(
                        (fv) =>
                          norm.includes(
                            _nk(
                              fv?.customField?.fieldKey ||
                                fv?.customField?.name,
                            ),
                          ) || norm.includes(_nk(fv?.customField?.label)),
                      );
                      return _rv(m?.value);
                    };
                    const _idType = _find([
                      "idtype",
                      "identificationtype",
                      "documenttype",
                      "doctype",
                    ]);
                    const _omanId = _find([
                      "omanid",
                      "nationalid",
                      "civilid",
                      "idcardnumber",
                      "idnumber",
                      "idno",
                    ]);
                    const _passport = _find([
                      "passport",
                      "passportnumber",
                      "passportno",
                    ]);
                    const _nk2 = _nk(_idType || "");
                    const resolvedId = (() => {
                      if (_nk2.includes("passport") && (_passport || _omanId))
                        return {
                          type: "Passport",
                          value: _passport || _omanId,
                        };
                      if (_omanId)
                        return {
                          type: _nk2.includes("passport") ? "Passport" : "ID",
                          value: _omanId,
                        };
                      if (_passport)
                        return { type: "Passport", value: _passport };
                      return null;
                    })();

                    const isVipFastTrack =
                      result.is_vip_fast_track || result.isVipFastTrack;
                    const bufferMs =
                      (workingHours?.checkInBufferMinutes ?? 60) * 60 * 1000;

                    // Check-in window: full approvedFrom–approvedTo range
                    const outsideWindow = (() => {
                      if (isVipFastTrack || !isApproved) return false;
                      if (result.status === "admin_approved") return false;
                      if (!result.approved_from || !result.approved_to) return false;
                      const now = Date.now();
                      const fromMs = new Date(result.approved_from).getTime();
                      const toMs = new Date(result.approved_to).getTime();
                      return now < fromMs - bufferMs || now > toMs + bufferMs;
                    })();

                    const fmtWindow = () => {
                      const fmt = (d) => `${formatDate(d)} ${formatTime(d)}`;
                      const from = new Date(
                        new Date(result.approved_from).getTime() - bufferMs,
                      );
                      const to = new Date(
                        new Date(result.approved_to).getTime() + bufferMs,
                      );
                      return `${fmt(from)} – ${fmt(to)}`;
                    };

                    // For single-day visits: today must match the appointment day.
                    // For multi-day visits: today must fall within approved_from – approved_to.
                    const isMultiDay = (() => {
                      const f = result.approved_from;
                      const t = result.approved_to;
                      if (!f || !t) return false;
                      return new Date(f).toDateString() !== new Date(t).toDateString();
                    })();
                    const outsideCheckoutDay = (() => {
                      if (!isCheckedIn) return false;
                      if (isMultiDay) {
                        const todayMs = new Date().setHours(0, 0, 0, 0);
                        const fromMs = new Date(result.approved_from).setHours(0, 0, 0, 0);
                        const toMs = new Date(result.approved_to).setHours(0, 0, 0, 0);
                        return todayMs < fromMs || todayMs > toMs;
                      }
                      const ref = result.approved_to || result.approved_from;
                      if (!ref) return false;
                      return new Date(ref).toDateString() !== new Date().toDateString();
                    })();

                    return (
                      <>
                        {resolvedId &&
                          (isApproved || (isCheckedOut && isMulti)) && (
                            <Box
                              onClick={() => setIdVerified((v) => !v)}
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1.5,
                                p: 1.5,
                                borderRadius: 2,
                                border: "1px solid",
                                borderColor: idVerified
                                  ? "success.main"
                                  : "warning.main",
                                bgcolor: idVerified
                                  ? isDark
                                    ? "rgba(46,125,50,0.12)"
                                    : "rgba(46,125,50,0.06)"
                                  : isDark
                                    ? "rgba(237,108,2,0.12)"
                                    : "rgba(237,108,2,0.06)",
                                cursor: "pointer",
                                userSelect: "none",
                                width: "100%",
                              }}
                            >
                              <Box
                                sx={{
                                  width: 20,
                                  height: 20,
                                  borderRadius: 0.5,
                                  flexShrink: 0,
                                  border: "2px solid",
                                  borderColor: idVerified
                                    ? "success.main"
                                    : "warning.main",
                                  bgcolor: idVerified
                                    ? "success.main"
                                    : "transparent",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                {idVerified && (
                                  <ICONS.check
                                    sx={{ fontSize: 14, color: "#fff" }}
                                  />
                                )}
                              </Box>
                              <Box>
                                <Typography
                                  variant="body2"
                                  fontWeight={700}
                                  color={
                                    idVerified ? "success.main" : "warning.main"
                                  }
                                  display="block"
                                >
                                  {idVerified
                                    ? t.gateIdVerified
                                    : t.gateIdVerificationRequired}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  {translateIdType(resolvedId.type)}:{" "}
                                  <strong>{resolvedId.value}</strong>
                                </Typography>
                              </Box>
                            </Box>
                          )}

                        {outsideWindow && (
                          <Alert
                            severity="error"
                            icon={<ICONS.time fontSize="small" />}
                            sx={{ borderRadius: 2, fontWeight: 600, mb: 1 }}
                          >
                            {t.gateOutsideWindow.replace(
                              "{{window}}",
                              fmtWindow(),
                            )}
                          </Alert>
                        )}

                        {outsideCheckoutDay && (
                          <Alert
                            severity="error"
                            icon={<ICONS.time fontSize="small" />}
                            sx={{ borderRadius: 2, fontWeight: 600, mb: 1 }}
                          >
                            {isMultiDay
                              ? t.gateOutsideVisitWindow
                                  .replace(
                                    "{{from}}",
                                    formatDate(result.approved_from),
                                  )
                                  .replace(
                                    "{{to}}",
                                    formatDate(result.approved_to),
                                  )
                              : t.gateCheckoutSameDay.replace(
                                  "{{date}}",
                                  formatDate(
                                    result.approved_to || result.approved_from,
                                  ),
                                )}
                          </Alert>
                        )}

                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          spacing={2}
                        >
                          <Button
                            fullWidth
                            variant="outlined"
                            startIcon={<ICONS.close />}
                            onClick={reset}
                          >
                            {t.close}
                          </Button>

                          {isPending && (
                            <Button
                              fullWidth
                              variant="contained"
                              disabled
                              startIcon={<ICONS.time />}
                              sx={{
                                fontSize: "0.85rem",
                                bgcolor: isDark
                                  ? "rgba(255,255,255,0.08) !important"
                                  : "rgba(0,0,0,0.06) !important",
                                color: isDark
                                  ? "rgba(255,255,255,0.4) !important"
                                  : "rgba(0,0,0,0.4) !important",
                                border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                              }}
                            >
                              {t.gateAwaitingApproval}
                            </Button>
                          )}

                          {isApproved && canCheckin && (
                            <Button
                              fullWidth
                              variant="contained"
                              color="success"
                              startIcon={
                                actionLoading ? (
                                  <CircularProgress size={20} />
                                ) : (
                                  <ICONS.login />
                                )
                              }
                              onClick={handleCheckInAction}
                              disabled={
                                actionLoading ||
                                (Boolean(resolvedId) && !idVerified) ||
                                outsideWindow
                              }
                            >
                              {t.gateCheckIn}
                            </Button>
                          )}

                          {isCheckedIn && canCheckout && (
                            <Button
                              fullWidth
                              variant="contained"
                              color="error"
                              startIcon={
                                actionLoading ? (
                                  <CircularProgress size={20} />
                                ) : (
                                  <ICONS.logout />
                                )
                              }
                              onClick={handleCheckOutAction}
                              disabled={actionLoading || outsideCheckoutDay}
                            >
                              {t.gateCheckOut}
                            </Button>
                          )}

                          {isCheckedOut && isMulti && canCheckin && (
                            <Button
                              fullWidth
                              variant="contained"
                              color="success"
                              startIcon={
                                actionLoading ? (
                                  <CircularProgress size={20} />
                                ) : (
                                  <ICONS.login />
                                )
                              }
                              onClick={handleCheckInAction}
                              disabled={
                                actionLoading ||
                                (Boolean(resolvedId) && !idVerified)
                              }
                            >
                              {t.gateCheckInAgain}
                            </Button>
                          )}

                          {isVipEnded && (
                            <Button
                              fullWidth
                              variant="contained"
                              color="warning"
                              startIcon={
                                actionLoading ? (
                                  <CircularProgress size={20} />
                                ) : (
                                  <ICONS.star />
                                )
                              }
                              onClick={handleVipRevisit}
                              disabled={actionLoading}
                            >
                              {t.gateVipCheckIn}
                            </Button>
                          )}
                        </Stack>
                      </>
                    );
                  })()}
                </Stack>
              </Paper>
            )}

            {error && (
              <Paper
                elevation={0}
                sx={{
                  p: 4,
                  borderRadius: 4,
                  border: `1px solid ${isDark ? "rgba(211,47,47,0.5)" : "rgba(211,47,47,0.2)"}`,
                  textAlign: "center",
                  bgcolor: "background.paper",
                  width: "100%",
                }}
              >
                <ICONS.errorOutline
                  sx={{ fontSize: 64, color: "error.main", mb: 2 }}
                />
                <Typography
                  variant="h6"
                  fontWeight={700}
                  color="error.main"
                  gutterBottom
                >
                  {t.gateVerificationFailed}
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={3}>
                  {error}
                </Typography>
                <Button
                  variant="contained"
                  color="error"
                  fullWidth
                  startIcon={<ICONS.refresh />}
                  onClick={reset}
                  sx={{ borderRadius: 3 }}
                >
                  {t.gateRetry}
                </Button>
              </Paper>
            )}
          </Box>
        </>
        )}
        </Box>
      </Container>

      {/* ID Verification Dialog — auto-opens on QR scan when ID is required */}
      <Dialog
        open={showIdVerifyDialog}
        onClose={() => setShowIdVerifyDialog(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 4, p: 1 },
        }}
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            fontWeight: 700,
          }}
        >
          <ICONS.vpnKey sx={{ color: "warning.main" }} />
          {t.gateIdVerificationRequired}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            {t.gateVerifyIdentityPrompt}
          </Typography>
          {resolvedId && (
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                border: "1px solid",
                borderColor: "warning.main",
                bgcolor: isDark
                  ? "rgba(237,108,2,0.08)"
                  : "rgba(237,108,2,0.04)",
              }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                display="block"
                mb={0.5}
              >
                {t.gateExpectedId.replace(
                  "{{type}}",
                  translateIdType(resolvedId.type),
                )}
              </Typography>
              <Typography variant="h6" fontWeight={700}>
                {resolvedId.value}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions
          sx={{
            px: 3,
            pb: 2,
            gap: 1,
            display: "flex",
            flexDirection: { xs: "column-reverse", sm: "row" },
            justifyContent: { xs: "flex-end", sm: "space-between" },
            width: "100%",
            ...getStartIconSpacing(dir),
          }}
        >
          <Button
            fullWidth
            variant="outlined"
            color="inherit"
            onClick={() => setShowIdVerifyDialog(false)}
            sx={{ borderRadius: 3, py: 1.5, whiteSpace: "nowrap" }}
          >
            {t.cancel}
          </Button>
          <Button
            fullWidth
            variant="contained"
            color="success"
            startIcon={<ICONS.check />}
            onClick={() => {
              setIdVerified(true);
              setShowIdVerifyDialog(false);
              handleCheckInAction();
            }}
            sx={{ borderRadius: 3, py: 1.5, whiteSpace: "nowrap" }}
          >
            {t.gateVerifyAndCheckIn}
          </Button>
        </DialogActions>
      </Dialog>
    </RoleGuard>
  );
}
