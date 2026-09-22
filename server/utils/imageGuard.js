/**
 * Database write guard helper to prevent raw Base64 image data from entering MongoDB.
 */
export function containsBase64Image(value) {
  if (!value) return false;

  if (typeof value === 'string') {
    return value.startsWith('data:image/');
  }

  if (Array.isArray(value)) {
    return value.some(containsBase64Image);
  }

  if (typeof value === 'object') {
    return Object.values(value).some(containsBase64Image);
  }

  return false;
}

/**
 * Asserts that a value or document fields contain no raw Base64 image data strings.
 * Throws a safe Error if Base64 data is detected.
 */
export function assertNoBase64Image(value, fieldName = 'image') {
  if (containsBase64Image(value)) {
    throw new Error(`Database write blocked: Base64 image data detected in ${fieldName}.`);
  }
}
