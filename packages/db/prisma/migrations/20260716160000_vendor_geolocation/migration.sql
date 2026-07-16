-- إحداثيّات موقع المتجر (خط العرض/الطول) — لصفحة «قريب منك» والخريطة.
ALTER TABLE "VendorProfile" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "VendorProfile" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;

-- بذرة توضيحيّة (مرّة واحدة): توزّع متاجر بغداد المعتمدة حول مركز المدينة
-- كي تظهر الخريطة مأهولةً فور النشر. المتاجر الحقيقيّة تضبط موقعها من لوحتها.
UPDATE "VendorProfile" v SET
  "latitude"  = 33.312 + (random() - 0.5) * 0.09,
  "longitude" = 44.361 + (random() - 0.5) * 0.09
FROM "Governorate" g
WHERE v."governorateId" = g.id
  AND g."nameAr" = 'بغداد'
  AND v.status = 'APPROVED'
  AND v."latitude" IS NULL;
