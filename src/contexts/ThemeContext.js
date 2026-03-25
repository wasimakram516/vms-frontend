"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { getTheme } from "@/styles/theme";
import ThemeSwitchOverlay from "@/components/ThemeSwitchOverlay";

const ColorModeContext = createContext({ toggleColorMode: () => {} });

export const useColorMode = () => useContext(ColorModeContext);

export const ThemeContextProvider = ({ children }) => {
  const [mode, setMode] = useState("dark");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [pendingMode, setPendingMode] = useState(null);

  // Stable ref so callbacks passed to the overlay never go stale
  const pendingModeRef = useRef(null);

  useEffect(() => {
    const savedMode = localStorage.getItem("sinan-vms-theme");
    if (savedMode === "light" || savedMode === "dark") {
      setMode(savedMode);
    }
  }, []);

  const colorMode = useMemo(
    () => ({
      mode,
      toggleColorMode: () => {
        // Ignore rapid clicks while animation is in progress
        if (isTransitioning) return;

        const newMode = mode === "light" ? "dark" : "light";
        pendingModeRef.current = newMode;
        setPendingMode(newMode);
        setIsTransitioning(true);
      },
    }),
    [mode, isTransitioning]
  );

  // Called by the overlay once the curtain fully covers the screen
  const handleMidpoint = useCallback(() => {
    const m = pendingModeRef.current;
    if (!m) return;
    setMode(m);
    localStorage.setItem("sinan-vms-theme", m);
  }, []);

  // Called by the overlay after fade-out completes
  const handleDone = useCallback(() => {
    setIsTransitioning(false);
    setPendingMode(null);
    pendingModeRef.current = null;
  }, []);

  const theme = useMemo(() => getTheme(mode), [mode]);

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        {children}
        <ThemeSwitchOverlay
          active={isTransitioning}
          targetMode={pendingMode ?? mode}
          onMidpoint={handleMidpoint}
          onDone={handleDone}
        />
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
};
