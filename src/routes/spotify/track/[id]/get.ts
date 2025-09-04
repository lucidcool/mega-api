import Elysia, { t } from "elysia";
import { AppContext } from "../../../../core/AppContext";
import SpotifyService from "../../../../services/SpotifyService";

export default function(
    app: Elysia,
    ctx: AppContext,
    routePath: string,
    method: string
) {
    app[method as "get"](routePath, async ({ params }: { params: { id: string } }) => {
        if (!params.id) {
            return { error: "Track ID is required" };
        }

        var track = await ctx.spotify.getTrack(params.id);
        return { track, params };
    }, {
        detail: {
            tags: ["Spotify"],
            summary: "Get spotify track by ID",
            description: "Retrieves a specific track from Spotify by its ID.",
            parameters: [
                {
                    name: "id",
                    in: "path",
                    required: true,
                    schema: t.String(),
                    example: '2GEoDwjcRfDxHOiLbi7CWS'
                }
            ],
            response: {
                200: t.Object({
                    test: t.String(),
                    params: t.Optional(t.Any())
                })
            }
        }
    });
}