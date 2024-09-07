import { codes } from "./code";
import { endianness } from "os";

const endian = endianness();

const float64Array = new Float64Array(1);
const uInt8Float64Array = new Uint8Array(float64Array.buffer);

const bigint64Array = new BigUint64Array(1);
const uInt8BigInt64Array = new Uint8Array(bigint64Array.buffer);

const max32UInt = 2 ** 32 - 1;
const max64UInt = 2n ** 64n - 1n;
const min64UInt = -max64UInt;

// 248 was selected by substrating 255 by 6 to represent 1 byte -> 7 bytes
export const lengthMaskTreshold = 248;

export class Encoder {
  referenceIdx = new WeakMap();
  objectCount = 0;

  constructor(private options?: { allowInfinity?: boolean }) {}

  private _encodeSafeInt(value: number) {
    // handle negative zero with a special code
    if (Object.is(value, -0)) {
      return Buffer.from([codes.NEGATIVE_INT[0]]);
    }

    const intArray = [];
    const codeRange = value >= 0 ? codes.POSITIVE_INT : codes.NEGATIVE_INT;
    let absValue = Math.abs(value);

    // high
    if (absValue >= 2 ** 32) {
      const high = Math.floor(absValue / 2 ** 32);
      absValue = absValue >>> 0; // assign low

      for (let i = 24; i >= 0; i -= 8) {
        const nextValue = high >> i;
        if (nextValue || intArray.length) {
          intArray.push(nextValue);
        }
      }
    }

    // low
    for (let i = 24; i >= 0; i -= 8) {
      const nextValue = absValue >> i;
      if (nextValue || intArray.length) {
        intArray.push(nextValue);
      }
    }
    const code = codeRange[intArray.length as keyof typeof codeRange];
    return Buffer.from([code, ...intArray]);
  }

  // encode length
  // if the length is smaller than lengthMaskTreshold, store the length as-is
  // if the length is greater than lengthMaskTreshold, use lengthMaskTreshold as mask to store the bytes size
  private _encodeLength(length: number) {
    if (length <= lengthMaskTreshold) {
      return Buffer.from([length]);
    } else {
      const result = this._encodeSafeInt(length);
      result[0]! = lengthMaskTreshold + (result.length - 1);
      return result;
    }
  }

  private _encodeBigInt64(value: bigint) {
    // unlinke Number, there are no negative zero in bigint
    const isPositive = value >= 0n;
    const codeRangeByte = isPositive
      ? codes.POSITIVE_BIGINT
      : codes.NEGATIVE_BIGINT;
    const absValue = isPositive ? value : value * -1n;

    bigint64Array[0] = absValue;
    const beBigIntArr =
      endian === "BE" ? uInt8BigInt64Array : [...uInt8BigInt64Array].reverse();
    const firstNonZeroIdx = beBigIntArr.findIndex((v) => v !== 0);

    const [code, result] =
      firstNonZeroIdx === -1
        ? [codeRangeByte[0], []]
        : [
            codeRangeByte[(8 - firstNonZeroIdx) as keyof typeof codeRangeByte],
            beBigIntArr.slice(firstNonZeroIdx, 8),
          ];

    return Buffer.from([code, ...result]);
  }

  private _encodeBigIntN(value: bigint) {
    const code = value > 0n ? codes.POSITIVE_BIGINT.N : codes.NEGATIVE_BIGINT.N;
    value = value > 0 ? value : value * -1n; // = Math.abs
    const bufferBigInt = Buffer.from(value.toString(16)); // bigint -> hex
    const length = bufferBigInt.length;

    if (length > max32UInt) throw new Error("BigInt is exceeding max bytesize");
    return Buffer.concat([
      Buffer.from([code]),
      this._encodeLength(length),
      bufferBigInt,
    ]);
  }

  private _encodeFloat(value: number) {
    float64Array[0] = value;
    const buffer = Buffer.allocUnsafe(9);
    buffer[0] = codes.FLOAT;
    for (let i = 0; i <= 7; i++) {
      buffer[i + 1] = uInt8Float64Array[endian === "BE" ? i : 7 - i]!;
    }
    return buffer;
  }

  private _encodeNumber(value: number) {
    if (value === Number.POSITIVE_INFINITY) {
      if (!this.options?.allowInfinity)
        throw new Error(`Unsupported value: POSITIVE_INFINITY`);
      return Buffer.from([codes.NUMBER_POSITIVE_INFINITY]);
    }

    if (value === Number.NEGATIVE_INFINITY) {
      if (!this.options?.allowInfinity)
        throw new Error(`Unsupported value: NEGATIVE_INFINITY`);
      return Buffer.from([codes.NUMBER_NEGATIVE_INFINITY]);
    }

    if (
      Number.isInteger(value) &&
      Number.MIN_SAFE_INTEGER <= value &&
      value <= Number.MAX_SAFE_INTEGER
    ) {
      return this._encodeSafeInt(value);
    }

    return this._encodeFloat(value);
  }

  _encodeString(value: string, opts?: { omitCode: boolean }) {
    const bufferString = Buffer.from(value, "utf-8");
    const length = bufferString.length;
    if (length > max32UInt) throw new Error("Text is exceeding max size");

    const arr: Buffer[] = [];
    if (!opts?.omitCode) {
      arr.push(Buffer.from([codes.STRING]));
    }
    arr.push(this._encodeLength(length), bufferString);

    return Buffer.concat(arr);
  }

  _encodeBoolean(value: boolean) {
    const flag = value === true ? codes.BOOLEAN_TRUE : codes.BOOLEAN_FALSE;
    return Buffer.from([flag]);
  }

  _encodeBuffer(value: Buffer) {
    const length = value.length;
    if (length > max32UInt) throw new Error("Text is exceeding max size");
    return Buffer.concat([
      Buffer.from([codes.BUFFER]),
      this._encodeLength(length),
      value,
    ]);
  }

  _encodeDate(value: Date) {
    return Buffer.concat([
      Buffer.from([codes.DATE]),
      this._encodeSafeInt(value.getTime()),
    ]);
  }

  _encodeArray(value: unknown[]) {
    return Buffer.concat([
      Buffer.from([codes.ARRAY_START]),
      ...value.map((v) => this.encode(v)),
      Buffer.from([codes.ARRAY_END]),
    ]);
  }

  _encodeObject(value: object) {
    return Buffer.concat([
      Buffer.from([codes.OBJECT_START]),
      ...Object.entries(value).map(([key, value]) =>
        Buffer.concat([
          this._encodeString(key, { omitCode: true }),
          this.encode(value),
        ])
      ),
      Buffer.from([codes.OBJECT_END]),
    ]);
  }

  encode(value: unknown): Buffer {
    if (typeof value === "undefined") {
      return Buffer.from([codes.UNDEFINED]);
    }
    if (value === null) {
      return Buffer.from([codes.NULL]);
    }
    if (typeof value === "bigint") {
      // could use bigint-buffer?
      if (min64UInt <= value && value <= max64UInt) {
        return this._encodeBigInt64(value);
      } else {
        return this._encodeBigIntN(value);
      }
    }
    if (typeof value === "number" && !isNaN(value)) {
      return this._encodeNumber(value);
    }
    if (typeof value === "string") {
      return this._encodeString(value);
    }
    if (typeof value === "boolean") {
      return this._encodeBoolean(value);
    }
    if (value instanceof Buffer) {
      return this._encodeBuffer(value);
    }
    if (value instanceof Date && !isNaN(value.getTime())) {
      return this._encodeDate(value);
    }
    if (Array.isArray(value)) {
      return this._encodeArray(value);
    }
    if (typeof value === "object") {
      return this._encodeObject(value);
    }

    // TODO handle loop on arrays and objects (cache)
    // TODO encode object, error, NaN, Set, Map
    // TODO custom class => add fromBuffer, toBuffer symbol (test with big decimal)
    throw new Error(`Unsupported value: ${value}`);
  }
}
