import { isAutosavedSite } from '../../../lib/state/redux/slice-sites';
import { AutosavedSiteSettingsForm } from './autosaved-site-settings-form';
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
			// Autosaved Playgrounds need recovery-specific action copy and
			// retention behavior. Explicit OPFS Playgrounds share the stored-site
			// flow with local directory Playgrounds.
			if (isAutosavedSite(activeSite)) {
				return (
					<AutosavedSiteSettingsForm
						siteSlug={activeSite.slug}
						onSubmit={onSubmit}
					/>
				);
			}

			return (
				<StoredSiteSettingsForm
					siteSlug={activeSite.slug}
					onSubmit={onSubmit}
				/>
			);
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
