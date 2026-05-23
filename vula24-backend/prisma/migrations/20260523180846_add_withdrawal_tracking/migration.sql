-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "withdrawalPaidAt" TIMESTAMP(3),
ADD COLUMN     "withdrawalReference" TEXT;
