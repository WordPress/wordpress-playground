import type { LocalFsAvailability } from '../../lib/hooks/use-local-fs-availability';

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
