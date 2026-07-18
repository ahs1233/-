-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "sectionId" TEXT;

-- CreateTable
CREATE TABLE "VendorSection" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorSection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VendorSection_vendorId_sortOrder_idx" ON "VendorSection"("vendorId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "VendorSection_vendorId_slug_key" ON "VendorSection"("vendorId", "slug");

-- CreateIndex
CREATE INDEX "Product_sectionId_idx" ON "Product"("sectionId");

-- AddForeignKey
ALTER TABLE "VendorSection" ADD CONSTRAINT "VendorSection_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "VendorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "VendorSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

