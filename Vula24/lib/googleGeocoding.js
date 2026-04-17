/**
 * Reverse geocode via Google Geocoding API — formatted addresses like Google Maps.
 * Enable “Geocoding API” for the same key you use for Places (or Maps).
 */
export async function reverseGeocodeFormatted(lat, lng, apiKey) {
  if (!apiKey || lat == null || lng == null) return null;
  const params = new URLSearchParams({
    latlng: `${Number(lat)},${Number(lng)}`,
    key: String(apiKey).trim(),
  });
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`
  );
  const data = await res.json();
  if (data.status !== 'OK' || !data.results?.length) {
    return null;
  }
  return data.results[0].formatted_address || null;
}

/** Format expo-location reverse result when Google is unavailable. */
export function formatExpoReversePlace(place) {
  if (!place) return null;
  const street = [place.streetNumber, place.street].filter(Boolean).join(' ').trim();
  const line1 = street || (place.name && place.name !== place.street ? place.name : '');
  const parts = [];
  if (line1) parts.push(line1);
  if (place.district && place.district !== place.city) parts.push(place.district);
  if (place.city) parts.push(place.city);
  if (place.region && place.region !== place.city) parts.push(place.region);
  if (place.postalCode) parts.push(place.postalCode);
  if (place.country) parts.push(place.country);
  const joined = parts.filter(Boolean).join(', ');
  return joined || null;
}
