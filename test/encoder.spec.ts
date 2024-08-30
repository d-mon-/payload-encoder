import { codes } from "../src/code";
import { Encoder } from "../src/payload-encoder";

const encoder = new Encoder();

describe("Encoder", () => {
  test("encode positive int", () => {
    const intTestCases = {
      0: [codes.POSITIVE_INT[0]],
      1: [codes.POSITIVE_INT[1], 1],
      255: [codes.POSITIVE_INT[1], 255],
      256: [codes.POSITIVE_INT[2], 1, 0],
      [Math.pow(2, 16) - 1]: [codes.POSITIVE_INT[2], 255, 255],
      [Math.pow(2, 16)]: [codes.POSITIVE_INT[3], 1, 0, 0],
      [Math.pow(2, 24) - 1]: [codes.POSITIVE_INT[3], 255, 255, 255],
      [Math.pow(2, 24)]: [codes.POSITIVE_INT[4], 1, 0, 0, 0],
      [Math.pow(2, 32) - 1]: [codes.POSITIVE_INT[4], 255, 255, 255, 255], // max int
    };

    Object.entries(intTestCases).forEach(([input, output]) => {
      expect(encoder.encode(Number(input))).toStrictEqual(Buffer.from(output));
    });
  });

  test("encode negative 0", () => {
    expect(encoder.encode(-0)).toStrictEqual(
      Buffer.from([codes.NEGATIVE_INT[0]])
    );
  });

  test("encode negative int", () => {
    const intTestCases = {
      [-1]: [codes.NEGATIVE_INT[1], 1],
      [-255]: [codes.NEGATIVE_INT[1], 255],
      [-256]: [codes.NEGATIVE_INT[2], 1, 0],
      [-Math.pow(2, 16) + 1]: [codes.NEGATIVE_INT[2], 255, 255],
      [-Math.pow(2, 16)]: [codes.NEGATIVE_INT[3], 1, 0, 0],
      [-Math.pow(2, 24) + 1]: [codes.NEGATIVE_INT[3], 255, 255, 255],
      [-Math.pow(2, 24)]: [codes.NEGATIVE_INT[4], 1, 0, 0, 0],
      [-Math.pow(2, 32) + 1]: [codes.NEGATIVE_INT[4], 255, 255, 255, 255], // min int
    };

    Object.entries(intTestCases).forEach(([input, output]) => {
      expect(encoder.encode(Number(input))).toStrictEqual(Buffer.from(output));
    });
  });

  test("fail encoding positive and negative infinity", () => {
    expect(() => encoder.encode(Number.POSITIVE_INFINITY)).toThrowError(
      "Unsupported value: POSITIVE_INFINITY"
    );
    expect(() => encoder.encode(Number.NEGATIVE_INFINITY)).toThrowError(
      "Unsupported value: NEGATIVE_INFINITY"
    );
  });

  test("encode positive and negative infinity", () => {
    const encoderWithInfinity = new Encoder({ allowInfinity: true });
    expect(encoderWithInfinity.encode(Number.POSITIVE_INFINITY)).toStrictEqual(
      Buffer.from([codes.NUMBER_POSITIVE_INFINITY])
    );
    expect(encoderWithInfinity.encode(Number.NEGATIVE_INFINITY)).toStrictEqual(
      Buffer.from([codes.NUMBER_NEGATIVE_INFINITY])
    );
  });

  test("encode float", () => {
    const floatTestCases = {
      [-Number.MIN_VALUE]: [codes.FLOAT, 128, 0, 0, 0, 0, 0, 0, 1],
      [Number.MIN_VALUE]: [codes.FLOAT, 0, 0, 0, 0, 0, 0, 0, 1],
      [-1e99]: [codes.FLOAT, 212, 125, 66, 174, 162, 135, 159, 46],
      [-0.1]: [codes.FLOAT, 191, 185, 153, 153, 153, 153, 153, 154],
      [0.1]: [codes.FLOAT, 63, 185, 153, 153, 153, 153, 153, 154],
      [0.01]: [codes.FLOAT, 63, 132, 122, 225, 71, 174, 20, 123],
      [1.1]: [codes.FLOAT, 63, 241, 153, 153, 153, 153, 153, 154],
      [1e99]: [codes.FLOAT, 84, 125, 66, 174, 162, 135, 159, 46],
      [Number.MAX_VALUE]: [codes.FLOAT, 127, 239, 255, 255, 255, 255, 255, 255],
      [-Number.MAX_VALUE]: [
        codes.FLOAT,
        255,
        239,
        255,
        255,
        255,
        255,
        255,
        255,
      ],
    };
    Object.entries(floatTestCases).forEach(([input, output]) => {
      expect(encoder.encode(Number(input))).toStrictEqual(Buffer.from(output));
    });
  });

  test("encode string", () => {
    const stringCode = String.fromCharCode(codes.STRING);
    const integerCode = String.fromCharCode(codes.POSITIVE_INT[1]);
    const stringBufferSize = String.fromCharCode(21);
    expect(encoder.encode("my nickname is d-mon-")).toStrictEqual(
      Buffer.from(
        `${stringCode}${integerCode}${stringBufferSize}my nickname is d-mon-`
      )
    );
  });

  test("encode bigint > 64bit", () => {
    const positiveBigintCode = String.fromCharCode(codes.POSITIVE_BIGINT.N);
    const negativeBigintCode = String.fromCharCode(codes.NEGATIVE_BIGINT.N);
    const integerCode = String.fromCharCode(codes.POSITIVE_INT[1]);
    const bigintBufferSize = String.fromCharCode(17);

    expect(encoder.encode(2n ** 64n)).toStrictEqual(
      Buffer.from(
        `${positiveBigintCode}${integerCode}${bigintBufferSize}10000000000000000`
      )
    );

    expect(encoder.encode(-(2n ** 64n))).toStrictEqual(
      Buffer.from(
        `${negativeBigintCode}${integerCode}${bigintBufferSize}10000000000000000`
      )
    );
  });

  test("encode positive bigint <= 64bit", () => {
    const intTestCases = {
      0: [codes.POSITIVE_BIGINT[0]],
      1: [codes.POSITIVE_BIGINT[1], 1],
      255: [codes.POSITIVE_BIGINT[1], 255],
      256: [codes.POSITIVE_BIGINT[4], 0, 0, 1, 0],
      [String(2n ** 32n - 1n)]: [codes.POSITIVE_BIGINT[4], 255, 255, 255, 255],
      [String(2n ** 32n)]: [codes.POSITIVE_BIGINT[8], 0, 0, 0, 1, 0, 0, 0, 0],
      [String(2n ** 64n - 1n)]: [
        codes.POSITIVE_BIGINT[8],
        255,
        255,
        255,
        255,
        255,
        255,
        255,
        255,
      ], // max bigint
    };

    Object.entries(intTestCases).forEach(([input, output]) => {
      expect(encoder.encode(BigInt(input))).toStrictEqual(Buffer.from(output));
    });
  });

  test("encode negative bigint <= 64bit", () => {
    const intTestCases = {
      "-0": [codes.POSITIVE_BIGINT[0]], // only exception
      "-1": [codes.NEGATIVE_BIGINT[1], 1],
      "-255": [codes.NEGATIVE_BIGINT[1], 255],
      "-256": [codes.NEGATIVE_BIGINT[4], 0, 0, 1, 0],
      [String(-(2n ** 32n - 1n))]: [
        codes.NEGATIVE_BIGINT[4],
        255,
        255,
        255,
        255,
      ],
      [String(-(2n ** 32n))]: [
        codes.NEGATIVE_BIGINT[8],
        0,
        0,
        0,
        1,
        0,
        0,
        0,
        0,
      ],
      [String(-(2n ** 64n - 1n))]: [
        codes.NEGATIVE_BIGINT[8],
        255,
        255,
        255,
        255,
        255,
        255,
        255,
        255,
      ], // max bigint
    };

    Object.entries(intTestCases).forEach(([input, output]) => {
      expect(encoder.encode(BigInt(input))).toStrictEqual(Buffer.from(output));
    });
  });

  test("encode buffer", () => {
    const stringCode = String.fromCharCode(codes.BUFFER);
    const integerCode = String.fromCharCode(codes.POSITIVE_INT[1]);
    const stringBufferSize = String.fromCharCode(2);
    expect(encoder.encode(Buffer.from([49, 48]))).toStrictEqual(
      Buffer.from(`${stringCode}${integerCode}${stringBufferSize}10`)
    );
  });
});
