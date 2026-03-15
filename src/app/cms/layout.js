"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Box } from "@mui/material";
import Sidebar from "@/components/nav/Sidebar";
import { useEffect } from "react";
import LoadingState from "@/components/LoadingState";
import { GlobalStyles } from "@mui/material";

export default function CmsLayout({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();

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
            borderColor: "#128199",
            outline: "none",
            borderWidth: "2px",
            padding: "15.5px 13px",
          },
        },
      }}
    />
  );

  useEffect(() => {
    if (
      (!loading && !user) ||
      (user &&
        user.role !== "admin" &&
        user.role !== "superadmin")
    ) {
      router.replace("/auth/login");
    }
  }, [loading, user, router]);

  const isAuthorized = user && (user.role === "admin" || user.role === "superadmin");

  if (loading || !isAuthorized) {
    return (
      <Box
        sx={{
          minHeight: "calc(100vh - 40px)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <LoadingState />
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      {flatpickrStyles}
      <Sidebar />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 3, md: 4 },
          pt: { xs: "72px", sm: "80px", md: "88px" },
          minWidth: 0,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
