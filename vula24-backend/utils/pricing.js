/**
 * @param {number} locksithBasePrice
 * @param {number} distanceKm
 * @returns {{ travelFee: number, platformFee: number, totalPrice: number, locksithEarning: number }}
 */
function calculateJobPrice(locksithBasePrice, distanceKm) {
  const d = Number(distanceKm);
  let travelFee = 0;
  if (d > 5 && d <= 10) travelFee = 60;
  else if (d > 10 && d <= 15) travelFee = 100;
  else if (d > 15 && d <= 20) travelFee = 150;

  const platformFee = locksithBasePrice * 0.25;
  const totalPrice = locksithBasePrice + travelFee + platformFee;
  const locksithEarning = locksithBasePrice + travelFee;

  return { travelFee, platformFee, totalPrice, locksithEarning };
}

/**
 * Haversine distance in km
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

module.exports = { calculateJobPrice, calculateDistance };
