"use client";

import Link from "next/link";
import { Button, Card, CardBody } from "@al-souq/ui";
import { trpc } from "@/src/trpc/react";

export default function NotificationsPage() {
  const list = trpc.notification.list.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  const markRead = trpc.notification.markRead.useMutation({
    onSuccess: () => {
      utils.notification.list.invalidate();
      utils.notification.unreadCount.invalidate();
    },
  });
  const markAll = trpc.notification.markAllRead.useMutation({
    onSuccess: () => {
      utils.notification.list.invalidate();
      utils.notification.unreadCount.invalidate();
    },
  });

  if (list.isError) {
    return (
      <div className="py-16 text-center">
        <p className="text-neutral-500">سجّل الدخول لعرض إشعاراتك.</p>
        <Link href="/login?next=/notifications" className="mt-3 inline-block text-brand-600">
          تسجيل الدخول
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">الإشعارات</h1>
        <Button size="sm" variant="ghost" onClick={() => markAll.mutate()}>
          تعليم الكل كمقروء
        </Button>
      </div>

      {list.isLoading ? (
        <p className="text-neutral-500">جارٍ التحميل…</p>
      ) : list.data!.length === 0 ? (
        <p className="text-neutral-500">لا توجد إشعارات.</p>
      ) : (
        <ul className="space-y-2">
          {list.data!.map((n) => {
            const orderId = (n.data as { orderId?: string } | null)?.orderId;
            const body = (
              <Card className={n.readAt ? "" : "border-brand-300 bg-brand-50/40"}>
                <CardBody className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{n.title}</span>
                    {!n.readAt && <span className="h-2 w-2 rounded-full bg-brand-500" />}
                  </div>
                  {n.body && <p className="text-sm text-neutral-600">{n.body}</p>}
                  <span className="text-xs text-neutral-400">
                    {new Date(n.createdAt).toLocaleString("ar-IQ")}
                  </span>
                </CardBody>
              </Card>
            );
            return (
              <li key={n.id} onClick={() => !n.readAt && markRead.mutate({ id: n.id })}>
                {orderId ? <Link href={`/orders/${orderId}`}>{body}</Link> : body}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
