const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const emails = ['spmthembu12@gmail.com', 'locksmith@test.com'];
  for (const email of emails) {
    const locksmith = await prisma.locksmith.findUnique({
      where: { email },
      select: { id: true, name: true }
    });
    if (!locksmith) {
      console.log('Not found:', email);
      continue;
    }
    await prisma.locksmith.update({
      where: { id: locksmith.id },
      data: {
        isVerified: true,
        isSuspended: false,
        isOnline: false,
        walletMinimum: 0,
        currentLat: -34.2271,
        currentLng: 19.4180,
      }
    });
    await prisma.wallet.upsert({
      where: { locksithId: locksmith.id },
      create: {
        locksithId: locksmith.id,
        balance: 500,
        minimumBalance: 0,
      },
      update: {
        balance: 500,
        minimumBalance: 0,
      }
    });
    await prisma.servicePricing.deleteMany({
      where: { locksithId: locksmith.id }
    });
    await prisma.servicePricing.createMany({
      data: [
        'CAR_LOCKOUT','HOUSE_LOCKOUT','OFFICE_LOCKOUT',
        'KEY_DUPLICATION','CAR_KEY_PROGRAMMING',
        'CAR_KEY_CUTTING','BROKEN_KEY_EXTRACTION',
        'LOST_KEY_REPLACEMENT','IGNITION_REPAIR',
        'LOCK_REPLACEMENT','LOCK_REPAIR','LOCK_UPGRADE',
        'DEADLOCK_INSTALLATION','SAFE_OPENING',
        'GATE_MOTOR_REPAIR','ACCESS_CONTROL',
        'PADLOCK_REMOVAL','GARAGE_DOOR',
        'SECURITY_GATE','ELECTRIC_FENCE_GATE'
      ].map(st => ({
        locksithId: locksmith.id,
        serviceType: st,
        isOffered: true,
        basePrice: 350,
      }))
    });
    console.log('Updated:', locksmith.name);
  }
  console.log('Done — both accounts ready for testing');
  prisma.$disconnect();
}
main().catch(console.error);
