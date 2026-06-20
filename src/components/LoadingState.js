"use client";

import SinanLoader from "@/components/SinanLoader";

export default function LoadingState({ fullScreen = true, ...props }) {
  return (
    <SinanLoader
      fullScreen={fullScreen}
      {...props}
    />
  );
}
