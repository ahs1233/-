-- AlterTable (idempotent)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "permissions" JSONB;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "scopeGovernorateId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "staffTitle" TEXT;
