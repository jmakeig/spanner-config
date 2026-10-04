/**
 * State machine that loads Spanner SKUs from the Cloud Billing Catalog API,
 * caching them in localStorage for `cache_max_age_ms` (set from the
 * SKU_CACHE_MAX_AGE_HOURS env var; two weeks by default).
 *
 * ```mermaid
 * stateDiagram-v2
 *     [*] --> uninitialized
 *     uninitialized --> reading_cache: LOAD
 *     uninitialized --> loading: RELOAD
 *     reading_cache --> loaded: fresh cache
 *     reading_cache --> loading: miss, stale, or unreadable
 *     state loading {
 *         [*] --> requesting
 *         requesting --> cancelling: CANCEL
 *     }
 *     loading --> writing_cache: success
 *     loading --> error: failure
 *     loading --> settle_cancel: cancelled
 *     settle_cancel --> loaded: has SKUs
 *     settle_cancel --> uninitialized: no SKUs
 *     writing_cache --> loaded: written or write failed
 *     loaded --> loading: RELOAD
 *     error --> loading: LOAD / RELOAD
 * ```
 *
 * LOAD uses the cache when it's fresh; RELOAD always goes to the network.
 */

// `cancelling` is nested inside `loading` so the invoked request stays alive
// until the abort actually settles. Leaving `loading` would stop the actor
// immediately, and a response racing the abort could otherwise slip through.
// A cancelled request returns to `loaded` if there are SKUs to show (a manual
// reload), otherwise to `uninitialized`.
//
// Cache I/O runs in invoked actors, so tests can swap them out with
// `sku_loader_machine.provide({ actors: { ... } })`.

import { assign, fromPromise, setup } from "xstate";
import { list_skus, type Sku } from "#lib/billing.ts";

/** Bump the version suffix if the stored shape changes, to drop old entries. */
export const SKU_CACHE_KEY = "spanner-config:skus:v1";

export interface CachedSkus {
	/** When the SKUs were fetched from the API, in ms since the epoch. */
	fetched_at: number;
	skus: Sku[];
}

export interface SkuLoaderInput {
	api_key: string;
	/** Cached SKUs older than this are refetched on LOAD. 0 never reuses the cache. */
	cache_max_age_ms: number;
}

export interface SkuLoaderContext {
	api_key: string;
	cache_max_age_ms: number;
	skus: Sku[];
	/** When `skus` were fetched from the API (not when they were read from cache). */
	fetched_at: number | null;
	error: Error | null;
	/** Replaced on every request, so it always belongs to the current one. */
	abort_controller: AbortController;
}

export type SkuLoaderEvent =
	{ type: "LOAD" } | { type: "RELOAD" } | { type: "CANCEL" };

function to_error(error: unknown): Error {
	return error instanceof Error ? error : new Error(String(error));
}

function is_cached_skus(value: unknown): value is CachedSkus {
	if (typeof value !== "object" || value === null) return false;
	const entry = value as Partial<CachedSkus>;
	return (
		typeof entry.fetched_at === "number" &&
		Number.isFinite(entry.fetched_at) &&
		Array.isArray(entry.skus)
	);
}

export const sku_loader_machine = setup({
	types: {
		input: {} as SkuLoaderInput,
		context: {} as SkuLoaderContext,
		events: {} as SkuLoaderEvent,
	},
	actors: {
		// Resolves null on a miss or a malformed entry. Rejects only if storage
		// itself is unusable (e.g. blocked by site-data settings).
		read_cache: fromPromise<CachedSkus | null>(async () => {
			const raw = globalThis.localStorage.getItem(SKU_CACHE_KEY);
			if (!raw) return null;
			const parsed: unknown = JSON.parse(raw);
			if (is_cached_skus(parsed)) return parsed;
			globalThis.localStorage.removeItem(SKU_CACHE_KEY);
			return null;
		}),
		// Rejects if storage is unavailable or full (the list is ~1 MB).
		write_cache: fromPromise<void, CachedSkus>(async ({ input }) => {
			globalThis.localStorage.setItem(SKU_CACHE_KEY, JSON.stringify(input));
		}),
		fetch_skus: fromPromise<Sku[], { api_key: string; signal: AbortSignal }>(
			// `signal` aborts if the actor is stopped (e.g. the app shuts the loader
			// down); `input.signal` aborts on CANCEL.
			({ input, signal }) =>
				list_skus(input.api_key, {
					signal: AbortSignal.any([signal, input.signal]),
				}),
		),
	},
	actions: {
		start_request: assign({ abort_controller: () => new AbortController() }),
		abort_request: ({ context }) => context.abort_controller.abort(),
		clear_error: assign({ error: null }),
		warn: (_, params: { message: string; error: unknown }) =>
			console.warn(params.message, params.error),
	},
	guards: {
		was_cancelled: ({ context }) => context.abort_controller.signal.aborted,
		has_skus: ({ context }) => context.skus.length > 0,
		is_fresh: ({ context }, params: { entry: CachedSkus | null }) => {
			if (!params.entry) return false;
			const age = Date.now() - params.entry.fetched_at;
			return age >= 0 && age < context.cache_max_age_ms;
		},
	},
}).createMachine({
	id: "sku_loader",
	context: ({ input }) => ({
		api_key: input.api_key,
		cache_max_age_ms: input.cache_max_age_ms,
		skus: [],
		fetched_at: null,
		error: null,
		abort_controller: new AbortController(),
	}),
	initial: "uninitialized",
	states: {
		uninitialized: {
			on: {
				LOAD: "reading_cache",
				RELOAD: { target: "loading", actions: "start_request" },
			},
		},
		reading_cache: {
			invoke: {
				src: "read_cache",
				onDone: [
					{
						guard: {
							type: "is_fresh",
							params: ({ event }) => ({ entry: event.output }),
						},
						target: "loaded",
						actions: assign({
							skus: ({ event }) => event.output?.skus ?? [],
							fetched_at: ({ event }) => event.output?.fetched_at ?? null,
						}),
					},
					{ target: "loading", actions: "start_request" },
				],
				onError: {
					target: "loading",
					actions: [
						{
							type: "warn",
							params: ({ event }) => ({
								message: "Couldn't read the SKU cache:",
								error: event.error,
							}),
						},
						"start_request",
					],
				},
			},
		},
		loading: {
			entry: "clear_error",
			invoke: {
				src: "fetch_skus",
				input: ({ context }) => ({
					api_key: context.api_key,
					signal: context.abort_controller.signal,
				}),
				onDone: [
					// A response that wins the race with CANCEL is discarded.
					{ guard: "was_cancelled", target: "#sku_loader.settle_cancel" },
					{
						target: "writing_cache",
						actions: assign({
							skus: ({ event }) => event.output,
							fetched_at: () => Date.now(),
						}),
					},
				],
				onError: [
					{ guard: "was_cancelled", target: "#sku_loader.settle_cancel" },
					{
						target: "error",
						actions: assign({ error: ({ event }) => to_error(event.error) }),
					},
				],
			},
			initial: "requesting",
			states: {
				requesting: { on: { CANCEL: "cancelling" } },
				cancelling: { entry: "abort_request" },
			},
		},
		// Transient: after a cancel, show the previous SKUs if there are any.
		settle_cancel: {
			always: [
				{ guard: "has_skus", target: "loaded" },
				{ target: "uninitialized" },
			],
		},
		writing_cache: {
			invoke: {
				src: "write_cache",
				input: ({ context }) => ({
					// `fetched_at` is always set by the transition into this state.
					fetched_at: context.fetched_at ?? Date.now(),
					skus: context.skus,
				}),
				onDone: "loaded",
				// The SKUs are still usable; they just won't survive a page reload.
				onError: {
					target: "loaded",
					actions: {
						type: "warn",
						params: ({ event }) => ({
							message: "Couldn't cache SKUs in localStorage:",
							error: event.error,
						}),
					},
				},
			},
		},
		loaded: {
			on: { RELOAD: { target: "loading", actions: "start_request" } },
		},
		error: {
			on: {
				LOAD: { target: "loading", actions: "start_request" },
				RELOAD: { target: "loading", actions: "start_request" },
			},
		},
	},
});
