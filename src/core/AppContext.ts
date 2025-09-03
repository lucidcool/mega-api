import { LoggerService } from "../services/LoggerService";

export class AppContext {
  logger: LoggerService;
  // userService: UserService;

  constructor() {
    this.logger = LoggerService.getInstance();
  }
}