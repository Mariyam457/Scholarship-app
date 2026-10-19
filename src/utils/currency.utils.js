const CURRENCY_SYMBOLS = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  CAD: 'CA$',
  AUD: 'A$',
  JPY: '¥',
  CHF: 'CHF ',
  NZD: 'NZ$',
  SEK: 'SEK ',
  SGD: 'S$',
};

export function formatCurrencyAmount(amount, currency = 'USD') {
  if (typeof amount !== 'number') return '';
  const symbol = CURRENCY_SYMBOLS[currency.toUpperCase()] || `${currency.toUpperCase()} `;
  return `${symbol}${amount.toLocaleString()}`;
}

export function parseCurrencyString(rawText) {
  if (!rawText) return {};

  const text = String(rawText).trim();
  let currency = 'USD';
  if (text.includes('€') || /EUR/i.test(text)) currency = 'EUR';
  else if (text.includes('£') || /GBP/i.test(text)) currency = 'GBP';
  else if (text.includes('CA$') || /CAD/i.test(text)) currency = 'CAD';
  else if (text.includes('A$') || /AUD/i.test(text)) currency = 'AUD';
  else if (text.includes('¥') || /JPY/i.test(text)) currency = 'JPY';
  else if (text.includes('CHF') || /CHF/i.test(text)) currency = 'CHF';

  const match = text.match(/[\d,]+(?:\.\d+)?/);
  if (match) {
    const numericStr = match[0].replace(/,/g, '');
    const num = parseFloat(numericStr);
    if (!isNaN(num) && num > 0) {
      return { amount: num, currency };
    }
  }

  return { currency };
}
