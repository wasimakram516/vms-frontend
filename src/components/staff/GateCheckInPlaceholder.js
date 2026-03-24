"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import QrScanner from "@/components/QrScanner";
import ICONS from "@/utils/iconUtil";

export default function GateCheckInPlaceholder() {
  const [showScanner, setShowScanner] = useState(false);
  const [token, setToken] = useState("");
  const [result, setResult] = useState(null);

  const handleScanSuccess = (value) => {
    setToken(value || "");
    setShowScanner(false);
    setResult({
      visitorName: "Visitor Name",
      status: "ready",
      scannedToken: value || "",
    });
  };

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, md: 7 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              QR Scan
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Scan visitor QR code or use manual token check-in.
            </Typography>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 2 }}>
              <Button
                variant="contained"
                startIcon={<ICONS.qrCodeScanner />}
                onClick={() => setShowScanner(true)}
              >
                Open Scanner
              </Button>
              <Button variant="outlined" startIcon={<ICONS.close />} onClick={() => setShowScanner(false)}>
                Close Scanner
              </Button>
            </Stack>

            {showScanner ? (
              <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 1.5 }}>
                <QrScanner
                  onScanSuccess={handleScanSuccess}
                  onError={() => setShowScanner(false)}
                  onCancel={() => setShowScanner(false)}
                />
              </Box>
            ) : null}

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 2 }}>
              <TextField
                fullWidth
                label="Manual token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
              <Button
                variant="contained"
                startIcon={<ICONS.checkCircle />}
                onClick={() =>
                  setResult({
                    visitorName: "Visitor Name",
                    status: "ready",
                    scannedToken: token,
                  })
                }
              >
                Verify
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, md: 5 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              Check-in Result
            </Typography>
            {!result ? (
              <Alert severity="info">No visitor scanned yet.</Alert>
            ) : (
              <Stack spacing={1}>
                <Typography>
                  <strong>Visitor:</strong> {result.visitorName}
                </Typography>
                <Typography>
                  <strong>Token:</strong> {result.scannedToken || "-"}
                </Typography>
                <Typography>
                  <strong>Status:</strong> {result.status}
                </Typography>
                <Button variant="contained" startIcon={<ICONS.checkCircle />}>
                  Check In Visitor
                </Button>
              </Stack>
            )}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
