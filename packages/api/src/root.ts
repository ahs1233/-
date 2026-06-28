import { router } from "./trpc";
import { authRouter } from "./routers/auth";
import { geoRouter } from "./routers/geo";
import { catalogRouter } from "./routers/catalog";
import { orderRouter } from "./routers/order";
import { addressRouter } from "./routers/address";
import { favoriteRouter } from "./routers/favorite";
import { reviewRouter } from "./routers/review";
import { notificationRouter } from "./routers/notification";
import { vendorRouter } from "./routers/vendor";
import { uploadRouter } from "./routers/upload";

/**
 * الراوتر الجذر — العقد الكامل للـ API.
 * يُستهلك بأمان نوعي على الويب، ويُصدَّر REST/OpenAPI لتطبيق native.
 */
export const appRouter = router({
  auth: authRouter,
  geo: geoRouter,
  catalog: catalogRouter,
  order: orderRouter,
  address: addressRouter,
  favorite: favoriteRouter,
  review: reviewRouter,
  notification: notificationRouter,
  vendor: vendorRouter,
  upload: uploadRouter,
});

export type AppRouter = typeof appRouter;
