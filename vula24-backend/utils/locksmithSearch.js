const prisma = require('../lib/prisma');
const { calculateDistance } = require('./pricing');

/**
 * Returns locksmiths AND online team members sorted by distance (closest first),
 * filtered to <= maxKm. Team member results carry isMember: true so callers can
 * route push notifications to the member's own push token.
 */
async function findLocksmithsByDistance({
  customerLat,
  customerLng,
  serviceType,
  maxKm = 20,
  excludeLocksmithId,
}) {
  // --- Locksmith records ---
  const lsWhere = {
    isVerified: true,
    isOnline: true,
    isSuspended: false,
    currentLat: { not: null },
    currentLng: { not: null },
    servicePricing: {
      some: { serviceType, isOffered: true, basePrice: { gt: 0 } },
    },
  };
  if (excludeLocksmithId) {
    lsWhere.id = { not: excludeLocksmithId };
  }

  const locksmiths = await prisma.locksmith.findMany({
    where: lsWhere,
    include: {
      servicePricing: { where: { serviceType } },
    },
  });

  const locksmithResults = locksmiths
    .map((l) => {
      const dist = calculateDistance(customerLat, customerLng, l.currentLat, l.currentLng);
      const pricing = l.servicePricing[0];
      return { locksmith: l, distanceKm: dist, basePrice: pricing ? pricing.basePrice : 0 };
    })
    .filter((x) => x.distanceKm <= maxKm && x.basePrice > 0);

  // --- Team member records ---
  const teamMembers = await prisma.teamMember.findMany({
    where: {
      isActive: true,
      isOnline: true,
      currentLat: { not: null },
      currentLng: { not: null },
      business: {
        isVerified: true,
        isSuspended: false,
        servicePricing: {
          some: { serviceType, isOffered: true, basePrice: { gt: 0 } },
        },
      },
    },
    include: {
      business: {
        include: {
          servicePricing: { where: { serviceType, isOffered: true } },
        },
      },
    },
  });

  const memberResults = teamMembers
    .filter((m) => excludeLocksmithId !== m.business.id)
    .map((m) => {
      const dist = calculateDistance(customerLat, customerLng, m.currentLat, m.currentLng);
      const basePrice = m.business.servicePricing[0]?.basePrice || 0;
      if (dist > maxKm || basePrice === 0) return null;
      return {
        locksmith: {
          ...m.business,
          currentLat: m.currentLat,
          currentLng: m.currentLng,
          isMember: true,
          memberId: m.id,
          memberName: m.name,
          memberPushToken: m.pushToken,
        },
        distanceKm: dist,
        basePrice,
      };
    })
    .filter(Boolean);

  return [...locksmithResults, ...memberResults]
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

async function getNearestLocksmith({ customerLat, customerLng, serviceType, excludeLocksmithId }) {
  const list = await findLocksmithsByDistance({
    customerLat,
    customerLng,
    serviceType,
    excludeLocksmithId,
  });
  return list[0] || null;
}

module.exports = { findLocksmithsByDistance, getNearestLocksmith };
