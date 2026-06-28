// ============================================================
// Geolocation utilities — Haversine, geofencing
// ============================================================

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/**
 * Distancia en metros entre dos puntos (fórmula de Haversine).
 */
export function haversineDistance(a: GeoPoint, b: GeoPoint): number {
  const R = 6371000; // radio de la Tierra en metros
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Verifica si un punto está dentro del geofence de una sucursal.
 */
export function isWithinGeofence(
  point: GeoPoint,
  sucursalCenter: GeoPoint,
  radiusMeters: number
): { within: boolean; distance: number } {
  const distance = haversineDistance(point, sucursalCenter);
  return { within: distance <= radiusMeters, distance };
}

/**
 * Genera un enlace de Google Maps para mostrar una ubicación.
 */
export function googleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}
