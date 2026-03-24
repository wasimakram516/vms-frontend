"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Typography,
  Button,
  Stack,
  Paper,
  IconButton,
} from "@mui/material";
import { useAuth } from "@/contexts/AuthContext";
import { useVisitor } from "@/contexts/VisitorContext";
import { useColorMode } from "@/contexts/ThemeContext";
import ICONS from "@/utils/iconUtil";
import VisitorLayout from "@/components/layout/VisitorLayout";

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { resetVisitorFlow } = useVisitor();
  const { mode } = useColorMode();
  const isDark = mode === "dark";

  const [view, setView] = useState("initial");

  const handleStaffAction = () => {
    if (user) {
      if (user.role === "staff") router.push("/staff/gate/verify");
      else if (["admin", "superadmin"].includes(user.role))
        router.push("/cms/dashboard");
      else router.push("/auth/login");
    } else {
      router.push("/auth/login");
    }
  };

  const cardStyle = {
    p: 3,
    borderRadius: 4,
    border: "2px solid",
    borderColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
    cursor: "pointer",
    transition: "all 0.3s ease",
    bgcolor: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)",
    "&:hover": {
      borderColor: isDark ? "rgba(255,255,255,0.2)" : "primary.main",
      transform: "translateY(-4px)",
      boxShadow: isDark
        ? "0 12px 32px rgba(255,255,255,0.05)"
        : "0 12px 24px rgba(0,0,0,0.1)",
    },
  };

  const iconBoxStyle = {
    p: 1.5,
    borderRadius: 3,
    bgcolor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
    color: "text.primary",
  };

  if (view === "initial") {
    return (
      <VisitorLayout justifyContent="center">
        <Stack spacing={4}>
          <Box textAlign="center">
            <Typography
              variant="h4"
              fontWeight={800}
              sx={{ fontFamily: "'Comfortaa', cursive" }}
            >
              Sinan Portal
            </Typography>
            <Typography color="text.secondary" mt={1}>
              Welcome to Sinan. Please select an option to continue.
            </Typography>
          </Box>

          <Stack spacing={3}>
            {/* Staff Card */}
            <Paper elevation={0} onClick={handleStaffAction} sx={cardStyle}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Box sx={iconBoxStyle}>
                  <ICONS.adminPanel fontSize="large" />
                </Box>
                <Box>
                  <Typography variant="h6" fontWeight={800}>
                    {user && ["admin", "superadmin", "staff"].includes(user.role)
                      ? "Go to Dashboard"
                      : "Login"}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {user && ["admin", "superadmin", "staff"].includes(user.role)
                      ? "Access your dashboard and management tools."
                      : "Staff and Admin secure access."}
                  </Typography>
                </Box>
              </Stack>
            </Paper>

            {/* Visitor Card */}
            <Paper elevation={0} onClick={() => setView("visitor")} sx={cardStyle}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Box sx={iconBoxStyle}>
                  <ICONS.people fontSize="large" />
                </Box>
                <Box>
                  <Typography variant="h6" fontWeight={800}>
                    Visitor
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Register a new visit or sign in as a returning guest.
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Stack>
        </Stack>
      </VisitorLayout>
    );
  }

  return (
    <VisitorLayout justifyContent="center">
      <Stack spacing={4}>
        <Box sx={{ position: "relative" }}>
          <IconButton
            onClick={() => setView("initial")}
            sx={{
              position: "absolute",
              left: -8,
              top: 0,
              bgcolor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
              "&:hover": { 
                bgcolor: "primary.main", 
                color: isDark ? "#000" : "#fff" 
              }
            }}
          >
            <ICONS.back />
          </IconButton>
          <Box textAlign="center">
            <Typography
              variant="h4"
              fontWeight={800}
              sx={{ fontFamily: "'Comfortaa', cursive" }}
            >
              Visitor Portal
            </Typography>
            <Typography color="text.secondary" mt={1}>
              Choose how you would like to proceed
            </Typography>
          </Box>
        </Box>

        <Stack spacing={3}>
          <Paper
            elevation={0}
            onClick={() => {
              resetVisitorFlow();
              router.push("/register/details");
            }}
            sx={cardStyle}
          >
            <Stack direction="row" spacing={2} alignItems="center">
              <Box sx={iconBoxStyle}>
                <ICONS.register fontSize="large" />
              </Box>
              <Box>
                <Typography variant="h6" fontWeight={800}>
                  New Visitor
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  First time visiting? Register now.
                </Typography>
              </Box>
            </Stack>
          </Paper>

          <Paper
            elevation={0}
            onClick={() => {
              resetVisitorFlow();
              router.push("/register/returning");
            }}
            sx={cardStyle}
          >
            <Stack direction="row" spacing={2} alignItems="center">
              <Box sx={iconBoxStyle}>
                <ICONS.replay fontSize="large" />
              </Box>
              <Box>
                <Typography variant="h6" fontWeight={800}>
                  Returning Visitor
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Already have an account? Login quickly.
                </Typography>
              </Box>
            </Stack>
          </Paper>
        </Stack>
      </Stack>
    </VisitorLayout>
  );
}
