import { useMemo } from 'react';
import css from './style.module.css';
import { Button, __experimentalVStack as VStack } from '@wordpress/components';
import { useAppSelector } from '../../../lib/state/redux/store';
import { selectSiteBySlug } from '../../../lib/state/redux/slice-sites';
import { redirectTo, PlaygroundRoute } from '../../../lib/state/url/router';
import { randomSiteName } from '../../../lib/state/redux/random-site-name';
import {
	SiteFormData,
	UnconnectedSiteSettingsForm,
} from './unconnected-site-settings-form';

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
	const updateSite = async (data: SiteFormData) => {
		redirectTo(
			PlaygroundRoute.newTemporarySite({
				...(siteInfo.originalUrlParams || {}),
				query: {
					php: data.phpVersion,
					wp: data.wpVersion,
					name: data.name,
					networking: data.withNetworking ? 'yes' : 'no',
					'php-extension-bundle': data.withExtensions
						? 'kitchen-sink'
						: 'light',
					language: data.language,
					multisite: data.multisite ? 'yes' : 'no',
				},
			})
		);
		onSubmit?.();
		// @TODO: Display a notification of updated site or forked site
	};
	const defaultValues = useMemo<Partial<SiteFormData>>(() => {
		const searchParams = siteInfo.originalUrlParams?.searchParams || {};
		const runtimeConf = siteInfo.metadata?.runtimeConfiguration || {};
		return {
			// @TODO: Choose one:
			// - Populate with the site name from the original URL params and
			//   when the site is saved, update it instead of creating a new temp site.
			// - Fork existing site and populate with new random name.
			// - Allow user to choose between Fork and Edit operations
			name: randomSiteName(),
			phpVersion: runtimeConf?.preferredVersions?.php as any,
			wpVersion: runtimeConf?.preferredVersions?.wp as any,
			withNetworking: runtimeConf?.features?.networking,
			withExtensions:
				runtimeConf?.phpExtensionBundles?.includes('kitchen-sink'),
			language: 'language' in searchParams ? searchParams.language : '',
			multisite:
				'multisite' in searchParams
					? searchParams.multisite === 'yes'
					: false,
		};
	}, [siteInfo]);

	return (
		<UnconnectedSiteSettingsForm
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
						reset the WordPress site to its initial state.
					</p>
					<Button type="submit" variant="primary">
						Save & Reset Playground
					</Button>
				</VStack>
			}
		/>
	);
}
