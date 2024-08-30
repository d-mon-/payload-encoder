import { codes } from "./code";
import { endianness } from "os";

const endian = endianness();

const float64Array = new Float64Array(1);
const uInt8Float64Array = new Uint8Array(float64Array.buffer);

const int_pows_caching = Array.from(Array(4), (_, i) => Math.pow(2, i * 8));
const bigint_pows_caching = Array.from(
  Array(7),
  (_, i) => 2n ** (BigInt(i) * 8n)
);

export class Decoder {
  constructor(private options?: { allowInfinity?: boolean }) {}

  private _decode32Int(code: number, buffer: Buffer, offset = 1) {
    // special case for negative zero
    if (code === codes.NEGATIVE_INT[0]) {
      return { data: -0, offset };
    }

    const codeIsPositiveInt =
      codes.POSITIVE_INT[0] <= code && code <= codes.POSITIVE_INT[4];

    const sign = codeIsPositiveInt ? 1 : -1;
    const bufferSize = codeIsPositiveInt
      ? code - codes.POSITIVE_INT[0]
      : code - codes.NEGATIVE_INT[0]; // return 4, 3, 2, 1 or 0

    let result = 0;
    for (let i = 0; i < bufferSize; i++) {
      const output = buffer[offset + i];
      if (typeof output === "undefined") throw new Error("Unexpected error");
      result += output * int_pows_caching[bufferSize - 1 - i]!;
    }
    return { data: sign * result, offset: offset + bufferSize };
  }

  private _decodeFloat(buffer: Buffer, offset = 1) {
    for (let i = 0; i <= 7; i++) {
      uInt8Float64Array[i] =
        buffer[endian === "BE" ? i + offset : 7 + offset - i]!;
    }
    return float64Array[0];
  }

  private _decodeString(buffer: Buffer, offset = 1) {
    const stringLengthCode = buffer.at(offset);
    if (typeof stringLengthCode === "undefined")
      throw new Error("Unexpected error");

    const { data, offset: nextOffset } = this._decode32Int(
      stringLengthCode,
      buffer,
      offset + 1
    );

    return buffer.toString("utf-8", nextOffset, nextOffset + data);
  }

  private _decodeBigInt(code: number, buffer: Buffer, offset = 1) {
    const codeIsPositiveInt =
      codes.POSITIVE_BIGINT[0] <= code && code <= codes.POSITIVE_BIGINT[8];

    const sign = codeIsPositiveInt ? 1n : -1n;
    let bufferSize: number;

    switch (code) {
      case codes.NEGATIVE_BIGINT[0]:
      case codes.POSITIVE_BIGINT[0]:
        bufferSize = 0;
        break;
      case codes.NEGATIVE_BIGINT[1]:
      case codes.POSITIVE_BIGINT[1]:
        bufferSize = 1;
        break;
      case codes.NEGATIVE_BIGINT[4]:
      case codes.POSITIVE_BIGINT[4]:
        bufferSize = 4;
        break;
      default:
        bufferSize = 8;
    }

    let result = 0n;
    for (let i = 0; i < bufferSize; i++) {
      const output = buffer[offset + i];
      if (typeof output === "undefined") throw new Error("Unexpected error");
      result += BigInt(output) * bigint_pows_caching[bufferSize - 1 - i]!;
    }
    return { data: sign * result, offset: offset + bufferSize };
  }

  private _decodeBigIntN(code: number, buffer: Buffer, offset = 1) {
    const bigIntLengthCode = buffer.at(offset);
    if (typeof bigIntLengthCode === "undefined")
      throw new Error("Unexpected error");

    const { data, offset: nextOffset } = this._decode32Int(
      bigIntLengthCode,
      buffer,
      offset + 1
    );

    const value = buffer.toString("utf-8", nextOffset, nextOffset + data);
    const result = BigInt("0x" + value);
    return code === codes.POSITIVE_BIGINT.N ? result : result * -1n;
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

    if (codes.POSITIVE_INT[0] <= code && code <= codes.NEGATIVE_INT[4]) {
      return this._decode32Int(code, buffer).data;
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

    throw new Error(`Couldn't decode value with code ${code}`);
  }
}
