// Type declarations for the Canvas protobuf stub / generated module.
// Replace/extend these when integrating the real generated protobuf code.

declare module '../proto/_canvas_pb.cjs' {
  // Minimal shape used in SpotifyService.
  interface CanvasRequestTrack {
    setTrackUri(uri: string): void;
  }

  class CanvasRequest {
    static Track: new () => CanvasRequestTrack;
    addTracks(track: CanvasRequestTrack): void;
    serializeBinary(): Uint8Array;
  }

  interface CanvasEntry {
    canvasUrl?: string;
    [k: string]: unknown;
  }

  interface CanvasResponseObject {
    canvasesList?: CanvasEntry[];
    [k: string]: unknown;
  }

  class CanvasResponse {
    static deserializeBinary(bytes: ArrayBuffer | Uint8Array): { toObject(): CanvasResponseObject };
  }

  const _default: {
    CanvasRequest: typeof CanvasRequest;
    CanvasResponse: typeof CanvasResponse;
  };

  export default _default;
}
