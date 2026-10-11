# Spanner Configuration Modeler

This project is a browser-based tool that allows users to model configurations for Google’s Spanner database. The application guides a user through selecting an instance configuration and size based on her requirements and constraints. Then calculates the total price, addressable storage size, and typcial latency. Given multiple configuartions that would address the requirements within the constraints, it ranks by least cost.

## Contents

- [Configuration](#configuration)
  - [Replicas](#replicas)
  - [Nodes and Processing Units](#nodes-and-processing-units)
  - [Read-only Replicas](#read-only-replicas)
  - [Geo-partitioning](#geo-partitioning)
- [Pricing](#pricing)
  - [Latency](#latency)
- [User Journeys](#user-journeys)
  - [Select an instance configuration](#select-an-instance-configuration)
    - [Add optional replicas](#add-optional-replicas)
  - [Price out an instance configuration](#price-out-an-instance-configuration)
- [Technical Specifications](#technical-specifications)
  - [Commands](#commands)
  - [Naming conventions](#naming-conventions)
  - [Architecture](#architecture)

## Configuration

Spanner is a distributed, managed database. Users create an _instance_ to provision compute and storage capacity. Instances can have multiple _databases_. Each database shares the instance’s resources.

### Replicas

Instances have multiple read-write _replicas_ that provide query processing and availability across multiple failure domains. A _regional_ instance configuration has replicas in three zones, all in the same region. A _multi-region_ configuration provides 5 to 9 replicas across zones in at least two separate regions, with a minimum of two per region, along with a single _witness_ replica in another region. The witness serves to maintain quorum among read-write replicas in the event of a partition between other replicas. _Dual-region_ is a type of multi-region configuration whose read-write replicas are located in the same jurisdiction for data residency. This is typically a single country, such as Japan or Australia.

### Nodes and Processing Units

A _node_ is the amount of compute allocated to each replica in an instance. Users can scale the throughput, measured in queries per second (QPS), by adding nodes to their instance. This relationship is approximately linear at any number of nodes. While a node represents the amount of CPU and RAM provided to each replica, the exact mapping to physical infrastructure is not exposed to users.

A _processing unit_ is 1/1000th of a node. An instance can be configured with a minimum of 100 processing units up to thousands of nodes. There is no practical upper limit. Below one node, or 1,000 processing units, you can only scale in increments of 100 processing units, e.g., 100, 200, 300, etc. Above one node, or 1,000 processing units, you can only scale in increments of whole nodes.

### Read-only Replicas

In addition to read-write replicas that participate in the quorum used in transaction processing, an instance can also have _read-only replicas_. These add throughput for queries that don’t update data. Some multi-region configurations include predefined read-only replicas. Each regional and multi-region configuration also has a list of regions in which a user can add an optional read-only replica. Unlike read-write replicas, read-only replicas always have a replication factor of 1.

### Geo-partitioning

**TODO**

## Pricing

When a customer provisions an instance, they are charged for:

* **Compute:** For each regional replica, the number of copies, or replication _factor_, times the unit price for each replica, measured in replica-node-hours. The unit price is determined by the _edition_ selected by the user.
    * _Standard_, _Enterprise_, or _Enterprise Plus_ for regional instances
    * Only _Enterprise Plus_ for multi-region or dual-region instances
* **Storage:** Usage per replica, measured in replica-GiB-months, where 1 GiB = 2<sup>30</sup> bytes. Storage supports two _tiers_, SSD and HDD. Each tier is priced differently per regional configuration. An instance is limited to 10 TiB of total storage per node, across both tiers.
* **Backup:** Backups are billed by instance-GiB-months, not by individual replicas. Backup unit prices also do not vary by region. The only variable is the configuration type:
    * Regional: $0.10/GiB-month
    * Multi-region: $0.30/GiB-month
* **Replication:** Users are charged for the volume of data replicated across _continents_ from the leader region to every other replica, measured in GiB-months.

    | Location      | North America | Europe | Asia  | Indonesia | Oceania | Middle East | Latin America | Africa |
    | ------------- | ------------: | -----: | ----: | --------: | ------: | ----------: | ------------: | -----: |
    | North America |         $0.04 |  $0.07 | $0.11 |     $0.13 |   $0.13 |       $0.14 |         $0.17 |  $0.14 |
    | Europe        |         $0.07 |  $0.04 | $0.11 |     $0.13 |   $0.13 |       $0.14 |         $0.17 |  $0.14 |
    | Asia          |         $0.11 |  $0.11 | $0.11 |     $0.13 |   $0.13 |       $0.14 |         $0.17 |  $0.14 |
    | Indonesia     |         $0.13 |  $0.13 | $0.13 |     $0.11 |   $0.11 |       $0.14 |         $0.17 |  $0.17 |
    | Oceania       |         $0.13 |  $0.13 | $0.13 |     $0.11 |   $0.11 |       $0.14 |         $0.17 |  $0.17 |
    | Middle East   |         $0.14 |  $0.14 | $0.14 |     $0.14 |   $0.14 |       $0.11 |         $0.17 |  $0.14 |
    | Latin America |         $0.17 |  $0.17 | $0.17 |     $0.17 |   $0.17 |       $0.17 |         $0.17 |  $0.17 |
    | Africa        |         $0.14 |  $0.14 | $0.14 |     $0.17 |   $0.17 |       $0.14 |         $0.17 |  $0.14 |

* **Network:** In addition to data replication (above), Spanner uses the network to:
    * Interact with external clients, for example to return query results to an application
    * Communicate between replicas for transaction or query processing, for example to gather intermediate results in an aggregate calculation or propagate locks in an update.

    All inbound data transfer and data transfer within the same region are free.

    * Outbound data transferred between regions within the same continent is billed at $0.01/GiB-month.
    * Intercontinental data transfer is billed at internet data transfer rates.

### Latency

Transactions, including read-only queries that need up-to-date data, require coordination among the read-write replicas in a Spanner instance. The RTT between replicas thus contributes significantly to overall latency. This is especially important in multi-region configurations, which require long-distance communication across geographically dispersed regions.

## User Journeys

### Select an instance configuration

The tool guides the user through a set of qualification questions to determine the appropriate instance configuration. The primary dimensions are:

* **Availability**
* **Latency**
* **Data Residency**

#### Add optional replicas

The user optionally adds eligible read-only replicas to the base configuration.

### Price out an instance configuration

Given a replica configuration, allow the user to specify the number of nodes and the amount of storage in order to calculate a total cost based on the real-time prices from the pre-loaded Billing API.

# Technical Specifications

### Commands

- `npm run dev`: start the dev server
- `npm run build`: build the static site into `build/`
- `npm run preview`: serve the production build locally
- `npm run stop` (or `npm stop`): kill this project's Vite dev and preview servers
- `npm run check`: type-check with svelte-check
- `npm run format` / `npm run format:check`: format or check `src/` with Prettier (tabs, semicolons; see `.prettierrc`)

### Naming conventions

- TypeScript variables, functions, parameters, and methods use `lower_snake_case` (`list_skus`, `page_token`), not `lowerCamelCase`.
- Types, interfaces, and classes stay `PascalCase` (`Sku`, `BillingApiError`); module-level constants stay `UPPER_SNAKE_CASE` (`SPANNER_SERVICE_ID`).
- Exceptions, where the name isn't ours to choose: names SvelteKit requires (`load`, `handleError`, `ssr`, `variables`, `defineEnvVars`), DOM/library APIs, and object keys that mirror external JSON (Google's `skuId`, `pricingInfo`, `nextPageToken`, and query params like `pageToken`).

### Architecture

- SvelteKit 3 + Svelte 5 (runes forced on) + TypeScript 6. Kit 3 has no `svelte.config.js`; Kit options, including the adapter, are passed to `sveltekit()` in `vite.config.ts`.
- Client-only SPA: `adapter-static` with `fallback: '200.html'` plus `export const ssr = false` in `src/routes/+layout.ts`. Do not add server code (`+page.server.ts`, `+server.ts`, `hooks.server.ts`); there is no server at runtime. The static host must serve `200.html` for unknown paths.
- Import from `src/lib` via the `#lib` alias (Node subpath imports in `package.json`). Kit 3 removed `$lib` and errors on it, so translate any older SvelteKit examples. Include the `.ts` extension (`#lib/billing.ts`); svelte-check can't resolve extensionless `#lib` imports.
- Env vars are declared in `src/env.ts` with `defineEnvVars` and imported from `$app/env/public` (Kit 3 deprecated `$env/static/public`). Client vars must be `public: true, static: true` since there is no runtime server. `GCP_BROWSER_API_KEY` is required at build time and is inlined into the bundle. `SKU_CACHE_MAX_AGE_HOURS` is optional (default 336, i.e. two weeks); its `schema` parses it to a number and fails the build on invalid values. Validate and convert in `schema` so imports are already typed. Read env vars in `.svelte.ts` wiring (e.g. `sku-loader.svelte.ts`) and pass them into machines as input; don't import `$app/env/public` from machine files.
- Pricing comes from the Cloud Billing Catalog API (Spanner service ID `CC63-0873-48FD`), fetched live in the browser with a referrer-restricted key. Don't bundle SKU data in the app; the Google APIs Terms restrict shipping permanent copies of API content. API failures throw `BillingApiError` (`src/lib/billing.ts`).
- SKU preloading is an XState v5 machine (`src/lib/sku-loader.machine.ts`; its Mermaid diagram is in the header comment): `uninitialized` → `reading_cache` → `loading` (`requesting` | `cancelling`) → `writing_cache` → `loaded` | `error`. `LOAD` serves SKUs from localStorage (key `spanner-config:skus:api-<BILLING_API_VERSION>:format-<SKU_CACHE_FORMAT>`, so changing the API version in `billing.ts` or the cache format drops old entries; `write_cache` deletes stale `spanner-config:skus:*` keys) when they're younger than the `cache_max_age_ms` input (from `SKU_CACHE_MAX_AGE_HOURS`); `RELOAD` always fetches. Cache read/write failures are logged and never block loading. `cancelling` is nested in `loading` so the invoked request stays alive until the abort settles; a cancelled reload returns to `loaded` with the previous SKUs. Keep I/O (fetch, localStorage) in invoked actors so tests can replace them with `.provide()`. The machine has no SvelteKit imports, so it can be tested directly in Node. Define actors, actions, and guards in `setup()` and reference them by name so states and events stay type-checked.
- `src/lib/sku-loader.svelte.ts` holds the app-wide singleton actor (kept private) and exports `sku_loader`; the root `+layout.svelte` sends `LOAD` on startup. `actor_state()` (`src/lib/actor.svelte.ts`) wraps an actor as `{ snapshot, send }`, mirroring snapshots into `$state.raw`. Components read `sku_loader.snapshot`, render with `snapshot.matches(...)`, and dispatch with `sku_loader.send(...)`; they never touch the raw actor, whose `getSnapshot()` isn't reactive. Use this instead of `@xstate/svelte`, which is store-based.
- `src/hooks.client.ts` maps uncaught errors (including any `BillingApiError` thrown from a route `load`) to `App.Error` for `src/routes/+error.svelte`.