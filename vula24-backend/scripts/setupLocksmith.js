/**
 * One-off setup for a specific locksmith: verify, PSIRA, location (Roodepoort),
 * wallet balance, walletMinimum, online.
 *
 *   cd vula24-backend && node scripts/setupLocksmith.js
 *   DATABASE_URL=postgresql://... node scripts/setupLocksmith.js
 *
 * Optional: pass a different email as first argument (defaults to Patrick's).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const prisma = require('../lib/prisma');

const DEFAULT_EMAIL = 'spmthembu12@gmail.com';

const STARTING_BALANCE = 500;
const WALLET_MINIMUM_BALANCE = 200;
const LOCKSMITH_WALLET_MINIMUM = 200;
const ROODEPOORT_LAT = -26.1625;
const ROODEPOORT_LNG = 27.8727;

function summarize(locksmith) {
  if (!locksmith) return null;
  const { password: _pw, ...rest } = locksmith;
  return rest;
}

async function main() {
  const email = (process.argv[2] || DEFAULT_EMAIL).trim().toLowerCase();

  const before = await prisma.locksmith.findUnique({
    where: { email },
    include: { wallet: true },
  });

  if (!before) {
    console.error(`No locksmith found for email: ${email}`);
    process.exit(1);
  }

  console.log('--- BEFORE ---');
  console.log(JSON.stringify(summarize(before), null, 2));

  await prisma.$transaction(async (tx) => {
    await tx.wallet.upsert({
      where: { locksithId: before.id },
      create: {
        locksithId: before.id,
        balance: STARTING_BALANCE,
        minimumBalance: WALLET_MINIMUM_BALANCE,
      },
      update: {
        balance: STARTING_BALANCE,
        minimumBalance: WALLET_MINIMUM_BALANCE,
      },
    });

    await tx.locksmith.update({
      where: { id: before.id },
      data: {
        isVerified: true,
        psiraVerified: true,
        currentLat: ROODEPOORT_LAT,
        currentLng: ROODEPOORT_LNG,
        walletMinimum: LOCKSMITH_WALLET_MINIMUM,
        isOnline: true,
      },
    });
  });

  const after = await prisma.locksmith.findUnique({
    where: { id: before.id },
    include: { wallet: true },
  });

  console.log('--- AFTER ---');
  console.log(JSON.stringify(summarize(after), null, 2));
  console.log('Done:', email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
