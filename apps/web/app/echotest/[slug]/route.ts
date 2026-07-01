import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export function GET(_req: Request, { params }: { params: { slug: string } }) {
  return NextResponse.json({ raw: params.slug });
}
