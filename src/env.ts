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
});
