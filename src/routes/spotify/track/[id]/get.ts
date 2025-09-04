import Elysia, { t } from "elysia";
import { AppContext } from "../../../../core/AppContext";
import { mapSpotifyTrack, trackSchema } from "../../../../structures";

export default function(
    app: Elysia,
    ctx: AppContext,
    routePath: string,
    method: string
) {
    app[method as "get"](routePath, async ({ params }: { params: { id: string } }) => {
        const id = params.id;
        if (!id) {
            return { status: 400, message: "Track ID is required" };
        }

        const raw = await ctx.spotify.getTrack(id);
        if (!raw) {
            return { status: 404, message: "Track not found" };
        }

        return mapSpotifyTrack(raw);
    }, {
        detail: {
            tags: ["Spotify"],
            summary: "Get spotify track by ID",
            description: "Retrieves a lean, curated track object with helpful related links.",
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
                200: trackSchema,
                400: t.Object({ status: t.Literal(400), message: t.String() }),
                404: t.Object({ status: t.Literal(404), message: t.String() })
            }
        }
    });
}