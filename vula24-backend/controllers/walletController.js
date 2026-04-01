const prisma = require('../lib/prisma');
const { AppError } = require('../middleware/errorHandler');

async function getMyWallet(req, res) {
  const wallet = await prisma.wallet.findUnique({
    where: { locksithId: req.locksmith.id },
    include: {
      transactions: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  });
  if (!wallet) throw new AppError('Wallet not found', 404);

  res.json({
    balance: wallet.balance,
    transactions: wallet.transactions,
  });
}

module.exports = { getMyWallet };
