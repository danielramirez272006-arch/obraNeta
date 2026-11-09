/**
 * Valida que una cadena tenga formato YYYY-MM-DD y corresponda a una fecha calendario real.
 * Rechaza fechas inexistentes como 2026-02-29 o 2026-04-31.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidCalendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [yearStr, monthStr, dayStr] = value.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Valida que una cadena tenga formato YYYY-MM con mes válido (01-12).
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidYearMonth(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}$/.test(value)) {
    return false;
  }
  const [yearStr, monthStr] = value.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  return year >= 1900 && year <= 2100 && month >= 1 && month <= 12;
}

/**
 * Comprueba si un valor es un número entero positivo (> 0).
 * @param {unknown} value
 * @returns {boolean}
 */
export function isPositiveInteger(value) {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/**
 * Comprueba si un valor es un número entero no negativo (>= 0).
 * @param {unknown} value
 * @returns {boolean}
 */
export function isNonNegativeInteger(value) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

