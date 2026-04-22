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
const { sendPushNotification } = require('../utils/pushNotifications');
const { uploadLocksmithImage } = require('../lib/locksmithUploads');
const { SERVICE_TYPES } = require('../constants/serviceTypes');

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

async function getNearbyLocksmiths(req, res) {
  const lat = parseFloat(req.query.lat, 10);
  const lng = parseFloat(req.query.lng, 10);
  const rawType = req.query.serviceType;

  const typesToSearch =
    rawType !== undefined && rawType !== null && String(rawType).trim() !== ''
      ? [String(rawType)]
      : SERVICE_TYPES;

  const byId = new Map();

  for (const st of typesToSearch) {
    const list = await findLocksmithsByDistance({
      customerLat: lat,
      customerLng: lng,
      serviceType: st,
      maxKm: 20,
    });
    for (const row of list) {
      const id = row.locksmith.id;
      const prev = byId.get(id);
      if (!prev || row.distanceKm < prev) {
        byId.set(id, row.distanceKm);
      }
    }
  }

  const ids = [...byId.keys()];
  if (ids.length === 0) {
    return res.json({ locksmiths: [] });
  }

  const rows = await prisma.locksmith.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      currentLat: true,
      currentLng: true,
      servicePricing: {
        where: { isOffered: true, basePrice: { gt: 0 } },
        select: { serviceType: true },
      },
    },
  });

  const locksmiths = rows
    .map((lm) => ({
      id: lm.id,
      distanceKm: byId.get(lm.id),
      currentLat: lm.currentLat,
      currentLng: lm.currentLng,
      serviceTypes: lm.servicePricing.map((p) => p.serviceType),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);

  res.json({ locksmiths });
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
  const pricing = calculateJobPrice(locksithBasePrice);

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

  const svcLabel = String(serviceType).replace(/_/g, ' ');
  const msgDb = `New ${svcLabel} job — ${customerAddress}`;
  const msgPush = `New ${svcLabel} — ${customerAddress}`;
  await prisma.notification.create({
    data: {
      recipientId: locksmith.id,
      recipientType: 'LOCKSMITH',
      title: 'New job nearby',
      message: msgDb,
    },
  });
  sendPushNotification(
    locksmith.pushToken,
    'New job nearby',
    msgPush,
    { jobId: String(job.id) }
  );

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

  const customer = await prisma.customer.findUnique({
    where: { id: job.customerId },
    select: { pushToken: true },
  });
  await prisma.notification.create({
    data: {
      recipientId: job.customerId,
      recipientType: 'CUSTOMER',
      title: 'Locksmith found',
      message:
        'A locksmith has accepted your job. Please complete payment to confirm.',
    },
  });
  sendPushNotification(
    customer?.pushToken,
    'Locksmith found',
    'A locksmith accepted your job. Complete payment to confirm.',
    { jobId: String(jobId) }
  );

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
  if (job.mode === 'EMERGENCY') {
    if (job.status !== 'DISPATCHED') {
      throw new AppError(
        'Wait for customer payment before marking arrived.',
        400
      );
    }
  } else if (job.status !== 'ACCEPTED') {
    throw new AppError('Job must be accepted before marking arrived', 400);
  }

  const updated = await prisma.job.update({
    where: { id: jobId },
    data: { status: 'ARRIVED' },
  });

  const customer = await prisma.customer.findUnique({
    where: { id: job.customerId },
    select: { pushToken: true },
  });
  await prisma.notification.create({
    data: {
      recipientId: job.customerId,
      recipientType: 'CUSTOMER',
      title: 'Locksmith arrived',
      message: 'Your locksmith has arrived at your location.',
    },
  });
  sendPushNotification(
    customer?.pushToken,
    'Locksmith arrived',
    'Your locksmith has arrived at your location.',
    { jobId: String(jobId) }
  );

  res.json({ job: updated });
}

async function dispatchJob(req, res) {
  const jobId = req.params.id;
  const customerId = req.customer.id;

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new AppError('Job not found', 404);
  if (job.customerId !== customerId) throw new AppError('Forbidden', 403);
  if (job.mode !== 'EMERGENCY') {
    throw new AppError(
      'Only emergency jobs use this dispatch step.',
      400
    );
  }
  if (job.status !== 'ACCEPTED') {
    throw new AppError('Job must be accepted before dispatch.', 400);
  }
  if (!job.depositPaid) {
    throw new AppError('Payment is required before dispatch.', 400);
  }

  const updated = await prisma.job.update({
    where: { id: jobId },
    data: { status: 'DISPATCHED' },
  });

  const customer = await prisma.customer.findUnique({
    where: { id: job.customerId },
    select: { pushToken: true },
  });

  if (job.locksithId) {
    const ls = await prisma.locksmith.findUnique({
      where: { id: job.locksithId },
      select: { pushToken: true },
    });
    await prisma.notification.create({
      data: {
        recipientId: job.locksithId,
        recipientType: 'LOCKSMITH',
        title: 'Customer has paid',
        message: 'Customer has paid — head to them now',
      },
    });
    sendPushNotification(
      ls?.pushToken,
      'Customer has paid',
      'Customer has paid — head to them now',
      { jobId: String(jobId) }
    );
  }

  await prisma.notification.create({
    data: {
      recipientId: job.customerId,
      recipientType: 'CUSTOMER',
      title: 'Locksmith on the way',
      message:
        'Your locksmith has been dispatched and is heading to you now.',
    },
  });
  sendPushNotification(
    customer?.pushToken,
    'Locksmith on the way',
    'Your locksmith is heading to you now.',
    { jobId: String(jobId) }
  );

  res.json({ job: updated });
}

async function expireAcceptedJobs() {
  // Compare in UTC: Prisma/Postgres store DateTime in UTC; JS Date is UTC internally.
  // Jobs with updatedAt older than 5 minutes (still unpaid) are expired.
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const stale = await prisma.job.findMany({
    where: {
      mode: 'EMERGENCY',
      status: 'ACCEPTED',
      depositPaid: false,
      updatedAt: { lt: fiveMinutesAgo },
    },
  });

  for (const job of stale) {
    await prisma.$transaction(async (tx) => {
      await tx.job.update({
        where: { id: job.id },
        data: {
          status: 'PENDING',
          locksithId: null,
          acceptedAt: null,
        },
      });
      if (job.locksithId) {
        await tx.notification.create({
          data: {
            recipientId: job.locksithId,
            recipientType: 'LOCKSMITH',
            title: 'Job unassigned',
            message: 'Job was unassigned — customer did not pay',
          },
        });
      }
    });
  }
}

async function expirePendingJobs() {
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
  const stale = await prisma.job.findMany({
    where: {
      mode: 'EMERGENCY',
      status: 'PENDING',
      createdAt: { lt: twoMinutesAgo },
    },
    select: {
      id: true,
      customerId: true,
    },
  });

  if (stale.length === 0) {
    return;
  }

  let cancelled = 0;
  for (const job of stale) {
    try {
      const updated = await prisma.job.updateMany({
        where: {
          id: job.id,
          status: 'PENDING',
          mode: 'EMERGENCY',
        },
        data: { status: 'CANCELLED', locksithId: null },
      });
      if (updated.count === 0) continue;
      cancelled += 1;

      const customer = await prisma.customer.findUnique({
        where: { id: job.customerId },
        select: { pushToken: true },
      });
      sendPushNotification(
        customer?.pushToken,
        'No Locksmith Found',
        'We could not find an available locksmith. Please try again.',
        { jobId: String(job.id) }
      );
    } catch (err) {
      console.error('expirePendingJobs', job.id, err);
    }
  }

  console.log(`[expirePendingJobs] cancelled ${cancelled} jobs`);
}

async function locksmithTimeout(req, res) {
  const { id: jobId } = req.params;
  const locksmithId = req.locksmith.id;

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new AppError('Job not found', 404);
  if (job.locksithId !== locksmithId) {
    throw new AppError('This job is not assigned to you', 403);
  }
  if (job.status !== 'PENDING' || job.mode !== 'EMERGENCY') {
    return res.json({ job, reassigned: false });
  }

  const next = await getNearestLocksmith({
    customerLat: job.customerLat,
    customerLng: job.customerLng,
    serviceType: job.serviceType,
    excludeLocksmithId: locksmithId,
  });

  if (!next) {
    const updated = await prisma.job.update({
      where: { id: job.id },
      data: { status: 'CANCELLED', locksithId: null, acceptedAt: null },
    });

    const customer = await prisma.customer.findUnique({
      where: { id: job.customerId },
      select: { pushToken: true },
    });
    sendPushNotification(
      customer?.pushToken,
      'No Locksmith Found',
      'We could not find an available locksmith. Please try again.',
      { jobId: String(job.id) }
    );

    return res.json({ job: updated, reassigned: false });
  }

  const svcLabel = String(job.serviceType).replace(/_/g, ' ');
  const msgDb = `New ${svcLabel} job — ${job.customerAddress}`;
  const msgPush = `New ${svcLabel} — ${job.customerAddress}`;

  const pricing = calculateJobPrice(next.basePrice);
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

  await prisma.notification.create({
    data: {
      recipientId: next.locksmith.id,
      recipientType: 'LOCKSMITH',
      title: 'New job nearby',
      message: msgDb,
    },
  });
  sendPushNotification(
    next.locksmith.pushToken,
    'New job nearby',
    msgPush,
    { jobId: String(job.id) }
  );

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

  const customer = await prisma.customer.findUnique({
    where: { id: job.customerId },
    select: { pushToken: true },
  });
  await prisma.notification.create({
    data: {
      recipientId: job.customerId,
      recipientType: 'CUSTOMER',
      title: 'Job complete',
      message: 'Your job has been completed. Thank you for using Vula24.',
    },
  });
  sendPushNotification(
    customer?.pushToken,
    'Job complete',
    'Your job has been completed. Thank you!',
    { jobId: String(jobId) }
  );

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

    const previousLocksmith = await prisma.locksmith.findUnique({
      where: { id: req.locksmith.id },
      select: { pushToken: true },
    });
    await prisma.notification.create({
      data: {
        recipientId: req.locksmith.id,
        recipientType: 'LOCKSMITH',
        title: 'Job reassigned',
        message: 'A job has been reassigned away from you.',
      },
    });
    sendPushNotification(
      previousLocksmith?.pushToken,
      'Job reassigned',
      'A job has been reassigned away from you.',
      { jobId: String(job.id) }
    );

    const pricing = calculateJobPrice(next.basePrice);
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
  const pricing = calculateJobPrice(quote.price);

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

  const customer = await prisma.customer.findUnique({
    where: { id: job.customerId },
    select: { pushToken: true },
  });
  await prisma.notification.create({
    data: {
      recipientId: job.customerId,
      recipientType: 'CUSTOMER',
      title: 'Quote accepted',
      message:
        'Your quote has been accepted. Please pay the deposit to confirm your booking.',
    },
  });
  sendPushNotification(
    customer?.pushToken,
    'Quote accepted',
    'Pay the deposit to confirm your booking.',
    { jobId: String(jobId) }
  );

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
          profilePhoto: true,
          vehicleType: true,
          vehicleColor: true,
          vehiclePlateNumber: true,
          totalJobs: true,
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
      profilePhoto: true,
      vehicleType: true,
      vehicleColor: true,
      vehiclePlateNumber: true,
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
  if (job.mode === 'EMERGENCY') {
    if (job.status !== 'DISPATCHED') {
      throw new AppError(
        'Wait for customer payment before marking arrived.',
        400
      );
    }
  } else if (job.status !== 'ACCEPTED') {
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

async function uploadLocksmithProfilePhoto(req, res) {
  const file = req.file;
  if (!file?.buffer?.length) {
    throw new AppError('profilePhoto image file is required', 400);
  }
  const profilePhoto = await uploadLocksmithImage(req, file);
  res.json({ profilePhoto });
}

const DOCUMENT_TYPE_TO_FIELD = {
  idPhoto: 'idPhotoUrl',
  selfiePhoto: 'selfiePhotoUrl',
  proofOfAddress: 'proofOfAddressUrl',
  toolsPhoto: 'toolsPhotoUrl',
};

async function uploadLocksmithDocument(req, res) {
  const file = req.file;
  const documentType = req.body?.documentType;
  const field = DOCUMENT_TYPE_TO_FIELD[documentType];
  if (!field) {
    throw new AppError(
      'documentType must be one of: idPhoto, selfiePhoto, proofOfAddress, toolsPhoto',
      400
    );
  }
  if (!file?.buffer?.length) {
    throw new AppError('document image file is required', 400);
  }
  const url = await uploadLocksmithImage(req, file);
  await prisma.locksmith.update({
    where: { id: req.locksmith.id },
    data: { [field]: url },
  });
  res.json({ field, url });
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
    'profilePhoto',
    'vehicleType',
    'vehicleColor',
    'vehiclePlateNumber',
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
    select: {
      isOnline: true,
      walletMinimum: true,
      profilePhoto: true,
      vehicleType: true,
      vehicleColor: true,
      vehiclePlateNumber: true,
    },
  });
  if (!current) throw new AppError('Locksmith not found', 404);
  const nextOnline = !current.isOnline;

  const profileFieldPresent = (v) => v != null && String(v).trim() !== '';

  if (nextOnline) {
    const wallet = await prisma.wallet.findUnique({
      where: { locksithId: id },
    });
    if (!wallet) throw new AppError('Wallet not found', 404);
    if (wallet.balance < current.walletMinimum) {
      return res.status(403).json({
        error: 'Insufficient wallet balance',
        message: `Minimum balance required: R${current.walletMinimum.toFixed(2)}. Current balance: R${wallet.balance.toFixed(2)}. Please top up.`,
        walletBalance: wallet.balance,
        minimumRequired: current.walletMinimum,
      });
    }
    if (
      !profileFieldPresent(current.profilePhoto) ||
      !profileFieldPresent(current.vehicleType) ||
      !profileFieldPresent(current.vehicleColor) ||
      !profileFieldPresent(current.vehiclePlateNumber)
    ) {
      return res.status(400).json({
        error: 'Profile incomplete',
        message:
          'Please complete your profile before going online. Add your profile photo and vehicle information.',
        incomplete: true,
      });
    }
  }

  await prisma.locksmith.update({
    where: { id },
    data: { isOnline: nextOnline },
  });
  res.json({ isOnline: nextOnline });
}

async function setPaymentMethod(req, res) {
  const jobId = req.params.id;
  const locksmithId = req.locksmith.id;
  const { paymentMethod } = req.body;

  if (paymentMethod !== 'APP' && paymentMethod !== 'CASH') {
    throw new AppError('Invalid paymentMethod', 400);
  }

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new AppError('Job not found', 404);
  if (job.locksithId !== locksmithId) {
    throw new AppError('This job is not assigned to you', 403);
  }
  if (job.status !== 'ACCEPTED') {
    throw new AppError(
      'Payment method can only be set when job status is ACCEPTED',
      400
    );
  }

  const updated = await prisma.job.update({
    where: { id: jobId },
    data: { paymentMethod },
  });
  res.json({ job: updated });
}

async function recordCashCollected(req, res) {
  const jobId = req.params.id;
  const locksmithId = req.locksmith.id;
  const { cashCollected } = req.body;

  if (typeof cashCollected !== 'number' || cashCollected <= 0) {
    throw new AppError('cashCollected must be greater than 0', 400);
  }

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new AppError('Job not found', 404);
  if (job.locksithId !== locksmithId) {
    throw new AppError('This job is not assigned to you', 403);
  }
  if (job.status !== 'COMPLETED') {
    throw new AppError(
      'Cash can only be recorded when job status is COMPLETED',
      400
    );
  }

  const commission = job.platformFee;

  const result = await prisma.$transaction(async (tx) => {
    await tx.job.update({
      where: { id: jobId },
      data: { cashCollected },
    });

    const wallet = await tx.wallet.findUnique({
      where: { locksithId: locksmithId },
    });
    if (!wallet) throw new AppError('Wallet not found', 404);

    const locksmith = await tx.locksmith.findUnique({
      where: { id: locksmithId },
      select: { isOnline: true, walletMinimum: true },
    });
    if (!locksmith) throw new AppError('Locksmith not found', 404);

    const updatedWallet = await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { decrement: commission } },
    });

    await tx.transaction.create({
      data: {
        walletId: wallet.id,
        amount: commission,
        type: 'DEBIT',
        description: `Commission on cash job - ${job.serviceType}`,
        jobId: job.id,
      },
    });

    const newBalance = updatedWallet.balance;

    if (newBalance < 0) {
      await tx.notification.create({
        data: {
          recipientId: locksmithId,
          recipientType: 'LOCKSMITH',
          title: 'Wallet balance',
          message:
            'Your wallet is negative. Top up to continue receiving jobs.',
        },
      });
    }

    let isOnline = locksmith.isOnline;
    if (newBalance < locksmith.walletMinimum) {
      await tx.locksmith.update({
        where: { id: locksmithId },
        data: { isOnline: false },
      });
      isOnline = false;
      await tx.notification.create({
        data: {
          recipientId: locksmithId,
          recipientType: 'LOCKSMITH',
          title: 'Set offline',
          message: `You have been set offline. Minimum wallet balance is R${locksmith.walletMinimum.toFixed(2)}. Please top up.`,
        },
      });
    }

    return { walletBalance: newBalance, isOnline };
  });

  res.json({
    success: true,
    walletBalance: result.walletBalance,
    isOnline: result.isOnline,
  });
}

async function raiseDispute(req, res) {
  const jobId = req.params.id;
  const customerId = req.customer.id;
  const { reason } = req.body;

  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    throw new AppError('reason is required', 400);
  }

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { customer: true },
  });
  if (!job) throw new AppError('Job not found', 404);
  if (job.customerId !== customerId) throw new AppError('Forbidden', 403);
  if (job.status !== 'COMPLETED') {
    throw new AppError('Disputes can only be raised for completed jobs', 400);
  }
  if (!job.completedAt) {
    throw new AppError('Job completion time missing', 400);
  }

  const hoursSince =
    (Date.now() - job.completedAt.getTime()) / (1000 * 60 * 60);
  if (hoursSince > 24) {
    throw new AppError(
      'Disputes can only be raised within 24 hours of completion',
      400
    );
  }

  if (job.isDisputed) {
    throw new AppError('This job is already disputed', 400);
  }

  const adminRecipientId =
    process.env.ADMIN_NOTIFICATION_RECIPIENT_ID || 'admin';

  await prisma.$transaction(async (tx) => {
    await tx.job.update({
      where: { id: jobId },
      data: {
        isDisputed: true,
        disputeReason: reason.trim(),
      },
    });

    await tx.notification.create({
      data: {
        recipientId: adminRecipientId,
        recipientType: 'CUSTOMER',
        title: 'New dispute',
        message: `New dispute raised for job ${jobId} by customer ${job.customer.name}`,
      },
    });

    if (job.locksithId) {
      await tx.notification.create({
        data: {
          recipientId: job.locksithId,
          recipientType: 'LOCKSMITH',
          title: 'Dispute raised',
          message:
            'A dispute has been raised for your job. Please submit proof of completion.',
        },
      });
    }
  });

  res.json({
    success: true,
    message: 'Dispute raised. Our team will review within 24 hours.',
  });
}

async function submitDisputeProof(req, res) {
  const jobId = req.params.id;
  const locksmithId = req.locksmith.id;
  const { disputeProofUrl } = req.body;

  if (!disputeProofUrl || typeof disputeProofUrl !== 'string') {
    throw new AppError('disputeProofUrl is required', 400);
  }

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new AppError('Job not found', 404);
  if (job.locksithId !== locksmithId) {
    throw new AppError('This job is not assigned to you', 403);
  }
  if (!job.isDisputed) {
    throw new AppError('Job is not under dispute', 400);
  }

  const adminRecipientId =
    process.env.ADMIN_NOTIFICATION_RECIPIENT_ID || 'admin';

  const updated = await prisma.$transaction(async (tx) => {
    const j = await tx.job.update({
      where: { id: jobId },
      data: { disputeProofUrl },
    });
    await tx.notification.create({
      data: {
        recipientId: adminRecipientId,
        recipientType: 'CUSTOMER',
        title: 'Dispute proof submitted',
        message: `Locksmith submitted dispute proof for job ${jobId}`,
      },
    });
    return j;
  });

  res.json({ job: updated });
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

async function updateLocksmithPushToken(req, res) {
  const { pushToken } = req.body;
  if (pushToken != null && typeof pushToken !== 'string') {
    throw new AppError('Invalid pushToken', 400);
  }
  await prisma.locksmith.update({
    where: { id: req.locksmith.id },
    data: { pushToken: pushToken || null },
  });
  res.json({ success: true });
}

module.exports = {
  createEmergencyJob,
  getNearbyLocksmiths,
  getJobById,
  getLocksmithJobById,
  listOpenScheduledJobsForLocksmith,
  getLocksmithProfile,
  uploadLocksmithProfilePhoto,
  uploadLocksmithDocument,
  acceptJob,
  dispatchJob,
  expireAcceptedJobs,
  expirePendingJobs,
  arrivedJob,
  startJob,
  completeJob,
  locksmithTimeout,
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
  setPaymentMethod,
  recordCashCollected,
  raiseDispute,
  submitDisputeProof,
  addTeamMember,
  listTeamMembers,
  deactivateTeamMember,
  updateLocksmithPushToken,
};
