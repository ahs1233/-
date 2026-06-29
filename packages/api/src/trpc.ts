/**
 * تهيئة tRPC: transformer، معالجة الأخطاء، والإجراءات المحمية حسب الدور (RBAC).
 * نضيف meta من نوع OpenApiMeta لتوليد REST/OpenAPI تلقائياً لتطبيق native.
 */
import { initTRPC, TRPCError } from "@trpc/server";
import type { OpenApiMeta } from "trpc-to-openapi";
import superjson from "superjson";
import { ZodError } from "zod";
import { hasRole, type AppRole } from "@al-souq/auth";
import type { Context } from "./context";

const t = initTRPC
  .context<Context>()
  .meta<OpenApiMeta>()
  .create({
    transformer: superjson,
    errorFormatter({ shape, error }) {
      return {
        ...shape,
        data: {
          ...shape.data,
          zod: error.cause instanceof ZodError ? error.cause.flatten() : null,
        },
      };
    },
  });

export const router = t.router;
export const middleware = t.middleware;
export const publicProcedure = t.procedure;

/** يتطلب مستخدماً مصادقاً. */
const requireAuth = middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "يجب تسجيل الدخول" });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const protectedProcedure = t.procedure.use(requireAuth);

/** يتطلب دوراً معيّناً. */
function requireRole(required: AppRole | AppRole[]) {
  return middleware(({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "يجب تسجيل الدخول" });
    }
    if (!hasRole(ctx.user.role, required)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "غير مصرّح لك بهذا الإجراء" });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  });
}

export const vendorProcedure = t.procedure.use(requireRole("VENDOR"));
export const adminProcedure = t.procedure.use(requireRole("ADMIN"));
