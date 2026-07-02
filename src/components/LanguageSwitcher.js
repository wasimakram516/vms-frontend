"use client";

import { Box, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useLanguage } from "@/contexts/LanguageContext";

export default function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();

  return (
    <Box
      sx={{
        display: "inline-flex",
        borderRadius: 999,
        bgcolor: (theme) => alpha(theme.palette.text.primary, 0.08),
        p: 0.4,
        backdropFilter: "blur(8px)",
      }}
    >
      {[
        { code: "en", label: "EN" },
        { code: "ar", label: "عر" },
      ].map(({ code, label }) => (
        <Box
          key={code}
          onClick={() => setLang(code)}
          sx={{
            px: 1.5,
            py: 0.5,
            borderRadius: 999,
            cursor: "pointer",
            bgcolor: lang === code ? "background.paper" : "transparent",
            boxShadow: lang === code ? "0 2px 8px rgba(0,0,0,0.12)" : "none",
            transition: "all 0.2s ease",
            "&:hover": {
              bgcolor: (theme) =>
                lang === code
                  ? "background.paper"
                  : alpha(theme.palette.text.primary, 0.06),
            },
          }}
        >
          <Typography
            variant="caption"
            sx={{
              fontWeight: lang === code ? 800 : 500,
              color: "text.primary",
              fontSize: "0.7rem",
              lineHeight: 1,
              fontFamily: code === "ar" ? "'Noto Sans Arabic', sans-serif" : "inherit",
            }}
          >
            {label}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
