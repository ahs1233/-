/**
 * إدارة جلسات refresh — توكن عالي الإنتروبيا يُخزَّن مجزّأً (sha256) في DB.
 * يسمح بالإبطال (logout) والتدوير (rotation) عند التجديد.
 * متوافق مع الويب والـ native (التوكن مجرّد نص، لا يعتمد على الكوكيز).
 */
import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@al-souq/db";
import { authEnv } from "./env";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface IssuedSession {
  refreshToken: string; // يُعطى للعميل مرة واحدة فقط
  sessionId: string;
  expiresAt: Date;
}

/** ينشئ جلسة refresh جديدة لمستخدم. */
export async function createSession(
  userId: string,
  meta: { userAgent?: string; ip?: string } = {},
): Promise<IssuedSession> {
  const refreshToken = randomBytes(48).toString("base64url");
  const refreshHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + authEnv.refreshTtl * 1000);

  const session = await prisma.session.create({
    data: {
      userId,
      refreshHash,
      userAgent: meta.userAgent,
      ip: meta.ip,
      expiresAt,
    },
  });

  return { refreshToken, sessionId: session.id, expiresAt };
}

export interface RefreshResult {
  ok: boolean;
  userId?: string;
  reason?: string;
}

/** يتحقق من توكن refresh ويعيد صاحبه (دون تدوير). */
export async function validateRefresh(refreshToken: string): Promise<RefreshResult> {
  const refreshHash = hashToken(refreshToken);
  const session = await prisma.session.findUnique({ where: { refreshHash } });
  if (!session) return { ok: false, reason: "جلسة غير معروفة" };
  if (session.revokedAt) return { ok: false, reason: "جلسة مُبطلة" };
  if (session.expiresAt.getTime() <= Date.now()) return { ok: false, reason: "انتهت صلاحية الجلسة" };
  return { ok: true, userId: session.userId };
}

/** يدوّر الجلسة: يُبطل القديمة ويُصدر جديدة (يمنع إعادة الاستخدام). */
export async function rotateSession(
  refreshToken: string,
  meta: { userAgent?: string; ip?: string } = {},
): Promise<{ ok: false; reason: string } | { ok: true; userId: string; session: IssuedSession }> {
  const refreshHash = hashToken(refreshToken);
  const existing = await prisma.session.findUnique({ where: { refreshHash } });
  if (!existing || existing.revokedAt || existing.expiresAt.getTime() <= Date.now()) {
    return { ok: false, reason: "جلسة غير صالحة" };
  }
  await prisma.session.update({ where: { id: existing.id }, data: { revokedAt: new Date() } });
  const session = await createSession(existing.userId, meta);
  return { ok: true, userId: existing.userId, session };
}

/** يُبطل جلسة معيّنة (تسجيل خروج). */
export async function revokeSession(refreshToken: string): Promise<void> {
  const refreshHash = hashToken(refreshToken);
  await prisma.session
    .update({ where: { refreshHash }, data: { revokedAt: new Date() } })
    .catch(() => undefined); // تجاهل إن لم توجد
}

/** يُبطل كل جلسات مستخدم (تسجيل خروج من كل الأجهزة). */
export async function revokeAllSessions(userId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
