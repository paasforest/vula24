/**
 * Mirrors backend calculateJobPrice for customer-facing preview (approx. travel 8km).
 */
export function estimateCustomerPays(basePrice, distanceKm = 8) {
  const d = Number(distanceKm);
  let travelFee = 0;
  if (d > 5 && d <= 10) travelFee = 60;
  else if (d > 10 && d <= 15) travelFee = 100;
  else if (d > 15 && d <= 20) travelFee = 150;
  const platformFee = basePrice * 0.25;
  const totalPrice = basePrice + travelFee + platformFee;
  return { travelFee, platformFee, totalPrice, locksmithEarning: basePrice + travelFee };
}
