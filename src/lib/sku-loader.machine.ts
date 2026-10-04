// State machine that loads Spanner SKUs from the Cloud Billing Catalog API.
//
//   uninitialized ──LOAD──▶ loading.requesting ──done──▶ loaded
//         ▲                  │            │
//         │               CANCEL        error
//         │                  ▼            ▼
//         └──settled── loading.cancelling   error ──LOAD──▶ loading
//
// `cancelling` is nested inside `loading` so the invoked request stays alive
// until the abort actually settles. Leaving `loading` would stop the actor
// immediately, and a response racing the abort could otherwise slip through.

import { assign, fromPromise, setup } from "xstate";
import { list_skus, type Sku } from "#lib/billing.ts";

export interface SkuLoaderInput {
	api_key: string;
}

export interface SkuLoaderContext {
	api_key: string;
	skus: Sku[];
	error: Error | null;
	/** Replaced on every LOAD, so it always belongs to the current request. */
	abort_controller: AbortController;
}

export type SkuLoaderEvent = { type: "LOAD" } | { type: "CANCEL" };

function to_error(error: unknown): Error {
	return error instanceof Error ? error : new Error(String(error));
}

export const sku_loader_machine = setup({
	types: {
		input: {} as SkuLoaderInput,
		context: {} as SkuLoaderContext,
		events: {} as SkuLoaderEvent,
	},
	actors: {
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
	},
	guards: {
		was_cancelled: ({ context }) => context.abort_controller.signal.aborted,
	},
}).createMachine({
	id: "sku_loader",
	context: ({ input }) => ({
		api_key: input.api_key,
		skus: [],
		error: null,
		abort_controller: new AbortController(),
	}),
	initial: "uninitialized",
	states: {
		uninitialized: {
			on: { LOAD: { target: "loading", actions: "start_request" } },
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
					{ guard: "was_cancelled", target: "uninitialized" },
					{
						target: "loaded",
						actions: assign({ skus: ({ event }) => event.output }),
					},
				],
				onError: [
					{ guard: "was_cancelled", target: "uninitialized" },
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
		loaded: {},
		error: {
			on: { LOAD: { target: "loading", actions: "start_request" } },
		},
	},
});
