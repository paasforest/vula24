const bcrypt = require('bcrypt');
const prisma = require('../lib/prisma');
const { AppError } = require('../middleware/errorHandler');
const {
  signCustomerToken,
  signLocksmithToken,
  signMemberToken,
} = require('../utils/jwt');

function stripCustomer(c) {
  if (!c) return c;
  const { password, ...rest } = c;
  return rest;
}

function stripLocksmith(l) {
  if (!l) return l;
  const { password, ...rest } = l;
  return rest;
}

async function registerCustomer(req, res) {
  const { name, phone, email, password } = req.body;
  const existing = await prisma.customer.findFirst({
    where: { OR: [{ email }, { phone }] },
  });
  if (existing) {
    throw new AppError('Email or phone already registered', 409);
  }
  const hash = await bcrypt.hash(password, 12);
  const customer = await prisma.customer.create({
    data: { name, phone, email, password: hash },
  });
  const token = signCustomerToken(customer.id);
  res.status(201).json({ token, customer: stripCustomer(customer) });
}

async function loginCustomer(req, res) {
  const { email, password } = req.body;
  const customer = await prisma.customer.findUnique({ where: { email } });
  if (!customer) throw new AppError('Invalid email or password', 401);
  const ok = await bcrypt.compare(password, customer.password);
  if (!ok) throw new AppError('Invalid email or password', 401);
  const token = signCustomerToken(customer.id);
  res.json({ token, customer: stripCustomer(customer) });
}

function publicLocksmithFileUrl(req, filename) {
  let base;
  if (process.env.APP_URL) {
    base = process.env.APP_URL.replace(/\/$/, '');
  } else {
    const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
    const host =
      req.get('host') || `localhost:${process.env.PORT || 3000}`;
    base = `${proto}://${host}`;
  }
  return `${base}/uploads/locksmith/${filename}`;
}

async function registerLocksmith(req, res) {
  const {
    name,
    phone,
    email,
    password,
    accountType,
    businessName,
    idPhotoUrl: bodyIdUrl,
    selfiePhotoUrl: bodySelfieUrl,
    toolsPhotoUrl,
    proofOfAddressUrl: bodyProofUrl,
    psiraNumber,
    bankName,
    bankAccountNumber,
    bankAccountHolder,
  } = req.body;

  const files = req.files || {};
  const idPhotoUrl = files.idPhoto?.[0]
    ? publicLocksmithFileUrl(req, files.idPhoto[0].filename)
    : bodyIdUrl || null;
  const selfiePhotoUrl = files.selfiePhoto?.[0]
    ? publicLocksmithFileUrl(req, files.selfiePhoto[0].filename)
    : bodySelfieUrl || null;
  const proofOfAddressUrl = files.proofOfAddress?.[0]
    ? publicLocksmithFileUrl(req, files.proofOfAddress[0].filename)
    : bodyProofUrl || null;

  if (accountType === 'BUSINESS' && !businessName?.trim()) {
    throw new AppError('businessName is required for BUSINESS accounts', 400);
  }

  const existing = await prisma.locksmith.findFirst({
    where: { OR: [{ email }, { phone }] },
  });
  if (existing) {
    throw new AppError('Email or phone already registered', 409);
  }

  const hash = await bcrypt.hash(password, 12);
  const locksmith = await prisma.$transaction(async (tx) => {
    const l = await tx.locksmith.create({
      data: {
        name,
        phone,
        email,
        password: hash,
        accountType,
        businessName: businessName || null,
        idPhotoUrl: idPhotoUrl || null,
        selfiePhotoUrl: selfiePhotoUrl || null,
        toolsPhotoUrl: toolsPhotoUrl || null,
        proofOfAddressUrl: proofOfAddressUrl || null,
        psiraNumber: psiraNumber?.trim() || null,
        bankName: bankName?.trim() || null,
        bankAccountNumber: bankAccountNumber?.trim() || null,
        bankAccountHolder: bankAccountHolder?.trim() || null,
      },
    });
    await tx.wallet.create({
      data: { locksithId: l.id, balance: 0 },
    });
    return l;
  });

  const token = signLocksmithToken(locksmith.id);
  res.status(201).json({ token, locksmith: stripLocksmith(locksmith) });
}

async function loginLocksmith(req, res) {
  const { email, password } = req.body;
  const locksmith = await prisma.locksmith.findUnique({ where: { email } });
  if (!locksmith) throw new AppError('Invalid email or password', 401);
  if (locksmith.isSuspended) {
    throw new AppError('Your account is suspended', 403);
  }
  const ok = await bcrypt.compare(password, locksmith.password);
  if (!ok) throw new AppError('Invalid email or password', 401);
  const token = signLocksmithToken(locksmith.id);
  res.json({ token, locksmith: stripLocksmith(locksmith) });
}

async function loginMember(req, res) {
  const { appEmail, appPassword } = req.body;
  const member = await prisma.teamMember.findUnique({
    where: { appEmail },
    include: { business: true },
  });
  if (!member || !member.isActive) {
    throw new AppError('Invalid credentials', 401);
  }
  const ok = await bcrypt.compare(appPassword, member.appPassword);
  if (!ok) throw new AppError('Invalid credentials', 401);
  const token = signMemberToken(member.id, member.businessId);
  res.json({
    token,
    memberId: member.id,
    businessId: member.businessId,
    name: member.name,
  });
}

module.exports = {
  registerCustomer,
  loginCustomer,
  registerLocksmith,
  loginLocksmith,
  loginMember,
};
