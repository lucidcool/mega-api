import Elysia, { t } from "elysia";
import { AppContext } from "../core/AppContext";

export default function(
    app: Elysia,
    ctx: AppContext,
    routePath: string,
    method: string
) {
    app[method as "get"](routePath, ({ params }) => {
        const test = "hi";
        return { test, params };
    }, {
        detail: {
            tags: ["Root"],
            summary: "Test",
            description: "Test endpoint.",
            response: {
                200: t.Object({
                    test: t.String(),
                    params: t.Optional(t.Any())
                })
            }
        }
    });
}