"use client";

import { useState, useRef, useEffect } from "react";
import {
  Box,
  Button,
  Paper,
  Stack,
  Typography,
  CircularProgress,
  Divider,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { useVisitor } from "@/contexts/VisitorContext";
import { useMessage } from "@/contexts/MessageContext";
import { verifyOtp } from "@/services/registrationService";
import { motion } from "framer-motion";
import ICONS from "@/utils/iconUtil";

const transition = { duration: 0.5, ease: [0.43, 0.13, 0.23, 0.96] };

export default function VisitorOtpPage() {
  const router = useRouter();
  const { showMessage } = useMessage();
  const { visitorData, setVisitorData, setFlowState } = useVisitor();
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const inputRefs = [useRef(), useRef(), useRef(), useRef()];

  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    if (value && index < 3) {
      inputRefs[index + 1].current?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handleVerify = async () => {
    const code = otp.join("");
    if (code.length < 4) {
      showMessage("Please enter the 4-digit OTP.", "error");
      return;
    }

    setLoading(true);
    try {
      const res = await verifyOtp(visitorData.identity, code);
      if (res.success) {
        setFlowState((prev) => ({ ...prev, otpVerified: true, ndaAccepted: true, currentStep: "details" }));
        if (res.user) {
          setVisitorData((prev) => ({
            ...prev,
            userId: res.user.id,
            fullName: res.user.full_name,
            email: res.user.email,
            phone: res.user.phone,
            dynamicFields: {
              ...prev.dynamicFields,
              full_name: res.user.full_name || "",
              email: res.user.email || (prev.identity?.includes("@") ? prev.identity : ""),
              phone: res.user.phone || (!prev.identity?.includes("@") ? prev.identity : ""),
            }
          }));
        }
        showMessage("Identity verified! Please confirm your details.", "success");
        router.push("/register/details");
      }
    } catch (err) {
      showMessage(err.message || "Invalid OTP", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 420, mx: "auto", px: 2, py: { xs: 2, md: 3 } }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={transition}>
        <Paper elevation={0} sx={{ p: { xs: 3, md: 4 }, borderRadius: 5, border: "1px solid rgba(0,0,0,0.06)" }}>
          <Stack spacing={3}>
            <Box sx={{ textAlign: "center", mb: 2 }}>
              <Typography variant="h5" fontWeight={800} sx={{ fontFamily: "'Comfortaa', cursive" }}>
                Verify Identity
              </Typography>
              <Typography variant="body2" color="text.secondary" mt={1}>
                We've sent a code to <Typography component="span" fontWeight={700} color="text.primary">{visitorData.identity || "your device"}</Typography>
              </Typography>
            </Box>

            <Stack direction="row" spacing={2} justifyContent="center" sx={{ my: 2 }}>
              {otp.map((digit, i) => (
                <Box
                  key={i}
                  component="input"
                  ref={inputRefs[i]}
                  value={digit}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  maxLength={1}
                  sx={{
                    width: { xs: 45, sm: 55 },
                    height: { xs: 55, sm: 65 },
                    textAlign: "center",
                    fontSize: "1.2rem",
                    fontWeight: 800,
                    borderRadius: 3,
                    border: "2px solid rgba(0,0,0,0.1)",
                    bgcolor: "rgba(0,0,0,0.01)",
                    outline: "none",
                    "&:focus": {
                      borderColor: "primary.main",
                      bgcolor: "#fff",
                      boxShadow: "0 0 0 4px rgba(18,129,153,0.1)",
                    },
                  }}
                />
              ))}
            </Stack>

            <Button
              variant="contained"
              fullWidth
              size="large"
              disabled={loading}
              onClick={handleVerify}
              sx={{ py: 1.8, borderRadius: 4, fontWeight: 700 }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : "Verify and Continue"}
            </Button>

            <Typography variant="caption" color="text.disabled" align="center">
              Didn't receive code? <Button variant="text" size="small" sx={{ fontSize: 11, fontWeight: 700 }}>Resend</Button>
            </Typography>

            <Button
              variant="text"
              fullWidth
              size="small"
              onClick={() => router.back()}
              sx={{ color: "text.disabled", textTransform: "none" }}
            >
              Back to Identity
            </Button>
          </Stack>
        </Paper>
      </motion.div>
    </Box>
  );
}
