import { LoggerService } from "../services/LoggerService";
import { SpotifyService } from "../services/SpotifyService";

export class AppContext {
  logger: LoggerService;
  spotify: SpotifyService;

  constructor() {
    this.logger = LoggerService.getInstance();
    this.spotify = new SpotifyService();
  }

  async init() {
    await this.spotify.init();
  }
}