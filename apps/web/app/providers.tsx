"use client";

import { ToastProvider } from "@al-souq/ui";
import { TRPCProvider } from "@/src/trpc/react";
import { ServiceWorkerRegistrar } from "@/src/pwa/register";
import { InstallPrompt } from "@/src/pwa/install-prompt";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TRPCProvider>
      <ToastProvider>
        {children}
        <ServiceWorkerRegistrar />
        <InstallPrompt />
      </ToastProvider>
    </TRPCProvider>
  );
}
