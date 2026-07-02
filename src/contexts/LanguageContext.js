"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useState } from "react";

const LanguageContext = createContext();

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export const LanguageProvider = ({ children }) => {
  const [lang, setLangState] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sinan-lang");
      if (saved === "en" || saved === "ar") return saved;
    }
    return "en";
  });

  const isRtl = lang === "ar";

  useIsomorphicLayoutEffect(() => {
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const setLang = useCallback((newLang) => {
    setLangState(newLang);
    localStorage.setItem("sinan-lang", newLang);
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
