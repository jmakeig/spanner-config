// Client for the Cloud Billing Catalog API.
// https://cloud.google.com/billing/docs/reference/rest/v1/services.skus/list

/** Cloud Billing API version. Also part of the SKU cache key, so changing it drops cached responses. */
export const BILLING_API_VERSION = "v1";

const API = `https://cloudbilling.googleapis.com/${BILLING_API_VERSION}`;

/** Billing service ID for Cloud Spanner. */
export const SPANNER_SERVICE_ID = "CC63-0873-48FD";

export interface Money {
	currencyCode: string;
	units: string;
	nanos: number;
}

export interface Sku {
	name: string;
	skuId: string;
	description: string;
	category: {
		serviceDisplayName: string;
		resourceFamily: string;
		resourceGroup: string;
		usageType: string;
	};
	serviceRegions: string[];
	pricingInfo: {
		summary: string;
		pricingExpression: {
			usageUnit: string;
			usageUnitDescription: string;
			displayQuantity: number;
			tieredRates: { startUsageAmount: number; unitPrice: Money }[];
		};
		effectiveTime: string;
	}[];
	geoTaxonomy?: { type: string; regions?: string[] };
}

/**
 * A failed call to the Cloud Billing API. `status` is 0 when the request never
 * got a response (offline, DNS, CORS). `reason` is Google's machine-readable
 * reason, e.g. `API_KEY_SERVICE_BLOCKED` or `API_KEY_HTTP_REFERRER_BLOCKED`.
 */
export class BillingApiError extends Error {
	readonly status: number;
	readonly reason: string | undefined;

	constructor(message: string, status: number, reason?: string) {
		super(message);
		this.name = "BillingApiError";
		this.status = status;
		this.reason = reason;
	}

	static async from_response(res: Response): Promise<BillingApiError> {
		const text = await res.text();
		try {
			const { error } = JSON.parse(text) as {
				error: { message: string; details?: { reason?: string }[] };
			};
			const reason = error.details?.find((d) => d.reason)?.reason;
			return new BillingApiError(error.message, res.status, reason);
		} catch {
			return new BillingApiError(
				text || res.statusText || "Request failed",
				res.status,
			);
		}
	}
}

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

/** What the user can do about a billing error, if anything. */
export function billing_error_hint(error: BillingApiError): string | undefined {
	if (error.reason && error.reason in BILLING_HINTS) {
		return BILLING_HINTS[error.reason];
	}
	if (error.status === 0) {
		return "The request didn't reach Google. Check your network connection and reload.";
	}
	if (error.status === 429) return BILLING_HINTS.RATE_LIMIT_EXCEEDED;
	return undefined;
}

/** One-line technical summary, e.g. `403 · API_KEY_INVALID · API key not valid.` */
export function billing_error_detail(error: BillingApiError): string {
	return [error.status || "network", error.reason, error.message]
		.filter(Boolean)
		.join(" · ");
}

export interface ListSkusOptions {
	service_id?: string;
	fetch_fn?: typeof fetch;
	/** Aborting rejects with the signal's reason (an `AbortError`), not a `BillingApiError`. */
	signal?: AbortSignal;
}

/** Fetches every SKU for a billing service, following pagination. */
export async function list_skus(
	api_key: string,
	{
		service_id = SPANNER_SERVICE_ID,
		fetch_fn = fetch,
		signal,
	}: ListSkusOptions = {},
): Promise<Sku[]> {
	const skus: Sku[] = [];
	let page_token: string | undefined;
	do {
		const url = new URL(`${API}/services/${service_id}/skus`);
		url.search = new URLSearchParams({
			key: api_key,
			currencyCode: "USD",
			pageSize: "5000",
			...(page_token && { pageToken: page_token }),
		}).toString();
		let res: Response;
		try {
			res = await fetch_fn(url, signal ? { signal } : {});
		} catch (e) {
			// Cancellation isn't an API failure; let callers tell them apart.
			if (signal?.aborted) throw signal.reason;
			throw new BillingApiError(e instanceof Error ? e.message : String(e), 0);
		}
		if (!res.ok) throw await BillingApiError.from_response(res);
		const body: { skus?: Sku[]; nextPageToken?: string } = await res.json();
		signal?.throwIfAborted();
		skus.push(...(body.skus ?? []));
		page_token = body.nextPageToken || undefined;
	} while (page_token);
	return skus;
}
