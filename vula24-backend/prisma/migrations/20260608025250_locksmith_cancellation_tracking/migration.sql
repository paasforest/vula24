-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "cancelReason" TEXT;

-- AlterTable
ALTER TABLE "Locksmith" ADD COLUMN     "cancellationCount" INTEGER NOT NULL DEFAULT 0;
