-- إعادةُ تسمية أسواق «السوگ» إلى نمط المحافظة: كلّ سوقٍ عالمٌ مستقلّ باسمٍ موحّد
-- «سوگ …»، و«{gov}» يُستبدل باسم المحافظة المختارة وقت العرض (سوگ بغداد…). كما
-- تُحدّث الأيقونات والترتيب وتُدرج «سوگ الخدمات». تعمل عبر migrate deploy الحرِج
-- كي يطابق الإنتاجُ رؤية المؤسّس (كلّ محافظة منفصلة بأسواقها).

-- (1) تحديث الأسواق الافتراضيّة القائمة إلى الأسماء/الأيقونات/الترتيب الجديد.
UPDATE "Market" AS m SET
  "nameAr" = v.name, "tagline" = v.tagline, "icon" = v.icon, "sortOrder" = v.ord, "updatedAt" = now()
FROM (VALUES
  ('stores',      'سوگ {gov}',            'قلب المدينة — كلّ متاجرها في مكانٍ واحد', '🏙️', 0),
  ('electronics', 'سوگ {gov} الإلكتروني', 'أجهزة وإكسسوارات أصلية',                  '💻', 1),
  ('food',        'سوگ الطعام',           'بقالة ومأكولات ومنتجات محليّة',           '🍔', 2),
  ('realestate',  'سوگ العقار',           'بيع، شراء، إيجار',                        '🏠', 3),
  ('cars',        'سوگ السيارات',         'بيع وشراء المركبات',                      '🚗', 4),
  ('jobs',        'سوگ الوظائف',          'فرص عمل في العراق',                       '💼', 5),
  ('travel',      'سوگ السفر',            'طيران، فنادق ورحلات',                     '✈️', 7),
  ('health',      'سوگ الصحة',            'صيدليات، أطباء، مختبرات',                 '🩺', 8),
  ('education',   'سوگ التعليم',          'دورات، مدارس، جامعات',                    '🎓', 9)
) AS v(slug, name, tagline, icon, ord)
WHERE m."slug" = v.slug;

-- (2) إدراج «سوگ الخدمات» إن لم يكن موجوداً (idempotent).
INSERT INTO "Market" ("id", "slug", "nameAr", "tagline", "icon", "kind", "categorySlug", "imageUrl", "status", "enabled", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'services', 'سوگ الخدمات', 'حِرفيّون وخدماتٌ منزليّة', '🛠️', 'category', NULL, NULL, 'soon', true, 6, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM "Market" m WHERE m."slug" = 'services');
