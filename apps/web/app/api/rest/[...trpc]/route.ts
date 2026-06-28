import { createOpenApiFetchHandler } from "trpc-to-openapi";
import { appRouter, createContext } from "@al-souq/api";

export const runtime = "nodejs";

/**
 * جسر REST مولّد من راوترات tRPC — نفس منطق الأعمال يُقدَّم كـ REST
 * ليستهلكه تطبيق native أو أي عميل HTTP، موثّق عبر /api/openapi.json.
 */
function handler(req: Request) {
  return createOpenApiFetchHandler({
    endpoint: "/api/rest",
    router: appRouter,
    createContext: ({ resHeaders }: { resHeaders: Headers }) =>
      createContext({ headers: req.headers, resHeaders }),
    req,
  });
}

export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
};
