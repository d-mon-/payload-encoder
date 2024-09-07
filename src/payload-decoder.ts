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

  private _decodeSafeInt(code: IntCode, buffer: Buffer, offset: number) {
    // special case for negative zero
    if (code === codes.NEGATIVE_INT[0]) {
      return { data: -0, offset: offset + 1 };
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

  private _decodeLength(buffer: Buffer, offset: number) {
    const length = buffer.at(offset);
    if (!length) throw new Error("length not found");
    if (length <= lengthMaskTreshold) {
      return { data: length, offset: offset + 1 };
    } else {
      return this._decodeSafeInt(
        codes.POSITIVE_INT[(length - lengthMaskTreshold) as IntIndex],
        buffer,
        offset + 1
      );
    }
  }

  private _decodeFloat(buffer: Buffer, offset: number) {
    for (let i = 0; i <= 7; i++) {
      uInt8Float64Array[i] =
        buffer[endian === "BE" ? i + offset : 7 + offset - i]!;
    }
    return { data: float64Array[0], offset: offset + 8 };
  }

  private _decodeString(buffer: Buffer, offset: number) {
    const { data, offset: nextOffset } = this._decodeLength(buffer, offset);
    return {
      data: buffer.toString("utf-8", nextOffset, nextOffset + data),
      offset: nextOffset + data,
    };
  }

  private _decodeBigInt(code: number, buffer: Buffer, offset: number) {
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

  private _decodeBigIntN(code: number, buffer: Buffer, offset: number) {
    const { data, offset: nextOffset } = this._decodeLength(buffer, offset);
    const value = buffer.toString("utf-8", nextOffset, nextOffset + data);
    const result = BigInt("0x" + value);
    return {
      data: code === codes.POSITIVE_BIGINT.N ? result : result * -1n,
      offset: nextOffset + data,
    };
  }

  private _decodeBuffer(buffer: Buffer, offset: number) {
    const { data, offset: nextOffset } = this._decodeLength(buffer, offset);
    return {
      data: buffer.subarray(nextOffset, nextOffset + data),
      offset: nextOffset + data,
    };
  }

  private _decodeDate(buffer: Buffer, offset: number) {
    const timestampCode = buffer.at(offset);
    if (!isInt(timestampCode)) throw new Error("Unexpected error");
    const { data, offset: nextOffset } = this._decodeSafeInt(
      timestampCode,
      buffer,
      offset + 1
    );
    return { data: new Date(data), offset: nextOffset };
  }

  private _decodeArray(buffer: Buffer, offset: number) {
    const result = [];
    while (buffer.at(offset) !== codes.ARRAY_END) {
      const decodedValue = this._decode(buffer, offset);
      result.push(decodedValue.data);
      offset = decodedValue.offset;
    }
    return { data: result, offset: offset + 1 };
  }

  _decode(buffer: Buffer, offset = 0): { data: unknown; offset: number } {
    const code = buffer.at(offset);
    offset = offset + 1;
    if (typeof code === "undefined") throw new Error("Unexpected error");

    if (code === codes.UNDEFINED) {
      return { data: undefined, offset };
    }

    if (code === codes.NULL) {
      return { data: null, offset };
    }

    if (isInt(code)) {
      return this._decodeSafeInt(code, buffer, offset);
    }

    if (code === codes.NUMBER_POSITIVE_INFINITY) {
      if (!this.options?.allowInfinity)
        throw new Error(`Couldn't decode value: POSITIVE_INFINITY`);
      return { data: Number.POSITIVE_INFINITY, offset };
    }

    if (code === codes.NUMBER_NEGATIVE_INFINITY) {
      if (!this.options?.allowInfinity)
        throw new Error(`Couldn't decode value: NEGATIVE_INFINITY`);
      return { data: Number.NEGATIVE_INFINITY, offset };
    }

    if (code === codes.FLOAT) {
      return this._decodeFloat(buffer, offset);
    }

    if (code === codes.STRING) {
      return this._decodeString(buffer, offset);
    }

    if (code === codes.BOOLEAN_FALSE) {
      return { data: false, offset };
    }
    if (code === codes.BOOLEAN_TRUE) {
      return { data: true, offset };
    }

    if (codes.POSITIVE_BIGINT[0] <= code && code <= codes.NEGATIVE_BIGINT.N) {
      if (
        code === codes.POSITIVE_BIGINT.N ||
        code === codes.NEGATIVE_BIGINT.N
      ) {
        return this._decodeBigIntN(code, buffer, offset);
      } else {
        return this._decodeBigInt(code, buffer, offset);
      }
    }

    if (code === codes.BUFFER) {
      return this._decodeBuffer(buffer, offset);
    }
    if (code === codes.DATE) {
      return this._decodeDate(buffer, offset);
    }
    if (code === codes.ARRAY_START) {
      return this._decodeArray(buffer, offset);
    }

    throw new Error(`Couldn't decode value with code ${code}`);
  }

  decode(buffer: Buffer) {
    return this._decode(buffer).data;
  }
}
