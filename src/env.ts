import { defineEnvVars } from "@sveltejs/kit/env";

export const variables = defineEnvVars({
	GCP_BROWSER_API_KEY: {
		public: true,
		// No server at runtime, so the value must be inlined at build time.
		static: true,
		description:
			"Google Cloud API key for the Cloud Billing Catalog API. Ships in the client bundle, so restrict it to the Cloud Billing API and this site's HTTP referrers.",
		schema: (value) => {
			if (!value) throw new Error("GCP_BROWSER_API_KEY must be set");
			return value;
		},
	},
	SKU_CACHE_MAX_AGE_HOURS: {
		public: true,
		static: true,
		description:
			"How long SKUs cached in localStorage are reused before refetching from the API, in hours. Defaults to 336 (two weeks); 0 always refetches.",
		schema: (value) => {
			if (value === undefined || value.trim() === "") return 14 * 24;
			const hours = Number(value);
			if (!Number.isFinite(hours) || hours < 0) {
				throw new Error(
					`SKU_CACHE_MAX_AGE_HOURS must be a non-negative number of hours, got "${value}"`,
				);
			}
			return hours;
		},
	},
});
