const prisma = require('../lib/prisma');
const { AppError } = require('../middleware/errorHandler');

async function getMyWallet(req, res) {
  const wallet = await prisma.wallet.findUnique({
    where: { locksithId: req.locksmith.id },
    include: {
      transactions: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          job: {
            select: {
              serviceType: true,
              teamMemberId: true,
              teamMember: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  if (!wallet) throw new AppError('Wallet not found', 404);

  const [locksmith, creditAgg] = await Promise.all([
    prisma.locksmith.findUnique({
      where: { id: req.locksmith.id },
      select: { isOnline: true },
    }),
    prisma.transaction.aggregate({
      where: { walletId: wallet.id, type: 'CREDIT' },
      _sum: { amount: true },
    }),
  ]);

  const minimumBalance = wallet.minimumBalance;
  const warning =
    wallet.balance < minimumBalance
      ? 'Your balance is below the minimum required to go online'
      : undefined;

  const totalEarned = Number(creditAgg._sum.amount || 0);

  res.json({
    balance: wallet.balance,
    minimumBalance,
    isOnline: locksmith ? locksmith.isOnline : false,
    totalEarned,
    ...(warning && { warning }),
    transactions: wallet.transactions,
  });
}

async function getPendingPayouts(req, res) {
  const pendingPayouts = await prisma.pendingPayout.findMany({
    where: { locksithId: req.locksmith.id, released: false },
    orderBy: { releaseAfter: 'asc' },
    select: {
      id: true,
      jobId: true,
      amount: true,
      releaseAfter: true,
    },
  });
  res.json({ pendingPayouts });
}

module.exports = { getMyWallet, getPendingPayouts };
