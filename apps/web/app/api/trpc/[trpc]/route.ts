import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter, createContext } from "@al-souq/api";
import { reportError } from "@/src/lib/report-error";

export const runtime = "nodejs";

function handler(req: Request) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: ({ resHeaders }) => createContext({ headers: req.headers, resHeaders }),
    onError({ error, path }) {
      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.error(`tRPC error on ${path ?? "<no-path>"}:`, error.message);
        return;
      }
      // في الإنتاج: الأخطاء المتوقّعة (تحقق/صلاحيات/حدود) ليست أعطالاً — نبلّغ فقط عن أعطال الخادم.
      if (error.code === "INTERNAL_SERVER_ERROR") {
        reportError(error.cause ?? error, { source: "trpc", path });
      }
    },
  });
}

export { handler as GET, handler as POST };
