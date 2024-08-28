import { codes } from "./code";
import { endianness } from "os";

const endian = endianness();

const float64Array = new Float64Array(1);
const uInt8Float64Array = new Uint8Array(float64Array.buffer);

const max32UInt = Math.pow(2, 32) - 1;
const min32UInt = -max32UInt;

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

  private _encodeBigInt(value: bigint) {
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

  encode(value: unknown) {
    if (typeof value === "undefined") {
      return Buffer.from([codes.UNDEFINED]);
    }
    if (value === null) {
      return Buffer.from([codes.NULL]);
    }
    if (typeof value === "number" && !isNaN(value)) {
      return this._encodeNumber(value);
    }
    if (typeof value === "bigint") {
      // could use bigint-buffer?
      return this._encodeBigInt(value);
    }
    if (typeof value === "string") {
      return this._encodeString(value);
    }
    if (typeof value === "boolean") {
      return this._encodeBoolean(value);
    }
    throw new Error(`Unsupported value: ${value}`);
  }
}
