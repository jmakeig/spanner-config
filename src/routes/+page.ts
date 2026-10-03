import { GCP_BROWSER_API_KEY } from "$app/env/public";
import { list_skus } from "#lib/billing.ts";
import type { PageLoad } from "./$types";

// Failures throw BillingApiError, which hooks.client.ts turns into App.Error.
export const load: PageLoad = async ({ fetch }) => ({
	skus: await list_skus(GCP_BROWSER_API_KEY, undefined, fetch),
});
