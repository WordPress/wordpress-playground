import { useMemo } from 'react';
import css from './style.module.css';
import { Button, __experimentalVStack as VStack } from '@wordpress/components';
import { useAppSelector } from '../../../lib/state/redux/store';
import { selectSiteBySlug } from '../../../lib/state/redux/slice-sites';
import type { SiteFormData } from './unconnected-site-settings-form';
import { UnconnectedSiteSettingsForm } from './unconnected-site-settings-form';
import { useSitesAPI } from '../../../lib/state/redux/site-management-api-middleware';
import {
	getSetupFormDefaultValues,
	getSiteSettingsFromFormData,
} from './setup-form-values';

export function TemporarySiteSettingsForm({
	siteSlug,
	onSubmit,
}: {
	siteSlug: string;
	onSubmit?: () => void;
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
		onSubmit?.();
	};
	const defaultValues = useMemo(
		() => getSetupFormDefaultValues(siteInfo),
		[siteInfo]
	);

	return (
		<UnconnectedSiteSettingsForm
			className="is-temporary-site"
			onSubmit={updateSite}
			defaultValues={defaultValues}
			footer={
				<VStack
					justify="flex-end"
					spacing={6}
					style={{ margin: 0 }}
					className={`${css.footer} ${css.formSection}`}
				>
					<p className={css.footerNote}>
						Applying changes rebuilds the Playground from its
						initial state, discarding the current site.
					</p>
					<Button type="submit" variant="primary" isDestructive>
						Apply Settings & Reset Playground
					</Button>
				</VStack>
			}
		/>
	);
}
