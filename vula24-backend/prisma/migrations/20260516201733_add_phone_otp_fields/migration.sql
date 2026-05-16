-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "phoneOtp" TEXT,
ADD COLUMN     "phoneOtpExpiry" TIMESTAMP(3),
ADD COLUMN     "phoneVerified" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Locksmith" ADD COLUMN     "phoneOtp" TEXT,
ADD COLUMN     "phoneOtpExpiry" TIMESTAMP(3),
ADD COLUMN     "phoneVerified" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "otp_verifications" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "otp" TEXT NOT NULL,
    "expiry" TIMESTAMP(3) NOT NULL,
    "userType" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "otp_verifications_phone_key" ON "otp_verifications"("phone");
