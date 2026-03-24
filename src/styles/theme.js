import { createTheme } from "@mui/material/styles";

export const getTheme = (mode) => {
  const isDark = mode === "dark";
  const darkBackground = "#121922";
  const darkSurface = "rgba(23, 30, 39, 0.82)";
  const darkSurfaceStrong = "rgba(28, 36, 47, 0.9)";
  const darkBorder = "rgba(255, 255, 255, 0.1)";

  return createTheme({
    palette: {
      mode,
      primary: {
        main: isDark ? "#ffffff" : "#000000",
        contrastText: isDark ? "#000000" : "#ffffff",
      },
      secondary: {
        main: isDark ? "#ffffff" : "#000000",
      },
      background: {
        default: isDark ? darkBackground : "#f8f9fa",
        paper: isDark ? darkSurface : "#ffffff",
      },
      text: {
        primary: isDark ? "#ffffff" : "#000000",
        secondary: isDark ? "rgba(255, 255, 255, 0.7)" : "rgba(0, 0, 0, 0.7)",
        disabled: isDark ? "rgba(255, 255, 255, 0.4)" : "rgba(0, 0, 0, 0.38)",
      },
      divider: isDark ? darkBorder : "rgba(0, 0, 0, 0.12)",
    },

    typography: {
      fontFamily: "'Comfortaa', cursive, sans-serif",
      h1: { fontWeight: 700 },
      h2: { fontWeight: 700 },
      h3: { fontWeight: 700 },
      h4: { fontWeight: 700 },
      h5: { fontWeight: 700 },
      h6: { fontWeight: 700 },
      button: { textTransform: "none", fontWeight: 600 },
    },

    shape: { borderRadius: 8 },

    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            transition: "background-color 0.3s ease, color 0.3s ease",
            backgroundColor: isDark ? darkBackground : "#f8f9fa",
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: "999px",
            fontSize: "1rem",
            padding: "10px 20px",
            fontWeight: 600,
            textTransform: "none",
            transition: "all 0.3s ease",
          },
          containedPrimary: {
            "&:hover": {
              backgroundColor: isDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.8)",
              transform: "scale(1.02)",
              boxShadow: "0 6px 24px rgba(0,0,0,0.3)",
            },
          },
          outlinedPrimary: {
            borderColor: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)",
            color: isDark ? "#ffffff" : "#000000",
            "&:hover": {
              borderColor: isDark ? "#ffffff" : "#000000",
              backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
              transform: "scale(1.03)",
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
            ...(isDark && {
              backdropFilter: "blur(12px)",
              border: `1px solid ${darkBorder}`,
              boxShadow: "0 8px 24px rgba(0,0,0,0.28)",
            }),
            ...(!isDark && {
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.05)",
              border: "1px solid rgba(0, 0, 0, 0.05)",
            }),
          },
        },
        variants: [
          {
            props: { variant: "frosted" },
            style: {
              backdropFilter: "blur(10px)",
              backgroundColor: isDark ? darkSurfaceStrong : "rgba(255, 255, 255, 0.8)",
              border: isDark ? `1px solid ${darkBorder}` : "1px solid rgba(0, 0, 0, 0.08)",
              boxShadow: isDark ? "0 8px 32px rgba(0,0,0,0.32)" : "0 8px 32px rgba(0,0,0,0.1)",
              borderRadius: 16,
            },
          },
        ],
      },
      MuiTextField: {
        defaultProps: {
          variant: "outlined",
          size: "small",
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: "30px",
            backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.02)",
            overflow: "hidden",
            transition: "all 0.2s ease",
            "&&.MuiOutlinedInput-multiline": {
              borderRadius: "16px",
            },
            "& .MuiOutlinedInput-notchedOutline": {
              borderColor: isDark ? darkBorder : "rgba(0,0,0,0.1)",
              borderRadius: "inherit",
            },
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)",
            },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: isDark ? "#ffffff" : "#000000",
              borderWidth: "1px",
            },
            "& .MuiInputBase-input": {
              color: isDark ? "#ffffff" : "#000000",
            },
          },
          input: {
            color: isDark ? "#ffffff !important" : "#000000 !important",
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            color: isDark ? "rgba(255, 255, 255, 0.7)" : "rgba(0, 0, 0, 0.7)",
            "&.Mui-focused": {
              color: isDark ? "#ffffff" : "#000000",
            },
          },
        },
      },
      MuiInputBase: {
        styleOverrides: {
          root: {
            color: isDark ? "#ffffff" : "#000000",
          },
          input: {
            "&:-webkit-autofill": {
              WebkitBoxShadow: isDark ? `0 0 0 1000px ${darkBackground} inset !important` : "0 0 0 1000px #ffffff inset !important",
              WebkitTextFillColor: isDark ? "#ffffff !important" : "#000000 !important",
            },
          },
        },
      },
      MuiCheckbox: {
        styleOverrides: {
          root: {
            color: isDark ? "rgba(255, 255, 255, 0.5)" : "rgba(0, 0, 0, 0.3)",
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? "rgba(18, 25, 34, 0.84)" : "rgba(255, 255, 255, 0.8)",
            backdropFilter: "blur(10px)",
            borderBottom: isDark ? `1px solid ${darkBorder}` : "1px solid rgba(0,0,0,0.08)",
            color: isDark ? "#ffffff" : "#000000",
          },
        },
      },
      MuiSelect: {
        styleOverrides: {
          root: {
            borderRadius: "30px",
            overflow: "hidden",
          },
          icon: {
            right: 16,
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          head: {
            fontWeight: 700,
            backgroundColor: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)",
          },
        },
      },
    },
  });
};

export default getTheme("dark");
