const prisma = require('../lib/prisma');
const { AppError } = require('../middleware/errorHandler');
const { buildPaymentFields, verifyItnSignature } = require('../utils/payfast');

function appBaseUrl() {
  return (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
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
            releaseAfter: new Date(Date.now() + 24 * 60 * 60 * 1000),
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
            releaseAfter: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
      }
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
      await prisma.$transaction(async (tx) => {
        const payout = await tx.pendingPayout.findUnique({
          where: { id: p.id },
        });
        if (!payout || payout.released) {
          return;
        }

        const wallet = await tx.wallet.findUnique({
          where: { locksithId: payout.locksithId },
        });
        if (!wallet) {
          await tx.pendingPayout.update({
            where: { id: payout.id },
            data: { released: true },
          });
          return;
        }

        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: payout.amount } },
        });
        await tx.transaction.create({
          data: {
            walletId: wallet.id,
            amount: payout.amount,
            type: 'CREDIT',
            description: `Payment for job ${payout.jobId}`,
            jobId: payout.jobId,
          },
        });
        await tx.pendingPayout.update({
          where: { id: payout.id },
          data: { released: true },
        });
      });
    } catch (err) {
      console.error('releasePendingPayouts', p.id, err);
    }
  }
}

async function withdraw(req, res) {
  const { amount } = req.body;
  const locksmithId = req.locksmith.id;

  if (amount <= 0) throw new AppError('Amount must be positive', 400);

  const wallet = await prisma.wallet.findUnique({
    where: { locksithId: locksmithId },
  });
  if (!wallet) throw new AppError('Wallet not found', 404);
  if (wallet.balance < amount) {
    throw new AppError('Insufficient wallet balance', 400);
  }

  const adminRecipientId =
    process.env.ADMIN_NOTIFICATION_RECIPIENT_ID || 'admin';

  await prisma.$transaction(async (tx) => {
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { decrement: amount } },
    });
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
        message: `Locksmith ${locksmithId} requested withdrawal of R${amount.toFixed(2)}`,
      },
    });
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
  createDepositPayment,
  createFinalPayment,
  createWalletTopup,
  payfastWebhook,
  releasePendingPayouts,
  withdraw,
  paymentReturn,
  paymentCancel,
};
