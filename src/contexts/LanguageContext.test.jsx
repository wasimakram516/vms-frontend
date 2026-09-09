import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";

function LangConsumer() {
  const { lang, setLang } = useLanguage();
  return (
    <button
      type="button"
      onClick={() => setLang(lang === "ar" ? "en" : "ar")}
    >
      {lang}
    </button>
  );
}

describe("LanguageProvider — declared document language", () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = "sinan-lang=; Max-Age=-99999999; path=/";
    document.documentElement.removeAttribute("lang");
    document.documentElement.removeAttribute("dir");
  });

  it("declares the initial language on <html>", () => {
    render(
      <LanguageProvider initialLang="ar">
        <LangConsumer />
      </LanguageProvider>,
    );

    expect(document.documentElement.getAttribute("lang")).toBe("ar");
    expect(document.documentElement.dir).toBe("rtl");
  });

  it("updates <html lang> and <html dir> whenever the in-app language switches, and persists the choice", () => {
    render(
      <LanguageProvider initialLang="en">
        <LangConsumer />
      </LanguageProvider>,
    );
    expect(document.documentElement.getAttribute("lang")).toBe("en");
    expect(document.documentElement.dir).toBe("ltr");

    fireEvent.click(screen.getByRole("button"));
    expect(document.documentElement.getAttribute("lang")).toBe("ar");
    expect(document.documentElement.dir).toBe("rtl");

    fireEvent.click(screen.getByRole("button"));
    expect(document.documentElement.getAttribute("lang")).toBe("en");
    expect(document.documentElement.dir).toBe("ltr");

    expect(localStorage.getItem("sinan-lang")).toBe("en");
    expect(document.cookie).toContain("sinan-lang=en");
  });

  it("honors a legacy localStorage language on mount and mirrors it into the cookie", () => {
    localStorage.setItem("sinan-lang", "ar");

    render(
      <LanguageProvider initialLang="en">
        <LangConsumer />
      </LanguageProvider>,
    );

    expect(document.documentElement.getAttribute("lang")).toBe("ar");
    expect(document.documentElement.dir).toBe("rtl");
    expect(document.cookie).toContain("sinan-lang=ar");
  });
});