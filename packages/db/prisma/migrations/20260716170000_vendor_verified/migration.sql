-- توثيق المتجر (علامة ✓ الذهبيّة).
ALTER TABLE "VendorProfile" ADD COLUMN IF NOT EXISTS "verified" BOOLEAN NOT NULL DEFAULT false;
