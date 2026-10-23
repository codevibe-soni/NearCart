// server/utils/phoneValidator.js
/**
 * Normalizes Indian mobile numbers.
 * Supported formats:
 *   9876543210            -> 9876543210
 *   +919876543210        -> 9876543210
 *   919876543210         -> 9876543210 (explicit country prefix)
 *   09876543210          -> 9876543210 (optional domestic trunk prefix)
 * Any other format is returned unchanged; validation will reject it.
 */
export const normalizePhone = (raw) => {
  if (!raw) return '';
  // Remove spaces, hyphens, dots, parentheses
  let cleaned = raw.replace(/[\s\-\.\(\)]/g, '');
  // Handle explicit prefixes
  if (cleaned.startsWith('+91')) {
    cleaned = cleaned.slice(3);
  } else if (cleaned.startsWith('91') && cleaned.length === 12) {
    // 91 + 10 digits
    cleaned = cleaned.slice(2);
  } else if (cleaned.startsWith('0') && cleaned.length === 11) {
    // Domestic trunk prefix, e.g., 09876543210
    cleaned = cleaned.slice(1);
  }
  return cleaned;
};

/**
 * Returns true if the normalized string is a valid Indian mobile number.
 * Indian mobile numbers must be 10 digits starting with 6‑9.
 */
export const isValidIndianMobile = (cleaned) => {
  return /^[6-9]\d{9}$/.test(cleaned);
};

/**
 * Optional explicit block‑list for known dummy/test numbers.
 * This is deliberately kept simple and documented.
 */
export const isBlockedTestNumber = (cleaned) => {
  const blocked = ['9999999999']; // add more if needed
  return blocked.includes(cleaned);
};
