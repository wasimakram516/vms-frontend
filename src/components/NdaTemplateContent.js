"use client";

import { Box, Stack, Typography } from "@mui/material";

const richTextSx = {
  fontSize: 14,
  lineHeight: 1.8,
  color: "text.primary",
  wordBreak: "break-word",
  "& > :first-of-type": {
    marginTop: 0,
  },
  "& > :last-child": {
    marginBottom: 0,
  },
  "& p": {
    my: 1.25,
    lineHeight: 1.8,
  },
  "& ul, & ol": {
    my: 1.5,
    pl: 3,
  },
  "& li": {
    my: 0.75,
  },
  "& h1": {
    mt: 0,
    mb: 1.5,
    fontSize: "1.5rem",
    fontWeight: 800,
    lineHeight: 1.3,
  },
  "& h2": {
    mt: 0,
    mb: 1.25,
    fontSize: "1.25rem",
    fontWeight: 800,
    lineHeight: 1.35,
  },
  "& h3": {
    mt: 0,
    mb: 1,
    fontSize: "1.05rem",
    fontWeight: 700,
    lineHeight: 1.4,
  },
  "& blockquote": {
    my: 1.5,
    pl: 2,
    borderLeft: "3px solid",
    borderColor: "divider",
    color: "text.secondary",
  },
  "& strong, & b": {
    fontWeight: 700,
  },
  "& em, & i": {
    fontStyle: "italic",
  },
  "& a": {
    color: "primary.main",
  },
};

function HtmlBlock({ html }) {
  if (!html?.trim()) return null;

  return <Box sx={richTextSx} dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function NdaTemplateContent({ template }) {
  if (!template) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
        No active NDA template is available right now.
      </Typography>
    );
  }

  const { preamble, body } = template;

  return (
    <Stack spacing={2.5}>
      {preamble ? (
        <Box
          sx={{
            px: 2,
            py: 1.75,
            borderRadius: 3,
            border: "1px solid",
            borderColor: "divider",
            bgcolor: (theme) =>
              theme.palette.mode === "dark"
                ? "rgba(255,255,255,0.04)"
                : "rgba(18,25,34,0.04)",
          }}
        >
          <HtmlBlock html={preamble} />
        </Box>
      ) : null}

      <HtmlBlock html={body} />
    </Stack>
  );
}
