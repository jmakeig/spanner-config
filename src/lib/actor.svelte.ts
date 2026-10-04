import type { AnyActorRef, SnapshotFrom } from "xstate";

/**
 * Mirrors an XState actor's snapshot into Svelte state. Read `snapshot` in a
 * component or `$derived` and it re-renders on every transition; call `send`
 * to dispatch events. Exposing both means callers never need the raw actor,
 * whose `getSnapshot()` isn't reactive.
 *
 * Uses `$state.raw` because snapshots are immutable and replaced wholesale; a
 * deep proxy would be wasted work and would wrap non-plain values in context.
 */
export function actor_state<TActor extends AnyActorRef>(actor: TActor) {
	let snapshot: SnapshotFrom<TActor> = $state.raw(actor.getSnapshot());
	const subscription = actor.subscribe((next: SnapshotFrom<TActor>) => {
		snapshot = next;
	});
	return {
		get snapshot() {
			return snapshot;
		},
		// The cast is needed: `bind` on a generic actor widens the event type to
		// `any`, which would let misspelled events through.
		send: actor.send.bind(actor) as TActor["send"],
		unsubscribe: () => subscription.unsubscribe(),
	};
}
