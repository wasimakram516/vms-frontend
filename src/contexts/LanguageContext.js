"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  // Always "en" on the server and first client render to avoid a hydration
  // mismatch; the saved language is applied in a mount effect below.
  const [lang, setLangState] = useState("en");

  const isRtl = lang === "ar";

  useEffect(() => {
    const saved = localStorage.getItem("sinan-lang");
    if (saved === "en" || saved === "ar") {
      setLangState(saved);
      // Keep the cookie in sync so server-rendered UI (e.g. route loaders) can
      // read the saved language.
      document.cookie = `sinan-lang=${saved}; path=/; max-age=31536000; SameSite=Lax`;
    }
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
