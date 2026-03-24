"use client";

import SinanLoader from "@/components/SinanLoader";

const DEFAULT_LOADING_COPY = {
  title: "Loading Sinan VMS",
  description: "Preparing your experience...",
};

export default function LoadingState({ fullScreen = true, ...props }) {
  return (
    <SinanLoader
      fullScreen={fullScreen}
      title={props.title ?? DEFAULT_LOADING_COPY.title}
      description={props.description ?? DEFAULT_LOADING_COPY.description}
      {...props}
    />
  );
}
