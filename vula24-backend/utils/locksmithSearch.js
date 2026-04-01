const prisma = require('../lib/prisma');
const { calculateDistance } = require('./pricing');

/**
 * Returns locksmiths sorted by distance (closest first), filtered to <= maxKm
 */
async function findLocksmithsByDistance({
  customerLat,
  customerLng,
  serviceType,
  maxKm = 20,
  excludeLocksmithId,
}) {
  const where = {
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
    where.id = { not: excludeLocksmithId };
  }

  const locksmiths = await prisma.locksmith.findMany({
    where,
    include: {
      servicePricing: { where: { serviceType } },
    },
  });

  const withDistance = locksmiths
    .map((l) => {
      const dist = calculateDistance(
        customerLat,
        customerLng,
        l.currentLat,
        l.currentLng
      );
      const pricing = l.servicePricing[0];
      return {
        locksmith: l,
        distanceKm: dist,
        basePrice: pricing ? pricing.basePrice : 0,
      };
    })
    .filter((x) => x.distanceKm <= maxKm && x.basePrice > 0)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  return withDistance;
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
