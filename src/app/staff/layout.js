"use client";

import { Box } from "@mui/material";

import RoleGuard from "@/components/auth/RoleGuard";

export default function StaffLayout({ children }) {
  return (
    <RoleGuard allowedRoles={["staff"]}>
      <Box
        sx={{
          maxWidth: 1200,
          mx: "auto",
          px: { xs: 2, md: 3 },
          py: 3,
        }}
      >
        {children}
      </Box>
    </RoleGuard>
  );
}
