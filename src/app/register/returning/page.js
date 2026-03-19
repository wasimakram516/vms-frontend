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
import { sendOtp } from "@/services/registrationService";
import { motion } from "framer-motion";

const transition = { duration: 0.5, ease: [0.43, 0.13, 0.23, 0.96] };

export default function ReturningVisitorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idFromQuery = searchParams.get("id");

  const [idNumber, setIdNumber] = useState(idFromQuery || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleIdSubmit = async (e) => {
    e.preventDefault();
    if (!idNumber) {
      setError("ID Number is required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await sendOtp(idNumber);
      router.push(`/register/otp?id=${encodeURIComponent(idNumber)}`);
    } catch (err) {
      setError(err.message || "Failed to send OTP");
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
          <form onSubmit={handleIdSubmit}>
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
                  <ICONS.badge sx={{ fontSize: 24 }} />
                </Box>
                <Typography variant="h6" fontWeight={800} textAlign="center" sx={{ fontFamily: "'Comfortaa', cursive" }}>
                  Returning Visitor
                </Typography>
                <Typography variant="body2" color="text.secondary" textAlign="center">
                  Enter your ID card number to retrieve your previously saved details.
                </Typography>
              </Stack>

              {error && <Alert severity="error">{error}</Alert>}

              <TextField
                fullWidth
                label="ID Card Number"
                required
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                placeholder="e.g. 2883392210"
              />

              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                disabled={loading}
                sx={{ borderRadius: "20px", py: 1.5, fontWeight: 700 }}
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : "Send OTP"}
              </Button>

              <Button
                variant="text"
                onClick={() => router.push("/register")}
                sx={{ textTransform: "none", fontWeight: 600 }}
              >
                Back to registration
              </Button>
            </Stack>
          </form>
        </Paper>
      </motion.div>
    </Box>
  );
}
