<script lang="ts">
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();
</script>

<h1>Cloud Spanner SKUs ({data.skus.length})</h1>
<pre>{JSON.stringify(data.skus, null, 2)}</pre>
