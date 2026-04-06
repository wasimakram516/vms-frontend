"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import LoadingState from "@/components/LoadingState";

export default function KitchenPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/staff/kitchen/orders");
  }, [router]);

  return <LoadingState />;
}
