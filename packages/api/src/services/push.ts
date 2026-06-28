/**
 * خدمة Web Push. ترسل إشعارات فورية لأجهزة المستخدم المشتركة (PushSubscription).
 * مهيّأة عبر مفاتيح VAPID؛ إن لم تُضبط فالخدمة تعمل بصمت دون إرسال (best-effort).
 * التنظيف: الاشتراكات المنتهية (404/410) تُحذف تلقائياً.
 */
import webpush from "web-push";
import type { PrismaClient } from "@al-souq/db";

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:admin@al-souq.iq";

let configured = false;
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  configured = true;
}

export function isPushConfigured(): boolean {
  return configured;
}

export function getVapidPublicKey(): string | null {
  return VAPID_PUBLIC ?? null;
}

export interface PushPayload {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
}

/**
 * يرسل إشعاراً لكل أجهزة المستخدم. آمن للاستدعاء خارج المعاملات (شبكة).
 * يبتلع الأخطاء الفردية ويحذف الاشتراكات الميتة.
 */
export async function sendPush(prisma: PrismaClient, userId: string, payload: PushPayload): Promise<void> {
  if (!configured) return;
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return;

  const data = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          data,
        );
      } catch (err: unknown) {
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => undefined);
        }
      }
    }),
  );
}

/** إرسال دفعة لعدة مستخدمين (best-effort). */
export async function sendPushMany(
  prisma: PrismaClient,
  items: { userId: string; payload: PushPayload }[],
): Promise<void> {
  if (!configured) return;
  await Promise.all(items.map((i) => sendPush(prisma, i.userId, i.payload)));
}
