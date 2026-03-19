"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  CircularProgress,
  Typography,
  Button,
  GlobalStyles,
  Stack,
  Paper,
} from "@mui/material";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import ICONS from "@/utils/iconUtil";

const fontStyles = (
  <GlobalStyles
    styles={`
      @import url('https://fonts.googleapis.com/css2?family=Comfortaa:wght@300;400;500;600;700&display=swap');
    `}
  />
);

const transition = { duration: 0.6, ease: [0.43, 0.13, 0.23, 0.96] };

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();



  return (
    <>
      {fontStyles}
      <Box
        sx={{
          height: "91vh",
          display: "flex",
          overflow: "hidden",
        }}
      >
        {/* Left — Brand Panel */}
        <Box
          sx={{
            flex: "0 0 45%",
            background: "linear-gradient(135deg, #128199 0%, #0077b6 100%)",
            display: { xs: "none", md: "flex" },
            flexDirection: "column",
            justifyContent: "center",
            p: 6,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={transition}
          >
            <Typography
              sx={{
                fontFamily: "'Comfortaa', cursive",
                fontSize: "3.5rem",
                fontWeight: 800,
                color: "#fff",
                mb: 2,
              }}
            >
              Sinan VMS
            </Typography>
            <Typography sx={{ color: "rgba(255,255,255,0.7)", maxWidth: 320, lineHeight: 1.6 }}>
              Experience a seamless visitor journey at Sinan. Please select your visit type to proceed.
            </Typography>
          </motion.div>
        </Box>

        {/* Right — Selection Panel */}
        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            px: 4,
            bgcolor: "background.default",
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={transition}
            style={{ width: "100%", maxWidth: 450 }}
          >
            <Typography
              variant="h4"
              fontWeight={800}
              sx={{ mb: 1, textAlign: "center", fontFamily: "'Comfortaa', cursive" }}
            >
              Visitor Portal
            </Typography>
            <Typography color="text.secondary" align="center" sx={{ mb: 5 }}>
              Choose how you would like to proceed
            </Typography>

            <Stack spacing={3}>
              {/* New Visitor Card */}
              <Paper
                elevation={0}
                onClick={() => router.push("/register/details")}
                sx={{
                  p: 3,
                  borderRadius: 4,
                  border: "2px solid rgba(0,0,0,0.05)",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  "&:hover": {
                    borderColor: "primary.main",
                    transform: "translateY(-4px)",
                    boxShadow: "0 12px 24px rgba(18,129,153,0.1)",
                  },
                }}
              >
                <Stack direction="row" spacing={2} alignItems="center">
                  <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: "primary.light", color: "primary.main" }}>
                    <ICONS.register fontSize="large" />
                  </Box>
                  <Box>
                    <Typography variant="h6" fontWeight={800}>New Visitor</Typography>
                    <Typography variant="body2" color="text.secondary">First time visiting? Register now.</Typography>
                  </Box>
                </Stack>
              </Paper>

              {/* Returning Visitor Card */}
              <Paper
                elevation={0}
                onClick={() => router.push("/visitor/login")}
                sx={{
                  p: 3,
                  borderRadius: 4,
                  border: "2px solid rgba(0,0,0,0.05)",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  "&:hover": {
                    borderColor: "primary.main",
                    transform: "translateY(-4px)",
                    boxShadow: "0 12px 24px rgba(18,129,153,0.1)",
                  },
                }}
              >
                <Stack direction="row" spacing={2} alignItems="center">
                  <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: "success.light", color: "success.main" }}>
                    <ICONS.replay fontSize="large" />
                  </Box>
                  <Box>
                    <Typography variant="h6" fontWeight={800}>Returning Visitor</Typography>
                    <Typography variant="body2" color="text.secondary">Already have an account? Login quickly.</Typography>
                  </Box>
                </Stack>
              </Paper>
            </Stack>

            <Box sx={{ mt: 8, textAlign: "center" }}>
              <Button
                variant="text"
                size="small"
                onClick={() => {
                  if (user) {
                    if (user.role === "staff") router.push("/staff/gate/verify");
                    else if (["admin", "superadmin"].includes(user.role)) router.push("/cms/dashboard");
                    else router.push("/auth/login");
                  } else {
                    router.push("/auth/login");
                  }
                }}
                sx={{ color: "text.disabled", "&:hover": { color: "primary.main" } }}
              >
                {user ? (["admin", "superadmin", "staff"].includes(user.role) ? "Go to Dashboard" : "Staff Login") : "Staff Login"}
              </Button>
            </Box>
          </motion.div>
        </Box>
      </Box>
    </>
  );
}