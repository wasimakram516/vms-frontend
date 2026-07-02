"use client";

import { useEffect } from "react";
import { Box } from "@mui/material";
import { usePathname } from "next/navigation";
import RoleGuard from "@/components/auth/RoleGuard";
import { useLanguage } from "@/contexts/LanguageContext";

// Pages that need full-width (no max-width container)
const FULL_WIDTH_PATHS = ["/staff/kitchen/orders", "/staff/gate/verify"];

export default function StaffLayout({ children }) {
  const pathname = usePathname();
  const { lang } = useLanguage();
  // Gate staff pages follow the selected language direction; other staff areas stay LTR
  const isGateArea = pathname?.startsWith("/staff/gate");
  useEffect(() => {
    document.documentElement.dir = isGateArea && lang === "ar" ? "rtl" : "ltr";
  }, [isGateArea, lang]);
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
