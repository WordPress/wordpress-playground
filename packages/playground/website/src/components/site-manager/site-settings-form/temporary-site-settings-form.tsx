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
import { TemporarySiteSettingsActionFooter } from './site-settings-action-footer';
import type { SiteSettingsSubmission } from './use-site-settings-submission';

export function TemporarySiteSettingsForm({
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
		await sitesAPI.createNewTemporarySite(
			undefined,
			getSiteSettingsFromFormData(data)
		);
	};
	const defaultValues = useMemo(
		() => getSetupFormDefaultValues(siteInfo),
		[siteInfo]
	);

	return (
		<UnconnectedSiteSettingsForm
			className="is-temporary-site"
			onSubmit={(data) => submission.run(updateSite, data)}
			defaultValues={defaultValues}
			footer={
				<TemporarySiteSettingsActionFooter
					isPending={submission.isPending}
					error={submission.error}
				/>
			}
		/>
	);
}
