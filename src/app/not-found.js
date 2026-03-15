"use client";

import { Box, Button, Container, Typography, Stack } from "@mui/material";
import { useRouter } from "next/navigation";
import Background from "@/components/Background";

export default function NotFoundPage() {
  const router = useRouter();

  const handleGoHome = () => router.push("/");

  return (
    <Container
      maxWidth="sm"
      sx={{
        height: "calc(100vh - 50px)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
      }}
    >
      {/* Background */}
      <Background/>

      {/* Logo + Code */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h1"
          fontWeight="bold"
          sx={{ fontSize: "5rem", color: "primary.main" }}
        >
          404
        </Typography>
      </Box>

      {/* Heading + Message */}
      <Typography variant="h5" fontWeight="bold" gutterBottom>
        Page Not Found
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Sorry, the page you&apos;re looking for doesn&apos;t exist or may have
        been moved.
      </Typography>

      {/* Actions */}
      <Stack direction="row" spacing={2}>
        <Button
          variant="contained"
          size="large"
          onClick={handleGoHome}
          sx={{
            textTransform: "none",
            px: 4,
            py: 1.5,
            fontWeight: 500,
          }}
        >
          Go to Home
        </Button>
        <Button
          variant="outlined"
          size="large"
          onClick={() => router.back()}
          sx={{
            textTransform: "none",
            px: 4,
            py: 1.5,
            fontWeight: 500,
          }}
        >
          Go Back
        </Button>
      </Stack>

      {/* Footer Note */}
      <Typography variant="caption" color="text.secondary" sx={{ mt: 6 }}>
        Powered by{" "}
        <a
          href="https://whitewall.om"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "inherit", fontWeight: 500, textDecoration: "none" }}
        >
          Sinan VMS
        </a>
      </Typography>
    </Container>
  );
}
