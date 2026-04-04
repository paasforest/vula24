-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('APP', 'CASH');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "bannedAt" TIMESTAMP(3),
ADD COLUMN     "bannedReason" TEXT,
ADD COLUMN     "isBanned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "strikeCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "cashCollected" DOUBLE PRECISION,
ADD COLUMN     "disputeNotes" TEXT,
ADD COLUMN     "disputeProofUrl" TEXT,
ADD COLUMN     "disputeReason" TEXT,
ADD COLUMN     "disputeResolvedAt" TIMESTAMP(3),
ADD COLUMN     "isDisputed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'APP';

-- AlterTable
ALTER TABLE "Locksmith" ADD COLUMN     "walletMinimum" DOUBLE PRECISION NOT NULL DEFAULT 200;

-- AlterTable
ALTER TABLE "Wallet" ADD COLUMN     "minimumBalance" DOUBLE PRECISION NOT NULL DEFAULT 200;
