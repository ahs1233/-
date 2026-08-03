-- تعبئةٌ لمرّة واحدة لعرض المحافظات (الشعور + صورة البطل + الأسواق) للمحافظات
-- ذات الهويّة المصوّرة. مقيّدةٌ بـ tagline IS NULL كي لا تلمس أيّ تعديلٍ لاحقٍ
-- من الأدمن (تبويب المحافظات في لوحة «المظهر»).

UPDATE "Governorate" SET
  "tagline" = 'قباب وأزقّة وفوانيس عند المغرب',
  "heroImageUrl" = '/hero-souk.jpg',
  "souks" = '[{"label":"الشورجة","q":"الشورجة","img":"/souks/souk-shorja.jpg"},{"label":"شارع المتنبّي","q":"كتب","img":"/souks/souk-books.jpg"},{"label":"سوق الصفافير","q":"نحاس","img":"/souks/souk-lantern.jpg"},{"label":"خان مرجان","q":"حرفي","img":"/souks/souk-craft.jpg"},{"label":"سوق العطّارين","q":"عطور","img":"/souks/souk-spice.jpg"},{"label":"سوق العبايات","q":"عباية","img":"/souks/souk-abaya.jpg"}]'::jsonb
WHERE "code" = 'BGD' AND "tagline" IS NULL;

UPDATE "Governorate" SET
  "tagline" = 'شطّ العرب والنخيل والموانئ',
  "heroImageUrl" = '/gov/basra.jpg',
  "souks" = '[{"label":"التمور","q":"تمر","emoji":"🌴"},{"label":"الأسماك","q":"سمك","emoji":"🐟"},{"label":"العطّارون","q":"عطار","emoji":"🧴"},{"label":"الأقمشة","q":"قماش","emoji":"🧵"}]'::jsonb
WHERE "code" = 'BSR' AND "tagline" IS NULL;

UPDATE "Governorate" SET
  "tagline" = 'الكتب والعطور والسجّاد والذهب',
  "heroImageUrl" = '/gov/najaf.jpg',
  "souks" = '[{"label":"المكتبات","q":"كتب","emoji":"📚"},{"label":"العطور","q":"عطور","emoji":"🫧"},{"label":"السجّاد","q":"سجاد","emoji":"🧶"},{"label":"الذهب","q":"ذهب","emoji":"💍"}]'::jsonb
WHERE "code" = 'NJF' AND "tagline" IS NULL;

UPDATE "Governorate" SET
  "tagline" = 'القلعة والبازار والأسواق التقليديّة',
  "heroImageUrl" = '/gov/erbil.jpg',
  "souks" = '[{"label":"القلعة","q":"تراث","emoji":"🏯"},{"label":"الأقمشة","q":"قماش","emoji":"🧵"},{"label":"الحلويّات","q":"حلويات","emoji":"🍬"},{"label":"البازار","q":"بازار","emoji":"🛍️"}]'::jsonb
WHERE "code" = 'ARB' AND "tagline" IS NULL;

UPDATE "Governorate" SET
  "tagline" = 'الحجر التراثيّ والأسواق القديمة',
  "heroImageUrl" = '/gov/mosul.jpg',
  "souks" = '[{"label":"النسيج","q":"نسيج","emoji":"🧵"},{"label":"الحبوب","q":"حبوب","emoji":"🌾"},{"label":"الصاغة","q":"ذهب","emoji":"💍"},{"label":"العطّارون","q":"عطار","emoji":"🧴"}]'::jsonb
WHERE "code" = 'NNW' AND "tagline" IS NULL;
