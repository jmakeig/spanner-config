import type { HandleClientError } from "@sveltejs/kit/hooks";
import {
	BillingApiError,
	billing_error_detail,
	billing_error_hint,
} from "#lib/billing.ts";

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
				const hint = billing_error_hint(error);
				return {
					status: 502,
					code: "billing-api",
					message: "Couldn't load Spanner prices from Google Cloud.",
					// exactOptionalPropertyTypes: omit `hint` rather than set it to undefined.
					...(hint && { hint }),
					detail: billing_error_detail(error),
				};
			}
			return {
				code: "unexpected",
				message: "Something went wrong.",
				detail: error instanceof Error ? error.message : String(error),
			};
	}
};
