import type { PlaygroundClient } from '@wp-playground/client';
import { getRemoteUrl } from '../config';

export type LocalFsAvailability =
	| 'available'
	| 'not-available'
	| 'origin-mismatch';

/**
 * Checks whether the current Playground can save files to a local directory.
 *
 * The app opens the directory picker and sends the chosen directory's handle to
 * remote.html so PHP can read and write its files. The browser allows this only
 * when the app and remote.html share an origin (scheme, host, and port).
 * WordPress may use a different origin: its page never receives the handle.
 *
 * Return null until this Playground's client exists. When switching sites, keep
 * local-directory saves disabled while the new client is still starting.
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
