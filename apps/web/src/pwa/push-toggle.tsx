"use client";

import { useEffect, useState } from "react";
import { Button } from "@al-souq/ui";
import { trpc } from "@/src/trpc/react";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function PushToggle() {
  const config = trpc.notification.pushConfig.useQuery();
  const subscribe = trpc.notification.subscribe.useMutation();
  const sendTest = trpc.notification.sendTest.useMutation();
  const [state, setState] = useState<"idle" | "subscribing" | "subscribed" | "denied" | "unsupported">("idle");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") setState("denied");
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => sub && setState("subscribed"))
      .catch(() => {});
  }, []);

  async function enable() {
    if (!config.data?.publicKey) return;
    setState("subscribing");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.data.publicKey) as BufferSource,
      });
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      await subscribe.mutateAsync({ endpoint: json.endpoint, keys: json.keys });
      setState("subscribed");
      sendTest.mutate();
    } catch {
      setState("idle");
    }
  }

  // لا نعرض شيئاً إن لم تُهيّأ خدمة Push على الخادم
  if (config.data && !config.data.configured) return null;
  if (state === "unsupported") return null;

  if (state === "subscribed") {
    return <p className="text-sm text-brand-600">✓ الإشعارات مفعّلة على هذا الجهاز</p>;
  }
  if (state === "denied") {
    return <p className="text-sm text-neutral-500">الإشعارات محظورة من إعدادات المتصفّح.</p>;
  }

  return (
    <Button size="sm" variant="outline" loading={state === "subscribing"} onClick={enable}>
      🔔 تفعيل إشعارات الجهاز
    </Button>
  );
}
