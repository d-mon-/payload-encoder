export const codes = {
  UNDEFINED: 0,
  NULL: 1,
  POSITIVE_INT: {
    0: 10, // positive zero (0 byte)
    1: 11, // 1 byte
    2: 12, // 2 bytes
    3: 13, // 3 bytes
    4: 14, // 4 bytes
    5: 15, // 5 bytes
    6: 16, // 6 bytes
    7: 17, // 7 bytes -- which is the lowest to store a safe integer, for storing 8 bytes, it uses float
  },
  NEGATIVE_INT: {
    0: 20, // negative zero (0 byte)
    1: 21,
    2: 22,
    3: 23,
    4: 24,
    5: 25,
    6: 26,
    7: 27, // 7 bytes
  },
  INT_CACHE: 29,
  POSITIVE_BIGINT: {
    0: 30, // positive zero (0 byte)
    1: 31, // 1 byte
    2: 32,
    3: 33,
    4: 34,
    5: 35,
    6: 36,
    7: 37,
    8: 38, // 8 byte
    N: 39, // N byte
  },
  NEGATIVE_BIGINT: {
    0: 40, // negative zero (0 byte) -- doesn't exist, but we keep it to stay consistent
    1: 41, // 1 byte
    2: 42,
    3: 43,
    4: 44,
    5: 45,
    6: 46,
    7: 47,
    8: 48, // 8 byte
    N: 49, // N byte
  },
  BIGINT_CACHE: 50,
  FLOAT: 51,
  FLOAT_CACHE: 52,
  NUMBER_POSITIVE_INFINITY: 60,
  NUMBER_NEGATIVE_INFINITY: 61,
  STRING: 70,
  STRING_CACHE: 71,
  BOOLEAN_TRUE: 80,
  BOOLEAN_FALSE: 81,
  BUFFER: 100,
  BUFFER_CACHE: 101,
  DATE: 102,
  DATE_CACHE: 103,
  ARRAY_START: 104,
  ARRAY_END: 105,
  ARRAY_CACHE: 106,
  OBJECT_START: 107,
  OBJECT_END: 108,
  OBJECT_CACHE: 109,
  CUSTOM: 255,
} as const;

export type IntIndex = keyof typeof codes.POSITIVE_INT;
export type PositiveIntCode = (typeof codes.POSITIVE_INT)[IntIndex];
export type NegativeIntCode = (typeof codes.NEGATIVE_INT)[IntIndex];
export type IntCode = PositiveIntCode | NegativeIntCode;

export function isPositiveInt(
  value: number | undefined
): value is PositiveIntCode {
  return (
    !value || (codes.POSITIVE_INT[0] <= value && value <= codes.POSITIVE_INT[7])
  );
}

export function isNegativeInt(
  value: number | undefined
): value is NegativeIntCode {
  return (
    !value || (codes.NEGATIVE_INT[0] <= value && value <= codes.NEGATIVE_INT[7])
  );
}

export function isInt(value: number | undefined): value is IntCode {
  return isPositiveInt(value) || isNegativeInt(value);
}
