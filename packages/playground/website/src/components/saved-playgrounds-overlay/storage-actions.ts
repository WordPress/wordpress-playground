import type { LocalFsAvailability } from '../../lib/hooks/use-local-fs-availability';

/**
 * Classifies which save actions should be shown for a Playground.
 *
 * Temporary and autosaved Playgrounds can still be persisted somewhere else.
 * Explicitly stored Playgrounds already have durable storage, so the overlay
 * should not offer another browser-storage or local-directory save action.
 */
export function getPlaygroundStorageActions({
	isTemporary,
	isAutosave,
	isOpfsAvailable,
	localFsAvailability,
}: {
	isTemporary: boolean;
	isAutosave: boolean;
	isOpfsAvailable: boolean;
	localFsAvailability: LocalFsAvailability | null;
}) {
	const canPersistSite = isTemporary || isAutosave;
	return {
		canStoreInBrowser: canPersistSite && isOpfsAvailable,
		canSaveToLocal: canPersistSite && localFsAvailability === 'available',
	};
}
