# Spanner Configuration Modeler

This project is a browser-based tool to allow users to model configurations for Google’s Spanner database. Spanner is a distributed, managed database. Users create an _instance_.

## Commands

- `npm run dev`: start the dev server
- `npm run build`: build the static site into `build/`
- `npm run preview`: serve the production build locally
- `npm run check`: type-check with svelte-check
- `npm run format` / `npm run format:check`: format or check `src/` with Prettier (tabs, semicolons; see `.prettierrc`)
## Naming conventions

- TypeScript variables, functions, parameters, and methods use `lower_snake_case` (`list_skus`, `page_token`), not `lowerCamelCase`.
- Types, interfaces, and classes stay `PascalCase` (`Sku`, `BillingApiError`); module-level constants stay `UPPER_SNAKE_CASE` (`SPANNER_SERVICE_ID`).
- Exceptions, where the name isn't ours to choose: names SvelteKit requires (`load`, `handleError`, `ssr`, `variables`, `defineEnvVars`), DOM/library APIs, and object keys that mirror external JSON (Google's `skuId`, `pricingInfo`, `nextPageToken`, and query params like `pageToken`).

## Architecture

- SvelteKit 3 + Svelte 5 (runes forced on) + TypeScript. Kit 3 has no `svelte.config.js`; Kit options, including the adapter, are passed to `sveltekit()` in `vite.config.ts`.
- Client-only SPA: `adapter-static` with `fallback: '200.html'` plus `export const ssr = false` in `src/routes/+layout.ts`. Do not add server code (`+page.server.ts`, `+server.ts`, `hooks.server.ts`); there is no server at runtime. The static host must serve `200.html` for unknown paths.
- Import from `src/lib` via the `#lib` alias (Node subpath imports in `package.json`). Kit 3 removed `$lib` and errors on it, so translate any older SvelteKit examples. Include the `.ts` extension (`#lib/billing.ts`); svelte-check can't resolve extensionless `#lib` imports.
- Env vars are declared in `src/env.ts` with `defineEnvVars` and imported from `$app/env/public` (Kit 3 deprecated `$env/static/public`). Client vars must be `public: true, static: true` since there is no runtime server. `GCP_BROWSER_API_KEY` is required at build time and is inlined into the bundle.
- Pricing comes from the Cloud Billing Catalog API (Spanner service ID `CC63-0873-48FD`), fetched live in the browser with a referrer-restricted key. Don't bundle SKU data in the app; the Google APIs Terms restrict shipping permanent copies of API content. API failures throw `BillingApiError` (`src/lib/billing.ts`).
- SKU preloading is an XState v5 machine (`src/lib/sku-loader.machine.ts`): `uninitialized` → `loading` (`requesting` | `cancelling`) → `loaded` | `error`. `cancelling` is nested in `loading` so the invoked request stays alive until the abort settles. The machine has no SvelteKit imports, so it can be tested directly in Node. Define actors, actions, and guards in `setup()` and reference them by name so states and events stay type-checked.
- `src/lib/sku-loader.svelte.ts` holds the app-wide singleton actor (kept private) and exports `sku_loader`; the root `+layout.svelte` sends `LOAD` on startup. `actor_state()` (`src/lib/actor.svelte.ts`) wraps an actor as `{ snapshot, send }`, mirroring snapshots into `$state.raw`. Components read `sku_loader.snapshot`, render with `snapshot.matches(...)`, and dispatch with `sku_loader.send(...)`; they never touch the raw actor, whose `getSnapshot()` isn't reactive. Use this instead of `@xstate/svelte`, which is store-based.
- `src/hooks.client.ts` maps uncaught errors (including any `BillingApiError` thrown from a route `load`) to `App.Error` for `src/routes/+error.svelte`.