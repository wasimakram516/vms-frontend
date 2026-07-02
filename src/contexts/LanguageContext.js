"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

const LanguageContext = createContext();

export const LanguageProvider = ({ children, initialLang = "en" }) => {
  // Seeded from the sinan-lang cookie by the server layout so SSR (including
  // route loaders) renders in the saved language and hydration matches.
  const [lang, setLangState] = useState(initialLang);

  const isRtl = lang === "ar";

  useEffect(() => {
    // Legacy fallback: honor localStorage for users who set a language before
    // the cookie existed, and mirror it into the cookie for future SSR.
    const saved = localStorage.getItem("sinan-lang");
    if (saved === "en" || saved === "ar") {
      if (saved !== lang) setLangState(saved);
      document.cookie = `sinan-lang=${saved}; path=/; max-age=31536000; SameSite=Lax`;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const setLang = useCallback((newLang) => {
    setLangState(newLang);
    localStorage.setItem("sinan-lang", newLang);
    document.cookie = `sinan-lang=${newLang}; path=/; max-age=31536000; SameSite=Lax`;
  }, []);

  return (
    <LanguageContext.Provider value={{ lang, setLang, isRtl }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
};
