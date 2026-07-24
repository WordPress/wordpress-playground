import { logger } from '@php-wasm/logger';
import type { PlaygroundClient } from '@wp-playground/client';
import type { PlaygroundDispatch } from './store';
import { updateSiteMetadata } from './slice-sites';

/**
 * Captures and stores a thumbnail without making thumbnail failure fail the
 * save or boot operation that made the Playground available.
 */
export async function captureAndPersistSiteThumbnail({
	playground,
	siteSlug,
	dispatch,
}: {
	playground: PlaygroundClient;
	siteSlug: string;
	dispatch: PlaygroundDispatch;
}) {
	try {
		const thumbnail = await playground.captureSiteThumbnail();
		await dispatch(
			updateSiteMetadata({
				slug: siteSlug,
				changes: { thumbnail },
			})
		);
	} catch (error) {
		logger.warn('Could not update saved Playground thumbnail', error);
	}
}
