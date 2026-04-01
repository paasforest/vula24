const prisma = require('../lib/prisma');
const { AppError } = require('../middleware/errorHandler');
const { buildPaymentFields, verifyItnSignature } = require('../utils/payfast');

function appBaseUrl() {
  return (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

function parsePaymentRef(mPaymentId) {
  if (!mPaymentId || typeof mPaymentId !== 'string') return null;
  const [jobId, kind] = mPaymentId.split(':');
  if (!jobId || (kind !== 'deposit' && kind !== 'final')) return null;
  return { jobId, kind };
}

async function createDepositPayment(req, res) {
  const { jobId } = req.body;
  const customerId = req.customer.id;

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new AppError('Job not found', 404);
  if (job.customerId !== customerId) throw new AppError('Forbidden', 403);

  const amount = job.totalPrice * 0.5;
  if (amount <= 0) throw new AppError('Invalid job total for payment', 400);

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
  });

  const mPaymentId = `${jobId}:deposit`;
  const { url, fields } = buildPaymentFields({
    amount,
    itemName: `Vula24 deposit — job ${jobId}`,
    itemDescription: '50% deposit',
    mPaymentId,
    email: customer.email,
    returnUrl: `${appBaseUrl()}/api/payments/return?status=deposit`,
    cancelUrl: `${appBaseUrl()}/api/payments/cancel`,
    notifyUrl: `${appBaseUrl()}/api/payments/webhook`,
  });

  res.json({ payUrl: url, fields, amount, mPaymentId });
}

async function createFinalPayment(req, res) {
  const { jobId } = req.body;
  const customerId = req.customer.id;

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new AppError('Job not found', 404);
  if (job.customerId !== customerId) throw new AppError('Forbidden', 403);
  if (!job.depositPaid) {
    throw new AppError('Deposit must be paid first', 400);
  }

  const amount = job.totalPrice * 0.5;
  if (amount <= 0) throw new AppError('Invalid job total for payment', 400);

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
  });

  const mPaymentId = `${jobId}:final`;
  const { url, fields } = buildPaymentFields({
    amount,
    itemName: `Vula24 final payment — job ${jobId}`,
    itemDescription: 'Remaining 50%',
    mPaymentId,
    email: customer.email,
    returnUrl: `${appBaseUrl()}/api/payments/return?status=final`,
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

  const job = await prisma.job.findUnique({
    where: { id: ref.jobId },
    include: { locksmith: true },
  });
  if (!job || !job.locksithId) {
    return res.status(200).send('OK');
  }

  const expectedHalf = job.totalPrice * 0.5;
  if (Math.abs(amountGross - expectedHalf) > 0.02) {
    console.warn('PayFast amount mismatch', { jobId: job.id, amountGross, expectedHalf });
    return res.status(400).send('AMOUNT_MISMATCH');
  }

  if (ref.kind === 'deposit') {
    if (job.depositPaid) {
      return res.status(200).send('OK');
    }
    await prisma.job.update({
      where: { id: job.id },
      data: { depositPaid: true },
    });
    return res.status(200).send('OK');
  }

  if (ref.kind === 'final') {
    if (job.finalPaid) {
      return res.status(200).send('OK');
    }
    await prisma.$transaction(async (tx) => {
      await tx.job.update({
        where: { id: job.id },
        data: { finalPaid: true },
      });

      const wallet = await tx.wallet.findUnique({
        where: { locksithId: job.locksithId },
      });
      if (!wallet) {
        throw new Error('Wallet missing for locksmith');
      }

      const credit = job.locksithEarning;
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: credit } },
      });
      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          amount: credit,
          type: 'CREDIT',
          description: `Payment for job ${job.id}`,
          jobId: job.id,
        },
      });
    });
    return res.status(200).send('OK');
  }

  return res.status(200).send('OK');
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
  payfastWebhook,
  withdraw,
  paymentReturn,
  paymentCancel,
};
