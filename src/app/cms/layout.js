"use client";

import { Box } from "@mui/material";
import Sidebar from "@/components/nav/Sidebar";
import { GlobalStyles } from "@mui/material";

import RoleGuard from "@/components/auth/RoleGuard";
import BreadcrumbsNav from "@/components/nav/BreadcrumbsNav";
import { useAuth } from "@/contexts/AuthContext";
import { usePathname } from "next/navigation";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import ICONS from "@/utils/iconUtil";

export default function CmsLayout({ children }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const isDev = user?.role === "dev";

  // Access Control Logic
  const effectiveAdminType = user?.role === "admin" ? (user?.adminType || "departmental") : user?.adminType;
  const isKitchenAdmin = user?.role === "admin" && effectiveAdminType === "kitchen";
  const isDepartmentalAdmin = user?.role === "admin" && effectiveAdminType === "departmental";
  
  const isOnKitchenPage = pathname.startsWith("/cms/kitchen");
  const isOnKitchenSettingsPage = pathname.startsWith("/cms/settings/kitchen-menu");
  
  // Kitchen Admin can ONLY see Kitchen page and Kitchen Menu Settings
  const kitchenAdminDenied = isKitchenAdmin && !isOnKitchenPage && !isOnKitchenSettingsPage && pathname !== "/cms";
  // Departmental Admin can see everything EXCEPT Kitchen page and Kitchen Menu settings
  const departmentalAdminDenied = isDepartmentalAdmin && (isOnKitchenPage || isOnKitchenSettingsPage);

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
