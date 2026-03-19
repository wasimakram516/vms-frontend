"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Box } from "@mui/material";
import { useAuth } from "@/contexts/AuthContext";
import LoadingState from "@/components/LoadingState";

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
