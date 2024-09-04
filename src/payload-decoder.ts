import { codes, IntCode, IntIndex, isInt, isPositiveInt } from "./code";
import { endianness } from "os";
import { lengthMaskTreshold } from "./payload-encoder";

const endian = endianness();

const float64Array = new Float64Array(1);
const uInt8Float64Array = new Uint8Array(float64Array.buffer);

const int_pows_caching = Array.from(Array(8), (_, i) => Math.pow(2, i * 8));
const bigint_pows_caching = Array.from(
  Array(8),
  (_, i) => 2n ** (BigInt(i) * 8n)
);

export class Decoder {
  constructor(private options?: { allowInfinity?: boolean }) {}

  private _decodeSafeInt(code: IntCode, buffer: Buffer, offset = 1) {
    // special case for negative zero
    if (code === codes.NEGATIVE_INT[0]) {
      return { data: -0, offset };
    }

    const codeIsPositiveInt = isPositiveInt(code);

    const sign = codeIsPositiveInt ? 1 : -1;
    const bufferSize = (
      codeIsPositiveInt
        ? code - codes.POSITIVE_INT[0]
        : code - codes.NEGATIVE_INT[0]
    ) as IntIndex;

    let result = 0;
    for (let i = 0; i < bufferSize; i++) {
      const output = buffer[offset + i];
      if (typeof output === "undefined") throw new Error("Unexpected error");
      result += output * int_pows_caching[bufferSize - 1 - i]!;
    }
    return { data: sign * result, offset: offset + bufferSize };
  }

  private _decodeLength(buffer: Buffer, offset = 1) {
    const length = buffer.at(offset);
    if (!length) throw new Error("length not found");
    if (length < lengthMaskTreshold) {
      return { data: length, offset: offset + 1 };
    } else {
      return this._decodeSafeInt(
        codes.POSITIVE_INT[(length - lengthMaskTreshold) as IntIndex],
        buffer,
        offset + 1
      );
    }
  }

  private _decodeFloat(buffer: Buffer, offset = 1) {
    for (let i = 0; i <= 7; i++) {
      uInt8Float64Array[i] =
        buffer[endian === "BE" ? i + offset : 7 + offset - i]!;
    }
    return float64Array[0];
  }

  private _decodeString(buffer: Buffer, offset = 1) {
    const { data, offset: nextOffset } = this._decodeLength(buffer, offset);
    return buffer.toString("utf-8", nextOffset, nextOffset + data);
  }

  private _decodeBigInt(code: number, buffer: Buffer, offset = 1) {
    const codeIsPositiveInt =
      codes.POSITIVE_BIGINT[0] <= code && code <= codes.POSITIVE_BIGINT[8];
    const sign = codeIsPositiveInt ? 1n : -1n;
    const bufferSize = codeIsPositiveInt
      ? code - codes.POSITIVE_BIGINT[0]
      : code - codes.NEGATIVE_BIGINT[0]; // return 0 -> 8

    let result = 0n;
    for (let i = 0; i < bufferSize; i++) {
      const output = buffer[offset + i];
      if (typeof output === "undefined") throw new Error("Unexpected error");
      result += BigInt(output) * bigint_pows_caching[bufferSize - 1 - i]!;
    }
    return { data: sign * result, offset: offset + bufferSize };
  }

  private _decodeBigIntN(code: number, buffer: Buffer, offset = 1) {
    const { data, offset: nextOffset } = this._decodeLength(buffer, offset);
    const value = buffer.toString("utf-8", nextOffset, nextOffset + data);
    const result = BigInt("0x" + value);
    return code === codes.POSITIVE_BIGINT.N ? result : result * -1n;
  }

  private _decodeBuffer(buffer: Buffer, offset = 1) {
    const { data, offset: nextOffset } = this._decodeLength(buffer, offset);
    return buffer.subarray(nextOffset, nextOffset + data);
  }

  private _decodeDate(buffer: Buffer, offset = 1) {
    const timestampCode = buffer.at(offset);
    if (!isInt(timestampCode)) throw new Error("Unexpected error");
    return new Date(
      this._decodeSafeInt(timestampCode, buffer, offset + 1).data
    );
  }

  decode(buffer: Buffer) {
    const code = buffer.at(0);
    if (typeof code === "undefined") throw new Error("Unexpected error");

    if (code === codes.UNDEFINED) {
      return undefined;
    }

    if (code === codes.NULL) {
      return null;
    }

    if (isInt(code)) {
      return this._decodeSafeInt(code, buffer).data;
    }

    if (code === codes.NUMBER_POSITIVE_INFINITY) {
      if (!this.options?.allowInfinity)
        throw new Error(`Couldn't decode value: POSITIVE_INFINITY`);
      return Number.POSITIVE_INFINITY;
    }

    if (code === codes.NUMBER_NEGATIVE_INFINITY) {
      if (!this.options?.allowInfinity)
        throw new Error(`Couldn't decode value: NEGATIVE_INFINITY`);
      return Number.NEGATIVE_INFINITY;
    }

    if (code === codes.FLOAT) {
      return this._decodeFloat(buffer);
    }

    if (code === codes.STRING) {
      return this._decodeString(buffer);
    }

    if (code === codes.BOOLEAN.FALSE) return false;
    if (code === codes.BOOLEAN.TRUE) return true;

    if (codes.POSITIVE_BIGINT[0] <= code && code <= codes.NEGATIVE_BIGINT.N) {
      if (
        code === codes.POSITIVE_BIGINT.N ||
        code === codes.NEGATIVE_BIGINT.N
      ) {
        return this._decodeBigIntN(code, buffer);
      } else {
        return this._decodeBigInt(code, buffer).data;
      }
    }

    if (code === codes.BUFFER) {
      return this._decodeBuffer(buffer);
    }
    if (code === codes.DATE) {
      return this._decodeDate(buffer);
    }

    throw new Error(`Couldn't decode value with code ${code}`);
  }
}
