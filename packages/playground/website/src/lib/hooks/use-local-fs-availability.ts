import type { PlaygroundClient } from '@wp-playground/client';
import { getRemoteUrl } from '../config';

export type LocalFsAvailability =
	| 'available'
	| 'not-available'
	| 'origin-mismatch';

/**
 * Reports whether the trusted PHP iframe can receive user-picked directories.
 *
 * Directory handles cannot be sent across origins. Check remote.html's origin,
 * not the rendered WordPress URL, which may use a separate origin.
 * A missing client reports no result while its PHP iframe is booting, so the
 * previous Playground cannot briefly enable local-directory saves for the next one.
 */
export function useLocalFsAvailability(
	playground?: PlaygroundClient
): LocalFsAvailability | null {
	if (!playground) {
		return null;
	}
	if (!(window as any).showDirectoryPicker) {
		return 'not-available';
	}
	return getRemoteUrl().origin === window.location.origin
		? 'available'
		: 'origin-mismatch';
}
