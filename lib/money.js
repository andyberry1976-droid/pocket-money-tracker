'use strict';

/** Convert an integer pence amount to pounds (number). */
function penceToPounds(pence) {
  if (!Number.isInteger(pence)) {
    throw new TypeError('Amount must be an integer number of pence');
  }
  return pence / 100;
}

/**
 * Format pence as a pounds-and-pence string, e.g. "£12.50" or "-£3.00".
 */
function formatPounds(pence) {
  if (!Number.isInteger(pence)) {
    throw new TypeError('Amount must be an integer number of pence');
  }
  const sign = pence < 0 ? '-' : '';
  const abs = Math.abs(pence);
  const pounds = Math.floor(abs / 100);
  const leftover = abs % 100;
  return `${sign}£${pounds}.${String(leftover).padStart(2, '0')}`;
}

/**
 * Parse a pounds amount (number or string such as "8.50" or "£8.50")
 * into integer pence. Rejects more than two decimal places.
 */
function parsePounds(value) {
  if (value === null || value === undefined || value === '') {
    throw new TypeError('Amount is required');
  }
  const text = String(value).trim().replace(/^£/, '');
  if (!/^-?\d+(\.\d{1,2})?$/.test(text)) {
    throw new TypeError('Amount must be a pounds value with at most two decimal places');
  }
  const negative = text.startsWith('-');
  const [poundsPart, fractionPart = ''] = text.replace(/^-/, '').split('.');
  const pence = Number(poundsPart) * 100 + Number(fractionPart.padEnd(2, '0'));
  return negative ? -pence : pence;
}

module.exports = { penceToPounds, formatPounds, parsePounds };
