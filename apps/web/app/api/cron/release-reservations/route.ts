import { NextResponse } from "next/server";
import { prisma } from "@al-souq/db";
import { releaseExpiredReservations } from "@al-souq/api";
import { reportError } from "@/src/lib/report-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * مهمة مجدولة (Vercel Cron): تلغي الطلبات PENDING التي انتهت مهلة حجز مخزونها
 * وتحرّر الحجز. الاستدعاء الانتهازي داخل order.place/myOrders يبقى كاحتياط.
 * محمي: يتطلب ترويسة Vercel Cron أو سرّ CRON_SECRET.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const isVercelCron = Boolean(req.headers.get("x-vercel-cron"));
  const secretOk = process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;
  if (process.env.NODE_ENV === "production" && !isVercelCron && !secretOk) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const released = await releaseExpiredReservations(prisma);
    return NextResponse.json({ ok: true, released });
  } catch (e) {
    reportError(e, { source: "cron:release-reservations" });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
