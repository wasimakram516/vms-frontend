"use client";

import {
  Box,
  Button,
  Container,
  Typography,
  Stack,
} from "@mui/material";
import ConstructionRoundedIcon from "@mui/icons-material/ConstructionRounded";
import { useRouter } from "next/navigation";

export default function ComingSoon() {
  const router = useRouter();

  return (
    <Container
      maxWidth="sm"
      sx={{
        height: "calc(100vh - 90px)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
      }}
    >
      {/* Icon */}
      <Box sx={{ mb: 3 }}>
        <ConstructionRoundedIcon
          sx={{ fontSize: "5rem", color: "primary.main" }}
        />
      </Box>

      {/* Heading + Message */}
      <Typography variant="h5" fontWeight="bold" gutterBottom>
        Coming Soon
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        This feature is under development. Please check back later.
      </Typography>

      {/* Actions */}
      <Stack direction="row" spacing={2}>
        <Button
          variant="contained"
          size="large"
          onClick={() => router.push("/cms")}
          sx={{ textTransform: "none", px: 4, py: 1.5, fontWeight: 500 }}
        >
          Go to Dashboard
        </Button>
        <Button
          variant="outlined"
          size="large"
          onClick={() => router.back()}
          sx={{ textTransform: "none", px: 4, py: 1.5, fontWeight: 500 }}
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
          WhiteWall Digital Solutions
        </a>
      </Typography>
    </Container>
  );
}
