export const codes = {
  UNDEFINED: 0,
  NULL: 1,
  POSITIVE_INT: {
    0: 10, // positive zero (0 byte)
    1: 11, // 1 byte
    2: 12, // 2 bytes
    3: 13, // 3 bytes
    4: 14, // 4 bytes
  },
  NEGATIVE_INT: {
    0: 15, // negative zero (0 byte)
    1: 16, // 1 byte
    2: 17, // 2 byte
    3: 18, // 3 byte
    4: 19, // 4 byte
  },
  POSITIVE_BIGINT: {
    N: 20,
    64: 21,
    32: 22,
    16: 23,
    8: 24,
  },
  NEGATIVE_BIGINT: {
    N: 25,
    64: 26,
    32: 27,
    16: 28,
    8: 29,
  },
  FLOAT: 30,
  NUMBER_POSITIVE_INFINITY: 40,
  NUMBER_NEGATIVE_INFINITY: 41,
  STRING: 50,
  BOOLEAN: { TRUE: 60, FALSE: 61 },
};
