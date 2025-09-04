import Elysia, { t } from "elysia";
import { AppContext } from "../../../../../core/AppContext";

export default function(
  app: Elysia,
  ctx: AppContext,
  routePath: string,
  method: string
) {
  // routePath will be /spotify/track/:id/canvas
  app[method as 'get'](routePath, async ({ params }) => {
    const { id } = params as { id: string };
    const canvas = await ctx.spotify.getCanvasByTrackId(id);
    if (!canvas || !canvas.canvasesList?.[0]) {
      return {
        id,
        canvasUrl: null,
        message: 'Canvas not available'
      };
    }
    return {
      id,
      canvasUrl: canvas.canvasesList[0].canvasUrl
    };
  }, {
    detail: {
      tags: ['Spotify'],
      summary: 'Get track canvas',
      description: 'Returns the Spotify canvas URL for a track if available.',
      parameters: [
        { name: 'id', in: 'path', required: true, schema: t.String() }
      ],
      response: {
        200: t.Object({
          id: t.String(),
          canvasUrl: t.Union([t.String(), t.Null()]),
          message: t.Optional(t.String())
        })
      }
    }
  });
}
