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
  Divider,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { useVisitor } from "@/contexts/VisitorContext";
import { useMessage } from "@/contexts/MessageContext";
import { sendOtp } from "@/services/registrationService";
import { motion } from "framer-motion";
import VisitorLayout from "@/components/layout/VisitorLayout";

import CountryCodeSelector from "@/components/CountryCodeSelector";
import { DEFAULT_ISO_CODE, getCountryCodeByIsoCode, DEFAULT_COUNTRY_CODE } from "@/utils/countryCodes";

const transition = { duration: 0.5, ease: [0.43, 0.13, 0.23, 0.96] };

export default function ReturningVisitorPage() {
  const router = useRouter();
  const { showMessage } = useMessage();
  const { visitorData, setVisitorData, setFlowState } = useVisitor();
  const [loading, setLoading] = useState(false);
  const [isoCode, setIsoCode] = useState(DEFAULT_ISO_CODE);

  const handleNext = async () => {
    if (!visitorData.identity.trim()) {
      showMessage("Please enter your email or phone number.", "error");
      return;
    }

    const val = visitorData.identity.trim();
    let finalIdentity = val;

    const isPhone = /^\d+$/.test(val.replace(/[+\-\s()]/g, ''));
    
    if (isPhone && !val.startsWith("+")) {
        const country = getCountryCodeByIsoCode(isoCode);
        const countryCode = country?.code || DEFAULT_COUNTRY_CODE;
        finalIdentity = `${countryCode}${val}`;
    }

    setLoading(true);
    try {
      await sendOtp(finalIdentity);
      setVisitorData((p) => ({ ...p, identity: finalIdentity }));
      setFlowState((prev) => ({ ...prev, isReturning: true, currentStep: "otp" }));
      router.push("/register/otp");
    } catch (err) {
      showMessage("Failed to send OTP. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  const isPhoneInput = /^\+?\d*$/.test(visitorData.identity.trim());

  return (
    <VisitorLayout justifyContent="center">
      <Stack spacing={3}>
        <Box sx={{ textAlign: "center", mb: 2 }}>
          <Typography variant="h5" fontWeight={800} sx={{ fontFamily: "'Comfortaa', cursive" }}>
            Welcome Back
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={1}>
            Enter your registered identity to get started.
          </Typography>
        </Box>

        <Divider />

        <TextField
          fullWidth
          autoFocus
          label="Email or Phone Number"
          placeholder="e.g. name@example.com / 98765432"
          value={visitorData.identity}
          onChange={(e) => setVisitorData((p) => ({ ...p, identity: e.target.value }))}
          InputProps={{
            startAdornment: isPhoneInput && visitorData.identity.length > 0 ? (
              <CountryCodeSelector
                 value={isoCode}
                 onChange={(iso) => setIsoCode(iso)}
              />
            ) : null,
          }}
          sx={{ "& .MuiOutlinedInput-root": { borderRadius: 4 } }}
          onKeyPress={(e) => e.key === 'Enter' && handleNext()}
        />

        <Button
          variant="contained"
          fullWidth
          size="large"
          disabled={loading}
          onClick={handleNext}
          sx={{ py: 1.8, borderRadius: 30, fontWeight: 700 }}
        >
          {loading ? <CircularProgress size={24} color="inherit" /> : "Send OTP"}
        </Button>

        <Button
          variant="text"
          fullWidth
          onClick={() => router.push("/")}
          sx={{ color: "text.disabled", textTransform: "none" }}
        >
          Cancel and Go Back
        </Button>
      </Stack>
    </VisitorLayout>
  );
}
