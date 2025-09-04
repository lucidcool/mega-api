// Lightweight TypeScript implementation for Canvas protobuf needs.
// Focuses only on features used by SpotifyService: serializing CanvasRequest
// and parsing canvasUrl fields from CanvasResponse.

// Helper UTF-8 encode
function utf8Encode(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

// Helper varint encode (unsigned)
function encodeVarint(num: number): number[] {
  const bytes: number[] = [];
  while (num > 127) {
    bytes.push((num & 0x7f) | 0x80);
    num >>>= 7;
  }
  bytes.push(num);
  return bytes;
}

// Helper to read varint
function readVarint(view: Uint8Array, offset: number): { value: number; next: number } {
  let result = 0;
  let shift = 0;
  let pos = offset;
  while (pos < view.length) {
    const byte = view[pos++];
    result |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) break;
    shift += 7;
  }
  return { value: result, next: pos };
}

export class CanvasRequest {
  static Track = class Track {
    private trackUri: string = '';
    setTrackUri(uri: string) { this.trackUri = uri; }
    getTrackUri() { return this.trackUri; }
    // Serialize Track message: field 1 (track_uri) string
    serialize(): number[] {
      const uriBytes = utf8Encode(this.trackUri);
      const inner: number[] = [];
      // tag for field 1, wire type 2 (length-delimited) => (1<<3)|2 = 0x0A
      inner.push(0x0A, ...encodeVarint(uriBytes.length), ...uriBytes);
      return inner;
    }
  };

  private tracks: InstanceType<typeof CanvasRequest.Track>[] = [];
  addTracks(t: InstanceType<typeof CanvasRequest.Track>) { this.tracks.push(t); }

  serializeBinary(): Uint8Array {
    const bytes: number[] = [];
    for (const track of this.tracks) {
      const trackBytes = track.serialize();
      // Outer message field 1 repeated Track messages => tag 0x0A then length then payload
      bytes.push(0x0A, ...encodeVarint(trackBytes.length), ...trackBytes);
    }
    return Uint8Array.from(bytes);
  }
}

interface CanvasEntry { canvasUrl?: string }

export class CanvasResponse {
  static deserializeBinary(buf: ArrayBuffer | Uint8Array) {
    const view = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    const canvases: CanvasEntry[] = [];
    let offset = 0;
    while (offset < view.length) {
      const tag = view[offset++];
      if (tag === 0x0A) { // field 1: Canvas message (length-delimited)
        const { value: len, next } = readVarint(view, offset);
        offset = next;
        const end = offset + len;
        let canvasUrl: string | undefined;
        let innerOffset = offset;
        while (innerOffset < end) {
          const innerTag = view[innerOffset++];
            // field 2 inside Canvas message: canvas_url (tag = 2, wire type 2 => 0x12)
          if (innerTag === 0x12) {
            const { value: slen, next: snext } = readVarint(view, innerOffset);
            innerOffset = snext;
            const slice = view.subarray(innerOffset, innerOffset + slen);
            canvasUrl = new TextDecoder().decode(slice);
            innerOffset += slen;
          } else { // skip other fields (string or length-delimited assumed)
            const { value: skipLen, next: skipNext } = readVarint(view, innerOffset);
            innerOffset = skipNext + skipLen; // naive skip (works for length-delimited)
          }
        }
        canvases.push({ canvasUrl });
        offset = end;
      } else {
        // Unknown top-level field: read length (assuming length-delimited) and skip
        const { value: len2, next: n2 } = readVarint(view, offset);
        offset = n2 + len2;
      }
    }
    return {
      toObject() {
        return { canvasesList: canvases };
      }
    };
  }
}

export default { CanvasRequest, CanvasResponse };
