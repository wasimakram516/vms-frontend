"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  CircularProgress,
  Divider,
  alpha,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { useVisitor } from "@/contexts/VisitorContext";
import { sendOtpSilently } from "@/services/registrationService";
import { useColorMode } from "@/contexts/ThemeContext";
import ICONS from "@/utils/iconUtil";
import VisitorLayout from "@/components/layout/VisitorLayout";
import { validateEmail } from "@/utils/validationUtils";

export default function ReturningVisitorPage() {
  const router = useRouter();
  const { visitorData, setVisitorData, setFlowState } = useVisitor();
  const { mode } = useColorMode();
  const isDark = mode === "dark";
  const [loading, setLoading] = useState(false);
  const [method, setMethod] = useState("email");
  const [email, setEmail] = useState(visitorData.identity?.includes("@") ? visitorData.identity : "");
  const [emailError, setEmailError] = useState("");
  const [otpRequestError, setOtpRequestError] = useState("");

  const validateEmailField = (value) => {
    const error = validateEmail(value, "Email");
    return error || "";
  };

  const handleNext = async () => {
    const validationError = validateEmailField(email);
    if (validationError) {
      setEmailError(validationError);
      return;
    }

    const finalIdentity = email.trim().toLowerCase();

    setLoading(true);
    setOtpRequestError("");
    try {
      const res = await sendOtpSilently(finalIdentity);
      if (!res.error) {
        setVisitorData((p) => ({ ...p, identity: finalIdentity, email: finalIdentity }));
        setFlowState((prev) => ({ ...prev, isReturning: true, currentStep: "otp" }));
        router.push("/register/otp");
      } else {
        setOtpRequestError(res.message || "Unable to send OTP. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <VisitorLayout justifyContent="center" mobileSubheading="Welcome Back">
      <Stack spacing={3}>
        <Box sx={{ textAlign: "center", mb: 2, display: { xs: "none", md: "block" } }}>
          <Typography variant="h5" fontWeight={800} sx={{ fontFamily: "'Comfortaa', cursive" }}>
            Welcome Back
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={1}>
            Sign in with your registered email. Phone OTP will be added later.
          </Typography>
        </Box>

        <Divider />

        <Tabs
          value={method}
          onChange={(_, value) => setMethod(value)}
          variant="fullWidth"
          sx={{
            minHeight: 46,
            bgcolor: (theme) => alpha(theme.palette.text.primary, isDark ? 0.06 : 0.04),
            borderRadius: 999,
            p: 0.5,
            "& .MuiTabs-indicator": { display: "none" },
          }}
        >
          <Tab
            value="email"
            icon={<ICONS.email fontSize="small" />}
            iconPosition="start"
            label="Email"
            sx={{
              minHeight: 38,
              borderRadius: 999,
              fontWeight: 800,
              textTransform: "none",
              "&.Mui-selected": {
                bgcolor: "background.paper",
                color: "text.primary",
                boxShadow: "0 6px 14px rgba(0,0,0,0.08)",
              },
            }}
          />
          <Tab
            value="phone"
            icon={<ICONS.phone fontSize="small" />}
            iconPosition="start"
            label="Phone"
            sx={{
              minHeight: 38,
              borderRadius: 999,
              fontWeight: 800,
              textTransform: "none",
              "&.Mui-selected": {
                bgcolor: "background.paper",
                color: "text.primary",
                boxShadow: "0 6px 14px rgba(0,0,0,0.08)",
              },
            }}
          />
        </Tabs>

        {method === "email" ? (
          <Stack spacing={2.5}>
            {otpRequestError && (
              <Alert severity="error" sx={{ borderRadius: 2 }}>
                {otpRequestError}
              </Alert>
            )}
            <TextField
              fullWidth
              autoFocus
              label="Email Address"
              type="email"
              placeholder="name@example.com"
              value={email}
              error={Boolean(emailError)}
              helperText={emailError}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) {
                  setEmailError("");
                }
              }}
              onBlur={() => setEmailError(validateEmailField(email))}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 4 } }}
              onKeyDown={(e) => e.key === "Enter" && handleNext()}
            />

            <Button
              variant="contained"
              fullWidth
              size="large"
              disabled={loading}
              onClick={handleNext}
              startIcon={loading ? <CircularProgress size={24} color="inherit" /> : <ICONS.email />}
              sx={{ py: 1.8, borderRadius: 30, fontWeight: 700 }}
            >
              {loading ? "Sending OTP..." : "Send OTP"}
            </Button>
          </Stack>
        ) : (
          <Box
            sx={{
              p: 3,
              borderRadius: 4,
              textAlign: "center",
              bgcolor: (theme) => alpha(theme.palette.text.primary, isDark ? 0.05 : 0.03),
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Box
              sx={{
                width: 64,
                height: 64,
                mx: "auto",
                mb: 2,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                bgcolor: (theme) => alpha(theme.palette.warning.main, 0.14),
                color: "warning.main",
              }}
            >
              <ICONS.phone fontSize="medium" />
            </Box>
            <Typography variant="h6" fontWeight={800} sx={{ mb: 1 }}>
              Phone OTP Coming Soon
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 320, mx: "auto" }}>
              Returning visitor sign-in by phone will be added in a later update. Please use your email for now.
            </Typography>
          </Box>
        )}

        <Button
          variant="text"
          fullWidth
          startIcon={<ICONS.back />}
          onClick={() => router.push("/")}
          sx={{ color: "text.disabled", textTransform: "none" }}
        >
          Back
        </Button>
      </Stack>
    </VisitorLayout>
  );
}
