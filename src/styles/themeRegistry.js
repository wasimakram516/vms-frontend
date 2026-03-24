"use client"; 

import { ThemeContextProvider } from "@/contexts/ThemeContext";
import CssBaseline from "@mui/material/CssBaseline";

export default function ThemeRegistry({ children }) {
  return (
    <ThemeContextProvider>
      <CssBaseline />
      {children}
    </ThemeContextProvider>
  );
}
