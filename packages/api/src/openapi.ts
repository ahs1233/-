/**
 * توليد وثيقة OpenAPI من راوترات tRPC — العقد القابل للمشاركة مع تطبيق native.
 * تُقدَّم عبر مسار في تطبيق الويب (/api/openapi.json) وتُستهلك من Expo لاحقاً.
 */
import { generateOpenApiDocument } from "trpc-to-openapi";
import { appRouter } from "./root";

export function buildOpenApiDocument(baseUrl: string) {
  return generateOpenApiDocument(appRouter, {
    title: "Al-Souq API",
    description: "واجهة برمجة منصة السوگ — العقد الرسمي للعملاء (ويب/native).",
    version: "0.1.0",
    baseUrl: `${baseUrl}/api/rest`,
    tags: ["auth", "geo", "catalog"],
  });
}
