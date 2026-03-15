"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  CircularProgress,
  Typography,
  Button,
  GlobalStyles,
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

  useEffect(() => {
    if (!loading && user) {
      if (user.role === "staff") {
        router.replace("/staff/gate/verify");
      } else if (user.role === "admin" || user.role === "superadmin") {
        router.replace("/cms/dashboard");
      }
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <Box
        sx={{
          height: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      {fontStyles}
      <Box
        sx={{
          height: "100vh",
          display: "flex",
          overflow: "hidden",
        }}
      >
        {/* Left — primary panel */}
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
            "&::before": {
              content: '""',
              position: "absolute",
              top: -80,
              right: -80,
              width: 280,
              height: 280,
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "50%",
            },
            "&::after": {
              content: '""',
              position: "absolute",
              bottom: -60,
              left: -60,
              width: 200,
              height: 200,
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "50%",
            },
          }}
        >
          {/* Headline */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={transition}
            style={{ position: "relative", zIndex: 1 }}
          >
            <Typography
              sx={{
                fontFamily: "'Comfortaa', cursive",
                fontSize: "2.8rem",
                fontWeight: 800,
                lineHeight: 1.1,
                color: "#fff",
                mb: 2,
              }}
            >
              Sinan VMS
            </Typography>
            <Typography
              sx={{
                fontSize: 13,
                color: "rgba(255,255,255,0.8)",
                lineHeight: 1.7,
                maxWidth: 240,
                fontWeight: 500
              }}
            >
              Visitor management made simple.
            </Typography>
          </motion.div>
        </Box>

        {/* Right — action panel */}
        <Box
          sx={{
            flex: 1,
            bgcolor: "background.paper",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            px: { xs: 4, md: 8 },
            py: 4,
          }}
        >
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={transition}
          >
            <Typography
              sx={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "primary.main",
                mb: 2,
              }}
            >
              Welcome
            </Typography>

            <Typography
              sx={{
                fontFamily: "'Comfortaa', cursive",
                fontSize: { xs: "1.6rem", md: "2.2rem" },
                fontWeight: 800,
                color: "text.primary",
                lineHeight: 1.2,
                mb: 1.5,
              }}
            >
              Visitor Portal
            </Typography>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mb: 4, maxWidth: 300, lineHeight: 1.6, fontWeight: 500 }}
            >
              Choose an option below to get started with your visit or manage registrations.
            </Typography>

            {/* Action cards */}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.2, maxWidth: 340 }}>
              <Button
                variant="contained"
                size="large"
                onClick={() => router.push("/register")}
                sx={{
                  py: 1.8,
                  px: 2.5,
                  borderRadius: 2,
                  boxShadow: "0 4px 12px rgba(18,129,153,0.15)",
                  textTransform: "none",
                  justifyContent: "space-between",
                  "&:hover": { boxShadow: "0 6px 20px rgba(18,129,153,0.25)" }
                }}
                endIcon={<ICONS.appRegister sx={{ opacity: 0.5 }} />}
              >
                <Box sx={{ textAlign: "left" }}>
                  <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: "#fff" }}>
                    Visitor Registration
                  </Typography>
                  <Typography sx={{ fontSize: 10, color: "rgba(255,255,255,0.7)", fontWeight: 400 }}>
                    Create new visit request
                  </Typography>
                </Box>
              </Button>

              <Button
                variant="outlined"
                size="large"
                onClick={() => router.push("/auth/login")}
                sx={{
                  py: 1.8,
                  px: 2.5,
                  borderRadius: 2,
                  borderColor: "rgba(0,0,0,0.1)",
                  borderWidth: "1.5px",
                  color: "text.primary",
                  "&:hover": { borderColor: "primary.main", borderWidth: "1.5px", bgcolor: "rgba(18,129,153,0.04)" },
                  textTransform: "none",
                  justifyContent: "space-between",
                }}
                endIcon={<ICONS.login sx={{ opacity: 0.5 }} />}
              >
                <Box sx={{ textAlign: "left" }}>
                  <Typography sx={{ fontSize: "0.95rem", fontWeight: 700 }}>
                    Staff Portal
                  </Typography>
                  <Typography sx={{ fontSize: 10, color: "text.disabled", fontWeight: 400 }}>
                    Manage access & approvals
                  </Typography>
                </Box>
              </Button>
            </Box>
          </motion.div>
        </Box>
      </Box>
    </>
  );
}