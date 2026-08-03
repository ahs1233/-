-- تحصيل الدخل: طبقة الاشتراك + الظهور المدفوع + النبض المموّل
-- AlterTable
ALTER TABLE "VendorProfile" ADD COLUMN     "featuredUntil" TIMESTAMP(3),
ADD COLUMN     "plan" TEXT NOT NULL DEFAULT 'free',
ADD COLUMN     "planExpiresAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "StoreActivity" ADD COLUMN     "sponsored" BOOLEAN NOT NULL DEFAULT false;
