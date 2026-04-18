require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  const hashed = await bcrypt.hash('Test1234!', 10);

  const existing = await prisma.locksmith.findUnique({
    where: { email: 'locksmith@test.com' },
  });

  if (existing) {
    await prisma.locksmith.update({
      where: { id: existing.id },
      data: {
        isVerified: true,
        isOnline: true,
        isSuspended: false,
        currentLat: -26.2041,
        currentLng: 28.0473,
        password: hashed,
      },
    });
    console.log('Updated existing locksmith');
    console.log('ID:', existing.id);
  } else {
    const locksmith = await prisma.locksmith.create({
      data: {
        name: 'Test Locksmith',
        email: 'locksmith@test.com',
        password: hashed,
        phone: '0821234567',
        accountType: 'INDIVIDUAL',
        isVerified: true,
        isOnline: true,
        isSuspended: false,
        currentLat: -26.2041,
        currentLng: 28.0473,
        wallet: {
          create: { balance: 100 },
        },
        servicePricing: {
          create: [
            {
              serviceType: 'HOUSE_LOCKOUT',
              isOffered: true,
              basePrice: 350,
            },
            {
              serviceType: 'CAR_LOCKOUT',
              isOffered: true,
              basePrice: 350,
            },
            {
              serviceType: 'LOCK_REPAIR',
              isOffered: true,
              basePrice: 350,
            },
            {
              serviceType: 'LOCK_REPLACEMENT',
              isOffered: true,
              basePrice: 350,
            },
            {
              serviceType: 'KEY_DUPLICATION',
              isOffered: true,
              basePrice: 350,
            },
          ],
        },
      },
    });
    console.log('Created locksmith ID:', locksmith.id);
  }

  console.log('--- LOGIN CREDENTIALS ---');
  console.log('Email: locksmith@test.com');
  console.log('Password: Test1234!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
