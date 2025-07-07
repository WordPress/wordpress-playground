import { useActiveSite } from '../../../lib/state/redux/store';
import { StoredSiteSettingsForm } from './stored-site-settings-form';
import { TemporarySiteSettingsForm } from './temporary-site-settings-form';

export function ActiveSiteSettingsForm({
	onSubmit,
}: {
	onSubmit?: () => void;
}) {
	const activeSite = useActiveSite();

	if (!activeSite) {
		return null;
	}

	switch (activeSite.metadata?.storage) {
		case 'none':
			return (
				<TemporarySiteSettingsForm
					siteSlug={activeSite.slug}
					onSubmit={onSubmit}
				/>
			);
		case 'opfs':
		case 'local-fs':
			return (
				<StoredSiteSettingsForm
					siteSlug={activeSite.slug}
					onSubmit={onSubmit}
				/>
			);
		default:
			return null;
	}
}
