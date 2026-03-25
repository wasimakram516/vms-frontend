"use client";

import ThemeRegistry from "@/styles/themeRegistry";
import { MessageProvider } from "@/contexts/MessageContext";
import { AuthProvider } from "@/contexts/AuthContext";
import ClientLayout from "@/utils/ClientLayout";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { useEffect } from "react";
import { VisitorProvider } from "@/contexts/VisitorContext";

export default function ClientRoot({ children }) {
  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const userAgent = window.navigator.userAgent || "";
    const isAndroidWebView =
      /Android/i.test(userAgent) &&
      (/\bwv\b/i.test(userAgent) || /; wv\)/i.test(userAgent));

    const root = document.documentElement;
    root.classList.toggle("android-webview", isAndroidWebView);

    if (!isAndroidWebView) {
      return () => {
        root.classList.remove("android-webview");
      };
    }

    const editableSelector = [
      "input:not([type])",
      "input[type='text']",
      "input[type='search']",
      "input[type='email']",
      "input[type='password']",
      "input[type='url']",
      "input[type='tel']",
      "input[type='number']",
      "textarea",
      "[contenteditable='true']",
      ".MuiInputBase-input",
    ].join(", ");

    const ltrSelector = [
      "input[type='email']",
      "input[type='password']",
      "input[type='url']",
      "input[type='tel']",
      "input[type='number']",
      "input[inputmode='email']",
      "input[inputmode='numeric']",
      "input[inputmode='decimal']",
      "input[inputmode='tel']",
      "input[autocomplete='username']",
      "input[autocomplete='current-password']",
      "input[autocomplete='new-password']",
      "input[autocomplete='one-time-code']",
    ].join(", ");

    const rootSelector =
      ".MuiInputBase-root, .MuiOutlinedInput-root, .MuiFilledInput-root, .MuiInput-root";

    const applyDirection = (element) => {
      if (!(element instanceof HTMLElement) || !element.matches(editableSelector)) {
        return;
      }

      const mode = element.matches(ltrSelector) ? "ltr" : "auto";
      element.setAttribute("dir", mode);
      element.dataset.androidWebviewDirMode = mode;
      element.style.setProperty("text-align", "start", "important");
      element.style.setProperty("unicode-bidi", "plaintext", "important");
      element.style.setProperty("user-select", "text", "important");
      element.style.setProperty("-webkit-user-select", "text", "important");

      const inputRoot = element.closest(rootSelector);
      if (inputRoot instanceof HTMLElement) {
        inputRoot.dataset.androidWebviewDirMode = mode;
        if (mode == "ltr") {
          inputRoot.style.setProperty("direction", "ltr", "important");
        } else {
          inputRoot.style.removeProperty("direction");
        }
      }
    };

    const applyToNode = (node) => {
      if (!(node instanceof HTMLElement)) {
        return;
      }

      if (node.matches(editableSelector)) {
        applyDirection(node);
      }

      node.querySelectorAll(editableSelector).forEach(applyDirection);
    };

    applyToNode(document.documentElement);

    const handleFocus = (event) => applyToNode(event.target);
    const handleInput = (event) => applyToNode(event.target);

    document.addEventListener("focusin", handleFocus, true);
    document.addEventListener("input", handleInput, true);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach(applyToNode);
      });
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      document.removeEventListener("focusin", handleFocus, true);
      document.removeEventListener("input", handleInput, true);
      root.classList.remove("android-webview");
    };
  }, []);

  return (
    <>
      <MessageProvider>
        <ThemeRegistry>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <AuthProvider>
              <VisitorProvider>
                <ClientLayout>{children}</ClientLayout>
              </VisitorProvider>
            </AuthProvider>
          </LocalizationProvider>
        </ThemeRegistry>
      </MessageProvider>
    </>
  );
}
