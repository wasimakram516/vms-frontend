"use client";

import { Box } from "@mui/material";
import { usePathname } from "next/navigation";
import RoleGuard from "@/components/auth/RoleGuard";

// Pages that need full-width (no max-width container)
const FULL_WIDTH_PATHS = ["/staff/kitchen/orders"];

export default function StaffLayout({ children }) {
  const pathname = usePathname();
  const isStaffEntryPage = pathname === "/staff";
  const isFullWidth = FULL_WIDTH_PATHS.some((p) => pathname.startsWith(p));

  if (isStaffEntryPage) {
    return children;
  }

  if (isFullWidth) {
    return (
      <RoleGuard allowedRoles={["staff"]}>
        {children}
      </RoleGuard>
    );
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
