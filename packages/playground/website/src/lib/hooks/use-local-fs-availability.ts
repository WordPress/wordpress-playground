import type { PlaygroundClient } from '@wp-playground/client';
import { logger } from '@php-wasm/logger';
import { useState, useEffect } from 'react';

export type LocalFsAvailability =
	| 'available'
	| 'not-available'
	| 'origin-mismatch';

/**
 * Checks whether the current Playground can receive File System Access handles.
 *
 * Directory handles cannot be proxied to a cross-origin iframe, so the browser
 * API existing on the parent page is not enough.
 */
async function determineLocalFsAvailability(
	playground: PlaygroundClient
): Promise<LocalFsAvailability> {
	if (!(window as any).showDirectoryPicker) {
		return 'not-available';
	}
	const isSameOriginAsPlayground =
		new URL(await playground.absoluteUrl).origin === window.location.origin;

	if (!isSameOriginAsPlayground) {
		return 'origin-mismatch';
	}

	return 'available';
}

/**
 * Reports whether the current iframe can save to a user-picked directory.
 *
 * The result is reset while a new iframe is booting so UI from the previous
 * Playground does not briefly enable local-directory saves for the next one.
 */
export function useLocalFsAvailability(playground?: PlaygroundClient) {
	const [isAvailable, setIsAvailable] = useState<LocalFsAvailability | null>(
		null
	);

	useEffect(() => {
		let cancelled = false;
		async function check() {
			if (!playground) {
				setIsAvailable(null);
				return;
			}
			setIsAvailable(null);
			try {
				const availability =
					await determineLocalFsAvailability(playground);
				if (!cancelled) {
					setIsAvailable(availability);
				}
			} catch (error) {
				logger.error(
					'Error checking local directory save availability.',
					error
				);
				if (!cancelled) {
					setIsAvailable('not-available');
				}
			}
		}
		check();
		return () => {
			cancelled = true;
		};
	}, [playground]);

	return isAvailable;
}
