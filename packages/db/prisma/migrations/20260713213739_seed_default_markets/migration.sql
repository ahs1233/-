-- تعبئةٌ حرِجة لأسواق «السوگ» الافتراضيّة في الإنتاج. البذر (seed) غير حرجٍ على
-- Vercel وقد يفشل على قاعدةٍ مأهولة، فيبقى جدول Market فارغاً ولا تظهر شبكة
-- «اختر السوق». هذه الهجرة تضمن وجودها (تعمل عبر migrate deploy الحرِج).
-- idempotent: تُدرج المفقود فقط (WHERE NOT EXISTS بالمعرّف)، فلا تلمس تعديلات
-- الأدمن ولا تُكرّر. categorySlug يُشتقّ من اسم الفئة كي يطابق ما بذره slugify.

INSERT INTO "Market" ("id", "slug", "nameAr", "tagline", "icon", "kind", "categorySlug", "imageUrl", "status", "enabled", "sortOrder", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  v.slug, v.name, v.tagline, v.icon, v.kind,
  CASE WHEN v.catname IS NULL THEN NULL ELSE (SELECT c.slug FROM "Category" c WHERE c."nameAr" = v.catname LIMIT 1) END,
  v.image, v.status, true, v.ord, now(), now()
FROM (VALUES
  ('stores',      'متاجر بغداد',        'كل ما تحتاجه في السوق المحلّي',        '🏪', 'stores',   NULL,            '/souks/souk-shorja.jpg', 'live', 0),
  ('electronics', 'بغداد الإلكترونية',  'أجهزة إلكترونية وإكسسوارات أصلية',     '📱', 'category', 'إلكترونيات',    NULL,                     'live', 1),
  ('food',        'الطعام',             'بقالة ومأكولات ومنتجات محليّة',        '🍔', 'category', 'بقالة وأطعمة',  '/souks/souk-spice.jpg',  'live', 2),
  ('travel',      'السفر',              'طيران، فنادق ورحلات',                  '✈️', 'category', NULL,            NULL,                     'soon', 3),
  ('realestate',  'العقارات',           'بيع، شراء، إيجار',                     '🏠', 'category', NULL,            NULL,                     'soon', 4),
  ('jobs',        'الوظائف',            'فرص عمل في العراق',                    '💼', 'category', NULL,            NULL,                     'soon', 5),
  ('health',      'الصحة',              'صيدليات، أطباء، مختبرات',              '🏥', 'category', NULL,            NULL,                     'soon', 6),
  ('education',   'التعليم',            'دورات، مدارس، جامعات',                 '🎓', 'category', NULL,            NULL,                     'soon', 7),
  ('cars',        'السيارات',           'بيع وشراء المركبات',                   '🚗', 'category', NULL,            NULL,                     'soon', 8)
) AS v(slug, name, tagline, icon, kind, catname, image, status, ord)
WHERE NOT EXISTS (SELECT 1 FROM "Market" m WHERE m."slug" = v.slug);
