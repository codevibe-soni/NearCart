/**
 * Phone Number Validation and Normalization Utility (India +91 Focus)
 */

export const normalizeIndianPhone = (rawPhone) => {
  if (!rawPhone || typeof rawPhone !== 'string') {
    return { isValid: false, normalized: '', localNumber: '', error: 'Phone number is required' };
  }

  // Remove all whitespace, dashes, dots, parentheses
  const cleaned = rawPhone.replace(/[\s\-\.\(\)]/g, '').trim();

  let digits = cleaned;
  if (digits.startsWith('+91')) {
    digits = digits.slice(3);
  } else if (digits.startsWith('91') && digits.length === 12) {
    digits = digits.slice(2);
  } else if (digits.startsWith('0') && digits.length === 11) {
    digits = digits.slice(1);
  }

  // Verify 10-digit Indian mobile number format (starts with 6, 7, 8, or 9)
  const isValid = /^[6-9]\d{9}$/.test(digits);

  if (!isValid) {
    return {
      isValid: false,
      normalized: '',
      localNumber: '',
      error: 'Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9',
    };
  }

  return {
    isValid: true,
    normalized: `+91${digits}`,
    localNumber: digits,
    error: null,
  };
};
