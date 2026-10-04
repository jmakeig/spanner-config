<script lang="ts">
	import favicon from "#lib/assets/favicon.svg";
	import { sku_loader } from "#lib/sku-loader.svelte.ts";

	let { children } = $props();

	// Preload prices as soon as the app starts, whichever route it opens on.
	sku_loader.send({ type: "LOAD" });
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
