const prisma = require('../lib/prisma');
const { AppError } = require('./errorHandler');
const { verifyUserToken, verifyAdminToken } = require('../utils/jwt');

function getBearerToken(req) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return null;
  return h.slice(7);
}

async function authenticateCustomer(req, res, next) {
  try {
    const token = getBearerToken(req);
    if (!token) return next(new AppError('Authentication required', 401));
    const payload = verifyUserToken(token);
    if (payload.type !== 'customer') {
      return next(new AppError('Invalid token for this resource', 403));
    }
    const customer = await prisma.customer.findUnique({
      where: { id: payload.sub },
    });
    if (!customer) return next(new AppError('Customer not found', 401));
    req.customer = customer;
    next();
  } catch {
    next(new AppError('Invalid or expired token', 401));
  }
}

async function authenticateLocksmith(req, res, next) {
  try {
    const token = getBearerToken(req);
    if (!token) return next(new AppError('Authentication required', 401));
    const payload = verifyUserToken(token);
    if (payload.type !== 'locksmith') {
      return next(new AppError('Invalid token for this resource', 403));
    }
    const locksmith = await prisma.locksmith.findUnique({
      where: { id: payload.sub },
    });
    if (!locksmith) return next(new AppError('Locksmith not found', 401));
    req.locksmith = locksmith;
    next();
  } catch {
    next(new AppError('Invalid or expired token', 401));
  }
}

async function authenticateMember(req, res, next) {
  try {
    const token = getBearerToken(req);
    if (!token) return next(new AppError('Authentication required', 401));
    const payload = verifyUserToken(token);
    if (payload.type !== 'member') {
      return next(new AppError('Invalid token for this resource', 403));
    }
    const member = await prisma.teamMember.findUnique({
      where: { id: payload.memberId || payload.sub },
    });
    if (!member || !member.isActive) {
      return next(new AppError('Team member not found or inactive', 401));
    }
    req.member = member;
    next();
  } catch {
    next(new AppError('Invalid or expired token', 401));
  }
}

/** Business locksmith JWT or team member JWT (same routes where both need access). */
async function authenticateLocksmithOrMember(req, res, next) {
  try {
    const token = getBearerToken(req);
    if (!token) return next(new AppError('Authentication required', 401));
    const payload = verifyUserToken(token);
    if (payload.type === 'locksmith') {
      const locksmith = await prisma.locksmith.findUnique({
        where: { id: payload.sub },
      });
      if (!locksmith) return next(new AppError('Locksmith not found', 401));
      req.locksmith = locksmith;
      return next();
    }
    if (payload.type === 'member') {
      const member = await prisma.teamMember.findUnique({
        where: { id: payload.memberId || payload.sub },
      });
      if (!member || !member.isActive) {
        return next(new AppError('Team member not found or inactive', 401));
      }
      req.member = member;
      return next();
    }
    return next(new AppError('Invalid token for this resource', 403));
  } catch {
    next(new AppError('Invalid or expired token', 401));
  }
}

async function authenticateAdmin(req, res, next) {
  try {
    const token = getBearerToken(req);
    if (!token) return next(new AppError('Authentication required', 401));
    const payload = verifyAdminToken(token);
    if (payload.type !== 'admin') {
      return next(new AppError('Invalid admin token', 403));
    }
    next();
  } catch {
    next(new AppError('Invalid or expired admin token', 401));
  }
}

/**
 * Customer or locksmith JWT for shared resources (e.g. notifications).
 * Sets req.notificationRecipient = { id, type: 'CUSTOMER' | 'LOCKSMITH' }.
 */
async function authenticateCustomerOrLocksmith(req, res, next) {
  try {
    const token = getBearerToken(req);
    if (!token) return next(new AppError('Authentication required', 401));
    const payload = verifyUserToken(token);
    if (payload.type === 'customer') {
      const customer = await prisma.customer.findUnique({
        where: { id: payload.sub },
      });
      if (!customer) return next(new AppError('Customer not found', 401));
      req.customer = customer;
      req.notificationRecipient = {
        id: customer.id,
        type: 'CUSTOMER',
      };
      return next();
    }
    if (payload.type === 'locksmith') {
      const locksmith = await prisma.locksmith.findUnique({
        where: { id: payload.sub },
      });
      if (!locksmith) return next(new AppError('Locksmith not found', 401));
      req.locksmith = locksmith;
      req.notificationRecipient = {
        id: locksmith.id,
        type: 'LOCKSMITH',
      };
      return next();
    }
    return next(new AppError('Invalid token for this resource', 403));
  } catch {
    next(new AppError('Invalid or expired token', 401));
  }
}

/**
 * Customer or locksmith JWT; verifies access to job :id
 */
async function authenticateJobParticipant(req, res, next) {
  try {
    const token = getBearerToken(req);
    if (!token) return next(new AppError('Authentication required', 401));
    const payload = verifyUserToken(token);
    const jobId = req.params.id;
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return next(new AppError('Job not found', 404));

    if (payload.type === 'customer' && payload.sub === job.customerId) {
      const customer = await prisma.customer.findUnique({
        where: { id: payload.sub },
      });
      if (!customer) return next(new AppError('Customer not found', 401));
      req.customer = customer;
      req.jobParticipantRole = 'customer';
      req.job = job;
      return next();
    }

    if (payload.type === 'locksmith' && job.locksithId === payload.sub) {
      const locksmith = await prisma.locksmith.findUnique({
        where: { id: payload.sub },
      });
      if (!locksmith) return next(new AppError('Locksmith not found', 401));
      req.locksmith = locksmith;
      req.jobParticipantRole = 'locksmith';
      req.job = job;
      return next();
    }

    return next(new AppError('You are not allowed to modify this job', 403));
  } catch {
    next(new AppError('Invalid or expired token', 401));
  }
}

module.exports = {
  authenticateCustomer,
  authenticateLocksmith,
  authenticateMember,
  authenticateLocksmithOrMember,
  authenticateAdmin,
  authenticateJobParticipant,
  authenticateCustomerOrLocksmith,
};
