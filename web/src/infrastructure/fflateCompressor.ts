import { deflateSync, Inflate } from 'fflate';
import type { Compressor } from '../application/ports';

/** Raw DEFLATE via fflate. Inflate streams and aborts once the output passes `maxBytes`. */
export class FflateCompressor implements Compressor {
  deflate(data: Uint8Array): Uint8Array {
    return deflateSync(data, { level: 9 });
  }

  inflate(data: Uint8Array, maxBytes: number): Uint8Array {
    const chunks: Uint8Array[] = [];
    let total = 0;
    const inflater = new Inflate((chunk) => {
      total += chunk.length;
      if (total > maxBytes) throw new RangeError(`Decompressed data exceeds ${maxBytes} bytes`);
      chunks.push(chunk);
    });
    inflater.push(data, true);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      out.set(c, offset);
      offset += c.length;
    }
    return out;
  }
}
