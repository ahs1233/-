"use client";

import { useEffect, useState } from "react";
import { useCart } from "./cart";

/**
 * يخبرنا هل أعاد zustand ترطيب السلة من localStorage بعد.
 * قبل الترطيب تكون السلة فارغة (0) على الخادم وأول رسم للعميل، فنمنع عرض
 * مجموع مضلِّل (٠) أو رسالة "سلة فارغة" وامضة حتى تكتمل القراءة من التخزين.
 *
 * مهم: نبدأ دائماً بـ false ونُكمل الترطيب داخل useEffect (على العميل فقط).
 * لا نلمس useCart.persist أثناء رسم الخادم لأن واجهة persist غير متوفّرة هناك،
 * وكان استدعاؤها في مُهيّئ useState يُسقط صفحتي السلة والدفع بخطأ 500.
 */
export function useCartHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const persist = useCart.persist;
    // احتياط: إن غابت واجهة persist لأي سبب، لا نُبقِ الواجهة عالقة على "جارٍ التحميل".
    if (!persist) {
      setHydrated(true);
      return;
    }
    const unsub = persist.onFinishHydration(() => setHydrated(true));
    if (persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);
  return hydrated;
}
