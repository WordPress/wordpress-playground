import { useMemo } from 'react';
import { useAppSelector } from '../../../lib/state/redux/store';
import { selectSiteBySlug } from '../../../lib/state/redux/slice-sites';
import type { SiteFormData } from './unconnected-site-settings-form';
import { UnconnectedSiteSettingsForm } from './unconnected-site-settings-form';
import { useSitesAPI } from '../../../lib/state/redux/site-management-api-middleware';
import {
	getSetupFormDefaultValues,
	getSiteSettingsFromFormData,
} from './setup-form-values';
import { SiteSettingsActionFooter } from './site-settings-action-footer';
import type { SiteSettingsSubmission } from './use-site-settings-submission';

/**
 * Renders the setup settings form for an autosaved Playground.
 *
 * PHP and networking can be applied to the current Playground. Setup changes
 * create a fresh autosaved Playground while preserving the current one.
 */
export function AutosavedSiteSettingsForm({
	siteSlug,
	submission,
}: {
	siteSlug: string;
	submission: SiteSettingsSubmission;
}) {
	const siteInfo = useAppSelector((state) =>
		selectSiteBySlug(state, siteSlug)
	)!;
	const sitesAPI = useSitesAPI();
	const updateSite = async (data: SiteFormData) => {
		await sitesAPI.updateRuntimeSettings({
			phpVersion: data.phpVersion,
			networking: data.withNetworking,
		});
	};
	const createFreshSite = async (data: SiteFormData) => {
		await sitesAPI.createNewSavedSite(
			undefined,
			getSiteSettingsFromFormData(data),
			{
				persistence: 'autosave',
				excludeFromPruning: [siteSlug],
			}
		);
	};
	const defaultValues = useMemo(
		() => getSetupFormDefaultValues(siteInfo),
		[siteInfo]
	);

	return (
		<UnconnectedSiteSettingsForm
			className="is-autosaved-site"
			onSubmit={(data) => submission.run(updateSite, data)}
			defaultValues={defaultValues}
			footer={(context) => (
				<SiteSettingsActionFooter
					{...context}
					sitePersistence="autosave"
					onApply={(data) => submission.run(updateSite, data)}
					onCreateFresh={(data) =>
						submission.run(createFreshSite, data)
					}
					isPending={submission.isPending}
					error={submission.error}
				/>
			)}
		/>
	);
}
