# Elysia with Bun runtime

## Getting Started
To get started with this template, simply paste this command into your terminal:
```bash
bun create elysia ./elysia-example
```

## Development
To start the development server run:
```bash
bun run dev
```

Open http://localhost:3000/ with your browser to see the result.

## API Documentation
This project uses `@elysiajs/openapi` to generate OpenAPI 3 documentation and serve a Scalar UI.

Once the server is running, open the docs (default path configured by the plugin, often `/swagger` or `/openapi`). Try:

- http://localhost:3000/swagger
- or http://localhost:3000/openapi

If one doesn’t load, check the console output or adjust the plugin configuration in `src/index.ts`.

Add route metadata using the `detail` property in route definitions to enrich the documentation (see `src/routes/get.ts`).