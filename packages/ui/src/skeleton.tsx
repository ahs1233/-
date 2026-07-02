import * as React from "react";
import { cn } from "./cn";

/** عنصر هيكلي نابض يُستخدم بدل «جارٍ التحميل…» النصية. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-neutral-200/70", className)} aria-hidden="true" />;
}

/** هيكل بطاقة منتج (شبكة الكتالوج). */
export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-2/5" />
        <Skeleton className="h-5 w-1/3" />
      </div>
    </div>
  );
}

/** هيكل صفّ قائمة (طلبات/متاجر/إشعارات). */
export function ListRowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3">
      <Skeleton className="h-14 w-14 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-3 w-2/5" />
      </div>
    </div>
  );
}
