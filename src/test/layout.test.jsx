import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";

vi.mock("next/headers", () => ({
  cookies: vi.fn(() =>
    Promise.resolve({
      get: (name) => {
        const match = document.cookie
          .split("; ")
          .find((c) => c.startsWith(`${name}=`));
        return match ? { value: match.slice(name.length + 1) } : undefined;
      },
    }),
  ),
}));

vi.mock("next/font/google", () => ({
  Comfortaa: () => ({ variable: "--font-latin" }),
  Noto_Kufi_Arabic: () => ({ variable: "--font-arabic" }),
}));

vi.mock("@/components/nav/Navbar", () => ({
  __esModule: true,
  default: () => <nav data-testid="navbar" />,
}));

vi.mock("@/app/ClientRoot", () => ({
  __esModule: true,
  default: ({ children }) => <div data-testid="client-root">{children}</div>,
}));

vi.mock("@mui/material", () => ({
  Box: ({ children, component, ...rest }) => {
    const Tag = component || "div";
    return <Tag {...rest}>{children}</Tag>;
  },
}));

import RootLayout from "@/app/layout.js";

async function renderRootLayout() {
  const element = await RootLayout({ children: <p>test content</p> });
  return renderToStaticMarkup(element);
}

describe("RootLayout — no-translate + declared language", () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie =
      "sinan-lang=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  });

  it("marks the whole document as not for browser translation", async () => {
    document.cookie = "sinan-lang=ar; path=/";
    const html = await renderRootLayout();

    // Present on both <html> and <body>.
    expect(html.match(/translate="no"/g)).toHaveLength(2);
    expect(html).toMatch(/name="google"\s+content="notranslate"/);
  });

  it("defaults to English (lang=ltr) when no language cookie is saved", async () => {
    const html = await renderRootLayout();
    expect(html).toMatch(/<html[^>]*lang="en"[^>]*>/);
    expect(html).toMatch(/<html[^>]*dir="ltr"[^>]*>/);
  });

  it("declares the saved language on <html> (lang + dir)", async () => {
    document.cookie = "sinan-lang=ar; path=/";
    const html = await renderRootLayout();
    expect(html).toMatch(/<html[^>]*lang="ar"[^>]*>/);
    expect(html).toMatch(/<html[^>]*dir="rtl"[^>]*>/);
  });

  it("extends the pre-hydration script to sync lang and dir from localStorage", async () => {
    document.cookie = "sinan-lang=ar; path=/";
    const html = await renderRootLayout();
    expect(html).toContain("setAttribute('lang',l)");
    expect(html).toContain("setAttribute('dir',l==='ar'?'rtl':'ltr')");
  });

  it("honors the language choice written by the in-app switcher (end-to-end cookie contract)", async () => {
    function Consumer() {
      const { lang, setLang } = useLanguage();
      return (
        <button type="button" onClick={() => setLang("ar")}>
          {lang}
        </button>
      );
    }

    render(
      <LanguageProvider initialLang="en">
        <Consumer />
      </LanguageProvider>,
    );
    fireEvent.click(screen.getByRole("button"));

    const html = await renderRootLayout();
    expect(html).toMatch(/<html[^>]*lang="ar"[^>]*>/);
    expect(html).toMatch(/<html[^>]*dir="rtl"[^>]*>/);
  });
});