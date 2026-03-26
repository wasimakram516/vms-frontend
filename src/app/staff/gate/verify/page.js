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
} from "@mui/material";

import QrScanner from "@/components/QrScanner";
import RoleGuard from "@/components/auth/RoleGuard";
import ICONS from "@/utils/iconUtil";
import LoadingState from "@/components/LoadingState";
import { useMessage } from "@/contexts/MessageContext";
import { useColorMode } from "@/contexts/ThemeContext";
import { useSocket } from "@/contexts/SocketContext";
import { verifyRegistrationByToken, checkInRegistration, checkOutRegistration } from "@/services/registrationService";
import { formatDate, formatTime } from "@/utils/dateUtils";

const STATUS_CONFIG = {
  pending:     { label: "Pending",    color: "warning" },
  approved:    { label: "Approved",   color: "success" },
  rejected:    { label: "Rejected",   color: "error" },
  checked_in:  { label: "Checked In", color: "info" },
  checked_out: { label: "Checked Out",color: "default" },
  cancelled:   { label: "Cancelled",  color: "default" },
  expired:     { label: "Expired",    color: "default" },
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
  const scanningRef = useRef(false);

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
        setResult(res);
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

  const handleCheckInAction = async () => {
    if (!result?.id) return;
    setActionLoading(true);
    try {
      const updated = await checkInRegistration(result.id);
      if (!updated.error) {
        setResult(updated);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOutAction = async () => {
    if (!result?.id) return;
    setActionLoading(true);
    try {
      const updated = await checkOutRegistration(result.id);
      if (!updated.error) {
        setResult(updated);
      }
    } finally {
      setActionLoading(false);
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

  useEffect(() => {
    const unsub = on("registration:updated", (updatedReg) => {
      if (result && result.id === updatedReg.id) {
        const isAccessible = ["approved", "checked_in", "checked_out"].includes(updatedReg.status);
        
        const mappedReg = {
          id: updatedReg.id,
          full_name: updatedReg.user?.fullName || "N/A",
          email: updatedReg.user?.email || "N/A",
          phone: updatedReg.user?.phone || "N/A",
          purpose_of_visit: updatedReg.purposeOfVisit,
          status: updatedReg.status,
          approved_date_from: updatedReg.approvedDateFrom,
          approved_date_to: updatedReg.approvedDateTo,
          approved_time_from: updatedReg.approvedTimeFrom,
          approved_time_to: updatedReg.approvedTimeTo,
          qr_token: updatedReg.qrToken,
          notApproved: !isAccessible,
          visitor: updatedReg.visitor,
          user: updatedReg.user,
          ...updatedReg
        };
        setResult(mappedReg);
        showMessage("Visitor status was updated.", "info");
      }
    });
    return () => unsub?.();
  }, [result?.id, on, showMessage]);

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
                bgcolor: isDark ? "rgba(255,255,255,0.1)" : "primary.light",
                color: "primary.main",
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
                  Start Scanning
                </Button>
                <Button 
                  variant="outlined" 
                  fullWidth 
                  startIcon={<ICONS.key />}
                  onClick={() => setManualMode(true)}
                  sx={{ py: 1.5, borderRadius: 3 }}
                >
                  Enter Token Manually
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
              <Box sx={{ bgcolor: `${sc.color}.light`, color: `${sc.color}.main`, p: 1, borderRadius: 2, display: "flex" }}>
                {sc.color === "success" ? <ICONS.checkCircle /> : <ICONS.time />}
              </Box>
              <Box>
                <Typography variant="h6" fontWeight={700}>Verification Success</Typography>
                <Chip label={sc.label} color={sc.color} size="small" sx={{ fontWeight: 600 }} />
              </Box>
            </Stack>
            
            <Divider sx={{ mb: 2 }} />
            
            {/* Not Approved - Show Minimal Details */}
            {result.notApproved ? (
              <List dense disablePadding>
                {[
                  { icon: ICONS.person, label: "Name", value: result.visitor?.fullName || result.full_name },
                  { icon: ICONS.business, label: "Company", value: result.visitor?.companyName || result.user?.companyName || "N/A" },
                  { icon: ICONS.info, label: "Purpose", value: result.visitor?.purposeOfVisit || result.purpose_of_visit },
                ].map((item) => (
                  <ListItem key={item.label} disablePadding sx={{ py: 0.8 }}>
                    <ListItemIcon sx={{ minWidth: 36, color: "primary.main" }}><item.icon fontSize="small" /></ListItemIcon>
                    <ListItemText 
                      primary={item.label} 
                      secondary={item.value} 
                      primaryTypographyProps={{ variant: "caption", color: "text.secondary", fontWeight: 600 }}
                      secondaryTypographyProps={{ variant: "body1", color: "text.primary", fontWeight: 500 }}
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              /* Approved - Show Full Details */
              <List dense disablePadding>
                {[
                  { icon: ICONS.person, label: "Name", value: result.full_name },
                  { icon: ICONS.business, label: "Company", value: result.user?.companyName || "N/A" },
                  { icon: ICONS.info, label: "Purpose", value: result.purpose_of_visit },
                  { icon: ICONS.event, label: "Approved From", value: result.approved_date_from ? formatDate(result.approved_date_from) : "—" },
                  { icon: ICONS.event, label: "Approved To", value: result.approved_date_to ? formatDate(result.approved_date_to) : "—" },
                  { icon: ICONS.time, label: "Time", value: `${result.approved_time_from ? formatTime(result.approved_time_from) : "—"} - ${result.approved_time_to ? formatTime(result.approved_time_to) : "—"}` },
                ].map((item) => (
                  <ListItem key={item.label} disablePadding sx={{ py: 0.8 }}>
                    <ListItemIcon sx={{ minWidth: 36, color: "primary.main" }}><item.icon fontSize="small" /></ListItemIcon>
                    <ListItemText 
                      primary={item.label} 
                      secondary={item.value} 
                      primaryTypographyProps={{ variant: "caption", color: "text.secondary", fontWeight: 600 }}
                      secondaryTypographyProps={{ variant: "body1", color: "text.primary", fontWeight: 500 }}
                    />
                  </ListItem>
                ))}
              </List>
            )}

            <Stack direction="row" spacing={2} mt={4}>
              {result.notApproved ? (
                <Button fullWidth variant="outlined" startIcon={<ICONS.close />} onClick={reset}>Close</Button>
              ) : (
                <>
                  {result.status === "approved" && (
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
                  {result.status === "checked_in" && (
                    <Button 
                      fullWidth 
                      variant="contained" 
                      color="info" 
                      startIcon={actionLoading ? <CircularProgress size={20} /> : <ICONS.logout />}
                      onClick={handleCheckOutAction}
                      disabled={actionLoading}
                    >
                      Check Out
                    </Button>
                  )}
                  {(result.status === "checked_out" || result.status === "checked_in") && (
                    <Button fullWidth variant="outlined" startIcon={<ICONS.check />} onClick={reset}>Close</Button>
                  )}
                </>
              )}
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
