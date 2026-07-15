-- صورةُ القسم (أقسام السوق كبوّابات) — تُفضَّل على الأيقونة إن وُجدت.
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
