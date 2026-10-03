<script lang="ts">
	import { page } from "$app/state";

	const titles: Record<App.Error["code"], string> = {
		"billing-api": "Pricing data unavailable",
		"not-found": "Page not found",
		unexpected: "Something went wrong",
	};
</script>

{#if page.error}
	<div role="alert">
		<h1>{titles[page.error.code] ?? titles.unexpected}</h1>
		<p>{page.error.message}</p>
		{#if page.error.hint}
			<p>{page.error.hint}</p>
		{/if}
		{#if page.error.detail}
			<details>
				<summary>Details ({page.status})</summary>
				<pre>{page.error.detail}</pre>
			</details>
		{/if}
		<p>
			{#if page.error.code === "not-found"}
				<a href="/">Go to the home page</a>
			{:else}
				<button onclick={() => location.reload()}>Try again</button>
			{/if}
		</p>
	</div>
{/if}
