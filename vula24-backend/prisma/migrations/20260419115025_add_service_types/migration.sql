-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ServiceType" ADD VALUE 'OFFICE_LOCKOUT';
ALTER TYPE "ServiceType" ADD VALUE 'CAR_KEY_PROGRAMMING';
ALTER TYPE "ServiceType" ADD VALUE 'CAR_KEY_CUTTING';
ALTER TYPE "ServiceType" ADD VALUE 'BROKEN_KEY_EXTRACTION';
ALTER TYPE "ServiceType" ADD VALUE 'LOST_KEY_REPLACEMENT';
ALTER TYPE "ServiceType" ADD VALUE 'IGNITION_REPAIR';
ALTER TYPE "ServiceType" ADD VALUE 'LOCK_UPGRADE';
ALTER TYPE "ServiceType" ADD VALUE 'DEADLOCK_INSTALLATION';
ALTER TYPE "ServiceType" ADD VALUE 'SAFE_OPENING';
ALTER TYPE "ServiceType" ADD VALUE 'GATE_MOTOR_REPAIR';
ALTER TYPE "ServiceType" ADD VALUE 'ACCESS_CONTROL';
ALTER TYPE "ServiceType" ADD VALUE 'PADLOCK_REMOVAL';
ALTER TYPE "ServiceType" ADD VALUE 'GARAGE_DOOR';
ALTER TYPE "ServiceType" ADD VALUE 'SECURITY_GATE';
ALTER TYPE "ServiceType" ADD VALUE 'ELECTRIC_FENCE_GATE';
