"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import en from "@/locales/en";
import ar from "@/locales/ar";

const dicts = { en, ar };

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [lang, setLangState] = useState("en");

  const isRtl = lang === "ar";

  useEffect(() => {
    const saved = localStorage.getItem("sinan-lang");
    if (saved === "en" || saved === "ar") {
      setLangState(saved);
    }
  }, []);

  const setLang = useCallback((newLang) => {
    setLangState(newLang);
    localStorage.setItem("sinan-lang", newLang);
  }, []);

  const t = useCallback(
    (key) => {
      const dict = dicts[lang] || dicts.en;
      return dict[key] ?? dicts.en[key] ?? key;
    },
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, isRtl, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
};
