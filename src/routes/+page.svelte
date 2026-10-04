<script lang="ts">
	import {
		BillingApiError,
		billing_error_detail,
		billing_error_hint,
	} from "#lib/billing.ts";
	import { sku_loader } from "#lib/sku-loader.svelte.ts";

	const snapshot = $derived(sku_loader.snapshot);
	const load = () => sku_loader.send({ type: "LOAD" });
	const cancel = () => sku_loader.send({ type: "CANCEL" });
</script>

{#if snapshot.matches("uninitialized")}
	<p>Spanner prices aren't loaded.</p>
	<button onclick={load}>Load prices</button>
{:else if snapshot.matches({ loading: "cancelling" })}
	<p aria-live="polite">Cancelling…</p>
{:else if snapshot.matches("loading")}
	<p aria-live="polite">Loading Spanner prices from Google Cloud…</p>
	<button onclick={cancel}>Cancel</button>
{:else if snapshot.matches("loaded")}
	<h1>Cloud Spanner SKUs ({snapshot.context.skus.length})</h1>
	<pre>{JSON.stringify(snapshot.context.skus, null, 2)}</pre>
{:else if snapshot.matches("error")}
	{@const error = snapshot.context.error}
	<div role="alert">
		<h1>Pricing data unavailable</h1>
		<p>Couldn't load Spanner prices from Google Cloud.</p>
		{#if error instanceof BillingApiError}
			{@const hint = billing_error_hint(error)}
			{#if hint}<p>{hint}</p>{/if}
			<details>
				<summary>Details</summary>
				<pre>{billing_error_detail(error)}</pre>
			</details>
		{:else if error}
			<details>
				<summary>Details</summary>
				<pre>{error.message}</pre>
			</details>
		{/if}
		<button onclick={load}>Try again</button>
	</div>
{/if}
