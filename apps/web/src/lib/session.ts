import "server-only";
import { cookies } from "next/headers";
import { verifyAccessToken, type AppRole } from "@al-souq/auth";

/**
 * يقرأ دور المستخدم الحالي من كوكي الوصول (جانب الخادم) دون رحلة شبكة.
 * يُستخدم لتوجيه الواجهة حسب الدور (متجر مقابل مشتر) قبل الرسم — بلا وميض.
 */
export async function getSessionRole(): Promise<AppRole | null> {
  const token = cookies().get("al_access")?.value;
  if (!token) return null;
  const claims = await verifyAccessToken(token);
  return claims?.role ?? null;
}
