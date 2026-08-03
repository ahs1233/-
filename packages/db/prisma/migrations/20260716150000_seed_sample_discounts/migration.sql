-- بذرة عرضٍ توضيحيّة (مرّة واحدة): تضع «سعراً قبل الخصم» على ٦ منتجات نشطة
-- كي تظهر العروض والخصومات فور النشر. تُلغى تلقائياً إن وُجد أيّ خصمٍ مسبقاً.
UPDATE "Product" SET "compareAtPrice" = ROUND("basePrice" * 1.30, 2)
WHERE id IN (
  SELECT p.id FROM "Product" p
  JOIN "VendorProfile" v ON v.id = p."vendorId"
  WHERE p.status = 'ACTIVE' AND v.status = 'APPROVED' AND p."compareAtPrice" IS NULL
  ORDER BY p."createdAt" DESC
  LIMIT 6
)
AND NOT EXISTS (SELECT 1 FROM "Product" WHERE "compareAtPrice" IS NOT NULL);
