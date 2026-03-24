"use client";

import { Box } from "@mui/material";
import Sidebar from "@/components/nav/Sidebar";
import { GlobalStyles } from "@mui/material";

import RoleGuard from "@/components/auth/RoleGuard";

export default function CmsLayout({ children }) {
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
    <RoleGuard allowedRoles={["admin", "superadmin"]}>
      <Box sx={{ display: "flex", height: "calc(100vh - 64px)" }}>
        {flatpickrStyles}
        <Sidebar />
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
          {children}
        </Box>
      </Box>
    </RoleGuard>
  );
}
