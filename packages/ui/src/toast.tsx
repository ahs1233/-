"use client";

import * as React from "react";
import { cn } from "./cn";

/**
 * نظام Toast خفيف بلا تبعيات: مزوّد + خطّاف useToast.
 * الرسائل تظهر أسفل الشاشة (فوق شريط التنقّل السفلي) وتختفي تلقائياً،
 * وتُعلن لقارئات الشاشة عبر aria-live.
 */

type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  toast: (message: string, kind?: ToastKind) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = React.createContext<ToastApi | null>(null);

const KIND_STYLE: Record<ToastKind, string> = {
  success: "bg-neutral-900 text-white",
  error: "bg-danger text-white",
  info: "bg-neutral-800 text-white",
};

const KIND_ICON: Record<ToastKind, string> = { success: "✓", error: "✕", info: "ℹ" };

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const idRef = React.useRef(0);

  const toast = React.useCallback((message: string, kind: ToastKind = "info") => {
    const id = ++idRef.current;
    setItems((prev) => [...prev.slice(-2), { id, kind, message }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  const api = React.useMemo<ToastApi>(
    () => ({
      toast,
      success: (m) => toast(m, "success"),
      error: (m) => toast(m, "error"),
    }),
    [toast],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex max-w-sm items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg",
              "animate-[toast-in_.25s_ease-out]",
              KIND_STYLE[t.kind],
            )}
          >
            <span aria-hidden="true">{KIND_ICON[t.kind]}</span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    // خارج المزوّد (مثلاً اختبارات): نسقط على تنبيه صامت بدل الانهيار
    return {
      toast: () => undefined,
      success: () => undefined,
      error: () => undefined,
    };
  }
  return ctx;
}
