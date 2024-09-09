import { SyncLocalFilesButton } from './sync-local-files-button';
import { useActiveSite } from '../../lib/redux-store';

export default function PlaygroundConfigurationGroup() {
	const activeSite = useActiveSite()!;
	return activeSite?.metadata?.storage === 'local-fs' ? (
		<SyncLocalFilesButton />
	) : null;
}
