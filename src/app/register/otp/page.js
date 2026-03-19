"use client";

import { useState } from "react";
import {
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
  CircularProgress,
  Alert,
} from "@mui/material";
import { useRouter, useSearchParams } from "next/navigation";
import ICONS from "@/utils/iconUtil";
import { sendOtp, verifyOtp } from "@/services/registrationService";
import { motion } from "framer-motion";

const transition = { duration: 0.5, ease: [0.43, 0.13, 0.23, 0.96] };

export default function OtpVerificationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idNumber = searchParams.get("id") || "";

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    if (!otp) {
      setError("OTP is required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await verifyOtp(idNumber, otp);
      if (res.success && res.user) {
        // Store in sessionStorage to pre-fill the main register page
        sessionStorage.setItem("preFilledRegistration", JSON.stringify(res.user));
        router.push("/register");
      }
    } catch (err) {
      setError(err.message || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!idNumber) return;
    setLoading(true);
    setError("");
    try {
      await sendOtp(idNumber);
    } catch (err) {
      setError(err.message || "Failed to resend OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ mt: 8, display: "flex", justifyContent: "center" }}>
       <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={transition}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 4, sm: 5 },
              borderRadius: 4,
              backdropFilter: "blur(12px)",
              backgroundColor: "rgba(255,255,255,0.75)",
              border: "1px solid rgba(255,255,255,0.3)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
              maxWidth: 450,
              width: "100%",
            }}
          >
            <form onSubmit={handleOtpSubmit}>
              <Stack spacing={3}>
                <Stack alignItems="center" spacing={1}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 2,
                      background: "linear-gradient(135deg, #128199 0%, #0077b6 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      mb: 1,
                    }}
                  >
                    <ICONS.vpnKey sx={{ fontSize: 24 }} />
                  </Box>
                  <Typography variant="h6" fontWeight={800} textAlign="center" sx={{ fontFamily: "'Comfortaa', cursive" }}>
                    OTP Verification
                  </Typography>
                  <Typography variant="body2" color="text.secondary" textAlign="center">
                    We've sent a verification code to your registered contact for ID: <strong>{idNumber}</strong>
                  </Typography>
                </Stack>

                {error && <Alert severity="error">{error}</Alert>}

                <TextField
                  fullWidth
                  label="Verification Code"
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="Enter 1111 for testing"
                  autoFocus
                />

                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  size="large"
                  disabled={loading}
                  sx={{ borderRadius: "20px", py: 1.5, fontWeight: 700 }}
                >
                  {loading ? <CircularProgress size={24} color="inherit" /> : "Verify & Continue"}
                </Button>

                <Stack direction="row" justifyContent="center" spacing={1}>
                  <Typography variant="body2" color="text.secondary">
                    Didn't receive code?
                  </Typography>
                  <Button
                    variant="text"
                    size="small"
                    onClick={handleResendOtp}
                    disabled={loading}
                    sx={{ p: 0, minWidth: 0, textTransform: "none", fontWeight: 700 }}
                  >
                    Resend
                  </Button>
                </Stack>

                <Button
                  variant="text"
                  onClick={() => router.push("/register/returning")}
                  sx={{ textTransform: "none", fontWeight: 600 }}
                >
                  Back to ID entry
                </Button>
              </Stack>
            </form>
          </Paper>
       </motion.div>
    </Box>
  );
}
