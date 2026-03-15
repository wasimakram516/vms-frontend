"use client";

import { useGlobalConfig } from "@/contexts/GlobalConfigContext";
import { Box, Divider, Typography } from "@mui/material";
import Image from "next/image";

export default function Footer() {
  const appName = useGlobalConfig()?.globalConfig?.appName;

  return (
    <Box
      component="footer"
      sx={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        bgcolor: "rgba(255, 255, 255, 0.3)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        zIndex: 10,
        py: 1,
        px: 4,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: 1,
      }}
    >
      {/* Logo */}
      <Box
        sx={{
          width: { xs: 35, sm: 40 },
          height: 30,
          display: "flex",
          alignItems: "center",
        }}
      >
        <Image
          src="/WW.png"
          alt="WhiteWall Logo"
          width={100}
          height={30}
          style={{ width: "100%", height: "auto", objectFit: "contain" }}
        />
      </Box>

      {/* Divider + App Name */}
      {appName && (
        <>
          <Divider
            orientation="vertical"
            flexItem
            sx={{ mx: 2, height: 30, bgcolor: "grey.400" }}
          />
          <Typography
            variant="body1"
            sx={{
              whiteSpace: "nowrap",
              fontWeight: 500,
              fontSize: { xs: "0.875rem", sm: "1rem" },
              display: "flex",
              alignItems: "center",
              height: 30,
            }}
          >
            {appName}
          </Typography>
        </>
      )}
    </Box>
  );
}
