const prisma = require('../lib/prisma');
const { AppError } = require('../middleware/errorHandler');
const { buildPaymentFields, verifyItnSignature } = require('../utils/payfast');
const { audit, AuditAction } = require('../utils/auditLog');

function appBaseUrl() {
  return (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

/** @param {'deposit' | 'final' | 'simulate'} paymentKind */
function releaseAfterForPendingPayout(job, paymentKind) {
  if (job.mode === 'EMERGENCY') {
    return new Date(Date.now() + 49 * 60 * 60 * 1000);
  }
  if (job.mode === 'SCHEDULED') {
    if (paymentKind === 'final') {
      return new Date(Date.now() + 2 * 60 * 60 * 1000);
    }
    return new Date();
  }
  return new Date(Date.now() + 49 * 60 * 60 * 1000);
}

function parsePaymentRef(mPaymentId) {
  if (!mPaymentId || typeof mPaymentId !== 'string') return null;
  if (mPaymentId.startsWith('wallet-topup:')) {
    const walletId = mPaymentId.slice('wallet-topup:'.length);
    if (!walletId) return null;
    return { kind: 'wallet-topup', walletId };
  }
  const idx = mPaymentId.lastIndexOf(':');
  if (idx === -1) return null;
  const jobId = mPaymentId.slice(0, idx);
  const kind = mPaymentId.slice(idx + 1);
  if (!jobId || (kind !== 'deposit' && kind !== 'final')) return null;
  return { jobId, kind };
}

async function simulatePayment(req, res) {
  const { jobId } = req.body;
  const customerId = req.customer.id;

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      locksmith: { select: { id: true, pushToken: true } },
      customer: { select: { id: true, pushToken: true } },
    },
  });

  if (!job) throw new AppError('Job not found', 404);
  if (job.customerId !== customerId) throw new AppError('Forbidden', 403);
  if (!job.locksithId) {
    throw new AppError('Job has no assigned locksmith', 400);
  }

  await prisma.$transaction(async (tx) => {
    await tx.job.update({
      where: { id: jobId },
      data: { depositPaid: true, finalPaid: true },
    });

    await tx.pendingPayout.upsert({
      where: { jobId },
      create: {
        jobId,
        locksithId: job.locksithId,
        amount: job.locksithEarning,
        releaseAfter: releaseAfterForPendingPayout(job, 'simulate'),
        released: false,
      },
      update: {},
    });
  });

  res.json({ success: true, message: 'Payment simulated' });
}

async function createDepositPayment(req, res) {
  const { jobId } = req.body;
  const customerId = req.customer.id;

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new AppError('Job not found', 404);
  if (job.customerId !== customerId) throw new AppError('Forbidden', 403);

  const amount = job.totalPrice;
  if (amount <= 0) throw new AppError('Invalid job total for payment', 400);

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
  });

  const mPaymentId = `${jobId}:deposit`;
  const { url, fields } = buildPaymentFields({
    amount,
    itemName: `Vula24 payment — job ${jobId}`,
    itemDescription: 'Full upfront payment',
    mPaymentId,
    email: customer.email,
    returnUrl: `${appBaseUrl()}/api/payments/return?status=deposit`,
    cancelUrl: `${appBaseUrl()}/api/payments/cancel`,
    notifyUrl: `${appBaseUrl()}/api/payments/webhook`,
  });

  res.json({ payUrl: url, fields, amount, mPaymentId });
}

async function createFinalPayment(req, res) {
  throw new AppError(
    'Payment is now collected upfront in full. This endpoint is deprecated.',
    400
  );
}

async function createWalletTopup(req, res) {
  const { amount } = req.body;
  const locksmithId = req.locksmith.id;

  if (typeof amount !== 'number' || amount < 100) {
    throw new AppError('Minimum top up is R100', 400);
  }

  const wallet = await prisma.wallet.findUnique({
    where: { locksithId: locksmithId },
  });
  if (!wallet) throw new AppError('Wallet not found', 404);

  const locksmith = await prisma.locksmith.findUnique({
    where: { id: locksmithId },
  });
  if (!locksmith) throw new AppError('Locksmith not found', 404);

  const mPaymentId = `wallet-topup:${wallet.id}`;
  const { url, fields } = buildPaymentFields({
    amount,
    itemName: 'Vula24 wallet top-up',
    itemDescription: 'Wallet balance top-up',
    mPaymentId,
    email: locksmith.email,
    returnUrl: `${appBaseUrl()}/api/payments/return?status=wallet-topup`,
    cancelUrl: `${appBaseUrl()}/api/payments/cancel`,
    notifyUrl: `${appBaseUrl()}/api/payments/webhook`,
  });

  res.json({ payUrl: url, fields, amount, mPaymentId });
}

async function payfastWebhook(req, res) {
  const body = req.body;
  if (!verifyItnSignature(body)) {
    return res.status(400).send('INVALID');
  }

  if (body.payment_status !== 'COMPLETE') {
    return res.status(200).send('OK');
  }

  const ref = parsePaymentRef(body.m_payment_id);
  if (!ref) {
    return res.status(200).send('OK');
  }

  const amountGross = parseFloat(String(body.amount_gross).replace(',', '.'));
  if (Number.isNaN(amountGross)) {
    return res.status(400).send('BAD_AMOUNT');
  }

  if (ref.kind === 'wallet-topup') {
    const wallet = await prisma.wallet.findUnique({
      where: { id: ref.walletId },
      include: { locksmith: true },
    });
    if (!wallet || !wallet.locksmith) {
      return res.status(200).send('OK');
    }

    const locksmith = wallet.locksmith;

    await prisma.$transaction(async (tx) => {
      const updated = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: amountGross } },
      });
      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          amount: amountGross,
          type: 'CREDIT',
          description: 'Wallet top-up',
        },
      });

      const meetsMin = updated.balance >= locksmith.walletMinimum;
      await tx.notification.create({
        data: {
          recipientId: locksmith.id,
          recipientType: 'LOCKSMITH',
          title: 'Wallet topped up',
          message: meetsMin
            ? 'Wallet topped up successfully. You can now go online.'
            : `Wallet topped up R${amountGross.toFixed(2)}. Top up further to meet your minimum balance.`,
        },
      });
    });

    await audit(AuditAction.WALLET_TOPPED_UP, {
      entityType: 'WALLET',
      entityId: ref.walletId,
      actorType: 'SYSTEM',
      metadata: {
        amount: amountGross,
        paymentId: body.m_payment_id,
      },
      ipAddress: req.ip,
    });

    return res.status(200).send('OK');
  }

  const job = await prisma.job.findUnique({
    where: { id: ref.jobId },
    include: { locksmith: true },
  });
  if (!job || !job.locksithId) {
    return res.status(200).send('OK');
  }

  if (ref.kind === 'deposit') {
    const expectedFull = job.totalPrice;
    const expectedHalf = job.totalPrice * 0.5;
    const matchesFull = Math.abs(amountGross - expectedFull) <= 0.02;
    const matchesHalf = Math.abs(amountGross - expectedHalf) <= 0.02;
    if (!matchesFull && !matchesHalf) {
      console.warn('PayFast amount mismatch', {
        jobId: job.id,
        amountGross,
        expectedFull,
        expectedHalf,
      });
      return res.status(400).send('AMOUNT_MISMATCH');
    }

    if (matchesHalf) {
      if (job.depositPaid) {
        return res.status(200).send('OK');
      }
      await prisma.job.update({
        where: { id: job.id },
        data: { depositPaid: true },
      });
      await audit(AuditAction.PAYMENT_RECEIVED, {
        entityType: 'JOB',
        entityId: ref.jobId,
        actorType: 'SYSTEM',
        metadata: {
          amount: amountGross,
          kind: ref.kind,
          paymentId: body.m_payment_id,
          partial: true,
        },
        ipAddress: req.ip,
      });
      return res.status(200).send('OK');
    }

    if (job.depositPaid && job.finalPaid) {
      return res.status(200).send('OK');
    }
    await prisma.$transaction(async (tx) => {
      await tx.job.update({
        where: { id: job.id },
        data: { depositPaid: true, finalPaid: true },
      });

      const credit = job.locksithEarning;
      const existingPending = await tx.pendingPayout.findUnique({
        where: { jobId: job.id },
      });
      if (!existingPending) {
        await tx.pendingPayout.create({
          data: {
            jobId: job.id,
            locksithId: job.locksithId,
            amount: credit,
            releaseAfter: releaseAfterForPendingPayout(job, 'deposit'),
          },
        });
      }

      const serviceLabel = String(job.serviceType).replace(/_/g, ' ');
      await tx.notification.create({
        data: {
          recipientId: job.locksithId,
          recipientType: 'LOCKSMITH',
          title: 'Payment received',
          message: `Payment received for ${serviceLabel} job. R${credit.toFixed(2)} will be released to your wallet after 24 hours if no dispute.`,
        },
      });
    });
    await audit(AuditAction.PAYMENT_RECEIVED, {
      entityType: 'JOB',
      entityId: ref.jobId,
      actorType: 'SYSTEM',
      metadata: {
        amount: amountGross,
        kind: ref.kind,
        paymentId: body.m_payment_id,
      },
      ipAddress: req.ip,
    });
    return res.status(200).send('OK');
  }

  if (ref.kind === 'final') {
    const expectedHalf = job.totalPrice * 0.5;
    if (Math.abs(amountGross - expectedHalf) > 0.02) {
      console.warn('PayFast amount mismatch', {
        jobId: job.id,
        amountGross,
        expectedHalf,
      });
      return res.status(400).send('AMOUNT_MISMATCH');
    }
    if (job.finalPaid) {
      return res.status(200).send('OK');
    }
    await prisma.$transaction(async (tx) => {
      await tx.job.update({
        where: { id: job.id },
        data: { finalPaid: true, depositPaid: true },
      });

      const credit = job.locksithEarning;
      const existingPending = await tx.pendingPayout.findUnique({
        where: { jobId: job.id },
      });
      if (!existingPending) {
        await tx.pendingPayout.create({
          data: {
            jobId: job.id,
            locksithId: job.locksithId,
            amount: credit,
            releaseAfter: releaseAfterForPendingPayout(job, 'final'),
          },
        });
      }
    });
    await audit(AuditAction.PAYMENT_RECEIVED, {
      entityType: 'JOB',
      entityId: ref.jobId,
      actorType: 'SYSTEM',
      metadata: {
        amount: amountGross,
        kind: ref.kind,
        paymentId: body.m_payment_id,
      },
      ipAddress: req.ip,
    });
    return res.status(200).send('OK');
  }

  return res.status(200).send('OK');
}

async function releasePendingPayouts() {
  const due = await prisma.pendingPayout.findMany({
    where: {
      released: false,
      releaseAfter: { lte: new Date() },
    },
  });

  for (const p of due) {
    try {
      const jobCheck = await prisma.job.findUnique({
        where: { id: p.jobId },
        select: { isDisputed: true },
      });
      if (jobCheck?.isDisputed) continue;

      let payoutReleased = false;
      let releaseAudit = null;

      await prisma.$transaction(async (tx) => {
        // Atomic claim - only succeeds if not yet released
        const claimed = await tx.pendingPayout.updateMany({
          where: {
            id: p.id,
            released: false,
          },
          data: { released: true },
        });

        // If another process already claimed this payout, skip
        if (claimed.count === 0) return;

        const payout = await tx.pendingPayout.findUnique({
          where: { id: p.id },
          include: {
            locksmith: {
              include: { wallet: true },
            },
          },
        });

        if (!payout?.locksmith?.wallet) return;

        releaseAudit = {
          payoutId: payout.id,
          jobId: payout.jobId,
          amount: payout.amount,
          locksithId: payout.locksithId,
        };

        await tx.wallet.update({
          where: { id: payout.locksmith.wallet.id },
          data: { balance: { increment: payout.amount } },
        });
        await tx.transaction.create({
          data: {
            walletId: payout.locksmith.wallet.id,
            amount: payout.amount,
            type: 'CREDIT',
            description: `Payment for job ${payout.jobId}`,
            jobId: payout.jobId,
          },
        });
        payoutReleased = true;
      });

      if (payoutReleased && releaseAudit) {
        await audit(AuditAction.PAYOUT_RELEASED, {
          entityType: 'PAYOUT',
          entityId: releaseAudit.payoutId,
          actorType: 'SYSTEM',
          metadata: {
            jobId: releaseAudit.jobId,
            amount: releaseAudit.amount,
            locksithId: releaseAudit.locksithId,
          },
        });
      }
    } catch (err) {
      console.error('releasePendingPayouts', p.id, err);
    }
  }
}

async function withdraw(req, res) {
  const { amount } = req.body;
  const locksmithId = req.locksmith.id;

  if (amount <= 0) throw new AppError('Amount must be positive', 400);
  if (amount < 100) throw new AppError('Minimum withdrawal is R100', 400);

  const adminRecipientId =
    process.env.ADMIN_NOTIFICATION_RECIPIENT_ID || 'admin';

  await prisma.$transaction(async (tx) => {
    // Atomic check-and-deduct using updateMany with WHERE balance >= amount
    const result = await tx.wallet.updateMany({
      where: {
        locksithId: locksmithId,
        balance: { gte: amount },
      },
      data: {
        balance: { decrement: amount },
      },
    });

    if (result.count === 0) {
      throw new AppError('Insufficient wallet balance', 400);
    }

    const wallet = await tx.wallet.findUnique({
      where: { locksithId: locksmithId },
    });
    if (!wallet) throw new AppError('Wallet not found', 404);

    await tx.transaction.create({
      data: {
        walletId: wallet.id,
        amount,
        type: 'DEBIT',
        description: 'Withdrawal request',
      },
    });
    await tx.notification.create({
      data: {
        recipientId: adminRecipientId,
        recipientType: 'CUSTOMER',
        title: 'Withdrawal request',
        message: `Locksmith ${locksmithId} requested R${amount.toFixed(2)}`,
      },
    });
  });

  const updatedWallet = await prisma.wallet.findUnique({
    where: { locksithId: locksmithId },
  });

  await audit(AuditAction.WITHDRAWAL_REQUESTED, {
    entityType: 'WALLET',
    entityId: updatedWallet?.id,
    actorType: 'LOCKSMITH',
    actorId: locksmithId,
    metadata: { amount, newBalance: updatedWallet?.balance },
    ipAddress: req.ip,
  });

  res.json({ success: true });
}

async function paymentReturn(req, res) {
  res.json({ status: 'received', query: req.query });
}

async function paymentCancel(req, res) {
  res.json({ status: 'cancelled' });
}

module.exports = {
  simulatePayment,
  createDepositPayment,
  createFinalPayment,
  createWalletTopup,
  payfastWebhook,
  releasePendingPayouts,
  withdraw,
  paymentReturn,
  paymentCancel,
};
