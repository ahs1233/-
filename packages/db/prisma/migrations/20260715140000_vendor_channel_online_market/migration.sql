-- فصل «بغداد الإلكتروني» (مشاريع الصفحات على إنستغرام/فيسبوك/تيك توك) عن «سوگ بغداد»
-- الواقعيّ. نضيف قناةً للبائع (physical/online) وروابط تواصله، وقناةً للسوق تفلتر
-- بائعيه. ثمّ نُحوّل سوق electronics من «فئة إلكترونيّات» إلى «عالم متاجرٍ إلكترونيّة».

ALTER TABLE "VendorProfile"
  ADD COLUMN IF NOT EXISTS "channel" TEXT NOT NULL DEFAULT 'physical',
  ADD COLUMN IF NOT EXISTS "instagramUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "facebookUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "tiktokUrl" TEXT;

ALTER TABLE "Market"
  ADD COLUMN IF NOT EXISTS "channel" TEXT;

-- «سوگ بغداد» (stores) يعرض المتاجر الواقعيّة فقط.
UPDATE "Market" SET "channel" = 'physical' WHERE "slug" = 'stores';

-- «بغداد الإلكتروني»: عالمُ متاجرٍ إلكترونيّة مستقلّ، لا فئةُ منتجاتٍ مرتبطةٌ بالسوق الواقعيّ.
UPDATE "Market"
SET "kind" = 'stores', "channel" = 'online', "categorySlug" = NULL,
    "tagline" = 'مشاريعُ وصفحاتٌ على إنستغرام وفيسبوك وتيك توك',
    "updatedAt" = now()
WHERE "slug" = 'electronics';
