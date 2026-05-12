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
    <VisitorLayout
    justifyContent="center"
    mobileSubheading={
      <>
        Sinan Sentry
        <br />
        Visitor Portal
      </>
    }>
      <Stack spacing={4}>
        <Box 
          textAlign="center"
          sx={{ display: { xs: "none", md: "block" } }}
        >
          <Typography
            variant="h4"
            fontWeight={800}
          >
            Visitor Portal
          </Typography>
          <Typography color="text.secondary" mt={1}>
            Choose how you would like to proceed
          </Typography>
        </Box>

        <Stack spacing={{ xs: 2, md: 3 }}>
          <Paper
            elevation={0}
            onClick={() => {
              resetVisitorFlow();
              navigateWithLoader("/register/details");
            }}
            sx={{
              ...cardStyle,
              padding: { xs: 0, md: cardStyle.p },
              py: { xs: 1.5, md: cardStyle.p },
              background: { xs: "transparent", md: cardStyle.background },
              border: "none",
              boxShadow: { xs: "none", md: cardStyle.boxShadow },
              borderRadius: { xs: 0, md: cardStyle.borderRadius },
              backdropFilter: { xs: "none", md: cardStyle.backdropFilter },
              "&:hover": {
                ...cardStyle["&:hover"],
                transform: { xs: "none", md: "-translateY(2px)" },
              }
            }}
          >
            <Stack 
              direction={{ xs: "column", md: "row" }} 
              spacing={{ xs: 1, md: 2 }} 
              alignItems="center"
            >
              <Box sx={{
                ...iconBoxStyle,
                width: { xs: 78, md: "auto" },
                height: { xs: 78, md: "auto" },
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: { xs: "50%", md: iconBoxStyle.borderRadius },
                border: { xs: `2px solid ${isDark ? "rgba(255,255,255,0.72)" : "rgba(0,0,0,0.1)"}`, md: "none" },
                bgcolor: { xs: "transparent", md: iconBoxStyle.bgcolor },
                color: "text.primary",
                "& svg": { fontSize: { xs: 40, md: "2.1875rem" } }
              }}>
                <ICONS.register fontSize="large" />
              </Box>
              <Box textAlign={{ xs: "center", md: "left" }}>
                <Typography 
                  variant="h6" 
                  fontWeight={800} 
                  sx={{ 
                    color: "text.primary",
                    fontSize: { xs: "1.05rem", md: "inherit" }
                  }}
                >
                  New Visitor
                </Typography>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: "text.secondary",
                    fontSize: { xs: "0.92rem", md: "inherit" }
                  }}
                >
                  First time visiting? <Box component="span" sx={{ display: { xs: "block", md: "inline" } }}>Register now.</Box>
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
            sx={{
              ...cardStyle,
              padding: { xs: 0, md: cardStyle.p },
              py: { xs: 1.5, md: cardStyle.p },
              background: { xs: "transparent", md: cardStyle.background },
              border: "none",
              boxShadow: { xs: "none", md: cardStyle.boxShadow },
              borderRadius: { xs: 0, md: cardStyle.borderRadius },
              backdropFilter: { xs: "none", md: cardStyle.backdropFilter },
              "&:hover": {
                ...cardStyle["&:hover"],
                transform: { xs: "none", md: "-translateY(2px)" },
              }
            }}
          >
            <Stack 
              direction={{ xs: "column", md: "row" }} 
              spacing={{ xs: 1, md: 2 }} 
              alignItems="center"
            >
              <Box sx={{
                ...iconBoxStyle,
                width: { xs: 78, md: "auto" },
                height: { xs: 78, md: "auto" },
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: { xs: "50%", md: iconBoxStyle.borderRadius },
                border: { xs: `2px solid ${isDark ? "rgba(255,255,255,0.72)" : "rgba(0,0,0,0.1)"}`, md: "none" },
                bgcolor: { xs: "transparent", md: iconBoxStyle.bgcolor },
                color: "text.primary",
                "& svg": { fontSize: { xs: 40, md: "2.1875rem" } }
              }}>
                <ICONS.replay fontSize="large" />
              </Box>
              <Box textAlign={{ xs: "center", md: "left" }}>
                <Typography 
                  variant="h6" 
                  fontWeight={800} 
                  sx={{ 
                    color: "text.primary",
                    fontSize: { xs: "1.05rem", md: "inherit" }
                  }}
                >
                  Returning Visitor
                </Typography>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: "text.secondary",
                    fontSize: { xs: "0.92rem", md: "inherit" }
                  }}
                >
                  Already have an account? <Box component="span" sx={{ display: { xs: "block", md: "inline" } }}>Login quickly.</Box>
                </Typography>
              </Box>
            </Stack>
          </Paper>
        </Stack>
      </Stack>
    </VisitorLayout>
  );
}
