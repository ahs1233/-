"use client";

import { TRPCProvider } from "@/src/trpc/react";
import { ServiceWorkerRegistrar } from "@/src/pwa/register";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TRPCProvider>
      {children}
      <ServiceWorkerRegistrar />
    </TRPCProvider>
  );
}
