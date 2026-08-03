/**
 * Flat India shipping rates (business rule).
 * Delhi NCR → ₹50; rest of India → ₹79.
 */

const DELHI_NCR_CITY_KEYWORDS = [
  'delhi',
  'new delhi',
  'noida',
  'greater noida',
  'ghaziabad',
  'gurugram',
  'gurgaon',
  'faridabad',
] as const;

/** Pincode prefixes commonly used across Delhi NCR. */
const DELHI_NCR_PINCODE_PREFIXES = [
  '110', // Delhi
  '121', // Faridabad
  '122', // Gurugram
  '201', // Noida / Greater Noida / Ghaziabad (partial)
] as const;

export const INDIA_SHIPPING_NCR = 50;
export const INDIA_SHIPPING_REST = 79;

export function isDelhiNcrAddress(input?: {
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
}): boolean {
  const city = String(input?.city || '').trim().toLowerCase();
  const state = String(input?.state || '').trim().toLowerCase();
  const pincode = String(input?.pincode || '').replace(/\D/g, '');

  if (city) {
    if (DELHI_NCR_CITY_KEYWORDS.some((k) => city === k || city.includes(k))) {
      return true;
    }
  }

  if (state) {
    if (
      state.includes('delhi') ||
      state === 'ncr' ||
      state.includes('national capital')
    ) {
      return true;
    }
  }

  if (pincode.length >= 3) {
    const prefix = pincode.slice(0, 3);
    if ((DELHI_NCR_PINCODE_PREFIXES as readonly string[]).includes(prefix)) {
      // 201xxx also covers some non-NCR UP areas — require city/state hint when available.
      if (prefix === '201') {
        if (!city && !state) return true;
        return (
          city.includes('noida') ||
          city.includes('ghaziabad') ||
          state.includes('uttar pradesh') ||
          state.includes('up')
        );
      }
      return true;
    }
  }

  return false;
}

/**
 * Returns the flat India shipping charge for an address.
 * - Delhi NCR → ₹50
 * - Rest of India → ₹79
 * - Unknown location → DEFAULT_SHIPPING_CHARGE (env) or ₹50
 */
export function getIndiaFlatShippingCharge(input?: {
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
}): number {
  const city = String(input?.city || '').trim();
  const state = String(input?.state || '').trim();
  const pincode = String(input?.pincode || '').replace(/\D/g, '');
  const hasLocationHint = Boolean(city || state || pincode.length >= 3);

  if (!hasLocationHint) {
    // No pincode/city yet — charge rest-of-India rate (never free / never assume NCR).
    return INDIA_SHIPPING_REST;
  }

  return isDelhiNcrAddress(input) ? INDIA_SHIPPING_NCR : INDIA_SHIPPING_REST;
}
