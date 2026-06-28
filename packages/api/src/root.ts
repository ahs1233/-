import { router } from "./trpc";
import { authRouter } from "./routers/auth";
import { geoRouter } from "./routers/geo";
import { catalogRouter } from "./routers/catalog";

/**
 * الراوتر الجذر — العقد الكامل للـ API.
 * يُستهلك بأمان نوعي على الويب، ويُصدَّر REST/OpenAPI لتطبيق native.
 */
export const appRouter = router({
  auth: authRouter,
  geo: geoRouter,
  catalog: catalogRouter,
});

export type AppRouter = typeof appRouter;
