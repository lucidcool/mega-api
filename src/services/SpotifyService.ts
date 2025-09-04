import axios from 'axios';
import * as OTPAuth from 'otpauth';
import { LoggerService } from './LoggerService';

/*

    Before you ask, this is completely vibe coded.
    Kill yourself.

*/
type SecretsMap = Record<string, number[]>;

interface SpotifyServiceOptions {
    spDc?: string;
    secretsUrl?: string;
    tokenRefreshIntervalMs?: number;
    secretsRefreshIntervalMs?: number;
}

interface SpotifyTrack {
    id: string;
    name: string;
    artists: Array<{ name: string; id: string }>;
    album: { name: string; id: string };
    duration_ms: number;
    popularity: number;
}

interface SpotifyAlbum {
    id: string;
    name: string;
    artists: Array<{ name: string; id: string }>;
    release_date: string;
    total_tracks: number;
    tracks: { items: SpotifyTrack[] };
}

interface SpotifyPlaylist {
    id: string;
    name: string;
    description: string;
    owner: { display_name: string; id: string };
    tracks: { items: Array<{ track: SpotifyTrack }> };
}

export class SpotifyService {
    private logger: LoggerService;
    private options: Required<SpotifyServiceOptions>;

    private authToken: string = '';
    private currentTotp: OTPAuth.TOTP | null = null;
    private currentTotpVersion: string | null = null;
    private lastSecretsFetch = 0;
    private initialized = false;
    private tokenInterval?: NodeJS.Timer;
    private secretsInterval?: NodeJS.Timer;

    constructor(opts: SpotifyServiceOptions = {}) {
        this.logger = LoggerService.getInstance();
        this.options = {
            spDc: opts.spDc ?? process.env.SP_DC ?? '',
            secretsUrl: opts.secretsUrl ?? 'https://raw.githubusercontent.com/Thereallo1026/spotify-secrets/refs/heads/main/secrets/secretDict.json',
            tokenRefreshIntervalMs: opts.tokenRefreshIntervalMs ?? 30 * 60 * 1000,
            secretsRefreshIntervalMs: opts.secretsRefreshIntervalMs ?? 60 * 60 * 1000
        };

        if (!this.options.spDc) {
            this.logger.warn('SpotifyService: SP_DC cookie missing. Set SP_DC env var for auth.');
        }
    }

    public async init() {
        if (this.initialized) return;
        this.initialized = true;

        await this.updateTOTPSecrets();
        await this.refreshAuthToken();

        this.secretsInterval = setInterval(() => {
            this.updateTOTPSecrets().catch(err => this.logger.error('TOTP secret refresh failed', err as Error));
        }, this.options.secretsRefreshIntervalMs).unref();

        this.tokenInterval = setInterval(() => {
            this.refreshAuthToken().catch(err => this.logger.error('Auth token refresh failed', err as Error));
        }, this.options.tokenRefreshIntervalMs).unref();

        this.logger.info('SpotifyService initialized');
    }

    public getAccessToken(): string | null {
        return this.authToken || null;
    }

    // Track methods
    public async getTrack(trackId: string): Promise<SpotifyTrack | null> {
        const token = this.requireToken();
        if (!token) return null;
        
        try {
            const response = await axios.get(`https://api.spotify.com/v1/tracks/${trackId}`, {
                headers: this.apiHeaders()
            });
            return response.data;
        } catch (err) {
            this.logger.error(`SpotifyService: Failed to fetch track ${trackId}`, err as Error);
            return null;
        }
    }

    public async searchTracks(query: string, limit: number = 20): Promise<SpotifyTrack[] | null> {
        const token = this.requireToken();
        if (!token) return null;
        
        try {
            const response = await axios.get('https://api.spotify.com/v1/search', {
                params: {
                    q: query,
                    type: 'track',
                    limit
                },
                headers: this.apiHeaders()
            });
            return response.data.tracks.items;
        } catch (err) {
            this.logger.error(`SpotifyService: Failed to search tracks for "${query}"`, err as Error);
            return null;
        }
    }

    // Album methods
    public async getAlbum(albumId: string): Promise<SpotifyAlbum | null> {
        const token = this.requireToken();
        if (!token) return null;
        
        try {
            const response = await axios.get(`https://api.spotify.com/v1/albums/${albumId}`, {
                headers: this.apiHeaders()
            });
            return response.data;
        } catch (err) {
            this.logger.error(`SpotifyService: Failed to fetch album ${albumId}`, err as Error);
            return null;
        }
    }

    // Playlist methods
    public async getPlaylist(playlistId: string): Promise<SpotifyPlaylist | null> {
        const token = this.requireToken();
        if (!token) return null;
        
        try {
            const response = await axios.get(`https://api.spotify.com/v1/playlists/${playlistId}`, {
                headers: this.apiHeaders()
            });
            return response.data;
        } catch (err) {
            this.logger.error(`SpotifyService: Failed to fetch playlist ${playlistId}`, err as Error);
            return null;
        }
    }

    // Canvas API
    public async getCanvasByTrackId(trackId: string) {
        const token = this.requireToken();
        if (!token) return null;
        const trackUri = `spotify:track:${trackId}`;
        return this.getCanvases(trackUri);
    }

    private async getCanvases(trackUri: string) {
        try {
            const { CanvasRequest, CanvasResponse } = await import('../proto/_canvas_pb');

            const canvasRequest = new CanvasRequest();
            const track = new CanvasRequest.Track();
            track.setTrackUri(trackUri);
            canvasRequest.addTracks(track);
            const requestBytes = canvasRequest.serializeBinary();

            const response = await axios.post(
                'https://spclient.wg.spotify.com/canvaz-cache/v0/canvases',
                requestBytes,
                {
                    responseType: 'arraybuffer',
                    headers: {
                        Accept: 'application/protobuf',
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Accept-Language': 'en',
                        'User-Agent': 'Spotify/9.0.34.593 iOS/18.4 (iPhone15,3)',
                        'Accept-Encoding': 'gzip, deflate, br',
                        Authorization: this.authToken
                    }
                }
            );

            if (response.status !== 200) {
                this.logger.error(`SpotifyService: Canvas fetch failed ${response.status} ${response.statusText}`);
                return null;
            }

            return CanvasResponse.deserializeBinary(response.data).toObject();
        } catch (err) {
            this.logger.error('SpotifyService: Canvas request error', err as Error);
            return null;
        }
    }

    // TOTP & Auth methods
    private async updateTOTPSecrets() {
        try {
            const now = Date.now();
            if (now - this.lastSecretsFetch < this.options.secretsRefreshIntervalMs) return;

            const secrets = await this.fetchSecretsFromGitHub();
            const newestVersion = this.findNewestVersion(secrets);

            if (newestVersion && newestVersion !== this.currentTotpVersion) {
                const data = secrets[newestVersion];
                const secret = this.createTotpSecret(data);
                this.currentTotp = new OTPAuth.TOTP({
                    period: 30,
                    digits: 6,
                    algorithm: 'SHA1',
                    secret
                });
                this.currentTotpVersion = newestVersion;
                this.lastSecretsFetch = now;
                this.logger.info(`SpotifyService: TOTP secrets updated v${newestVersion}`);
                if (!this.authToken) await this.refreshAuthToken();
            }
        } catch (err) {
            this.logger.error('SpotifyService: Failed to update TOTP secrets', err as Error);
            if (!this.currentTotp) this.useFallbackSecret();
        }
    }

    private async fetchSecretsFromGitHub(): Promise<SecretsMap> {
        const { data } = await axios.get<SecretsMap>(this.options.secretsUrl, {
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        return data;
    }

    private findNewestVersion(secrets: SecretsMap): string | null {
        const versions = Object.keys(secrets).map(Number);
        if (!versions.length) return null;
        return Math.max(...versions).toString();
    }

    private createTotpSecret(data: number[]) {
        const mapped = data.map((value, index) => value ^ ((index % 33) + 9));
        const hex = Buffer.from(mapped.join(''), 'utf8').toString('hex');
        return OTPAuth.Secret.fromHex(hex);
    }

    private useFallbackSecret() {
        const fallbackData = [99,111,47,88,49,56,118,65,52,67,50,104,117,101,55,94,95,75,94,49,69,36,85,64,74,60];
        const secret = this.createTotpSecret(fallbackData);
        this.currentTotp = new OTPAuth.TOTP({ period: 30, digits: 6, algorithm: 'SHA1', secret });
        this.currentTotpVersion = '19';
        this.logger.warn('SpotifyService: Using fallback TOTP secret');
    }

    private generateTOTP(timestamp: number) {
        if (!this.currentTotp) throw new Error('TOTP not initialized');
        return this.currentTotp.generate({ timestamp });
    }

    private async getServerTime(): Promise<number> {
        try {
            const { data } = await axios.get('https://open.spotify.com/api/server-time', {
                headers: this.commonHeaders()
            });
            const time = Number(data.serverTime);
            if (isNaN(time)) throw new Error('Invalid server time');
            return time * 1000;
        } catch {
            return Date.now();
        }
    }

    private async generateAuthPayload(reason = 'init', productType = 'mobile-web-player') {
        const localTime = Date.now();
        const serverTime = await this.getServerTime();
        return {
            reason,
            productType,
            totp: this.generateTOTP(localTime),
            totpVer: this.currentTotpVersion || '19',
            totpServer: this.generateTOTP(Math.floor(serverTime / 30) * 30000)
        } as Record<string, string>;
    }

    private async spotifyAuth(): Promise<string | false> {
        try {
            const payload = await this.generateAuthPayload();
            const url = new URL('https://open.spotify.com/api/token');
            Object.entries(payload).forEach(([k,v]) => url.searchParams.append(k,v));
            const response = await axios.get(url.toString(), { headers: this.commonHeaders() });
            if ((response.data as any)?.accessToken) return (response.data as any).accessToken;
            this.logger.error('SpotifyService: No access token in response', undefined, { data: response.data });
            return false;
        } catch (err) {
            this.logger.error('SpotifyService: Error fetching authentication', err as Error);
            return false;
        }
    }

    private async refreshAuthToken() {
        if (!this.options.spDc) return;
        const auth = await this.spotifyAuth();
        if (auth) {
            this.authToken = `Bearer ${auth}`;
            this.logger.info('SpotifyService: Auth token refreshed');
        } else {
            this.logger.warn('SpotifyService: Failed to refresh auth token');
        }
    }

    private requireToken(): string | null {
        if (!this.authToken) {
            this.logger.warn('SpotifyService: Auth token not available');
            return null;
        }
        return this.authToken;
    }

    private commonHeaders() {
        return {
            'User-Agent': this.userAgent(),
            Origin: 'https://open.spotify.com/',
            Referer: 'https://open.spotify.com/',
            Cookie: this.options.spDc ? `sp_dc=${this.options.spDc}` : ''
        };
    }

    private apiHeaders() {
        return {
            Authorization: this.authToken,
            'Content-Type': 'application/json'
        };
    }

    private userAgent() {
        return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';
    }
}

export default SpotifyService;
