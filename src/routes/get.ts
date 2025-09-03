import Elysia from "elysia";
import { AppContext } from "../core/AppContext";

export default function(
    app: Elysia,
    ctx: AppContext,
    routePath: string,
    method: string
) {
    app[method as "get"](routePath, ({ params }) => {
        var test = "hi";
        return { test, params };
    });
}