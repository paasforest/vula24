const prisma = require('../lib/prisma');

const AuditAction = {
  // Auth
  CUSTOMER_REGISTER: 'CUSTOMER_REGISTER',
  LOCKSMITH_REGISTER: 'LOCKSMITH_REGISTER',
  CUSTOMER_LOGIN: 'CUSTOMER_LOGIN',
  LOCKSMITH_LOGIN: 'LOCKSMITH_LOGIN',
  LOGIN_FAILED: 'LOGIN_FAILED',
  OTP_SENT: 'OTP_SENT',
  OTP_VERIFIED: 'OTP_VERIFIED',
  OTP_FAILED: 'OTP_FAILED',

  // Wallet
  WITHDRAWAL_REQUESTED: 'WITHDRAWAL_REQUESTED',
  WITHDRAWAL_FAILED: 'WITHDRAWAL_FAILED',
  WITHDRAWAL_PAID: 'WITHDRAWAL_PAID',
  PAYOUT_RELEASED: 'PAYOUT_RELEASED',
  WALLET_TOPPED_UP: 'WALLET_TOPPED_UP',

  // Jobs
  JOB_CREATED: 'JOB_CREATED',
  JOB_ACCEPTED: 'JOB_ACCEPTED',
  JOB_COMPLETED: 'JOB_COMPLETED',
  JOB_CANCELLED: 'JOB_CANCELLED',
  JOB_DISPUTED: 'JOB_DISPUTED',

  // Admin
  ADMIN_LOGIN: 'ADMIN_LOGIN',
  LOCKSMITH_APPROVED: 'LOCKSMITH_APPROVED',
  LOCKSMITH_REJECTED: 'LOCKSMITH_REJECTED',
  LOCKSMITH_SUSPENDED: 'LOCKSMITH_SUSPENDED',
  LOCKSMITH_DELETED: 'LOCKSMITH_DELETED',
  DISPUTE_RESOLVED: 'DISPUTE_RESOLVED',

  // Payments
  PAYMENT_RECEIVED: 'PAYMENT_RECEIVED',
  PAYMENT_WEBHOOK: 'PAYMENT_WEBHOOK',
};

async function audit(action, {
  entityType,
  entityId,
  actorType,
  actorId,
  metadata,
  ipAddress,
} = {}) {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        entityType: entityType || 'SYSTEM',
        entityId: entityId || null,
        actorType: actorType || 'SYSTEM',
        actorId: actorId || null,
        metadata: metadata || null,
        ipAddress: ipAddress || null,
      },
    });
  } catch (e) {
    // Never block main flow for audit logging
    console.error('[audit] Failed to log:', action, e?.message);
  }
}

module.exports = { audit, AuditAction };
