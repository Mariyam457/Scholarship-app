export const COUNTRY_NAMES_TO_ISO = {
  'united kingdom': 'GB',
  'uk': 'GB',
  'great britain': 'GB',
  'england': 'GB',
  'scotland': 'GB',
  'wales': 'GB',
  'united states': 'US',
  'usa': 'US',
  'united states of america': 'US',
  'germany': 'DE',
  'france': 'FR',
  'canada': 'CA',
  'australia': 'AU',
  'japan': 'JP',
  'switzerland': 'CH',
  'sweden': 'SE',
  'netherlands': 'NL',
  'new zealand': 'NZ',
  'singapore': 'SG',
  'south korea': 'KR',
  'korea': 'KR',
  'italy': 'IT',
  'spain': 'ES',
  'china': 'CN',
  'norway': 'NO',
  'denmark': 'DK',
  'finland': 'FI',
  'austria': 'AT',
  'belgium': 'BE',
  'ireland': 'IE',
  'pakistan': 'PK',
  'india': 'IN',
  'bangladesh': 'BD',
  'nigeria': 'NG',
  'kenya': 'KE',
  'ghana': 'GH',
  'egypt': 'EG',
  'turkey': 'TR',
  'brazil': 'BR',
  'mexico': 'MX',
  'indonesia': 'ID',
  'malaysia': 'MY',
  'saudi arabia': 'SA',
  'united arab emirates': 'AE',
  'uae': 'AE',
};

export const ISO_TO_COUNTRY_NAMES = {
  GB: 'United Kingdom',
  US: 'United States',
  DE: 'Germany',
  FR: 'France',
  CA: 'Canada',
  AU: 'Australia',
  JP: 'Japan',
  CH: 'Switzerland',
  SE: 'Sweden',
  NL: 'Netherlands',
  NZ: 'New Zealand',
  SG: 'Singapore',
  KR: 'South Korea',
  IT: 'Italy',
  ES: 'Spain',
  CN: 'China',
  NO: 'Norway',
  DK: 'Denmark',
  FI: 'Finland',
  AT: 'Austria',
  BE: 'Belgium',
  IE: 'Ireland',
  PK: 'Pakistan',
  IN: 'India',
  BD: 'Bangladesh',
  NG: 'Nigeria',
  KE: 'Kenya',
  GH: 'Ghana',
  EG: 'Egypt',
  TR: 'Turkey',
  BR: 'Brazil',
  MX: 'Mexico',
  ID: 'Indonesia',
  MY: 'Malaysia',
  SA: 'Saudi Arabia',
  AE: 'United Arab Emirates',
};

export function getCountryIsoCode(countryNameOrCode) {
  if (!countryNameOrCode) return '';
  const trimmed = countryNameOrCode.trim();
  if (trimmed.length === 2) return trimmed.toUpperCase();
  const lower = trimmed.toLowerCase();
  return COUNTRY_NAMES_TO_ISO[lower] || trimmed.substring(0, 2).toUpperCase();
}

export function getCountryDisplayName(isoCode) {
  if (!isoCode) return '';
  const code = isoCode.toUpperCase();
  return ISO_TO_COUNTRY_NAMES[code] || code;
}

export function getCountryFlagEmoji(isoCode) {
  if (!isoCode || isoCode.length !== 2) return '🌐';
  const code = isoCode.toUpperCase();
  const codePoints = [...code].map((c) => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}
