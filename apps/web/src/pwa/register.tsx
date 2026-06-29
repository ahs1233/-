"use client";

import { useEffect } from "react";

/**
 * تسجيل service worker للـ PWA.
 * في المرحلة 1 نسجّل عاملاً بسيطاً (تثبيت + قشرة أساسية). التخزين الأوفلاين
 * المتقدّم وإشعارات Push تُبنى في المرحلة 6.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* تجاهل فشل التسجيل بصمت */
      });
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);
  return null;
}
