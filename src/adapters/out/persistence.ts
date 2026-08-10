/**
 * Guards for values crossing back out of PostgreSQL.
 *
 * A stored value that violates an invariant the domain relies on is a data-integrity fault,
 * not something to coerce: `Number('8080a')` would hand `NaN` to code whose types promise a
 * number. These helpers fail loudly instead, with enough context to find the offending row.
 */

export class PersistenceDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PersistenceDataError';
  }
}

/**
 * Base-10 digits only. Rejects everything `Number()` would quietly accept or mangle:
 * '', ' 42', '8080a', '1e3', '1.5', '0x10', 'Infinity', 'NaN'.
 */
const INTEGER_PATTERN = /^-?\d+$/;

/**
 * @param context What is being parsed, used verbatim in the error message.
 * @throws PersistenceDataError when the stored text is not a safe base-10 integer.
 */
export function parseStoredInteger(rawValue: string, context: string): number {
  if (!INTEGER_PATTERN.test(rawValue)) {
    throw new PersistenceDataError(
      `${context}: expected an integer, found ${JSON.stringify(rawValue)}.`
    );
  }

  const parsed = Number(rawValue);

  // A bigint column can hold values that lose precision as a JS number; silently rounding
  // one would produce an id that matches no row.
  if (!Number.isSafeInteger(parsed)) {
    throw new PersistenceDataError(
      `${context}: ${JSON.stringify(rawValue)} is outside the safe integer range.`
    );
  }

  return parsed;
}
