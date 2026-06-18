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

/**
 * Renders the setup settings form for an autosaved Playground.
 *
 * Autosaved Playgrounds represent recoverable unsaved work, so changing setup
 * fields recreates the same autosaved site instead of creating a second site or
 * preserving the previous WordPress files.
 */
export function AutosavedSiteSettingsForm({
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
		await sitesAPI.recreateAutosavedSite(getSiteSettingsFromFormData(data));
		onSubmit?.();
	};
	const defaultValues = useMemo(
		() => getSetupFormDefaultValues(siteInfo),
		[siteInfo]
	);

	return (
		<UnconnectedSiteSettingsForm
			className="is-autosaved-site"
			onSubmit={updateSite}
			defaultValues={defaultValues}
			footer={
				<VStack
					justify="flex-end"
					spacing={6}
					style={{ margin: 0 }}
					className={`${css.footer} ${css.formSection}`}
				>
					<p>
						<b>Destructive action!</b> Applying these settings will
						recreate this autosaved Playground under the same name
						and replace its current WordPress files.
					</p>
					<Button type="submit" variant="primary">
						Apply Settings & Recreate Playground
					</Button>
				</VStack>
			}
		/>
	);
}
