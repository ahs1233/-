import * as React from "react";
import { cn } from "./cn";

/** حالة فراغ موحّدة: أيقونة + عنوان + وصف + إجراء اختياري. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-neutral-200 px-6 py-12 text-center",
        className,
      )}
    >
      {icon && <span className="mb-1 grid h-14 w-14 place-items-center rounded-2xl bg-neutral-100 text-neutral-400">{icon}</span>}
      <p className="font-bold text-neutral-700">{title}</p>
      {description && <p className="max-w-xs text-sm text-neutral-400">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
