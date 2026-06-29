import "server-only";
import { headers } from "next/headers";
import { appRouter, createContext } from "@al-souq/api";

// نوع المُنادي صريح لتفادي TS2742 (نوع غير قابل للتسمية عبر moduleResolution)
type ServerApi = ReturnType<typeof appRouter.createCaller>;

/**
 * مُنادي tRPC من جانب الخادم (React Server Components) — يستدعي الراوتر مباشرة
 * دون رحلة HTTP، مع تمرير ترويسات الطلب الحالية (للكوكيز/المصادقة).
 */
export async function getServerApi(): Promise<ServerApi> {
  const h = headers();
  const ctx = await createContext({ headers: h as unknown as Headers });
  return appRouter.createCaller(ctx);
}
