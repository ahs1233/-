/**
 * إبلاغ مركزي عن أخطاء الخادم.
 * دائماً يسجّل بنيوياً إلى stdout (تلتقطه سجلات Vercel)، وإن ضُبط SENTRY_DSN
 * يرسل الحدث إلى Sentry عبر Envelope API مباشرة — بلا SDK ثقيل يعبث ببناء Next.
 */

interface ReportContext {
  source: string;
  path?: string;
  userId?: string;
  extra?: Record<string, unknown>;
}

function parseDsn(dsn: string): { endpoint: string; publicKey: string } | null {
  try {
    const u = new URL(dsn);
    const projectId = u.pathname.replace(/^\//, "");
    if (!projectId || !u.username) return null;
    return {
      endpoint: `${u.protocol}//${u.host}/api/${projectId}/envelope/`,
      publicKey: u.username,
    };
  } catch {
    return null;
  }
}

export function reportError(error: unknown, ctx: ReportContext): void {
  const err = error instanceof Error ? error : new Error(String(error));

  // ١) سجلّ بنيوي دائم (سجلات المنصة)
  // eslint-disable-next-line no-console
  console.error(
    JSON.stringify({
      level: "error",
      source: ctx.source,
      path: ctx.path,
      message: err.message,
      stack: err.stack?.split("\n").slice(0, 6).join("\n"),
      ts: new Date().toISOString(),
    }),
  );

  // ٢) Sentry (اختياري — عند ضبط SENTRY_DSN)
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  const parsed = parseDsn(dsn);
  if (!parsed) return;

  const eventId = crypto.randomUUID().replace(/-/g, "");
  const timestamp = new Date().toISOString();
  const event = {
    event_id: eventId,
    timestamp,
    platform: "node",
    level: "error",
    environment: process.env.NODE_ENV ?? "production",
    tags: { source: ctx.source, ...(ctx.path ? { path: ctx.path } : {}) },
    ...(ctx.userId ? { user: { id: ctx.userId } } : {}),
    extra: ctx.extra,
    exception: {
      values: [
        {
          type: err.name,
          value: err.message,
          stacktrace: err.stack
            ? {
                frames: err.stack
                  .split("\n")
                  .slice(1, 20)
                  .map((line) => ({ function: line.trim() }))
                  .reverse(),
              }
            : undefined,
        },
      ],
    },
  };
  const envelope =
    JSON.stringify({ event_id: eventId, sent_at: timestamp, dsn }) +
    "\n" +
    JSON.stringify({ type: "event" }) +
    "\n" +
    JSON.stringify(event);

  // إرسال دون انتظار (best-effort) — لا يُبطئ الاستجابة ولا يُفشلها
  fetch(parsed.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-sentry-envelope",
      "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${parsed.publicKey}, sentry_client=al-souq/1.0`,
    },
    body: envelope,
  }).catch(() => undefined);
}
