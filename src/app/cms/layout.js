"use client";

import { useEffect } from "react";
import { Box } from "@mui/material";
import Sidebar from "@/components/nav/Sidebar";
import { GlobalStyles } from "@mui/material";

import RoleGuard from "@/components/auth/RoleGuard";
import BreadcrumbsNav from "@/components/nav/BreadcrumbsNav";
import { useAuth } from "@/contexts/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import ICONS from "@/utils/iconUtil";
import { canAccessResource } from "@/utils/permissions";

export default function CmsLayout({ children }) {
  useEffect(() => { document.documentElement.dir = "ltr"; }, []);
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isDev = user?.role === "dev";

  // Access Control Logic
  const effectiveAdminType = user?.role === "admin" ? (user?.adminType || "departmental") : user?.adminType;
  const isKitchenAdmin = user?.role === "admin" && effectiveAdminType === "kitchen";
  const isDepartmentalAdmin = user?.role === "admin" && effectiveAdminType === "departmental";
  
  const isOnKitchenPage = pathname.startsWith("/cms/kitchen");
  const isOnKitchenSettingsPage = pathname.startsWith("/cms/settings/kitchen-menu");
  const isOnSettingsIndex = pathname === "/cms/settings";
  const isOnDashboard = pathname === "/cms" || pathname === "/cms/dashboard";

  // Kitchen Admin permission check
  const hasKitchenAccess = canAccessResource(user, "kitchen");
  const hasKitchenMenuAccess = canAccessResource(user, "kitchen-menu");
  const kitchenAdminNoPermissions = isKitchenAdmin && !hasKitchenAccess && !hasKitchenMenuAccess;

  // Redirect kitchen admin from dashboard/root to the page they have access to
  useEffect(() => {
    if (isKitchenAdmin && isOnDashboard) {
      if (hasKitchenAccess) {
        router.replace("/cms/kitchen");
      } else if (hasKitchenMenuAccess) {
        router.replace("/cms/settings/kitchen-menu");
      }
    }
  }, [isKitchenAdmin, isOnDashboard, hasKitchenAccess, hasKitchenMenuAccess, router]);

  // Kitchen Admin: if no permissions at all, deny everything; otherwise only kitchen/kitchen-menu/settings
  const kitchenAdminDenied = kitchenAdminNoPermissions ||
    (isKitchenAdmin && !isOnKitchenPage && !isOnKitchenSettingsPage && !isOnSettingsIndex && !isOnDashboard);
  // Departmental Admin is blocked from kitchen pages UNLESS dynamic permission grants access
  const departmentalAdminDenied = isDepartmentalAdmin && (
    (isOnKitchenPage && !canAccessResource(user, "kitchen", { hardcodeAllowed: false })) ||
    (isOnKitchenSettingsPage && !canAccessResource(user, "kitchen-menu", { hardcodeAllowed: false }))
  );

  const accessDenied = kitchenAdminDenied || departmentalAdminDenied;
  const flatpickrStyles = (
    <GlobalStyles
      styles={{
        ".flatpickr-input": {
          width: "100%",
          padding: "16.5px 14px",
          border: "1px solid rgba(0,0,0,0.23)",
          borderRadius: "12px",
          fontSize: "1rem",
          fontFamily: "inherit",
          backgroundColor: "#fff",
          "&:hover": {
            borderColor: "rgba(0,0,0,0.87)",
          },
          "&:focus": {
            borderColor: "primary.main",
            outline: "none",
            borderWidth: "2px",
            padding: "15.5px 13px",
          },
        },
      }}
    />
  );

  return (
    <RoleGuard allowedRoles={["admin", "superadmin", "dev"]}>
      <Box sx={{ display: "flex", height: "calc(100vh - 64px)" }}>
          {flatpickrStyles}
          {!isDev && <Sidebar />}
          <Box
            component="main"
            sx={{
              flexGrow: 1,
              height: "100%",
              overflowY: "auto",
              p: { xs: 2, sm: 3, md: 4 },
              pt: { xs: "8px", sm: "16px", md: "24px" },
              minWidth: 0,
            }}
          >
            <BreadcrumbsNav />
            {accessDenied ? (
              <Stack alignItems="center" justifyContent="center" sx={{ height: "60vh", opacity: 0.6 }}>
                <ICONS.lock sx={{ fontSize: 64, mb: 2 }} />
                <Typography variant="h5" fontWeight="bold">Access Denied</Typography>
                <Typography variant="body2">You do not have permission to view this page.</Typography>
              </Stack>
            ) : (
              children
            )}
          </Box>
        </Box>
    </RoleGuard>
  );
}
