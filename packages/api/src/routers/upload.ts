/**
 * راوتر الرفع — يصدر رابطاً موقّعاً مسبقاً ليرفع البائع/الأدمن الصور مباشرةً
 * إلى التخزين (S3/MinIO). الخادم لا يمرّر الملف، فقط يوقّع الإذن.
 */
import { TRPCError } from "@trpc/server";
import { getStorage } from "@al-souq/storage";
import { presignUploadSchema } from "@al-souq/validators";
import { router, vendorProcedure } from "../trpc";

export const uploadRouter = router({
  // متاح للبائع (والأدمن عبر hasRole) لرفع صور المنتجات/المتجر
  presign: vendorProcedure.input(presignUploadSchema).mutation(async ({ ctx, input }) => {
    const storage = getStorage();
    if (!storage.configured) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "خدمة رفع الصور غير مهيّأة على الخادم",
      });
    }
    const prefix = `${input.purpose}/${ctx.user.id}`;
    return storage.presignUpload({ prefix, contentType: input.contentType });
  }),

  // هل خدمة الرفع متاحة؟ (لتبديل واجهة الرفع/إدخال الرابط في العميل)
  status: vendorProcedure.query(() => ({ configured: getStorage().configured })),
});
