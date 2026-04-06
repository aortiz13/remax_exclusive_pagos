import { parsePhoneNumber, isValidNumber } from 'libphonenumber-js';

/**
 * Validates an email address.
 * @param {string} email
 * @returns {boolean}
 */
export const validateEmail = (email) => {
  if (!email) return false;
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

/**
 * Validates a phone number with country context.
 * @param {string} fullPhone - e.g. "+56912345678"
 * @returns {boolean}
 */
export const validatePhone = (fullPhone) => {
  if (!fullPhone) return false;
  try {
    const phoneNumber = parsePhoneNumber(fullPhone);
    return phoneNumber.isValid();
  } catch (error) {
    return false;
  }
};

/**
 * Returns a placeholder for a given country prefix.
 * @param {string} countryCode - ISO 3166-1 alpha-2 (e.g. 'CL', 'AR')
 * @returns {string}
 */
export const getPhonePlaceholder = (countryCode) => {
  const examples = {
    CL: "9 1234 5678",
    AR: "9 11 1234-5678",
    PE: "912 345 678",
    VE: "412 1234567",
    CO: "312 1234567",
    US: "201 555 0123",
    MX: "55 1234 5678",
  };
  return examples[countryCode] || "Número de teléfono";
};

/**
 * Common country prefixes for the CRM.
 */
export const COUNTRY_PREFIXES = [
  { code: 'CL', name: 'Chile', prefix: '+56' },
  { code: 'AR', name: 'Argentina', prefix: '+54' },
  { code: 'PE', name: 'Perú', prefix: '+51' },
  { code: 'CO', name: 'Colombia', prefix: '+57' },
  { code: 'VE', name: 'Venezuela', prefix: '+58' },
  { code: 'MX', name: 'México', prefix: '+52' },
  { code: 'US', name: 'Estados Unidos', prefix: '+1' },
  { code: 'ES', name: 'España', prefix: '+34' },
  { code: 'UY', name: 'Uruguay', prefix: '+598' },
];
