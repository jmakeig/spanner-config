import { createActor } from "xstate";
import { GCP_BROWSER_API_KEY } from "$app/env/public";
import { actor_state } from "#lib/actor.svelte.ts";
import { sku_loader_machine } from "#lib/sku-loader.machine.ts";

// One loader for the whole app, so prices are fetched once and shared by every
// route. A module-level singleton is safe because nothing renders on a server.
// The actor stays private: components use `sku_loader.snapshot` and `.send`.
const actor = createActor(sku_loader_machine, {
	input: { api_key: GCP_BROWSER_API_KEY },
}).start();

export const sku_loader = actor_state(actor);
