import { Modal, Button, Flex, FlexItem } from '@wordpress/components';
import { useMemo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../lib/state/redux/store';
import SiteSettingsForm, { SiteFormData } from '../site-settings-form';
import {
	removeSite,
	selectSiteBySlug,
} from '../../../lib/state/redux/slice-sites';
import { redirectTo, PlaygroundRoute } from '../../../lib/state/url/router';
import { randomSiteName } from '../../../lib/state/redux/random-site-name';
import css from './style.module.css';
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
	const dispatch = useAppDispatch();
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
		setConfirmDialogSiteFormData(false);
	};
	const resetSite = async (data: SiteFormData) => {
		/**
		 * Resetting requires site removal
		 * to free up the site slug for reuse.
		 */
		await dispatch(removeSite(siteSlug));
		await updateSite(data);
	};
	const cloneSite = async (data: SiteFormData) => {
		/**
		 * Cloning requires a new name
		 * to not interfere with the original site slug.
		 */
		await updateSite({ ...data, name: randomSiteName() });
	};
	const defaultValues = useMemo<Partial<SiteFormData>>(() => {
		const searchParams = siteInfo.originalUrlParams?.searchParams || {};
		const runtimeConf = siteInfo.metadata?.runtimeConfiguration || {};
		return {
			name: siteInfo.metadata.name,
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
			{!!confirmDialogSiteFormData && (
				<Modal
					onRequestClose={() => setConfirmDialogSiteFormData(false)}
					title="Confirm Playground settings update"
					size="medium"
				>
					<p>
						Clone will create a new temporary Playground with
						updated settings and keep the changes you made
						previously.
					</p>
					<p>
						Resetting will remove the Playground and all changes you
						made previously and create a new Playground with the
						updated settings.
					</p>
					<Flex direction="column">
						<FlexItem>
							<Button
								variant="primary"
								className={css.confirmDialogButton}
								onClick={() =>
									resetSite(
										confirmDialogSiteFormData as SiteFormData
									)
								}
							>
								Reset site and update settings
							</Button>
						</FlexItem>
						<FlexItem>
							<Button
								variant="secondary"
								className={css.confirmDialogButton}
								onClick={() =>
									cloneSite(
										confirmDialogSiteFormData as SiteFormData
									)
								}
							>
								Clone site with new settings
							</Button>
						</FlexItem>
						<FlexItem>
							<Button
								variant="tertiary"
								className={css.confirmDialogButton}
								onClick={() =>
									setConfirmDialogSiteFormData(false)
								}
							>
								Cancel
							</Button>
						</FlexItem>
					</Flex>
				</Modal>
			)}
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
