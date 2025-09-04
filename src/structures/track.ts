import { t } from 'elysia';
import type { SpotifyTrack } from '../services/SpotifyService';
import { msToHuman } from '../utils/time';

export interface TrackDTO {
  id: string;
  name: string;
  duration: {
    ms: number;
    human: string; // mm:ss
  };
  preview: string | null;
  popularity: number | null;
  album: {
    id: string;
    name: string;
    link: string;
    art: {
        sm: {
            url: string;
            size: number;
        }
        lg: {
            url: string;
            size: number;
        }
        xl: {
            url: string;
            size: number;
        }
    }
  } | null;
  artists: Array<{
    id: string;
    name: string;
    link: string;
  }>;
}

export const trackSchema = t.Object({
  id: t.String(),
  name: t.String(),
  duration: t.Object({
    ms: t.Number(),
    human: t.String()
  }),
  preview: t.Union([t.String(), t.Null()]),
  popularity: t.Union([t.Number(), t.Null()]),
  album: t.Union([
    t.Object({
      id: t.String(),
      name: t.String(),
      link: t.String(),
        art: t.Object({
            sm: t.Object({
                url: t.String(),
                size: t.Number()
            }),
            lg: t.Object({
                url: t.String(),
                size: t.Number()
            }),
            xl: t.Object({
                url: t.String(),
                size: t.Number()
            })
        })
    }),
    t.Null()
  ]),
  artists: t.Array(t.Object({
    id: t.String(),
    name: t.String(),
    link: t.String()
  })),
});

export interface MapTrackOptions {
  basePath?: string;
}

export function mapSpotifyTrack(track: SpotifyTrack, opts: MapTrackOptions = {}): TrackDTO {
  const base = opts.basePath ?? '';
  const albumId = track.album?.id;
  const primaryArtist = track.artists?.[0];

  return {
    id: track.id,
    name: track.name,
    duration: {
      ms: track.duration_ms,
      human: msToHuman(track.duration_ms)
    },
    preview: track.preview_url,
    popularity: typeof track.popularity === 'number' ? track.popularity : null,
    album: albumId ? {
      id: albumId,
      name: track.album.name,
      link: `${base}/spotify/album/${albumId}`,
        art: {
            sm: {
                url: track.album.images[2]?.url ?? '',
                size: track.album.images[2]?.width ?? 64
            },
            lg: {
                url: track.album.images[1]?.url ?? '',
                size: track.album.images[1]?.width ?? 300
            },
            xl: {
                url: track.album.images[0]?.url ?? '',
                size: track.album.images[0]?.width ?? 640
            }
        }
    } : null,
    artists: (track.artists || []).map(a => ({
      id: a.id,
      name: a.name,
      link: `${base}/spotify/artist/${a.id}`
    })),
  };
}
