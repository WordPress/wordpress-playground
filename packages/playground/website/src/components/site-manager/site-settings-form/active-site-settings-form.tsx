import { isAutosavedSite } from '../../../lib/state/redux/slice-sites';
import { AutosavedSiteSettingsForm } from './autosaved-site-settings-form';
import { useActiveSite } from '../../../lib/state/redux/store';
import { StoredSiteSettingsForm } from './stored-site-settings-form';
import { TemporarySiteSettingsForm } from './temporary-site-settings-form';
import { useSiteSettingsSubmission } from './use-site-settings-submission';

export function ActiveSiteSettingsForm({
	onSubmit,
}: {
	onSubmit?: () => void;
}) {
	const activeSite = useActiveSite();
	// Keep one submission guard above the site-type switch. Creating a fresh
	// autosave from an explicitly saved Playground changes the rendered form
	// before the new runtime finishes booting, but it must not unlock the action.
	const submission = useSiteSettingsSubmission(onSubmit);

	if (!activeSite) {
		return null;
	}

	switch (activeSite.metadata?.storage) {
		case 'none':
			return (
				<TemporarySiteSettingsForm
					siteSlug={activeSite.slug}
					submission={submission}
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
						submission={submission}
					/>
				);
			}

			return (
				<StoredSiteSettingsForm
					siteSlug={activeSite.slug}
					submission={submission}
				/>
			);
		case 'local-fs':
			return (
				<StoredSiteSettingsForm
					siteSlug={activeSite.slug}
					submission={submission}
				/>
			);
		default:
			return null;
	}
}
