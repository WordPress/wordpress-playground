import { useMemo } from 'react';
import { useAppSelector } from '../../../lib/state/redux/store';
import css from './style.module.css';
import {
	Icon,
	Button,
	__experimentalVStack as VStack,
	__experimentalHStack as HStack,
} from '@wordpress/components';
import { info } from '@wordpress/icons';
import { selectSiteBySlug } from '../../../lib/state/redux/slice-sites';
import type { SiteFormData } from './unconnected-site-settings-form';
import { UnconnectedSiteSettingsForm } from './unconnected-site-settings-form';
import { useSitesAPI } from '../../../lib/state/redux/site-management-api-middleware';

export function StoredSiteSettingsForm({
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
		await sitesAPI.setPhpVersion(data.phpVersion);
		await sitesAPI.setNetworking(data.withNetworking);
		onSubmit?.();
	};

	const defaultValues = useMemo<Partial<SiteFormData>>(
		() => ({
			name: siteInfo.metadata.name,
			// @TODO: Handle an unsupported PHP version coming up here
			phpVersion: siteInfo.metadata.runtimeConfiguration
				.phpVersion as any,
			withNetworking: !!siteInfo.metadata.runtimeConfiguration.networking,
		}),
		[siteInfo]
	);

	return (
		<UnconnectedSiteSettingsForm
			className="is-stored-site"
			onSubmit={updateSite}
			defaultValues={defaultValues}
			enabledFields={{
				wpVersion: false,
				language: false,
				multisite: false,
			}}
			header={
				<HStack
					as="p"
					spacing={3}
					className={`${css.notice} ${css.formSection}`}
					style={{ margin: 0 }}
					alignment="center"
					justify="flex-start"
				>
					<Icon icon={info} size={16} />
					<span>
						Stored Playgrounds have limited configuration options.
					</span>
				</HStack>
			}
			footer={
				<VStack
					justify="flex-end"
					spacing={6}
					className={css.formSection}
					style={{ paddingTop: 0 }}
				>
					<Button
						type="submit"
						variant="primary"
						style={{ justifyContent: 'center' }}
					>
						Save & Reload
					</Button>
				</VStack>
			}
		/>
	);
}
