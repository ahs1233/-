"use client";

import { TRPCProvider } from "@/src/trpc/react";
import { ServiceWorkerRegistrar } from "@/src/pwa/register";
import { InstallPrompt } from "@/src/pwa/install-prompt";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TRPCProvider>
      {children}
      <ServiceWorkerRegistrar />
      <InstallPrompt />
    </TRPCProvider>
  );
}
