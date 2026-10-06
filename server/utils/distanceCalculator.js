/**
 * Utility for distance-based delivery fee calculations in NearCart
 */

/**
 * Calculates distance between two geographical points using the Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in kilometers rounded to 2 decimal places
 */
export function calculateHaversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return Math.round(distance * 100) / 100;
}

/**
 * Validates delivery charge slabs configuration
 * @param {Array} slabs - Array of slab objects { minDistanceKm, maxDistanceKm, charge }
 * @returns {string|null} Null if valid, error message string if invalid
 */
export function validateDeliveryChargeSlabs(slabs) {
  if (!slabs) return null;
  if (!Array.isArray(slabs)) return 'Delivery charge slabs must be an array';
  if (slabs.length === 0) return null;

  const sorted = [...slabs].sort((a, b) => Number(a.minDistanceKm) - Number(b.minDistanceKm));

  for (let i = 0; i < sorted.length; i++) {
    const min = Number(sorted[i].minDistanceKm);
    const max = Number(sorted[i].maxDistanceKm);
    const charge = Number(sorted[i].charge);

    if (isNaN(min) || min < 0) {
      return `Invalid minimum distance: ${sorted[i].minDistanceKm}`;
    }
    if (isNaN(max) || max <= min) {
      return `Maximum distance (${max} km) must be greater than minimum distance (${min} km)`;
    }
    if (isNaN(charge) || charge < 0) {
      return `Delivery charge (${charge}) cannot be negative`;
    }

    if (i > 0) {
      const prevMax = Number(sorted[i - 1].maxDistanceKm);
      const prevMin = Number(sorted[i - 1].minDistanceKm);
      if (min < prevMax) {
        return `Overlapping distance slabs: range ${prevMin}–${prevMax} km overlaps with range ${min}–${max} km`;
      }
    }
  }

  return null;
}

/**
 * Determines the applicable delivery fee for a given distance using distance slabs or default fallback
 * @param {Array} slabs - Array of distance slabs
 * @param {number} distanceKm - Calculated distance in kilometers
 * @param {number} defaultFee - Legacy default delivery fee fallback
 * @returns {number} Delivery fee in INR
 */
export function getFeeForDistance(slabs, distanceKm, defaultFee = 0) {
  if (!slabs || !Array.isArray(slabs) || slabs.length === 0) {
    return Number(defaultFee) || 0;
  }

  const sorted = [...slabs].sort((a, b) => Number(a.minDistanceKm) - Number(b.minDistanceKm));

  // 1. Try exact range match (min <= distance <= max)
  const exactMatch = sorted.find(
    (s) => distanceKm >= Number(s.minDistanceKm) && distanceKm <= Number(s.maxDistanceKm)
  );
  if (exactMatch) {
    return Number(exactMatch.charge);
  }

  // 2. If distance is below the smallest min, use first slab charge
  if (distanceKm <= Number(sorted[0].minDistanceKm)) {
    return Number(sorted[0].charge);
  }

  // 3. For intermediate fractional/boundary values (e.g., 3.5 km between 3 and 4, or 5.01 km between 5 and 6)
  const upperMatch = sorted.find((s) => distanceKm <= Number(s.maxDistanceKm));
  if (upperMatch) {
    return Number(upperMatch.charge);
  }

  // 4. If distance exceeds the maximum slab, use highest slab charge
  return Number(sorted[sorted.length - 1].charge);
}

/**
 * Calculates delivery distance and fee from manual distance input supplied by customer
 * @param {Object} shop - Shop document containing deliveryChargeSlabs and deliveryFee
 * @param {number|string} distanceInput - Distance in kilometers supplied by customer
 * @returns {Object} Result { success, distanceKm, deliveryFee, error }
 */
/**
 * Validates latitude and longitude values
 * @param {number|string} lat - Latitude (-90 to 90)
 * @param {number|string} lng - Longitude (-180 to 180)
 * @returns {string|null} Null if valid, error message if invalid
 */
export function validateCoordinates(latInput, lngInput) {
  if (latInput === undefined || latInput === null || latInput === '' || lngInput === undefined || lngInput === null || lngInput === '') {
    return 'Latitude and longitude are required.';
  }

  const lat = Number(latInput);
  const lng = Number(lngInput);

  if (isNaN(lat) || !isFinite(lat)) {
    return 'Latitude must be a valid number.';
  }

  if (isNaN(lng) || !isFinite(lng)) {
    return 'Longitude must be a valid number.';
  }

  if (lat < -90 || lat > 90) {
    return 'Latitude must be between -90 and 90 degrees.';
  }

  if (lng < -180 || lng > 180) {
    return 'Longitude must be between -180 and 180 degrees.';
  }

  if (lat === 0 && lng === 0) {
    return 'Please select a valid delivery location.';
  }

  return null;
}

/**
 * Checks if a coordinate pair [longitude, latitude] is valid and non-zero
 * @param {Array} coords - GeoJSON coordinates array [longitude, latitude]
 * @returns {boolean} True if valid
 */
export function isValidCoordinatePair(coords) {
  if (!coords || !Array.isArray(coords) || coords.length < 2) return false;
  const lng = Number(coords[0]);
  const lat = Number(coords[1]);

  if (isNaN(lat) || !isFinite(lat) || lat < -90 || lat > 90) return false;
  if (isNaN(lng) || !isFinite(lng) || lng < -180 || lng > 180) return false;
  if (lat === 0 && lng === 0) return false;

  return true;
}

/**
 * Calculates delivery distance and fee from manual distance input supplied by customer
 * @param {Object} shop - Shop document containing deliveryChargeSlabs and deliveryFee
 * @param {number|string} distanceInput - Distance in kilometers supplied by customer
 * @returns {Object} Result { success, distanceKm, deliveryFee, error }
 */
export function calculateDeliveryFeeFromDistance(shop, distanceInput) {
  if (distanceInput === undefined || distanceInput === null || distanceInput === '') {
    return { success: false, error: 'Please enter a valid delivery distance.' };
  }

  const distanceKm = Number(distanceInput);

  if (
    isNaN(distanceKm) ||
    !isFinite(distanceKm) ||
    distanceKm < 0 ||
    distanceKm > 100
  ) {
    return { success: false, error: 'Please enter a valid delivery distance.' };
  }

  const fallbackFee = shop?.deliveryFee !== undefined ? Number(shop.deliveryFee) : 0;
  const deliveryFee = getFeeForDistance(shop?.deliveryChargeSlabs, distanceKm, fallbackFee);

  return {
    success: true,
    distanceKm: Math.round(distanceKm * 100) / 100,
    deliveryFee,
  };
}

/**
 * Authoritatively calculates delivery distance and fee for a given shop and address
 * @param {Object} shop - Shop document containing location coordinates and deliveryChargeSlabs
 * @param {Object} address - Address document containing location coordinates
 * @param {number|string} [manualDistance] - Deprecated optional manual distance in km
 * @returns {Object} Result { success, distanceKm, deliveryFee, error }
 */
export function calculateDeliveryFeeForShopAndAddress(shop, address, manualDistance) {
  if (!shop) {
    return { success: false, error: 'Shop is required to calculate delivery charge' };
  }

  if (!address) {
    return { success: false, error: 'Delivery address is required' };
  }

  // Extract GeoJSON coordinates [longitude, latitude]
  const shopCoords = shop.location?.coordinates;
  const addressCoords = address?.location?.coordinates;

  const hasShopCoords = isValidCoordinatePair(shopCoords);
  const hasAddrCoords = isValidCoordinatePair(addressCoords);

  if (!hasShopCoords) {
    return { success: false, error: 'Location is not configured for this shop.' };
  }

  if (!hasAddrCoords) {
    return { success: false, error: 'Location is not configured for this address.' };
  }

  // GeoJSON array: index 0 = longitude, index 1 = latitude
  const shopLng = Number(shopCoords[0]);
  const shopLat = Number(shopCoords[1]);
  const addrLng = Number(addressCoords[0]);
  const addrLat = Number(addressCoords[1]);

  const distanceKm = calculateHaversineDistanceKm(shopLat, shopLng, addrLat, addrLng);
  const fallbackFee = shop.deliveryFee !== undefined ? Number(shop.deliveryFee) : 0;
  const deliveryFee = getFeeForDistance(shop.deliveryChargeSlabs, distanceKm, fallbackFee);

  return { success: true, distanceKm, deliveryFee };
}
export function validateCoordinates(lat, lng) {
  const latitude = Number(lat);
  const longitude = Number(lng);

  if (
    !isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90
  ) {
    return 'Invalid latitude. Latitude must be between -90 and 90.';
  }

  if (
    !isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    return 'Invalid longitude. Longitude must be between -180 and 180.';
  }

  return null;
}

export function isValidCoordinatePair(coordinates) {
  if (
    !Array.isArray(coordinates) ||
    coordinates.length < 2
  ) {
    return false;
  }

  const [lng, lat] = coordinates;

  return (
    isFinite(Number(lat)) &&
    isFinite(Number(lng)) &&
    Number(lat) >= -90 &&
    Number(lat) <= 90 &&
    Number(lng) >= -180 &&
    Number(lng) <= 180
  );
} 
