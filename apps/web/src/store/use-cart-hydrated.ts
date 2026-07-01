"use client";

import { useEffect, useState } from "react";
import { useCart } from "./cart";

/**
 * يخبرنا هل أعاد zustand ترطيب السلة من localStorage بعد.
 * قبل الترطيب تكون السلة فارغة (0) على الخادم وأول رسم للعميل، فنمنع عرض
 * مجموع مضلِّل (٠) أو رسالة "سلة فارغة" وامضة حتى تكتمل القراءة من التخزين.
 */
export function useCartHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useCart.persist.hasHydrated());
  useEffect(() => {
    const unsub = useCart.persist.onFinishHydration(() => setHydrated(true));
    setHydrated(useCart.persist.hasHydrated());
    return unsub;
  }, []);
  return hydrated;
}
