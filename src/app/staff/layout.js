"use client";

import { Box } from "@mui/material";
import { usePathname } from "next/navigation";

import RoleGuard from "@/components/auth/RoleGuard";

export default function StaffLayout({ children }) {
  const pathname = usePathname();
  const isStaffEntryPage = pathname === "/staff";

  if (isStaffEntryPage) {
    return children;
  }

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
