import {
	Modal,
	__experimentalConfirmDialog as ConfirmDialog,
} from '@wordpress/components';
import { useMemo, useState } from 'react';
import { useAppSelector } from '../../../lib/state/redux/store';
import SiteSettingsForm, { SiteFormData } from '../site-settings-form';
import { selectSiteBySlug } from '../../../lib/state/redux/slice-sites';
import { redirectTo, PlaygroundRoute } from '../../../lib/state/url/router';
import { randomSiteName } from '../../../lib/state/redux/random-site-name';

export function StartSimilarSiteButton({
	siteSlug,
	children,
}: {
	siteSlug: string;
	children: (onClick: () => void) => React.ReactNode;
}) {
	const [confirmDialogSiteFormData, setConfirmDialogSiteFormData] = useState<
		SiteFormData | false
	>(false);
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
		// @TODO: Display a notification of updated site or forked site
		setModalOpen(false);
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
		<div>
			{children(() => setModalOpen(true))}
			<ConfirmDialog
				isOpen={!!confirmDialogSiteFormData}
				onConfirm={() =>
					updateSite(confirmDialogSiteFormData as SiteFormData)
				}
				onCancel={() => setConfirmDialogSiteFormData(false)}
				title="Confirm Playground settings update"
				confirmButtonText="Reset and update"
			>
				<p>
					By updating Playground settings on a temporary site, <br />
					you will reset the Playground and lose all changes you made
					<br />
					previously.
				</p>
				<p>
					If you want to keep the changes you made previously, <br />
					you can cancel this dialog, Click Save in Playground details{' '}
					<br />
					and update settings after the site is saved.
				</p>
			</ConfirmDialog>
			{isModalOpen && (
				<Modal
					title="Edit Playground settings"
					onRequestClose={() => setModalOpen(false)}
				>
					<SiteSettingsForm
						onSubmit={(data: SiteFormData) =>
							setConfirmDialogSiteFormData(data)
						}
						onCancel={() => setModalOpen(false)}
						submitButtonText="Update"
						defaultValues={defaultValues}
					/>
				</Modal>
			)}
		</div>
	);
}
