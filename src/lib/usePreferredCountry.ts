'use client';

import { useEffect, useState } from 'react';
import { getCountryFromCookieHeader, normalizeCountryCode, isIndiaCountry } from './countryPreference';

function readPreferredCountry(): string {
  if (typeof window === 'undefined') {
    return 'IN';
  }

  const storedCountry = window.localStorage.getItem('preferredCountry');
  if (storedCountry) {
    return normalizeCountryCode(storedCountry);
  }

  return getCountryFromCookieHeader(window.document.cookie) || 'IN';
}

export function usePreferredCountry() {
  const [country, setCountry] = useState('IN');

  useEffect(() => {
    const syncCountry = () => setCountry(readPreferredCountry());

    syncCountry();
    window.addEventListener('storage', syncCountry);
    window.addEventListener('preferredCountryChanged', syncCountry);

    return () => {
      window.removeEventListener('storage', syncCountry);
      window.removeEventListener('preferredCountryChanged', syncCountry);
    };
  }, []);

  return {
    country,
    isIndia: isIndiaCountry(country),
  };
}