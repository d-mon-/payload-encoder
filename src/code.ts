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
    0: 20, // positive zero (0 byte)
    1: 21, // 1 byte
    4: 22, // 4 byte
    8: 23, // 8 byte
    N: 24, // N byte
  },
  NEGATIVE_BIGINT: {
    0: 25, // negative zero (0 byte) -- doesn't exist, but we keep it to stay consistent
    1: 26, // 1 byte
    4: 27, // 4 byte
    8: 28, // 8 byte
    N: 29, // N byte
  },
  FLOAT: 30,
  NUMBER_POSITIVE_INFINITY: 40,
  NUMBER_NEGATIVE_INFINITY: 41,
  STRING: 50,
  BOOLEAN: { TRUE: 60, FALSE: 61 },
};
