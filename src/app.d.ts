// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Error {
			status: number;
			message: string;
			/** Category used by +error.svelte to pick a title. */
			code: "billing-api" | "not-found" | "unexpected";
			/** What the user can do about it, if anything. */
			hint?: string;
			/** Raw technical detail, shown collapsed. */
			detail?: string;
		}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
