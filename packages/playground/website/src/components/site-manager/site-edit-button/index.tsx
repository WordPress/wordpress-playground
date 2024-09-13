import { Modal } from '@wordpress/components';
import { useMemo, useState } from 'react';
import { useAppSelector, useAppDispatch } from '../../../lib/state/redux/store';
import SiteSettingsForm, { SiteFormData } from '../site-settings-form';
import {
	selectSiteBySlug,
	updateSiteMetadata,
} from '../../../lib/state/redux/slice-sites';
import { redirectTo, PlaygroundRoute } from '../../../lib/state/url/router';
import { randomSiteName } from '../../../lib/state/redux/random-site-name';

export function SiteEditButton({
	siteSlug,
	children,
}: {
	siteSlug: string;
	children: (onClick: () => void) => React.ReactNode;
}) {
	const siteInfo = useAppSelector((state) =>
		selectSiteBySlug(state, siteSlug)
	)!;
	if (siteInfo.metadata.storage === 'none') {
		return (
			<InMemorySiteEditButton siteSlug={siteSlug} children={children} />
		);
	}
	return <StoredSiteEditButton siteSlug={siteSlug} children={children} />;
}

function StoredSiteEditButton({
	siteSlug,
	children,
}: {
	siteSlug: string;
	children: (onClick: () => void) => React.ReactNode;
}) {
	const siteInfo = useAppSelector((state) =>
		selectSiteBySlug(state, siteSlug)
	)!;
	const [isModalOpen, setModalOpen] = useState(false);
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
		// @TODO: Display a notification "site updated"
		setModalOpen(false);
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
		<div>
			{children(() => setModalOpen(true))}

			{isModalOpen && (
				<Modal
					title="Edit site settings"
					onRequestClose={() => setModalOpen(false)}
				>
					<SiteSettingsForm
						onSubmit={updateSite}
						onCancel={() => setModalOpen(false)}
						submitButtonText="Update"
						formFields={{
							name: true,
							phpVersion: true,
							withExtensions: true,
							withNetworking: true,
						}}
						defaultValues={defaultValues}
					/>
				</Modal>
			)}
		</div>
	);
}

function InMemorySiteEditButton({
	siteSlug,
	children,
}: {
	siteSlug: string;
	children: (onClick: () => void) => React.ReactNode;
}) {
	const siteInfo = useAppSelector((state) =>
		selectSiteBySlug(state, siteSlug)
	)!;
	const [isModalOpen, setModalOpen] = useState(false);
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
		// @TODO: Display a notification "site updated"
		setModalOpen(false);
	};
	const defaultValues = useMemo<Partial<SiteFormData>>(() => {
		const searchParams = siteInfo.originalUrlParams?.searchParams || {};
		const runtimeConf = siteInfo.metadata?.runtimeConfiguration || {};
		return {
			// @TODO: Populate with the site name from the original URL params and
			//        when the site is saved, update it instead of creating a new temp site.
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
		<div>
			{children(() => setModalOpen(true))}

			{isModalOpen && (
				<Modal
					title="Edit site settings"
					onRequestClose={() => setModalOpen(false)}
				>
					<SiteSettingsForm
						onSubmit={updateSite}
						onCancel={() => setModalOpen(false)}
						submitButtonText="Update"
						defaultValues={defaultValues}
					/>
				</Modal>
			)}
		</div>
	);
}
