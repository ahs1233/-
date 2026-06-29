import * as React from "react";
import { cn } from "./cn";

const ORDER_STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-neutral-100 text-neutral-700",
  CONFIRMED: "bg-info/10 text-info",
  PREPARING: "bg-brand-100 text-brand-700",
  SHIPPED: "bg-gold-400/20 text-gold-600",
  DELIVERED: "bg-brand-100 text-brand-700",
  COMPLETED: "bg-brand-500 text-white",
  CANCELLED: "bg-danger/10 text-danger",
  RETURNED: "bg-warning/10 text-warning",
};

const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: "بانتظار التأكيد",
  CONFIRMED: "تم التأكيد",
  PREPARING: "قيد التحضير",
  SHIPPED: "تم الشحن",
  DELIVERED: "تم التوصيل",
  COMPLETED: "مكتمل",
  CANCELLED: "ملغى",
  RETURNED: "مُرتجع",
};

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", className)}
      {...props}
    />
  );
}

export function OrderStatusBadge({ status }: { status: string }) {
  return (
    <Badge className={ORDER_STATUS_STYLES[status] ?? "bg-neutral-100 text-neutral-700"}>
      {ORDER_STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

export { ORDER_STATUS_LABEL };
