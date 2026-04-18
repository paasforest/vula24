/**
 * Sets isVerified = true for a locksmith by email (direct DB update).
 * Use when you have DATABASE_URL (e.g. Railway public Postgres URL), not the admin API.
 *
 *   cd vula24-backend && node scripts/approveLocksmithByEmail.js user@example.com
 *   DATABASE_URL=postgresql://... node scripts/approveLocksmithByEmail.js user@example.com
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const prisma = require('../lib/prisma');

const email = (process.argv[2] || '').trim().toLowerCase();

async function main() {
  if (!email) {
    console.error('Usage: node scripts/approveLocksmithByEmail.js <email>');
    process.exit(1);
  }

  const locksmith = await prisma.locksmith.findUnique({ where: { email } });
  if (!locksmith) {
    console.error('No locksmith found for email:', email);
    process.exit(1);
  }

  await prisma.locksmith.update({
    where: { id: locksmith.id },
    data: { isVerified: true },
  });

  console.log('Approved locksmith:', locksmith.id, email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
