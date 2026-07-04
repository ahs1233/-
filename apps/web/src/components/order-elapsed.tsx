"use client";

import { useEffect, useState } from "react";

// حالات نهائية لا تحتاج عدّاداً (سُلّم/اكتمل/أُلغي/أُرجع).
const TERMINAL = new Set(["DELIVERED", "COMPLETED", "CANCELLED", "RETURNED"]);

/**
 * يعرض وقت الطلب دائماً، ولكل طلب لم يُسلَّم بعد يعرض عدّاد الدقائق المنقضية
 * (حيّاً، يُحدَّث كل ٣٠ث) بلون يتصاعد مع التأخّر: عادي < ساعة، ذهبي ≥ ساعة، أحمر ≥ ساعتين.
 */
export function OrderElapsed({ placedAt, status }: { placedAt: string | Date; status: string }) {
  const undelivered = !TERMINAL.has(status);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!undelivered) return;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [undelivered]);

  const placed = new Date(placedAt);
  const timeStr = placed.toLocaleString("ar-IQ", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  if (!undelivered) {
    return <span className="text-xs text-neutral-400 nums">{timeStr}</span>;
  }

  const mins = Math.max(0, Math.floor((now - placed.getTime()) / 60_000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const label = h > 0 ? `${h} س ${m} د` : `${m} د`;
  const color =
    mins >= 120 ? "bg-danger/10 text-danger" : mins >= 60 ? "bg-gold-400/20 text-gold-600" : "bg-neutral-100 text-neutral-600";

  return (
    <span className="flex items-center gap-1.5">
      <span className="text-xs text-neutral-400 nums">{timeStr}</span>
      <span className={`rounded-full px-1.5 py-0.5 text-xs nums ${color}`} title="منذ استلام الطلب">
        ⏱ {label}
      </span>
    </span>
  );
}
