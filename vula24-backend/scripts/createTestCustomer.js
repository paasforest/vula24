/**
 * Creates one demo customer for the Vula24 customer app — INSERT only.
 * Does not update, delete, or modify any existing customer rows.
 *
 * Run from vula24-backend: npm run setup:test-customer
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

/** Dedicated demo account — must not overlap emails/phones you use elsewhere */
const DEMO_EMAIL = 'vula24.demo.customer@test.com';
const DEMO_PHONE = '0827701001';
const DEMO_PASSWORD = 'Test1234!';
const DEMO_NAME = 'Vula24 Demo Customer';

async function main() {
  const byEmail = await prisma.customer.findUnique({
    where: { email: DEMO_EMAIL },
  });
  if (byEmail) {
    console.log('Demo customer already exists — left unchanged (no updates).');
    console.log('ID:', byEmail.id);
    console.log('--- CUSTOMER APP LOGIN ---');
    console.log('Email:', DEMO_EMAIL);
    console.log('Password: (the one set when this row was first created; try', DEMO_PASSWORD, 'if you used this script)');
    return;
  }

  const byPhone = await prisma.customer.findUnique({
    where: { phone: DEMO_PHONE },
  });
  if (byPhone) {
    console.error(
      'Phone',
      DEMO_PHONE,
      'is already used by another customer (email:',
      byPhone.email,
      '). Change DEMO_PHONE in scripts/createTestCustomer.js and run again.'
    );
    process.exitCode = 1;
    return;
  }

  const hashed = await bcrypt.hash(DEMO_PASSWORD, 12);
  const customer = await prisma.customer.create({
    data: {
      name: DEMO_NAME,
      email: DEMO_EMAIL,
      phone: DEMO_PHONE,
      password: hashed,
    },
  });
  console.log('Created new demo customer — existing accounts were not touched.');
  console.log('ID:', customer.id);
  console.log('--- CUSTOMER APP LOGIN ---');
  console.log('Email:', DEMO_EMAIL);
  console.log('Password:', DEMO_PASSWORD);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
