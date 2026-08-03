-- AlterTable
ALTER TABLE "VendorProfile" ADD COLUMN     "addressText" TEXT,
ADD COLUMN     "closesAt" TEXT,
ADD COLUMN     "deliveryInfo" TEXT,
ADD COLUMN     "establishedYear" INTEGER,
ADD COLUMN     "opensAt" TEXT,
ADD COLUMN     "ordersCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "responseMins" INTEGER;

-- CreateTable
CREATE TABLE "StoreActivity" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoreActivity_vendorId_idx" ON "StoreActivity"("vendorId");

-- CreateIndex
CREATE INDEX "StoreActivity_createdAt_idx" ON "StoreActivity"("createdAt");

-- AddForeignKey
ALTER TABLE "StoreActivity" ADD CONSTRAINT "StoreActivity_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "VendorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

