import { NextRequest, NextResponse } from "next/server";
// مسار فرعي آمن لبيئة Edge (jose فقط، بلا node:crypto)
import { verifyAccessToken } from "@al-souq/auth/jwt";

/**
 * حماية المسارات حسب الدور على حافة الطلب (Edge).
 * يتحقق من توكن الوصول في الكوكي ويعيد التوجيه عند عدم الصلاحية.
 * الحماية النهائية تبقى في tRPC (RBAC على كل endpoint) — هذه طبقة دفاع أولى.
 */
const PROTECTED: { prefix: string; roles: string[] }[] = [
  { prefix: "/vendor", roles: ["VENDOR", "ADMIN"] },
  { prefix: "/admin", roles: ["ADMIN"] },
  { prefix: "/account", roles: ["CUSTOMER", "VENDOR", "ADMIN"] },
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const rule = PROTECTED.find((r) => pathname.startsWith(r.prefix));
  if (!rule) return NextResponse.next();

  const token = req.cookies.get("al_access")?.value;
  const claims = token ? await verifyAccessToken(token) : null;

  if (!claims) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (!rule.roles.includes(claims.role)) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/vendor/:path*", "/admin/:path*", "/account/:path*"],
};
