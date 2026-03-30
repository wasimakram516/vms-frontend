"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Typography, Stack, Paper } from "@mui/material";
import { useVisitor } from "@/contexts/VisitorContext";
import { useColorMode } from "@/contexts/ThemeContext";
import ICONS from "@/utils/iconUtil";
import LoadingState from "@/components/LoadingState";
import VisitorLayout from "@/components/layout/VisitorLayout";

export default function HomePage() {
  const router = useRouter();
  const { resetVisitorFlow } = useVisitor();
  const { mode } = useColorMode();
  const isDark = mode === "dark";
  const [isNavigating, setIsNavigating] = useState(false);

  const navigateWithLoader = (path) => {
    setIsNavigating(true);
    router.push(path);
  };

  if (isNavigating) return <LoadingState />;

  const cardStyle = {
    p: 3,
    borderRadius: 4,
    border: "1px solid",
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
    cursor: "pointer",
    transition: "all 0.3s ease",
    background: isDark
      ? "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)"
      : "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,249,250,0.96) 100%)",
    boxShadow: isDark
      ? "0 10px 24px rgba(5, 10, 18, 0.24), inset 0 1px 0 rgba(255,255,255,0.06)"
      : "0 8px 22px rgba(15, 23, 42, 0.06)",
    backdropFilter: isDark ? "blur(12px)" : "none",
    "&:hover": {
      borderColor: isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.12)",
      transform: "translateY(-2px)",
      boxShadow: isDark
        ? "0 14px 30px rgba(5, 10, 18, 0.3), inset 0 1px 0 rgba(255,255,255,0.09)"
        : "0 12px 26px rgba(15, 23, 42, 0.1)",
    },
  };

  const iconBoxStyle = {
    p: 1.5,
    borderRadius: 3,
    bgcolor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)",
    boxShadow: isDark ? "inset 0 1px 0 rgba(255,255,255,0.06)" : "none",
    color: "text.primary",
  };

  return (
    <VisitorLayout justifyContent="center">
      <Stack spacing={4}>
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

        <Stack spacing={3}>
          <Paper
            elevation={0}
            onClick={() => {
              resetVisitorFlow();
              navigateWithLoader("/register/details");
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
              navigateWithLoader("/register/returning");
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
