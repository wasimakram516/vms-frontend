"use client";

import { useLanguage } from "@/contexts/LanguageContext";

export default function useI18nLayout(translations = {}, forcedLanguage = null) {
  const { lang: globalLang } = useLanguage();

  // Forced language (e.g. from URL) overrides global context
  const language = forcedLanguage || globalLang || "en";

  const isArabic = language === "ar";
  const dir = isArabic ? "rtl" : "ltr";
  const align = isArabic ? "right" : "left";

  const t = translations[language] || translations.en || {};

  return { dir, align, isArabic, language, t };
}
