"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CmsIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/cms/dashboard");
  }, [router]);

  return null;
}
