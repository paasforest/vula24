const prisma = require('../lib/prisma');
const { AppError } = require('../middleware/errorHandler');

async function getMyWallet(req, res) {
  const [wallet, locksmith] = await Promise.all([
    prisma.wallet.findUnique({
      where: { locksithId: req.locksmith.id },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    }),
    prisma.locksmith.findUnique({
      where: { id: req.locksmith.id },
      select: { isOnline: true },
    }),
  ]);
  if (!wallet) throw new AppError('Wallet not found', 404);

  const minimumBalance = wallet.minimumBalance;
  const warning =
    wallet.balance < minimumBalance
      ? 'Your balance is below the minimum required to go online'
      : undefined;

  res.json({
    balance: wallet.balance,
    minimumBalance,
    isOnline: locksmith ? locksmith.isOnline : false,
    ...(warning && { warning }),
    transactions: wallet.transactions,
  });
}

module.exports = { getMyWallet };
