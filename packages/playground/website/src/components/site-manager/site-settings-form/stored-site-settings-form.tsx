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

export function StoredSiteSettingsForm({
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

	const defaultValues = useMemo<Partial<SiteFormData>>(
		() => getSetupFormDefaultValues(siteInfo),
		[siteInfo]
	);

	return (
		<UnconnectedSiteSettingsForm
			className="is-stored-site"
			onSubmit={(data) => submission.run(updateSite, data)}
			defaultValues={defaultValues}
			footer={(context) => (
				<SiteSettingsActionFooter
					{...context}
					siteName={siteInfo.metadata.name}
					sitePersistence="explicit"
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
