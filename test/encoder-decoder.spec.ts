import { Decoder } from "../src/payload-decoder";
import { Encoder } from "../src/payload-encoder";

const encoder = new Encoder();
const decoder = new Decoder();

describe("Encoder/Decoder", () => {
  test("positive int", () => {
    const intTestCases = [
      0,
      1,
      255,
      256,
      Math.pow(2, 16) - 1,
      Math.pow(2, 16),
      Math.pow(2, 24) - 1,
      Math.pow(2, 24),
      Math.pow(2, 32) - 1,
    ];

    intTestCases.forEach((input) => {
      const encodedValue = encoder.encode(input);
      expect(decoder.decode(encodedValue)).toStrictEqual(input);
    });
  });

  test("negative 0", () => {
    expect(decoder.decode(encoder.encode(-0))).toStrictEqual(-0);
  });

  test("negative int", () => {
    const intTestCases = [
      -1,
      -255,
      -256,
      -12345,
      -Math.pow(2, 16) + 1,
      -Math.pow(2, 16),
      -Math.pow(2, 24) + 1,
      -Math.pow(2, 24),
      -Math.pow(2, 32) + 1,
    ];

    intTestCases.forEach((input) => {
      const encodedValue = encoder.encode(input);
      expect(decoder.decode(encodedValue)).toStrictEqual(input);
    });
  });

  test("positive and negative infinity", () => {
    const encoderWithInfinity = new Encoder({ allowInfinity: true });
    const decoderWithInfinity = new Decoder({ allowInfinity: true });

    expect(
      decoderWithInfinity.decode(
        encoderWithInfinity.encode(Number.POSITIVE_INFINITY)
      )
    ).toStrictEqual(Number.POSITIVE_INFINITY);

    expect(
      decoderWithInfinity.decode(
        encoderWithInfinity.encode(Number.NEGATIVE_INFINITY)
      )
    ).toStrictEqual(Number.NEGATIVE_INFINITY);
  });

  test("float", () => {
    const floatTestCases = [
      -Number.MIN_VALUE,
      Number.MIN_VALUE,
      -1e99,
      -0.1,
      0.1,
      0.01,
      1.1,
      1e99,
      Number.MAX_VALUE,
      -Number.MAX_VALUE,
    ];

    floatTestCases.forEach((input) => {
      expect(decoder.decode(encoder.encode(input))).toStrictEqual(input);
    });
  });

  test("string", () => {
    expect(
      decoder.decode(encoder.encode("my nickname is d-mon-"))
    ).toStrictEqual("my nickname is d-mon-");
    expect(decoder.decode(encoder.encode("abc".repeat(500)))).toStrictEqual(
      "abc".repeat(500)
    );
  });

  test("boolean", () => {
    expect(decoder.decode(encoder.encode(true))).toStrictEqual(true);
    expect(decoder.decode(encoder.encode(false))).toStrictEqual(false);
  });

  test("undefined", () => {
    expect(decoder.decode(encoder.encode(undefined))).toEqual(undefined);
    expect(decoder.decode(encoder.encode(null))).toEqual(null);
  });

  test("bigint", () => {
    const bigIntTestCases = [
      0n,
      1n,
      255n,
      256n,
      String(2n ** 32n - 1n),
      String(2n ** 32n),
      String(2n ** 64n - 1n),
      String(2n ** 64n),
      -1n,
      -255n,
      -256n,
      String(-(2n ** 32n - 1n)),
      String(-(2n ** 32n)),
      String(-(2n ** 64n - 1n)),
      String(-(2n ** 64n)),
    ];

    bigIntTestCases.forEach((input) => {
      expect(decoder.decode(encoder.encode(input))).toEqual(input);
    });
  });

  test("buffer", () => {
    expect(decoder.decode(encoder.encode(Buffer.from([1, 0])))).toStrictEqual(
      Buffer.from([1, 0])
    );
  });

  test("date", () => {
    const date = new Date();
    expect(decoder.decode(encoder.encode(date))).toStrictEqual(date);
  });

  test("array", () => {
    const expected = [
      -12345,
      12345,
      "abcdef",
      12345n,
      -12345n,
      1.2345,
      -1.2345,
      new Date(),
      Buffer.from([1, 2, 3, 4, 5]),
      [12345, 67890, "abc", [12345]],
      12345,
    ];

    expect(decoder.decode(encoder.encode(expected))).toStrictEqual(expected);
  });

  test("object", () => {
    const expected = {
      a: 1,
      ["b".repeat(500)]: 2,
      10000: 10000,
      e: {
        f: [1n, 5n],
      },
      g: ["a", "b"],
    };

    expect(decoder.decode(encoder.encode(expected))).toStrictEqual(expected);
  });
});
