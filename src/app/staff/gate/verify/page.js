"use client";

import { useState, useCallback, useRef } from "react";
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
} from "@mui/material";

import QrScanner from "@/components/QrScanner";
import ICONS from "@/utils/iconUtil";
import LoadingState from "@/components/LoadingState";
import { useMessage } from "@/contexts/MessageContext";
import { useColorMode } from "@/contexts/ThemeContext";
import { verifyRegistrationByToken } from "@/services/registrationService";

const STATUS_CONFIG = {
  approved:    { label: "Approved",   color: "success" },
  pending:     { label: "Pending",    color: "warning" },
  rejected:    { label: "Rejected",   color: "error" },
  checked_in:  { label: "Checked In", color: "info" },
  checked_out: { label: "Checked Out",color: "default" },
};

export default function StaffVerifyPage() {
  const { showMessage } = useMessage();
  const { mode } = useColorMode();
  const isDark = mode === "dark";
  const [showScanner, setShowScanner] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
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
      // Mock result
      const mockRes = res || (input.toUpperCase().startsWith("SN-") ? {
        token: input.toUpperCase(),
        full_name: "Sara Al-Mutairi",
        email: "sara@example.com",
        purpose_of_visit: "Interview",
        status: "approved",
        requested_date: "2026-03-16",
      } : { error: true, message: "Invalid or unknown token." });

      if (mockRes.error) {
        setError(mockRes.message);
      } else {
        setResult(mockRes);
      }
    } catch (err) {
      setError("An error occurred during verification.");
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

  const reset = () => {
    setToken("");
    setResult(null);
    setError(null);
    setShowScanner(false);
    setManualMode(false);
  };

  const sc = result ? (STATUS_CONFIG[result.status] || { label: result.status, color: "default" }) : null;

  return (
    <Container maxWidth="sm">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" fontWeight={800} gutterBottom textAlign="center" color="primary.main" sx={{ fontFamily: "'Comfortaa', cursive" }}>
          Gate Check-in
        </Typography>
        <Typography color="text.secondary" textAlign="center" sx={{ mb: 4 }}>
          Scan visitor QR or enter token manually to grant access.
        </Typography>

        {/* Home / Choice State */}
        {!showScanner && !loading && !result && !error && (
          <Paper elevation={0} variant="frosted" sx={{ p: 4, borderRadius: 4, textAlign: "center" }}>
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

        {/* Scanning State */}
        {showScanner && (
          <QrScanner 
            onScanSuccess={handleScanSuccess}
            onCancel={() => setShowScanner(false)}
            onError={(err) => { showMessage(err, "error"); setShowScanner(false); }}
          />
        )}

        {/* Loading State */}
        {loading && (
          <LoadingState
            cardMaxWidth={380}
          />
        )}

        {/* Success / Result State */}
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
            
            <List dense disablePadding>
              {[
                { icon: ICONS.person, label: "Name", value: result.full_name },
                { icon: ICONS.event, label: "Purpose", value: result.purpose_of_visit },
                { icon: ICONS.time, label: "Visit Date", value: result.requested_date },
                { icon: ICONS.key, label: "Token", value: result.token },
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

            <Stack direction="row" spacing={2} mt={4}>
              <Button fullWidth variant="contained" color="success" startIcon={<ICONS.checkCircle />} onClick={reset}>Grant</Button>
              <Button fullWidth variant="outlined" startIcon={<ICONS.check />} onClick={reset}>Finish</Button>
            </Stack>
          </Paper>
        )}

        {/* Error State */}
        {error && (
          <Paper elevation={0} sx={{ p: 4, borderRadius: 4, border: `1px solid ${isDark ? "rgba(211,47,47,0.5)" : "rgba(211,47,47,0.2)"}`, textAlign: "center", bgcolor: "background.paper" }}>
            <ICONS.errorOutline sx={{ fontSize: 64, color: "error.main", mb: 2 }} />
            <Typography variant="h6" fontWeight={700} color="error.main" gutterBottom>Verification Failed</Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>{error}</Typography>
            <Button variant="contained" color="error" fullWidth startIcon={<ICONS.refresh />} onClick={reset} sx={{ borderRadius: 3 }}>Retry</Button>
          </Paper>
        )}
      </Box>
    </Container>
  );
}
