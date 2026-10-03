import type { HandleClientError } from "@sveltejs/kit/hooks";
import { BillingApiError } from "#lib/billing.ts";

// Hints for Google's error reasons, keyed by `error.details[].reason`.
const BILLING_HINTS: Record<string, string> = {
	API_KEY_SERVICE_BLOCKED:
		"The API key isn't allowed to call the Cloud Billing API. Add it under the key's API restrictions.",
	API_KEY_HTTP_REFERRER_BLOCKED:
		"The API key doesn't allow requests from this site. Add this site's address under the key's website restrictions.",
	API_KEY_INVALID: "The API key is invalid. Check GCP_BROWSER_API_KEY.",
	SERVICE_DISABLED:
		"The Cloud Billing API isn't enabled for the key's project. Enable it in the Google Cloud console.",
	RATE_LIMIT_EXCEEDED:
		"Too many requests to the Cloud Billing API. Wait a minute and reload.",
};

function billing_hint(error: BillingApiError): string | undefined {
	if (error.reason && error.reason in BILLING_HINTS) {
		return BILLING_HINTS[error.reason];
	}
	if (error.status === 0) {
		return "The request didn't reach Google. Check your network connection and reload.";
	}
	if (error.status === 429) return BILLING_HINTS.RATE_LIMIT_EXCEEDED;
	return undefined;
}

export const handleError: HandleClientError = ({ kind, error, event }) => {
	switch (kind) {
		case "app":
			return error;
		case "framework":
			return {
				code: error.status === 404 ? "not-found" : "unexpected",
				detail: event.url.pathname,
			};
		case "unknown":
			console.error(error);
			if (error instanceof BillingApiError) {
				const hint = billing_hint(error);
				return {
					status: 502,
					code: "billing-api",
					message: "Couldn't load Spanner prices from Google Cloud.",
					// exactOptionalPropertyTypes: omit `hint` rather than set it to undefined.
					...(hint && { hint }),
					detail: [error.status || "network", error.reason, error.message]
						.filter(Boolean)
						.join(" · "),
				};
			}
			return {
				code: "unexpected",
				message: "Something went wrong.",
				detail: error instanceof Error ? error.message : String(error),
			};
	}
};
