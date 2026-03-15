"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Box } from "@mui/material";
import { useAuth } from "@/contexts/AuthContext";
import LoadingState from "@/components/LoadingState";

export default function StaffLayout({ children }) {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if ((!loading && !user) || (user && user.role !== "staff")) {
      router.replace("/auth/login");
    }
  }, [loading, user, router]);

  const isAuthorized = user && user.role === "staff";

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
  );
}
