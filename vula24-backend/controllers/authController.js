const bcrypt = require('bcrypt');
const prisma = require('../lib/prisma');
const { AppError } = require('../middleware/errorHandler');
const {
  requireJwtSecret,
  signCustomerToken,
  signLocksmithToken,
  signMemberToken,
} = require('../utils/jwt');
const { uploadLocksmithImage } = require('../lib/locksmithUploads');
const {
  sendOTP,
  generateOTP,
  normalizeSaPhone,
} = require('../utils/smsPortal');
const { audit, AuditAction } = require('../utils/auditLog');

function phoneLookupVariants(canonical) {
  if (!canonical || canonical.length < 11) return [];
  const local0 = `0${canonical.slice(2)}`;
  return [canonical, `+${canonical}`, local0];
}

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

async function sendPhoneOTP(req, res) {
  const { phone, userType } = req.body;

  if (!phone) throw new AppError('Phone is required', 400);

  const cid = process.env.SMSPORTAL_CLIENT_ID?.trim();
  const csec = process.env.SMSPORTAL_CLIENT_SECRET?.trim();
  if (!cid || !csec) {
    throw new AppError('SMS service is not configured', 503);
  }

  const canonical = normalizeSaPhone(phone);
  if (!canonical || canonical.length < 11) {
    throw new AppError('Invalid South African phone number', 400);
  }

  const otp = generateOTP();
  const expiry = new Date(Date.now() + 10 * 60 * 1000);

  const variants = phoneLookupVariants(canonical);

  if (userType === 'customer') {
    const existing = await prisma.customer.findFirst({
      where: { phone: { in: variants } },
    });
    if (existing) {
      await prisma.customer.update({
        where: { id: existing.id },
        data: { phoneOtp: otp, phoneOtpExpiry: expiry },
      });
    }
  } else if (userType === 'locksmith') {
    const existing = await prisma.locksmith.findFirst({
      where: { phone: { in: variants } },
    });
    if (existing) {
      await prisma.locksmith.update({
        where: { id: existing.id },
        data: { phoneOtp: otp, phoneOtpExpiry: expiry },
      });
    }
  } else {
    throw new AppError('Invalid userType', 400);
  }

  await prisma.otpVerification.upsert({
    where: { phone: canonical },
    create: { phone: canonical, otp, expiry, userType },
    update: { otp, expiry, userType, verified: false },
  });

  const sent = await sendOTP(phone, otp);
  if (!sent) {
    throw new AppError('Failed to send OTP. Please try again.', 500);
  }

  await audit(AuditAction.OTP_SENT, {
    entityType: 'OTP',
    actorType: 'SYSTEM',
    metadata: { phone },
    ipAddress: req.ip,
  });

  res.json({
    success: true,
    message: 'OTP sent to your phone number',
  });
}

async function verifyPhoneOTP(req, res) {
  const { phone, otp, userType } = req.body;

  if (!phone || !otp) {
    throw new AppError('Phone and OTP are required', 400);
  }

  const canonical = normalizeSaPhone(phone);
  if (!canonical || canonical.length < 11) {
    throw new AppError('Invalid South African phone number', 400);
  }

  const record = await prisma.otpVerification.findUnique({
    where: { phone: canonical },
  });

  if (!record) {
    throw new AppError('OTP not found. Please request a new one.', 404);
  }

  if (userType && record.userType !== userType) {
    throw new AppError('Verification does not match account type', 400);
  }

  if (new Date() > record.expiry) {
    throw new AppError('OTP has expired. Please request a new one.', 400);
  }

  if (record.otp !== String(otp).trim()) {
    throw new AppError('Invalid OTP. Please try again.', 400);
  }

  await prisma.otpVerification.update({
    where: { phone: canonical },
    data: { verified: true },
  });

  const variants = phoneLookupVariants(canonical);
  if (record.userType === 'customer') {
    const c = await prisma.customer.findFirst({
      where: { phone: { in: variants } },
    });
    if (c) {
      await prisma.customer.update({
        where: { id: c.id },
        data: {
          phoneVerified: true,
          phoneOtp: null,
          phoneOtpExpiry: null,
        },
      });
    }
  } else if (record.userType === 'locksmith') {
    const l = await prisma.locksmith.findFirst({
      where: { phone: { in: variants } },
    });
    if (l) {
      await prisma.locksmith.update({
        where: { id: l.id },
        data: {
          phoneVerified: true,
          phoneOtp: null,
          phoneOtpExpiry: null,
        },
      });
    }
  }

  await audit(AuditAction.OTP_VERIFIED, {
    entityType: 'OTP',
    actorType: 'SYSTEM',
    metadata: { phone },
    ipAddress: req.ip,
  });

  res.json({
    success: true,
    verified: true,
    message: 'Phone number verified successfully',
  });
}

async function registerCustomer(req, res) {
  requireJwtSecret();
  const { name, phone, email, password } = req.body;

  const existing = await prisma.customer.findFirst({
    where: { OR: [{ email }, { phone }] },
  });
  if (existing) {
    if (existing.isBanned) {
      if (existing.phone === phone) {
        throw new AppError(
          'This phone number has been suspended. Contact support@vula24.co.za',
          403
        );
      }
      throw new AppError(
        'Your account has been suspended. Contact support@vula24.co.za',
        403
      );
    }
    throw new AppError('Email or phone already registered', 409);
  }
  const hash = await bcrypt.hash(password, 12);

  const canonicalPhone = normalizeSaPhone(phone);
  const otpRecord =
    canonicalPhone.length >= 11
      ? await prisma.otpVerification.findUnique({
          where: { phone: canonicalPhone },
        })
      : null;
  const phoneVerified = otpRecord?.verified === true;

  const customer = await prisma.customer.create({
    data: {
      name,
      phone,
      email,
      password: hash,
      phoneVerified,
    },
  });
  const token = signCustomerToken(customer.id);

  await audit(AuditAction.CUSTOMER_REGISTER, {
    entityType: 'CUSTOMER',
    entityId: customer.id,
    actorType: 'CUSTOMER',
    actorId: customer.id,
    metadata: { phone: customer.phone, email: customer.email },
    ipAddress: req.ip,
  });

  res.status(201).json({ token, customer: stripCustomer(customer) });
}

async function loginCustomer(req, res) {
  requireJwtSecret();
  const { email, password } = req.body;
  const customer = await prisma.customer.findUnique({ where: { email } });
  if (!customer) throw new AppError('Invalid email or password', 401);
  if (customer.isBanned) {
    throw new AppError(
      'Your account has been suspended. Contact support@vula24.co.za',
      403
    );
  }
  const ok = await bcrypt.compare(password, customer.password);
  if (!ok) {
    await audit(AuditAction.LOGIN_FAILED, {
      entityType: 'CUSTOMER',
      actorType: 'UNKNOWN',
      metadata: { email: req.body.email },
      ipAddress: req.ip,
    });
    throw new AppError('Invalid email or password', 401);
  }
  const token = signCustomerToken(customer.id);

  await audit(AuditAction.CUSTOMER_LOGIN, {
    entityType: 'CUSTOMER',
    entityId: customer.id,
    actorType: 'CUSTOMER',
    actorId: customer.id,
    ipAddress: req.ip,
  });

  res.json({ token, customer: stripCustomer(customer) });
}

async function registerLocksmith(req, res) {
  requireJwtSecret();
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
    vehicleType,
    vehicleColor,
    vehiclePlateNumber,
  } = req.body;

  const files = req.files || {};
  let idPhotoUrl = bodyIdUrl || null;
  let selfiePhotoUrl = bodySelfieUrl || null;
  let proofOfAddressUrl = bodyProofUrl || null;

  if (files.idPhoto?.[0]) {
    idPhotoUrl = await uploadLocksmithImage(req, files.idPhoto[0]);
  }
  if (files.selfiePhoto?.[0]) {
    selfiePhotoUrl = await uploadLocksmithImage(req, files.selfiePhoto[0]);
  }
  if (files.proofOfAddress?.[0]) {
    proofOfAddressUrl = await uploadLocksmithImage(req, files.proofOfAddress[0]);
  }

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
  const walletMinimum = accountType === 'BUSINESS' ? 500 : 200;

  const canonicalPhone = normalizeSaPhone(phone);
  const otpRecord =
    canonicalPhone.length >= 11
      ? await prisma.otpVerification.findUnique({
          where: { phone: canonicalPhone },
        })
      : null;
  const phoneVerified = otpRecord?.verified === true;

  const locksmith = await prisma.$transaction(async (tx) => {
    const l = await tx.locksmith.create({
      data: {
        name,
        phone,
        email,
        password: hash,
        accountType,
        businessName: businessName || null,
        walletMinimum,
        phoneVerified,
        idPhotoUrl: idPhotoUrl || null,
        selfiePhotoUrl: selfiePhotoUrl || null,
        toolsPhotoUrl: toolsPhotoUrl || null,
        proofOfAddressUrl: proofOfAddressUrl || null,
        psiraNumber: psiraNumber?.trim() || null,
        bankName: bankName?.trim() || null,
        bankAccountNumber: bankAccountNumber?.trim() || null,
        bankAccountHolder: bankAccountHolder?.trim() || null,
        vehicleType: vehicleType?.trim() || null,
        vehicleColor: vehicleColor?.trim() || null,
        vehiclePlateNumber: vehiclePlateNumber?.trim() || null,
      },
    });
    await tx.wallet.create({
      data: {
        locksithId: l.id,
        balance: 0,
        minimumBalance: walletMinimum,
      },
    });
    return l;
  });

  const token = signLocksmithToken(locksmith.id);

  await audit(AuditAction.LOCKSMITH_REGISTER, {
    entityType: 'LOCKSMITH',
    entityId: locksmith.id,
    actorType: 'LOCKSMITH',
    actorId: locksmith.id,
    metadata: { phone: locksmith.phone, email: locksmith.email },
    ipAddress: req.ip,
  });

  res.status(201).json({ token, locksmith: stripLocksmith(locksmith) });
}

async function loginLocksmith(req, res) {
  requireJwtSecret();
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

async function updateCustomerPushToken(req, res) {
  const { pushToken } = req.body;
  if (pushToken != null && typeof pushToken !== 'string') {
    throw new AppError('Invalid pushToken', 400);
  }
  await prisma.customer.update({
    where: { id: req.customer.id },
    data: { pushToken: pushToken || null },
  });
  res.json({ success: true });
}

const customerProfileSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  phoneVerified: true,
  profilePhoto: true,
  createdAt: true,
};

async function getCustomerProfile(req, res) {
  const customer = await prisma.customer.findUnique({
    where: { id: req.customer.id },
    select: customerProfileSelect,
  });
  if (!customer) throw new AppError('Customer not found', 404);
  res.json({ customer });
}

async function updateCustomerProfile(req, res) {
  const { name, phone } = req.body;
  const data = {};
  if (name !== undefined) data.name = String(name).trim();
  if (phone !== undefined) data.phone = String(phone).trim();

  if (data.name !== undefined && data.name === '') {
    throw new AppError('Name cannot be empty', 400);
  }
  if (data.phone !== undefined && data.phone === '') {
    throw new AppError('Phone cannot be empty', 400);
  }

  if (data.phone !== undefined) {
    const taken = await prisma.customer.findFirst({
      where: {
        phone: data.phone,
        id: { not: req.customer.id },
      },
    });
    if (taken) throw new AppError('Phone already in use', 409);
  }

  if (Object.keys(data).length === 0) {
    const customer = await prisma.customer.findUnique({
      where: { id: req.customer.id },
      select: customerProfileSelect,
    });
    if (!customer) throw new AppError('Customer not found', 404);
    return res.json({ customer });
  }

  const customer = await prisma.customer.update({
    where: { id: req.customer.id },
    data,
    select: customerProfileSelect,
  });
  res.json({ customer });
}

async function uploadCustomerPhoto(req, res) {
  const file = req.file;
  if (!file?.buffer?.length) {
    throw new AppError('photo image file is required', 400);
  }
  const url = await uploadLocksmithImage(req, file);
  res.json({ url });
}

async function loginMember(req, res) {
  requireJwtSecret();
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
    businessName: member.business?.businessName || null,
  });
}

module.exports = {
  registerCustomer,
  loginCustomer,
  registerLocksmith,
  loginLocksmith,
  loginMember,
  sendPhoneOTP,
  verifyPhoneOTP,
  updateCustomerPushToken,
  getCustomerProfile,
  updateCustomerProfile,
  uploadCustomerPhoto,
};
