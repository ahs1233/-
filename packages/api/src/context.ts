/**
 * سياق tRPC — يُبنى لكل طلب.
 * يستخرج توكن الوصول (Authorization: Bearer ... أو من الكوكي)، يتحقق منه،
 * ويحمّل المستخدم. الطبقة لا تعتمد على Next تحديداً — تستقبل Headers قياسية
 * بحيث يُعاد استخدامها من أي محوّل (web أو native في المستقبل).
 */
import { prisma } from "@al-souq/db";
import { verifyAccessToken, type AppRole } from "@al-souq/auth";

export interface AuthedUser {
  id: string;
  role: AppRole;
  phone: string;
}

export interface Context {
  prisma: typeof prisma;
  user: AuthedUser | null;
  reqIp?: string;
  userAgent?: string;
  /** ترويسات الطلب — لقراءة كوكي refresh على الويب. */
  reqHeaders: Headers;
  /** ترويسات الاستجابة — تُستخدم لضبط كوكيز المصادقة (httpOnly) على الويب. */
  resHeaders?: Headers;
}

function extractToken(headers: Headers): string | null {
  const auth = headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  // دعم الكوكي للويب (httpOnly access token)
  const cookie = headers.get("cookie") ?? "";
  const match = cookie.match(/(?:^|;\s*)al_access=([^;]+)/);
  return match ? decodeURIComponent(match[1]!) : null;
}

export async function createContext(opts: {
  headers: Headers;
  resHeaders?: Headers;
}): Promise<Context> {
  const token = extractToken(opts.headers);
  let user: AuthedUser | null = null;

  if (token) {
    const claims = await verifyAccessToken(token);
    if (claims) {
      // نتحقق أن المستخدم ما زال موجوداً وغير محظور (التوكن قد يسبق الحظر)
      const dbUser = await prisma.user.findUnique({
        where: { id: claims.sub },
        select: { id: true, role: true, phone: true, isBlocked: true },
      });
      if (dbUser && !dbUser.isBlocked) {
        user = { id: dbUser.id, role: dbUser.role as AppRole, phone: dbUser.phone };
      }
    }
  }

  return {
    prisma,
    user,
    reqIp: opts.headers.get("x-forwarded-for") ?? undefined,
    userAgent: opts.headers.get("user-agent") ?? undefined,
    reqHeaders: opts.headers,
    resHeaders: opts.resHeaders,
  };
}

const COOKIE_BASE = "Path=/; HttpOnly; SameSite=Lax";

/** يضبط كوكي الوصول فقط (مثلاً عند تغيّر الدور بعد تسجيل بائع). */
export function setAccessCookie(ctx: Context, accessToken: string, ttl: number): void {
  if (!ctx.resHeaders) return;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  ctx.resHeaders.append(
    "set-cookie",
    `al_access=${encodeURIComponent(accessToken)}; ${COOKIE_BASE}; Max-Age=${ttl}${secure}`,
  );
}

/** يضبط كوكيز المصادقة على الويب (في native تُتجاهل ويُعتمد على جسم الرد). */
export function setAuthCookies(
  ctx: Context,
  tokens: { accessToken: string; refreshToken: string },
  ttl: { access: number; refresh: number },
): void {
  if (!ctx.resHeaders) return;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  setAccessCookie(ctx, tokens.accessToken, ttl.access);
  ctx.resHeaders.append(
    "set-cookie",
    `al_refresh=${encodeURIComponent(tokens.refreshToken)}; ${COOKIE_BASE}; Max-Age=${ttl.refresh}${secure}`,
  );
}

export function clearAuthCookies(ctx: Context): void {
  if (!ctx.resHeaders) return;
  ctx.resHeaders.append("set-cookie", `al_access=; ${COOKIE_BASE}; Max-Age=0`);
  ctx.resHeaders.append("set-cookie", `al_refresh=; ${COOKIE_BASE}; Max-Age=0`);
}

/** يقرأ كوكي refresh من ترويسات الطلب (للويب). */
export function readRefreshCookie(headers: Headers): string | null {
  const cookie = headers.get("cookie") ?? "";
  const match = cookie.match(/(?:^|;\s*)al_refresh=([^;]+)/);
  return match ? decodeURIComponent(match[1]!) : null;
}
