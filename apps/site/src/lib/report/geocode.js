// Address → latitude/longitude via the U.S. Census Bureau geocoder.
// Free public service, no API key. US addresses only.
// Docs: https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html

const URL_BASE = 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress';

export async function geocode(address) {
  const url = `${URL_BASE}?${new URLSearchParams({ address, benchmark: 'Public_AR_Current', format: 'json' })}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Census geocoder ${res.status}`);
  return parseGeocode(await res.json());
}

// → { lat, lng, matched } or null when the address isn't found.
export function parseGeocode(body) {
  const match = body?.result?.addressMatches?.[0];
  const c = match?.coordinates;
  if (!c || !Number.isFinite(c.x) || !Number.isFinite(c.y)) return null;
  return { lat: c.y, lng: c.x, matched: match.matchedAddress || '' };
}
