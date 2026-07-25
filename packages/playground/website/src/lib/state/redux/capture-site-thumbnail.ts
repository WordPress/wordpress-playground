import { logger } from '@php-wasm/logger';
import type { PlaygroundClient } from '@wp-playground/client';
import { selectClientBySiteSlug } from './slice-clients';
import type { PlaygroundDispatch, PlaygroundReduxState } from './store';
import { updateSiteMetadata } from './slice-sites';

const latestCaptureBySiteSlug = new Map<string, symbol>();

/**
 * Captures and stores a thumbnail without making thumbnail failure fail the
 * save or boot operation that made the Playground available.
 *
 * `captureSiteThumbnail()` cannot be cancelled. Only the newest request for a
 * site in this tab may write, and only while Redux still owns the client that
 * started it.
 */
export async function captureAndPersistSiteThumbnail({
	playground,
	siteSlug,
	dispatch,
	getState,
	signal,
}: {
	playground: PlaygroundClient;
	siteSlug: string;
	dispatch: PlaygroundDispatch;
	getState: () => PlaygroundReduxState;
	signal?: AbortSignal;
}) {
	if (
		signal?.aborted ||
		selectClientBySiteSlug(getState(), siteSlug) !== playground
	) {
		return;
	}

	const captureRequest = Symbol();
	latestCaptureBySiteSlug.set(siteSlug, captureRequest);
	try {
		const thumbnail = await playground.captureSiteThumbnail();
		/*
		 * Rendering cannot be cancelled. By the time it returns, this iframe may
		 * already be dead or a newer capture may have started. Do not let that
		 * stale result touch saved metadata.
		 */
		if (
			signal?.aborted ||
			latestCaptureBySiteSlug.get(siteSlug) !== captureRequest ||
			selectClientBySiteSlug(getState(), siteSlug) !== playground
		) {
			return;
		}
		await dispatch(
			updateSiteMetadata({
				slug: siteSlug,
				changes: { thumbnail },
			})
		);
	} catch (error) {
		if (
			signal?.aborted ||
			latestCaptureBySiteSlug.get(siteSlug) !== captureRequest ||
			selectClientBySiteSlug(getState(), siteSlug) !== playground
		) {
			return;
		}
		logger.warn('Could not update saved Playground thumbnail', error);
	} finally {
		if (latestCaptureBySiteSlug.get(siteSlug) === captureRequest) {
			latestCaptureBySiteSlug.delete(siteSlug);
		}
	}
}
