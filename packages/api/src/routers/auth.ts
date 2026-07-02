/**
 * راوتر المصادقة — OTP عبر الهاتف العراقي.
 * التدفّق: requestOtp → verifyOtp (يُنشئ المستخدم إن جديد، يُصدر access+refresh).
 * يُعيد التوكنات في جسم الرد (للـ native) ويضبط كوكيز httpOnly (للويب).
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  requestOtpSchema,
  verifyOtpSchema,
  completeProfileSchema,
} from "@al-souq/validators";
import {
  requestOtp,
  verifyOtp,
  signAccessToken,
  createSession,
  rotateSession,
  revokeSession,
  authEnv,
} from "@al-souq/auth";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { setAuthCookies, clearAuthCookies, readRefreshCookie, type Context } from "../context";

/**
 * حدّ معدّل طلبات OTP لكل رقم (حماية من قصف الرسائل / التكلفة / DoS).
 * يعتمد على عدّ سجلّات OtpCode الحديثة (الفهرس [phone,purpose,expiresAt] متاح).
 */
const OTP_RATE = {
  shortWindowMs: 10 * 60 * 1000, // ١٠ دقائق
  shortMax: 3,
  longWindowMs: 60 * 60 * 1000, // ساعة
  longMax: 8,
};

async function enforceOtpRateLimit(ctx: Context, phone: string): Promise<void> {
  const now = Date.now();
  const [shortCount, longCount] = await Promise.all([
    ctx.prisma.otpCode.count({
      where: { phone, createdAt: { gte: new Date(now - OTP_RATE.shortWindowMs) } },
    }),
    ctx.prisma.otpCode.count({
      where: { phone, createdAt: { gte: new Date(now - OTP_RATE.longWindowMs) } },
    }),
  ]);
  if (shortCount >= OTP_RATE.shortMax || longCount >= OTP_RATE.longMax) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "طلبت رموزاً كثيرة، انتظر قليلاً ثم حاول مجدداً.",
    });
  }
}

async function issueTokens(ctx: Context, user: { id: string; role: string; phone: string }) {
  const accessToken = await signAccessToken({
    sub: user.id,
    role: user.role as "CUSTOMER" | "VENDOR" | "ADMIN",
    phone: user.phone,
  });
  const session = await createSession(user.id, { userAgent: ctx.userAgent, ip: ctx.reqIp });
  setAuthCookies(
    ctx,
    { accessToken, refreshToken: session.refreshToken },
    { access: authEnv.accessTtl, refresh: authEnv.refreshTtl },
  );
  return { accessToken, refreshToken: session.refreshToken };
}

export const authRouter = router({
  requestOtp: publicProcedure
    .meta({ openapi: { method: "POST", path: "/auth/otp/request", tags: ["auth"] } })
    .input(requestOtpSchema)
    .output(z.object({ ok: z.literal(true), expiresAt: z.date(), devCode: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await enforceOtpRateLimit(ctx, input.phone);
      const res = await requestOtp(input.phone, input.purpose);
      return { ok: true as const, expiresAt: res.expiresAt, devCode: res.devCode };
    }),

  verifyOtp: publicProcedure
    .meta({ openapi: { method: "POST", path: "/auth/otp/verify", tags: ["auth"] } })
    .input(verifyOtpSchema)
    .output(
      z.object({
        ok: z.literal(true),
        accessToken: z.string(),
        refreshToken: z.string(),
        isNewUser: z.boolean(),
        user: z.object({ id: z.string(), role: z.string(), name: z.string().nullable() }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await verifyOtp(input.phone, input.code);
      if (!result.ok) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: result.reason });
      }

      const existing = await ctx.prisma.user.findUnique({ where: { phone: input.phone } });
      const isNewUser = !existing;
      const user =
        existing ??
        (await ctx.prisma.user.create({
          data: { phone: input.phone, phoneVerified: true, role: "CUSTOMER" },
        }));

      if (!user.phoneVerified) {
        await ctx.prisma.user.update({ where: { id: user.id }, data: { phoneVerified: true } });
      }
      if (user.isBlocked) {
        throw new TRPCError({ code: "FORBIDDEN", message: "هذا الحساب محظور" });
      }

      const tokens = await issueTokens(ctx, user);
      return {
        ok: true as const,
        ...tokens,
        isNewUser,
        user: { id: user.id, role: user.role, name: user.name },
      };
    }),

  refresh: publicProcedure
    .meta({ openapi: { method: "POST", path: "/auth/refresh", tags: ["auth"] } })
    .input(z.object({ refreshToken: z.string().optional() }))
    .output(z.object({ ok: z.literal(true), accessToken: z.string(), refreshToken: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const token = input.refreshToken ?? readRefreshCookie(ctx.reqHeaders);
      if (!token) throw new TRPCError({ code: "UNAUTHORIZED", message: "لا يوجد توكن تجديد" });

      const rotated = await rotateSession(token, { userAgent: ctx.userAgent, ip: ctx.reqIp });
      if (!rotated.ok) throw new TRPCError({ code: "UNAUTHORIZED", message: rotated.reason });

      const user = await ctx.prisma.user.findUnique({ where: { id: rotated.userId } });
      if (!user || user.isBlocked) throw new TRPCError({ code: "UNAUTHORIZED" });

      const accessToken = await signAccessToken({
        sub: user.id,
        role: user.role as "CUSTOMER" | "VENDOR" | "ADMIN",
        phone: user.phone,
      });
      setAuthCookies(
        ctx,
        { accessToken, refreshToken: rotated.session.refreshToken },
        { access: authEnv.accessTtl, refresh: authEnv.refreshTtl },
      );
      return { ok: true as const, accessToken, refreshToken: rotated.session.refreshToken };
    }),

  logout: publicProcedure
    .meta({ openapi: { method: "POST", path: "/auth/logout", tags: ["auth"] } })
    .input(z.object({ refreshToken: z.string().optional() }))
    .output(z.object({ ok: z.literal(true) }))
    .mutation(async ({ ctx, input }) => {
      const token = input.refreshToken ?? readRefreshCookie(ctx.reqHeaders);
      if (token) await revokeSession(token);
      clearAuthCookies(ctx);
      return { ok: true as const };
    }),

  me: protectedProcedure
    .meta({ openapi: { method: "GET", path: "/auth/me", tags: ["auth"] } })
    .input(z.void())
    .output(
      z.object({
        id: z.string(),
        phone: z.string(),
        name: z.string().nullable(),
        email: z.string().nullable(),
        role: z.string(),
      }),
    )
    .query(async ({ ctx }) => {
      const user = await ctx.prisma.user.findUniqueOrThrow({
        where: { id: ctx.user.id },
        select: { id: true, phone: true, name: true, email: true, role: true },
      });
      return user;
    }),

  completeProfile: protectedProcedure
    .input(completeProfileSchema)
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.update({
        where: { id: ctx.user.id },
        data: { name: input.name, email: input.email || null },
        select: { id: true, name: true, email: true },
      });
      return user;
    }),
});
