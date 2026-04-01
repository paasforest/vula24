const prisma = require('../lib/prisma');
const { AppError } = require('../middleware/errorHandler');
const {
  calculateJobPrice,
  calculateDistance,
} = require('../utils/pricing');
const {
  findLocksmithsByDistance,
  getNearestLocksmith,
} = require('../utils/locksmithSearch');
const bcrypt = require('bcrypt');

const SERVICE_TYPES = [
  'CAR_LOCKOUT',
  'HOUSE_LOCKOUT',
  'KEY_DUPLICATION',
  'LOCK_REPLACEMENT',
  'LOCK_REPAIR',
];

function stripLocksmithPublic(l) {
  if (!l) return null;
  const {
    password,
    bankName,
    bankAccountNumber,
    bankAccountHolder,
    ...rest
  } = l;
  return rest;
}

async function createEmergencyJob(req, res) {
  const customerId = req.customer.id;
  const {
    serviceType,
    customerLat,
    customerLng,
    customerAddress,
    customerNote,
  } = req.body;

  const nearest = await getNearestLocksmith({
    customerLat,
    customerLng,
    serviceType,
  });

  if (!nearest) {
    throw new AppError(
      'No verified online locksmiths offering this service within 20km',
      404
    );
  }

  const { locksmith, distanceKm, basePrice: locksithBasePrice } = nearest;
  const pricing = calculateJobPrice(locksithBasePrice, distanceKm);

  const job = await prisma.job.create({
    data: {
      customerId,
      locksithId: locksmith.id,
      serviceType,
      mode: 'EMERGENCY',
      status: 'PENDING',
      customerLat,
      customerLng,
      customerAddress,
      customerNote: customerNote || null,
      locksithBasePrice,
      travelFee: pricing.travelFee,
      platformFee: pricing.platformFee,
      totalPrice: pricing.totalPrice,
      locksithEarning: pricing.locksithEarning,
    },
    include: {
      locksmith: true,
    },
  });

  res.status(201).json({
    job: {
      ...job,
      locksmith: stripLocksmithPublic(job.locksmith),
    },
    distanceKm,
    pricing,
  });
}

async function acceptJob(req, res) {
  const jobId = req.params.id;
  const locksmithId = req.locksmith.id;

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new AppError('Job not found', 404);
  if (job.locksithId !== locksmithId) {
    throw new AppError('This job is not assigned to you', 403);
  }
  if (job.status !== 'PENDING') {
    throw new AppError('Job cannot be accepted in its current state', 400);
  }

  const updated = await prisma.job.update({
    where: { id: jobId },
    data: { status: 'ACCEPTED', acceptedAt: new Date() },
  });
  res.json({ job: updated });
}

async function arrivedJob(req, res) {
  const jobId = req.params.id;
  const locksmithId = req.locksmith.id;

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new AppError('Job not found', 404);
  if (job.locksithId !== locksmithId) {
    throw new AppError('This job is not assigned to you', 403);
  }
  if (job.status !== 'ACCEPTED') {
    throw new AppError('Job must be accepted before marking arrived', 400);
  }

  const updated = await prisma.job.update({
    where: { id: jobId },
    data: { status: 'ARRIVED' },
  });
  res.json({ job: updated });
}

async function startJob(req, res) {
  const jobId = req.params.id;
  const locksmithId = req.locksmith.id;

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new AppError('Job not found', 404);
  if (job.locksithId !== locksmithId) {
    throw new AppError('This job is not assigned to you', 403);
  }
  if (job.status !== 'ARRIVED') {
    throw new AppError('Job must be marked arrived before starting work', 400);
  }

  const updated = await prisma.job.update({
    where: { id: jobId },
    data: { status: 'IN_PROGRESS' },
  });
  res.json({ job: updated });
}

async function completeJob(req, res) {
  const jobId = req.params.id;
  const locksmithId = req.locksmith.id;

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new AppError('Job not found', 404);
  if (job.locksithId !== locksmithId) {
    throw new AppError('This job is not assigned to you', 403);
  }
  if (job.status !== 'IN_PROGRESS') {
    throw new AppError('Job must be in progress to complete', 400);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const j = await tx.job.update({
      where: { id: jobId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
    await tx.locksmith.update({
      where: { id: locksmithId },
      data: { totalJobs: { increment: 1 } },
    });
    return j;
  });

  res.json({ job: updated });
}

async function cancelJob(req, res) {
  const job = req.job;
  const role = req.jobParticipantRole;

  if (job.status === 'COMPLETED' || job.status === 'CANCELLED') {
    throw new AppError('Job cannot be cancelled', 400);
  }

  if (role === 'customer') {
    const updated = await prisma.job.update({
      where: { id: job.id },
      data: { status: 'CANCELLED' },
    });
    return res.json({ job: updated, reassigned: false });
  }

  if (role === 'locksmith') {
    const shouldReassign =
      job.mode === 'EMERGENCY' &&
      job.status === 'ACCEPTED' &&
      job.locksithId === req.locksmith.id;

    if (!shouldReassign) {
      const updated = await prisma.job.update({
        where: { id: job.id },
        data: { status: 'CANCELLED' },
      });
      return res.json({ job: updated, reassigned: false });
    }

    const next = await getNearestLocksmith({
      customerLat: job.customerLat,
      customerLng: job.customerLng,
      serviceType: job.serviceType,
      excludeLocksmithId: req.locksmith.id,
    });

    if (!next) {
      const updated = await prisma.job.update({
        where: { id: job.id },
        data: { status: 'CANCELLED', locksithId: null, acceptedAt: null },
      });
      return res.json({
        job: updated,
        reassigned: false,
        message: 'No alternative locksmith found; job cancelled',
      });
    }

    const pricing = calculateJobPrice(next.basePrice, next.distanceKm);
    const updated = await prisma.job.update({
      where: { id: job.id },
      data: {
        status: 'PENDING',
        locksithId: next.locksmith.id,
        acceptedAt: null,
        locksithBasePrice: next.basePrice,
        travelFee: pricing.travelFee,
        platformFee: pricing.platformFee,
        totalPrice: pricing.totalPrice,
        locksithEarning: pricing.locksithEarning,
      },
      include: { locksmith: true },
    });

    return res.json({
      job: {
        ...updated,
        locksmith: stripLocksmithPublic(updated.locksmith),
      },
      reassigned: true,
      distanceKm: next.distanceKm,
      pricing,
    });
  }
}

async function createScheduledJob(req, res) {
  const customerId = req.customer.id;
  const {
    serviceType,
    description,
    jobPhotoUrl,
    scheduledDate,
    customerLat,
    customerLng,
    customerAddress,
  } = req.body;

  const scheduled = new Date(scheduledDate);
  if (Number.isNaN(scheduled.getTime())) {
    throw new AppError('Invalid scheduledDate', 400);
  }

  const eligible = await findLocksmithsByDistance({
    customerLat,
    customerLng,
    serviceType,
    maxKm: 20,
  });

  const job = await prisma.job.create({
    data: {
      customerId,
      serviceType,
      mode: 'SCHEDULED',
      status: 'PENDING',
      customerLat,
      customerLng,
      customerAddress,
      customerNote: description || null,
      jobPhotoUrl: jobPhotoUrl || null,
      scheduledDate: scheduled,
      locksithBasePrice: 0,
      travelFee: 0,
      platformFee: 0,
      totalPrice: 0,
      locksithEarning: 0,
    },
  });

  res.status(201).json({
    jobId: job.id,
    locksmithsNotified: eligible.length,
  });
}

async function submitQuote(req, res) {
  const jobId = req.params.id;
  const locksmithId = req.locksmith.id;
  const { price, message } = req.body;

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new AppError('Job not found', 404);
  if (job.mode !== 'SCHEDULED') {
    throw new AppError('Quotes are only for scheduled jobs', 400);
  }
  if (job.status !== 'PENDING' || job.locksithId) {
    throw new AppError('Job is not open for quotes', 400);
  }

  const inZone = await findLocksmithsByDistance({
    customerLat: job.customerLat,
    customerLng: job.customerLng,
    serviceType: job.serviceType,
    maxKm: 20,
  });
  const allowed = inZone.some((x) => x.locksmith.id === locksmithId);
  if (!allowed) {
    throw new AppError('You are not in range for this job', 403);
  }

  try {
    const quote = await prisma.quote.create({
      data: {
        jobId,
        locksithId: locksmithId,
        price,
        message: message || null,
      },
    });
    res.status(201).json({ quote });
  } catch (e) {
    if (e.code === 'P2002') {
      throw new AppError('You already submitted a quote for this job', 409);
    }
    throw e;
  }
}

async function listQuotes(req, res) {
  const jobId = req.params.id;
  const customerId = req.customer.id;

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new AppError('Job not found', 404);
  if (job.customerId !== customerId) {
    throw new AppError('Forbidden', 403);
  }

  const quotes = await prisma.quote.findMany({
    where: { jobId, status: 'PENDING' },
    include: {
      locksmith: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          rating: true,
          businessName: true,
          accountType: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  res.json({ quotes });
}

async function acceptQuote(req, res) {
  const { id: jobId, quoteId } = req.params;
  const customerId = req.customer.id;

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new AppError('Job not found', 404);
  if (job.customerId !== customerId) throw new AppError('Forbidden', 403);

  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, jobId, status: 'PENDING' },
    include: { locksmith: true },
  });
  if (!quote) throw new AppError('Quote not found', 404);

  const locksmith = quote.locksmith;
  if (!locksmith.currentLat || !locksmith.currentLng) {
    throw new AppError(
      'Locksmith has not set location; cannot calculate pricing',
      400
    );
  }

  const distanceKm = calculateDistance(
    job.customerLat,
    job.customerLng,
    locksmith.currentLat,
    locksmith.currentLng
  );
  if (distanceKm > 20) {
    throw new AppError('Locksmith is currently out of range', 400);
  }

  const locksithBasePrice = quote.price;
  const pricing = calculateJobPrice(locksithBasePrice, distanceKm);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.quote.update({
      where: { id: quoteId },
      data: { status: 'ACCEPTED' },
    });
    await tx.quote.updateMany({
      where: { jobId, id: { not: quoteId } },
      data: { status: 'REJECTED' },
    });
    return tx.job.update({
      where: { id: jobId },
      data: {
        locksithId: quote.locksithId,
        locksithBasePrice,
        travelFee: pricing.travelFee,
        platformFee: pricing.platformFee,
        totalPrice: pricing.totalPrice,
        locksithEarning: pricing.locksithEarning,
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      },
      include: { locksmith: true },
    });
  });

  res.json({
    job: {
      ...updated,
      locksmith: stripLocksmithPublic(updated.locksmith),
    },
    distanceKm,
    pricing,
  });
}

async function updateLocksmithLocation(req, res) {
  const { lat, lng } = req.body;
  await prisma.locksmith.update({
    where: { id: req.locksmith.id },
    data: { currentLat: lat, currentLng: lng },
  });
  res.json({ success: true, currentLat: lat, currentLng: lng });
}

async function getLocksmithLocationForJob(req, res) {
  const jobId = req.params.id;
  const customerId = req.customer.id;

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      locksmith: {
        select: { currentLat: true, currentLng: true, id: true, name: true },
      },
    },
  });
  if (!job) throw new AppError('Job not found', 404);
  if (job.customerId !== customerId) throw new AppError('Forbidden', 403);
  if (!job.locksithId || !job.locksmith) {
    throw new AppError('No locksmith assigned to this job', 404);
  }

  res.json({
    locksmithId: job.locksmith.id,
    name: job.locksmith.name,
    currentLat: job.locksmith.currentLat,
    currentLng: job.locksmith.currentLng,
  });
}

async function getJobById(req, res) {
  const jobId = req.params.id;
  const customerId = req.customer.id;

  const job = await prisma.job.findFirst({
    where: { id: jobId, customerId },
    include: {
      locksmith: {
        select: {
          id: true,
          name: true,
          phone: true,
          rating: true,
          businessName: true,
          accountType: true,
          currentLat: true,
          currentLng: true,
          idPhotoUrl: true,
          selfiePhotoUrl: true,
        },
      },
      teamMember: {
        select: {
          id: true,
          name: true,
          phone: true,
        },
      },
    },
  });
  if (!job) throw new AppError('Job not found', 404);
  res.json({ job });
}

async function listCustomerJobs(req, res) {
  const jobs = await prisma.job.findMany({
    where: { customerId: req.customer.id },
    orderBy: { createdAt: 'desc' },
    include: {
      locksmith: {
        select: {
          id: true,
          name: true,
          phone: true,
          rating: true,
          businessName: true,
        },
      },
    },
  });
  res.json({ jobs });
}

async function listLocksmithJobs(req, res) {
  const jobs = await prisma.job.findMany({
    where: { locksithId: req.locksmith.id },
    orderBy: { createdAt: 'desc' },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
        },
      },
    },
  });
  res.json({ jobs });
}

async function getLocksmithJobById(req, res) {
  const jobId = req.params.id;
  const locksmithId = req.locksmith.id;
  const job = await prisma.job.findFirst({
    where: { id: jobId, locksithId: locksmithId },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
        },
      },
    },
  });
  if (!job) throw new AppError('Job not found', 404);
  res.json({ job });
}

async function listOpenScheduledJobsForLocksmith(req, res) {
  const locksmith = req.locksmith;
  if (!locksmith.currentLat || !locksmith.currentLng) {
    return res.json({ jobs: [] });
  }
  const open = await prisma.job.findMany({
    where: {
      mode: 'SCHEDULED',
      status: 'PENDING',
      locksithId: null,
    },
    orderBy: { createdAt: 'desc' },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          phone: true,
        },
      },
    },
  });
  const eligible = open.filter((job) => {
    const km = calculateDistance(
      job.customerLat,
      job.customerLng,
      locksmith.currentLat,
      locksmith.currentLng
    );
    return km <= 20;
  });
  res.json({ jobs: eligible });
}

async function getLocksmithProfile(req, res) {
  const l = await prisma.locksmith.findUnique({
    where: { id: req.locksmith.id },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      accountType: true,
      businessName: true,
      psiraNumber: true,
      psiraVerified: true,
      isVerified: true,
      isSuspended: true,
      isOnline: true,
      rating: true,
      totalJobs: true,
      idPhotoUrl: true,
      selfiePhotoUrl: true,
      proofOfAddressUrl: true,
      toolsPhotoUrl: true,
      bankName: true,
      bankAccountNumber: true,
      bankAccountHolder: true,
      createdAt: true,
    },
  });
  if (!l) throw new AppError('Locksmith not found', 404);
  res.json({ locksmith: l });
}

function requireBusinessAccount(locksmith) {
  if (locksmith.accountType !== 'BUSINESS') {
    throw new AppError('This action is only available for business accounts', 403);
  }
}

async function getServicePricing(req, res) {
  const locksithId = req.locksmith.id;
  const rows = await prisma.servicePricing.findMany({
    where: { locksithId },
    orderBy: { serviceType: 'asc' },
  });
  const byType = Object.fromEntries(rows.map((r) => [r.serviceType, r]));
  const pricing = SERVICE_TYPES.map((serviceType) => {
    if (byType[serviceType]) return byType[serviceType];
    return { serviceType, basePrice: 0, isOffered: false };
  });
  res.json({ pricing });
}

async function upsertServicePricing(req, res) {
  const locksithId = req.locksmith.id;
  const items = req.body;
  await prisma.$transaction(
    items.map((item) =>
      prisma.servicePricing.upsert({
        where: {
          locksithId_serviceType: {
            locksithId,
            serviceType: item.serviceType,
          },
        },
        create: {
          locksithId,
          serviceType: item.serviceType,
          basePrice: item.basePrice,
          isOffered: item.isOffered,
        },
        update: {
          basePrice: item.basePrice,
          isOffered: item.isOffered,
        },
      })
    )
  );
  const pricing = await prisma.servicePricing.findMany({
    where: { locksithId },
    orderBy: { serviceType: 'asc' },
  });
  res.json({ pricing });
}

async function listMemberAvailableJobs(req, res) {
  const businessId = req.member.businessId;
  const jobs = await prisma.job.findMany({
    where: {
      locksithId: businessId,
      status: 'PENDING',
      teamMemberId: null,
    },
    orderBy: { createdAt: 'desc' },
    include: {
      customer: {
        select: { id: true, name: true, phone: true },
      },
    },
  });
  res.json({ jobs });
}

async function memberAcceptJob(req, res) {
  const jobId = req.params.id;
  const memberId = req.member.id;
  const businessId = req.member.businessId;

  const updated = await prisma.$transaction(async (tx) => {
    const job = await tx.job.findUnique({ where: { id: jobId } });
    if (!job) throw new AppError('Job not found', 404);
    if (job.locksithId !== businessId) {
      throw new AppError('This job is not assigned to your business', 403);
    }
    if (job.status !== 'PENDING' || job.teamMemberId) {
      throw new AppError('Job is not available to accept', 400);
    }
    return tx.job.update({
      where: { id: jobId },
      data: {
        teamMemberId: memberId,
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      },
    });
  });

  res.json({ job: updated });
}

async function memberArrivedJob(req, res) {
  const jobId = req.params.id;
  const memberId = req.member.id;
  const businessId = req.member.businessId;

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new AppError('Job not found', 404);
  if (job.locksithId !== businessId || job.teamMemberId !== memberId) {
    throw new AppError('This job is not assigned to you', 403);
  }
  if (job.status !== 'ACCEPTED') {
    throw new AppError('Job must be accepted before marking arrived', 400);
  }

  const updated = await prisma.job.update({
    where: { id: jobId },
    data: { status: 'ARRIVED' },
  });
  res.json({ job: updated });
}

async function memberStartJob(req, res) {
  const jobId = req.params.id;
  const memberId = req.member.id;
  const businessId = req.member.businessId;

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new AppError('Job not found', 404);
  if (job.locksithId !== businessId || job.teamMemberId !== memberId) {
    throw new AppError('This job is not assigned to you', 403);
  }
  if (job.status !== 'ARRIVED') {
    throw new AppError('Job must be marked arrived before starting work', 400);
  }

  const updated = await prisma.job.update({
    where: { id: jobId },
    data: { status: 'IN_PROGRESS' },
  });
  res.json({ job: updated });
}

async function memberCompleteJob(req, res) {
  const jobId = req.params.id;
  const memberId = req.member.id;
  const businessId = req.member.businessId;

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new AppError('Job not found', 404);
  if (job.locksithId !== businessId || job.teamMemberId !== memberId) {
    throw new AppError('This job is not assigned to you', 403);
  }
  if (job.status !== 'IN_PROGRESS') {
    throw new AppError('Job must be in progress to complete', 400);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const j = await tx.job.update({
      where: { id: jobId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
    await tx.locksmith.update({
      where: { id: businessId },
      data: { totalJobs: { increment: 1 } },
    });
    return j;
  });

  res.json({ job: updated });
}

async function listMemberCompletedJobs(req, res) {
  const memberId = req.member.id;
  const jobs = await prisma.job.findMany({
    where: { teamMemberId: memberId, status: 'COMPLETED' },
    orderBy: { completedAt: 'desc' },
    include: {
      customer: {
        select: { id: true, name: true, phone: true },
      },
    },
  });
  res.json({ jobs });
}

async function updateLocksmithProfile(req, res) {
  const id = req.locksmith.id;
  const allowed = [
    'bankName',
    'bankAccountNumber',
    'bankAccountHolder',
    'psiraNumber',
    'idPhotoUrl',
    'selfiePhotoUrl',
    'toolsPhotoUrl',
    'proofOfAddressUrl',
  ];
  const data = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) data[key] = req.body[key];
  }
  if (Object.keys(data).length === 0) {
    throw new AppError('No valid fields to update', 400);
  }

  const updated = await prisma.locksmith.update({
    where: { id },
    data,
  });
  const { password, ...profile } = updated;
  res.json({ locksmith: profile });
}

async function toggleLocksmithOnline(req, res) {
  const id = req.locksmith.id;
  const current = await prisma.locksmith.findUnique({
    where: { id },
    select: { isOnline: true },
  });
  if (!current) throw new AppError('Locksmith not found', 404);
  const nextOnline = !current.isOnline;
  await prisma.locksmith.update({
    where: { id },
    data: { isOnline: nextOnline },
  });
  res.json({ isOnline: nextOnline });
}

async function addTeamMember(req, res) {
  const locksmith = req.locksmith;
  requireBusinessAccount(locksmith);

  const { name, phone, appEmail, appPassword } = req.body;
  const existing = await prisma.teamMember.findFirst({
    where: { OR: [{ appEmail }, { phone }] },
  });
  if (existing) {
    throw new AppError('Team member email or phone already in use', 409);
  }

  const hash = await bcrypt.hash(appPassword, 12);
  const member = await prisma.teamMember.create({
    data: {
      businessId: locksmith.id,
      name,
      phone,
      appEmail,
      appPassword: hash,
    },
    select: {
      id: true,
      businessId: true,
      name: true,
      phone: true,
      appEmail: true,
      idPhotoUrl: true,
      isActive: true,
      createdAt: true,
    },
  });

  res.status(201).json({ member });
}

async function listTeamMembers(req, res) {
  const locksmith = req.locksmith;
  requireBusinessAccount(locksmith);

  const members = await prisma.teamMember.findMany({
    where: { businessId: locksmith.id },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      phone: true,
      appEmail: true,
      idPhotoUrl: true,
      isActive: true,
      createdAt: true,
    },
  });
  res.json({ members });
}

async function deactivateTeamMember(req, res) {
  const locksmith = req.locksmith;
  requireBusinessAccount(locksmith);
  const { memberId } = req.params;

  const member = await prisma.teamMember.findFirst({
    where: { id: memberId, businessId: locksmith.id },
  });
  if (!member) throw new AppError('Team member not found', 404);

  const updated = await prisma.teamMember.update({
    where: { id: memberId },
    data: { isActive: false },
    select: {
      id: true,
      name: true,
      phone: true,
      appEmail: true,
      idPhotoUrl: true,
      isActive: true,
      createdAt: true,
    },
  });
  res.json({ member: updated });
}

module.exports = {
  createEmergencyJob,
  getJobById,
  getLocksmithJobById,
  listOpenScheduledJobsForLocksmith,
  getLocksmithProfile,
  acceptJob,
  arrivedJob,
  startJob,
  completeJob,
  cancelJob,
  createScheduledJob,
  submitQuote,
  listQuotes,
  acceptQuote,
  updateLocksmithLocation,
  getLocksmithLocationForJob,
  listCustomerJobs,
  listLocksmithJobs,
  getServicePricing,
  upsertServicePricing,
  listMemberAvailableJobs,
  memberAcceptJob,
  memberArrivedJob,
  memberStartJob,
  memberCompleteJob,
  listMemberCompletedJobs,
  updateLocksmithProfile,
  toggleLocksmithOnline,
  addTeamMember,
  listTeamMembers,
  deactivateTeamMember,
};
