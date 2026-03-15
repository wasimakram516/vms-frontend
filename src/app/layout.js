import "../styles/globals.css";
import ClientRoot from "./ClientRoot";
import Navbar from "@/components/nav/Navbar";
import { Box } from "@mui/material";

export const metadata = {
  title: "Sinan VMS",
  description:
    "Sinan VMS is a visitor management platform for registration, approvals, and gate check-in.",
  keywords:
    "Sinan VMS, visitor management, registrations, approvals, gate check-in",
  openGraph: {
    title: "Sinan VMS",
    description:
      "Manage visitor registrations, approvals, and gate check-in in one platform.",
    url: "https://sinan-vms.local",
    siteName: "Sinan VMS",
    images: [
      {
        url: "/WW.png",
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
    images: ["/og-image.png"],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ClientRoot>
          <Navbar />
          <Box component="main" sx={{ pt: "22px", minHeight: "calc(100vh - 64px)" }}>
            {children}
          </Box>
        </ClientRoot>
      </body>
    </html>
  );
}
