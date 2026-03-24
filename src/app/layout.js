import "../styles/globals.css";
import ClientRoot from "./ClientRoot";
import Navbar from "@/components/nav/Navbar";
import { Box } from "@mui/material";

export const metadata = {
  title: "Sinan VMS",
  description:
    "Sinan VMS is a visitor management platform for registration, approvals, and gate check-in.",
  icons: {
    icon: "/favicon.png",
  },
  keywords:
    "Sinan VMS, visitor management, registrations, approvals, gate check-in",
  openGraph: {
    title: "Sinan VMS",
    description:
      "Manage visitor registrations, approvals, and gate check-in in one platform.",
    url: "https://sinan.whitewall.solutions",
    siteName: "Sinan VMS",
    images: [
      {
        url: "/sinan.png",
        width: 512,
        height: 512,
        alt: "Sinan VMS",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sinan VMS",
    description:
      "Manage visitor registrations, approvals, and gate check-in in one platform.",
    images: ["/background.png"],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body style={{ margin: 0, padding: 0 }}>
        <ClientRoot>
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
      </body>
    </html>
  );
}
