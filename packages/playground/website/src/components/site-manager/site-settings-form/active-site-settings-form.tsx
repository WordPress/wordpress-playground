import { useActiveSite } from '../../../lib/state/redux/store';
import { isTemporarySite } from '../../../lib/state/redux/slice-sites';
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

	return isTemporarySite(activeSite) ? (
		<TemporarySiteSettingsForm
			siteSlug={activeSite.slug}
			onSubmit={onSubmit}
		/>
	) : (
		<StoredSiteSettingsForm
			siteSlug={activeSite.slug}
			onSubmit={onSubmit}
		/>
	);
}
