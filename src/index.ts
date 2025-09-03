import { Elysia } from "elysia";
import { AppContext } from "./core/AppContext";
import { registerRoutes } from "./core/Router";

const app = new Elysia();
const ctx = new AppContext();

app.decorate("ctx", ctx);

registerRoutes(app, ctx);

app.listen(3000);

ctx.logger.info(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`)
