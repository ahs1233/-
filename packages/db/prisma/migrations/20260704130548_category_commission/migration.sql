-- AlterTable (idempotent)
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "commissionRate" DECIMAL(5,4);
