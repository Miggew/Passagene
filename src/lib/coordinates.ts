/**
 * Utility functions for coordinate manipulation and Google Maps integration
 */

/**
 * Validates that coordinates are within valid range
 * @param lat Latitude (-90 to 90)
 * @param lng Longitude (-180 to 180)
 * @returns true if coordinates are valid
 */
export function isValidCoordinates(lat: number, lng: number): boolean {
  return (
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * Extracts coordinates from Google Maps URLs
 * Supported formats:
 * - https://maps.google.com/?q=-23.55,-46.63
 * - https://www.google.com/maps/place/.../@-23.55,-46.63,17z
 * - https://www.google.com/maps/dir/.../-23.55,-46.63
 * - https://www.google.com/maps?q=-23.55,-46.63
 *
 * NOT supported (short URLs require redirect):
 * - https://goo.gl/maps/xxxxx
 * - https://maps.app.goo.gl/xxxxx
 *
 * @param url The Google Maps URL to parse
 * @returns Object with lat and lng strings, or null if extraction failed
 */
export function extractCoordsFromMapsUrl(url: string): { lat: string; lng: string } | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  // Check for short URLs that we can't process
  if (url.includes('goo.gl/maps') || url.includes('maps.app.goo.gl')) {
    return null;
  }

  try {
    // Pattern 1: /@-23.55,-46.63, (coordinates after @)
    const atPattern = /@(-?\d+\.?\d*),(-?\d+\.?\d*)/;
    const atMatch = url.match(atPattern);
    if (atMatch) {
      return { lat: atMatch[1], lng: atMatch[2] };
    }

    // Pattern 2: ?q=-23.55,-46.63 or &q=-23.55,-46.63 (query parameter)
    const qPattern = /[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/;
    const qMatch = url.match(qPattern);
    if (qMatch) {
      return { lat: qMatch[1], lng: qMatch[2] };
    }

    // Pattern 3: /dir/.../.../-23.55,-46.63 (directions endpoint)
    const dirPattern = /\/dir\/.*?\/(-?\d+\.?\d*),(-?\d+\.?\d*)/;
    const dirMatch = url.match(dirPattern);
    if (dirMatch) {
      return { lat: dirMatch[1], lng: dirMatch[2] };
    }

    // Pattern 4: ll=-23.55,-46.63 (legacy parameter)
    const llPattern = /[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/;
    const llMatch = url.match(llPattern);
    if (llMatch) {
      return { lat: llMatch[1], lng: llMatch[2] };
    }

    // Pattern 5: /place/-23.55,-46.63 (place with coordinates only)
    const placePattern = /\/place\/(-?\d+\.?\d*),(-?\d+\.?\d*)/;
    const placeMatch = url.match(placePattern);
    if (placeMatch) {
      return { lat: placeMatch[1], lng: placeMatch[2] };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Checks if a URL is a short Google Maps URL that requires redirect
 * @param url The URL to check
 * @returns true if it's a short URL
 */
export function isShortMapsUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }
  return url.includes('goo.gl/maps') || url.includes('maps.app.goo.gl');
}

/**
 * Generates a Google Maps URL for navigation to specific coordinates
 * @param lat Latitude
 * @param lng Longitude
 * @returns Google Maps URL
 */
export function getGoogleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

/**
 * Generates a Google Maps search URL for an address
 * @param address The address to search
 * @returns Google Maps search URL
 */
export function getGoogleMapsSearchUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}
