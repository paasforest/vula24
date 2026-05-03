/**
 * Read-only: print locksmith fields relevant to toggle-online / profile complete.
 *
 * Usage (from vula24-backend):
 *   node scripts/inspectLocksmithByEmail.js
 *   node scripts/inspectLocksmithByEmail.js spmthembu12@gmail.com
 *
 * Uses DATABASE_URL from .env — must point at the DB you want to inspect (e.g. Railway).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const EMAIL = process.argv[2] || 'spmthembu12@gmail.com';

async function main() {
  const ls = await prisma.locksmith.findUnique({
    where: { email: EMAIL },
    select: {
      id: true,
      name: true,
      email: true,
      profilePhoto: true,
      vehicleType: true,
      vehicleColor: true,
      vehiclePlateNumber: true,
      isVerified: true,
      isOnline: true,
      isSuspended: true,
    },
  });
  if (!ls) {
    console.log('No locksmith found for email:', EMAIL);
    return;
  }
  console.log(JSON.stringify(ls, null, 2));
  console.log('\n--- Toggle-online blockers (go ONLINE) ---');
  const empty = (v) => v == null || String(v).trim() === '';
  const fields = [
    ['profilePhoto', ls.profilePhoto],
    ['vehicleType', ls.vehicleType],
    ['vehicleColor', ls.vehicleColor],
    ['vehiclePlateNumber', ls.vehiclePlateNumber],
  ];
  for (const [k, v] of fields) {
    console.log(`  ${k}: ${empty(v) ? 'MISSING/EMPTY (blocks going online)' : 'ok'}`);
  }
  console.log('  isVerified:', ls.isVerified);
  console.log('  isSuspended:', ls.isSuspended);
  console.log('  isOnline:', ls.isOnline);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
