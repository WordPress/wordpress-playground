import type { PlaygroundClient } from '@wp-playground/remote';

type SiteFirstBootInitializer = (playground: PlaygroundClient) => Promise<void>;

interface PendingInitializer {
	initialize: SiteFirstBootInitializer;
	resolve: () => void;
	reject: (error: unknown) => void;
}

const pendingInitializers = new Map<string, PendingInitializer>();

/**
 * Registers work that must modify a new site's MEMFS before its first OPFS
 * copy. `finished` settles after boot runs that work. Cancellation removes
 * unconsumed work and resolves `finished`; callers handle the cancellation
 * reason separately.
 */
export function registerSiteFirstBootInitializer(
	siteSlug: string,
	initialize: SiteFirstBootInitializer
) {
	if (pendingInitializers.has(siteSlug)) {
		throw new Error(
			`Site already has a first-boot initializer: ${siteSlug}`
		);
	}

	let resolve!: () => void;
	let reject!: (error: unknown) => void;
	const finished = new Promise<void>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	const pending = { initialize, resolve, reject };
	pendingInitializers.set(siteSlug, pending);

	return {
		finished,
		cancel() {
			if (pendingInitializers.get(siteSlug) === pending) {
				pendingInitializers.delete(siteSlug);
				resolve();
			}
		},
	};
}

/** Runs and consumes a site's pending first-boot initializer, if any. */
export async function runSiteFirstBootInitializer(
	siteSlug: string,
	playground: PlaygroundClient
) {
	const pending = pendingInitializers.get(siteSlug);
	if (!pending) {
		return;
	}
	pendingInitializers.delete(siteSlug);

	try {
		await pending.initialize(playground);
		pending.resolve();
	} catch (error) {
		pending.reject(error);
		throw error;
	}
}
