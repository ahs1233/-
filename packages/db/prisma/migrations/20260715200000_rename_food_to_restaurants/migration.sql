-- إعادة تسمية بوّابة «الطعام» ← «المطاعم» (إن كانت ما زالت بالاسم الافتراضيّ).
UPDATE "Market" SET "nameAr" = 'المطاعم', "icon" = '🍽️', "tagline" = 'مطاعم ومأكولات ومنتجات محليّة', "updatedAt" = now()
WHERE "slug" = 'food' AND "nameAr" IN ('الطعام', 'سوگ الطعام');
