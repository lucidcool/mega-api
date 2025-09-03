import fs from "fs";
import path from "path";
import { Elysia } from "elysia";
import { AppContext } from "./AppContext";

export function registerRoutes(app: Elysia, ctx: AppContext) {
    const routesDir = path.join(__dirname, "../routes");
    let routeCount = 0;

    function walk(dir: string, baseRoute = "") {
        const files = fs.readdirSync(dir);

        for (const file of files) {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                const routeSegment =
                    file.startsWith("[") && file.endsWith("]")
                        ? `:${file.slice(1, -1)}`
                        : file;
                walk(fullPath, `${baseRoute}/${routeSegment}`);
            } else if (file.endsWith(".ts")) {
                const [method] = file.split(".");
                const routePath = baseRoute || "/";
                const register = require(fullPath).default;

                if (typeof register === "function") {
                    register(app, ctx, routePath, method);
                    ctx.logger.info(`Registered [${method.toUpperCase()}] ${routePath}`);
                    routeCount++;
                }
            }
        }
    }

    walk(routesDir);
    ctx.logger.info(`Total routes registered: ${routeCount}`);
}