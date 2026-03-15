"use client";

import { Box } from "@mui/material";
import { Shift } from "ambient-cbg";

export default function Background({ type = "static" }) {
  if (type === "dynamic") {
    return (
       <Shift />
    );
  }

  return (
    <Box
      aria-hidden
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: -1,
        pointerEvents: "none",
        background: `
          radial-gradient(800px 600px at 8% 12%, rgba(18,129,153,0.22) 0%, transparent 60%),
          radial-gradient(720px 540px at 92% 16%, rgba(0,119,182,0.18) 0%, transparent 60%),
          radial-gradient(700px 520px at 18% 86%, rgba(3,54,73,0.12) 0%, transparent 60%),
          radial-gradient(680px 520px at 84% 84%, rgba(18,129,153,0.16) 0%, transparent 60%),
          linear-gradient(180deg, #f0f7fa 0%, #ffffff 100%)
        `,
        filter: "saturate(1.05)",
      }}
    />
  );
}
