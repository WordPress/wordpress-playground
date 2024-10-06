import { useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../../../lib/state/redux/store';
import css from './style.module.css';
import {
	Icon,
	Button,
	__experimentalVStack as VStack,
	__experimentalHStack as HStack,
} from '@wordpress/components';
import { info } from '@wordpress/icons';
import {
	selectSiteBySlug,
	updateSiteMetadata,
} from '../../../lib/state/redux/slice-sites';
import {
	SiteFormData,
	UnconnectedSiteSettingsForm,
} from './unconnected-site-settings-form';

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
	const dispatch = useAppDispatch();
	const updateSite = async (data: SiteFormData) => {
		await dispatch(
			updateSiteMetadata({
				slug: siteSlug,
				changes: {
					name: data.name,
					runtimeConfiguration: {
						...siteInfo.metadata.runtimeConfiguration,
						features: {
							...siteInfo.metadata.runtimeConfiguration.features,
							networking: data.withNetworking,
						},
						phpExtensionBundles: data.withExtensions
							? ['kitchen-sink']
							: ['light'],
						preferredVersions: {
							...siteInfo.metadata.runtimeConfiguration
								.preferredVersions,
							php: data.phpVersion,
						},
					},
				},
			})
		);
		onSubmit?.();
		// @TODO: Display a notification "site updated"
	};

	const defaultValues = useMemo<Partial<SiteFormData>>(
		() => ({
			name: siteInfo.metadata.name,
			// @TODO: Handle an unsupported PHP version coming up here
			phpVersion: siteInfo.metadata.runtimeConfiguration.preferredVersions
				.php as any,
			withExtensions:
				siteInfo.metadata.runtimeConfiguration.phpExtensionBundles.includes(
					'kitchen-sink'
				),
			withNetworking:
				!!siteInfo.metadata.runtimeConfiguration.features.networking,
		}),
		[siteInfo]
	);

	return (
		<UnconnectedSiteSettingsForm
			onSubmit={updateSite}
			defaultValues={defaultValues}
			enabledFields={{
				name: true,
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
