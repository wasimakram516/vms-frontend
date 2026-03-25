"use client";

import { Box, Button, Typography, Stack, Paper } from "@mui/material";
import { useRouter } from "next/navigation";
import { useColorMode } from "@/contexts/ThemeContext";
import RoleGuard from "@/components/auth/RoleGuard";
import ICONS from "@/utils/iconUtil";

export default function KitchenStaffPage() {
  const router = useRouter();
  const { mode } = useColorMode();
  const isDark = mode === "dark";

  return (
    <RoleGuard allowedRoles={["staff"]} allowedStaffTypes={["kitchen"]}>
      <Box
        sx={{
          height: "85vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          px: 2,
          bgcolor: "background.default",
        }}
      >
        <Paper
          elevation={0}
          variant="frosted"
          sx={{
            p: { xs: 1, md: 3 },
            maxWidth: 500,
            width: "100%",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <Box
            sx={{
              mb: 4,
              p: 3,
              borderRadius: "50%",
              bgcolor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
              color: "primary.main",
            }}
          >
            <ICONS.flash sx={{ fontSize: 64 }} />
          </Box>

          <Typography variant="h5" fontWeight={700} gutterBottom>
            Coming Soon
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 5, maxWidth: 350 }}>
            Kitchen staff features are currently under development. We're working
            hard to bring you an amazing experience.
          </Typography>

          <Stack direction="row" spacing={2} sx={{ width: "100%" }}>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<ICONS.back />}
              onClick={() => router.back()}
              sx={{ py: 1.5, borderRadius: 30 }}
            >
              Back
            </Button>
            <Button
              variant="contained"
              fullWidth
              startIcon={<ICONS.home />}
              onClick={() => router.push("/")}
              sx={{ py: 1.5, borderRadius: 30 }}
            >
              Home
            </Button>
          </Stack>
        </Paper>
      </Box>
    </RoleGuard>
  );
}
