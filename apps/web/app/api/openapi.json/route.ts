import { NextResponse } from "next/server";
import { buildOpenApiDocument } from "@al-souq/api";

export const runtime = "nodejs";

/** وثيقة OpenAPI — العقد الرسمي القابل للمشاركة مع تطبيق native. */
export function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return NextResponse.json(buildOpenApiDocument(baseUrl));
}
