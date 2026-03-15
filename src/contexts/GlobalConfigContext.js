"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { getGlobalConfig, getFonts, syncFonts } from "@/services/globalConfigService";
import { scanFonts } from "@/utils/fontScanner";

const GlobalConfigContext = createContext();

export const GlobalConfigProvider = ({ children }) => {
  const [globalConfig, setGlobalConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fonts, setFonts] = useState([]);
  const [fontsLoading, setFontsLoading] = useState(true);

  const refetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getGlobalConfig();
      setGlobalConfig(data);
    } catch (error) {
      console.error("Failed to load global config", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const syncFontsToDB = useCallback(async () => {
    try {
      setFontsLoading(true);
      const result = await getFonts();
      if (result?.data?.fonts && result.data.fonts.length > 0) {
        setFonts(result.data.fonts);
      } else {
        const scannedFonts = scanFonts();
        setFonts(scannedFonts);
        await syncFonts(scannedFonts);
      }
    } catch (error) {
      console.error("Failed to fetch fonts, using scanned fonts:", error);
      const scannedFonts = scanFonts();
      setFonts(scannedFonts);
      try {
        await syncFonts(scannedFonts);
      } catch (syncError) {
        console.error("Failed to sync fonts to database:", syncError);
      }
    } finally {
      setFontsLoading(false);
    }
  }, []);

  useEffect(() => {
    refetchConfig();
    syncFontsToDB();
  }, [refetchConfig, syncFontsToDB]);

  return (
    <GlobalConfigContext.Provider
      value={{ globalConfig, setGlobalConfig, refetchConfig, loading, fonts, fontsLoading, syncFontsToDB }}
    >
      {children}
    </GlobalConfigContext.Provider>
  );
};

export const useGlobalConfig = () => useContext(GlobalConfigContext);
