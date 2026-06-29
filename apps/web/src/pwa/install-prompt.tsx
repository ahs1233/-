"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** شريط تثبيت التطبيق (PWA) — يظهر عند توفّر beforeinstallprompt ويُخفى بعد الرفض. */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("al-install-dismissed") === "1") {
      setHidden(true);
      return;
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!deferred || hidden) return null;

  return (
    <div className="fixed inset-x-0 bottom-16 z-30 mx-auto w-full max-w-screen-md px-4">
      <div className="flex items-center gap-3 rounded-xl bg-neutral-900 p-3 text-white shadow-lg">
        <span className="text-2xl">📲</span>
        <p className="flex-1 text-sm">ثبّت تطبيق السوگ على شاشتك للوصول السريع.</p>
        <button
          className="rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-medium"
          onClick={async () => {
            await deferred.prompt();
            await deferred.userChoice;
            setDeferred(null);
          }}
        >
          تثبيت
        </button>
        <button
          className="text-neutral-400"
          aria-label="إغلاق"
          onClick={() => {
            localStorage.setItem("al-install-dismissed", "1");
            setHidden(true);
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
