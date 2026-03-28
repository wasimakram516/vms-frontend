"use client";

import Navbar from "@/components/nav/Navbar";
import { Box } from "@mui/material";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function ClientLayout({ children }) {
  const pathname = usePathname();
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) return <>{children}</>;

  const modulePrefixes = [
    "/auth",
    "/cms",
    "/staff",
    "/register",
  ];

  const hideNavbar = modulePrefixes.some((prefix) =>
    pathname.startsWith(prefix)
  );

return (
  <>
    {!hideNavbar && <Navbar />}
    <Box>{children}</Box>
  </>
);
}
