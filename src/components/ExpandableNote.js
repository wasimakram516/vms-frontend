"use client";

import { useState, useEffect, useRef } from "react";
import { Box, Button, Typography } from "@mui/material";

/**
 * Collapsed-by-default note with a 3-line clamp and a "Show more/less" toggle
 * when the content overflows.
 */
export default function ExpandableNote({ text = "", maxLines = 3 }) {
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const clampRef = useRef(null);

  useEffect(() => {
    const clamp = clampRef.current;
    if (!clamp) return;
    setOverflowing(clamp.scrollHeight > clamp.clientHeight + 1);
  }, [text]);

  if (!text) return null;
  return (
    <Box>
      <Typography
        ref={clampRef}
        component="div"
        variant="body2"
        color="text.primary"
        sx={{
          position: "relative",
          overflow: "hidden",
          overflowWrap: "anywhere",
          wordBreak: "break-word",
          whiteSpace: "pre-wrap",
          display: expanded ? "block" : "-webkit-box",
          WebkitLineClamp: expanded ? "unset" : maxLines,
          WebkitBoxOrient: "vertical",
        }}
      >
        {text}
      </Typography>
      {overflowing && (
        <Button
          size="small"
          onClick={() => setExpanded((p) => !p)}
          sx={{
            mt: 0.25,
            p: 0,
            minWidth: 0,
            fontSize: "0.7rem",
            lineHeight: 1.4,
            textTransform: "none",
            textDecoration: "underline",
            textUnderlineOffset: 2,
            justifyContent: "flex-start",
            "&:hover": { background: "transparent", textDecoration: "underline", textUnderlineOffset: 2 },
          }}
        >
          {expanded ? "Show less" : "Show more"}
        </Button>
      )}
    </Box>
  );
}