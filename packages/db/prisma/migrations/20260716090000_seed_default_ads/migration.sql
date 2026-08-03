-- تعبئةٌ حرِجة لإعلانات «السوگ» الافتراضيّة في الإنتاج. البذر غير حرجٍ على Vercel،
-- فيبقى جدول Ad فارغاً ولا يظهر قسم «الإعلانات» في الأسواق. تُدرج المفقود فقط
-- (WHERE NOT EXISTS بالعنوان)، فلا تُكرّر ولا تلمس إعلانات الأدمن. الصور من public.
INSERT INTO "Ad" ("id", "title", "subtitle", "imageUrl", "linkUrl", "placement", "active", "sortOrder", "governorateId", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text, v.title, v.subtitle, v.image, v.link, 'home_banner', true, v.ord,
  CASE WHEN v.govname IS NULL THEN NULL ELSE (SELECT g."id" FROM "Governorate" g WHERE g."nameAr" = v.govname LIMIT 1) END,
  now(), now()
FROM (VALUES
  ('أسبوع النحاسيّات البغداديّة', 'دلال وصواني من قلب سوق الصفافير', '/souks/souk-lantern.jpg', '/search?q=نحاس', 'بغداد', 0),
  ('موسم التمور البصريّة',        'من نخيل شطّ العرب إلى بابك',       '/gov/basra.jpg',          '/search?q=تمر',  'البصرة', 1),
  ('عروض السوگ لكلّ العراق',      'تشكيلةٌ مختارة والدفع عند الاستلام', '/hero-souk.jpg',          '/search',        NULL,     2)
) AS v(title, subtitle, image, link, govname, ord)
WHERE NOT EXISTS (SELECT 1 FROM "Ad" a WHERE a."title" = v.title);
