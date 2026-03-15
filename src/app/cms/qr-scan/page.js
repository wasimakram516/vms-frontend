"use client";

import { useState, useCallback, useRef } from "react";
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Stack,
  Tooltip,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Container,
  Paper,
  Chip,
  Alert,
  Divider,
} from "@mui/material";

import QrScanner from "@/components/QrScanner";
import ICONS from "@/utils/iconUtil";
import { useMessage } from "@/contexts/MessageContext";

// Mock verification function — replace with real API call in Phase 2
const mockVerify = async (token) => {
  await new Promise((r) => setTimeout(r, 1000));
  const clean = token.trim().toUpperCase();
  if (!clean || clean.length < 3) {
    return { error: true, message: "Invalid or unknown token." };
  }
  // Simulate a successful result
  return {
    token: clean,
    full_name: "Sara Al-Mutairi",
    email: "sara@example.com",
    purpose_of_visit: "Interview",
    status: "approved",
    requested_date: "2026-03-16",
  };
};

const STATUS_CONFIG = {
  approved:    { label: "Approved",   color: "success" },
  pending:     { label: "Pending",    color: "warning" },
  rejected:    { label: "Rejected",   color: "error" },
  checked_in:  { label: "Checked In", color: "info" },
  checked_out: { label: "Checked Out",color: "default" },
};

export default function CmsQrScanPage() {
  const { showMessage } = useMessage();
  const [showScanner, setShowScanner] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const scanningRef = useRef(false);

  const successAudioRef = useRef(null);
  const errorAudioRef = useRef(null);

  const doVerify = useCallback(async (input) => {
    setLoading(true);
    setError(null);
    setResult(null);
    const res = await mockVerify(input);
    if (res?.error) {
      errorAudioRef.current?.play();
      setError(res.message || "Invalid token.");
    } else {
      successAudioRef.current?.play();
      setResult(res);
    }
    setLoading(false);
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
    <Box>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} mb={3} gap={1}>
        <Box>
          <Typography variant="h4" fontWeight={800}>QR Scan</Typography>
          <Typography color="text.secondary" variant="body2" mt={0.5}>
            Scan a visitor QR code or enter a token manually to verify registration.
          </Typography>
        </Box>
      </Stack>

      <Container maxWidth="xs" disableGutters>
        {/* Idle state */}
        {!showScanner && !loading && !result && !error && (
          <Paper elevation={0} sx={{ p: 4, borderRadius: 3, border: "1px solid rgba(0,0,0,0.07)", textAlign: "center" }}>
            <ICONS.qrCodeScanner sx={{ fontSize: 56, color: "primary.main", mb: 2 }} />
            <Typography variant="h6" fontWeight={700} mb={1}>Verify a Registration</Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>
              Scan a QR code using the camera, or enter a token manually.
            </Typography>

            {!manualMode ? (
              <Stack spacing={1.5}>
                <Button variant="contained" size="large" startIcon={<ICONS.qrCodeScanner />} onClick={() => setShowScanner(true)} fullWidth>
                  Open Scanner
                </Button>
                <Button variant="outlined" startIcon={<ICONS.key />} onClick={() => setManualMode(true)} fullWidth>
                  Manual Token Entry
                </Button>
              </Stack>
            ) : (
              <Stack spacing={2}>
                <Typography variant="body2" color="text.secondary">
                  Enter the token or place cursor here and scan with a connected QR reader.
                </Typography>
                <Stack direction="row" spacing={1}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Enter Token"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && token.trim()) doVerify(token); }}
                    autoFocus
                  />
                  <Button variant="contained" disabled={!token.trim()} onClick={() => doVerify(token)} sx={{ minWidth: 90 }}>
                    Verify
                  </Button>
                </Stack>
                <Button variant="text" size="small" onClick={() => setManualMode(false)}>← Back</Button>
              </Stack>
            )}
          </Paper>
        )}

        {/* QR Scanner overlay */}
        {showScanner && (
          <QrScanner
            onScanSuccess={handleScanSuccess}
            onError={(err) => { showMessage(err || "Camera error.", "error"); setShowScanner(false); }}
            onCancel={() => setShowScanner(false)}
          />
        )}

        {/* Loading */}
        {loading && (
          <Paper elevation={0} sx={{ p: 5, borderRadius: 3, border: "1px solid rgba(0,0,0,0.07)", textAlign: "center" }}>
            <CircularProgress />
            <Typography variant="body2" mt={2} color="text.secondary">Verifying registration...</Typography>
          </Paper>
        )}

        {/* Success */}
        {result && sc && (
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: "1px solid rgba(46,125,50,0.25)", bgcolor: "rgba(46,125,50,0.04)" }}>
            <Stack alignItems="center" mb={3}>
              <ICONS.checkCircle sx={{ fontSize: 56, color: "success.main", mb: 1 }} />
              <Typography variant="h6" fontWeight={700} color="success.main">Verified</Typography>
              <Chip label={sc.label} color={sc.color} size="small" sx={{ mt: 0.5, fontWeight: 600 }} />
            </Stack>
            <Divider sx={{ mb: 2 }} />
            <List dense disablePadding>
              {[
                [ICONS.key, "Token", result.token],
                [ICONS.person, "Name", result.full_name],
                [ICONS.email, "Email", result.email],
                [ICONS.event, "Purpose", result.purpose_of_visit],
                [ICONS.time, "Requested Date", result.requested_date],
              ].map(([Icon, label, value]) => (
                <ListItem key={label} disablePadding sx={{ py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 36 }}><Icon sx={{ fontSize: 18, color: "text.secondary" }} /></ListItemIcon>
                  <ListItemText primary={label} secondary={value || "—"} primaryTypographyProps={{ variant: "caption", color: "text.secondary" }} secondaryTypographyProps={{ variant: "body2", fontWeight: 500 }} />
                </ListItem>
              ))}
            </List>
            <Button variant="outlined" fullWidth onClick={reset} startIcon={<ICONS.qrCodeScanner />} sx={{ mt: 3 }}>
              Scan Another
            </Button>
          </Paper>
        )}

        {/* Error */}
        {error && (
          <Paper elevation={0} sx={{ p: 4, borderRadius: 3, border: "1px solid rgba(211,47,47,0.2)", textAlign: "center" }}>
            <ICONS.errorOutline sx={{ fontSize: 56, color: "error.main", mb: 1 }} />
            <Typography variant="h6" fontWeight={700} color="error.main" mb={1}>Verification Failed</Typography>
            <Alert severity="error" sx={{ mb: 2, textAlign: "left" }}>{error}</Alert>
            <Button variant="outlined" color="error" onClick={reset} startIcon={<ICONS.replay />}>Try Again</Button>
          </Paper>
        )}
      </Container>

      <audio ref={successAudioRef} src="/correct.wav" preload="auto" />
      <audio ref={errorAudioRef} src="/wrong.wav" preload="auto" />
    </Box>
  );
}
