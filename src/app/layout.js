import "../styles/globals.css";
import { cookies } from "next/headers";
import { headers } from "next/headers";
import { Comfortaa, Noto_Kufi_Arabic } from "next/font/google";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import ClientRoot from "./ClientRoot";
import Navbar from "@/components/nav/Navbar";
import { Box } from "@mui/material";

const comfortaa = Comfortaa({
  variable: "--font-latin",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

const notoKufiArabic = Noto_Kufi_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata = {
  title: "Sinan Sentry",
  description:
    "Sinan Sentry is a visitor management platform for registration, approvals, and gate check-in.",
  icons: {
    apple: "/logo-mark-light.png",
  },
  keywords:
    "Sinan Sentry, visitor management, registrations, approvals, gate check-in",
  openGraph: {
    title: "Sinan Sentry",
    description:
      "Manage visitor registrations, approvals, and gate check-in in one platform.",
    url: "https://sinan.whitewall.solutions",
    siteName: "Sinan Sentry",
    images: [
      {
        url: "/sinan.png",
        width: 512,
        height: 512,
        alt: "Sinan Sentry",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sinan Sentry",
    description:
      "Manage visitor registrations, approvals, and gate check-in in one platform.",
    images: ["/background.png"],
  },
};

export default async function RootLayout({ children }) {
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const saved = cookieStore.get("sinan-lang")?.value;
  const initialLang = saved === "ar" ? "ar" : "en";
  const nonce = requestHeaders.get("x-nonce") || undefined;

  return (
    <html
      lang={initialLang}
      dir={initialLang === "ar" ? "rtl" : "ltr"}
      translate="no"
      className={`${comfortaa.variable} ${notoKufiArabic.variable}`}
      suppressHydrationWarning
    >
      <head>
        <meta name="google" content="notranslate" />
      </head>
      <body translate="no">
        <AppRouterCacheProvider options={{ key: "mui", nonce }}>
          <ClientRoot initialLang={initialLang}>
            <Navbar />
            <Box
              component="main"
              sx={{
                height: "100vh",
                pt: "64px",
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {children}
            </Box>
          </ClientRoot>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
