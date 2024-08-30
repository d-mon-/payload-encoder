import { codes } from "./code";
import { endianness } from "os";

const endian = endianness();

const float64Array = new Float64Array(1);
const uInt8Float64Array = new Uint8Array(float64Array.buffer);

const bigint64Array = new BigUint64Array(1);
const uInt8BigInt64Array = new Uint8Array(bigint64Array.buffer);

const max32UInt = 2 ** 32 - 1;
const min32UInt = -max32UInt;
const max64UInt = 2n ** 64n - 1n;
const min64UInt = -max64UInt;

export class Encoder {
  constructor(private options?: { allowInfinity?: boolean }) {}

  private _encode32Int(value: number) {
    // handle negative zero with a special code
    if (Object.is(value, -0)) {
      return Buffer.from([codes.NEGATIVE_INT[0]]);
    }

    const intArray = [];
    const codeRange = value >= 0 ? codes.POSITIVE_INT : codes.NEGATIVE_INT;
    const absValue = Math.abs(value);

    for (let i = 24; i >= 0; i -= 8) {
      const nextValue = absValue >> i;
      if (nextValue || intArray.length) {
        intArray.push(nextValue);
      }
    }
    const code = codeRange[intArray.length as 0 | 1 | 2 | 3 | 4];
    return Buffer.from([code, ...intArray]);
  }

  private _encodeBigInt64(value: bigint) {
    // there ares no negative zero in bigint
    const isPositive = value >= 0n;
    const codeRangeByte = isPositive
      ? codes.POSITIVE_BIGINT
      : codes.NEGATIVE_BIGINT;
    const absValue = isPositive ? value : value * -1n;

    bigint64Array[0] = absValue;
    let bigIntArr =
      endian === "BE" ? uInt8BigInt64Array : [...uInt8BigInt64Array].reverse();
    const nonZeroIdx = bigIntArr.findIndex((v) => v !== 0);

    let code: number;
    if (nonZeroIdx === -1) {
      code = codeRangeByte[0]; // 0 bit
      bigIntArr = [];
    } else if (nonZeroIdx < 4) {
      code = codeRangeByte[8]; // 8 bytes
    } else if (nonZeroIdx < 7) {
      code = codeRangeByte[4];
      bigIntArr = bigIntArr.slice(4, 8); // 4 bytes
    } else {
      code = codeRangeByte[1];
      bigIntArr = bigIntArr.slice(7, 8); // 1 byte
    }

    return Buffer.from([code, ...bigIntArr]);
  }

  private _encodeBigIntN(value: bigint) {
    const code = value > 0n ? codes.POSITIVE_BIGINT.N : codes.NEGATIVE_BIGINT.N;
    value = value > 0 ? value : value * -1n; // = Math.abs
    const bufferBigInt = Buffer.from(value.toString(16)); // bigint -> hex
    const length = bufferBigInt.length;

    if (length > max32UInt) throw new Error("BigInt is exceeding max bytesize");
    return Buffer.concat([
      Buffer.from([code]),
      this._encode32Int(length),
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

    if (Number.isInteger(value) && min32UInt <= value && value <= max32UInt) {
      return this._encode32Int(value);
    }

    return this._encodeFloat(value);
  }

  _encodeString(value: string) {
    const bufferString = Buffer.from(value, "utf-8");
    const length = bufferString.length;
    if (length > max32UInt) throw new Error("Text is exceeding max size");
    return Buffer.concat([
      Buffer.from([codes.STRING]),
      this._encode32Int(length),
      bufferString,
    ]);
  }

  _encodeBoolean(value: boolean) {
    const flag = value === true ? codes.BOOLEAN.TRUE : codes.BOOLEAN.FALSE;
    return Buffer.from([flag]);
  }

  _encodeBuffer(value: Buffer) {
    const length = value.length;
    if (length > max32UInt) throw new Error("Text is exceeding max size");
    return Buffer.concat([
      Buffer.from([codes.BUFFER]),
      this._encode32Int(length),
      value,
    ]);
  }

  encode(value: unknown) {
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
    throw new Error(`Unsupported value: ${value}`);
  }
}
