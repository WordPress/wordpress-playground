import { useState } from 'react';
import { external, trash } from '@wordpress/icons';
import { Icon } from '@wordpress/icons';
import { Spinner } from '@wordpress/components';
import { logger } from '@php-wasm/logger';
import { useActiveSite } from '../../lib/state/redux/store';
import { opfsSiteStorage } from '../../lib/state/opfs/opfs-site-storage';
import { broadcastSiteReset } from '../../lib/state/redux/tab-coordinator';
import { useBackup } from '../../lib/hooks/use-backup';
import useFetch from '../../lib/hooks/use-fetch';
import { WordPressIcon } from '@wp-playground/components';
import {
	Overlay,
	OverlayHeader,
	OverlayBody,
	OverlaySection,
} from '../overlay';
import css from './style.module.css';
import {
	getBlueprintUrl,
	healthCheckRecoveryBlueprint,
} from '../../lib/health-check-recovery';
import { BackupReminder } from '../backup-reminder';
import { TabInfoWindow } from '../tab-info-window';

type AppEntry = {
	title: string;
	description: string;
	author: string;
	categories: string[];
};

const APPS_INDEX_URL =
	'https://raw.githubusercontent.com/WordPress/blueprints/my-wordpress/apps.json';
const APPS_BASE_URL =
	'https://raw.githubusercontent.com/WordPress/blueprints/my-wordpress/';

function getAppBlueprintUrl(blueprintUrl: string): string {
	const url = new URL(window.location.href);
	url.hash = '';
	url.searchParams.set('blueprint-url', blueprintUrl);
	return url.toString();
}

interface MenuOverlayProps {
	onClose: () => void;
}

export function MenuOverlay({ onClose }: MenuOverlayProps) {
	const activeSite = useActiveSite();
	const { isDependentMode } = useBackup();

	const [showDeleteButton, setShowDeleteButton] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [showRecoveryButton, setShowRecoveryButton] = useState(false);

	const {
		data: appsData,
		isLoading: appsLoading,
		isError: appsError,
	} = useFetch<Record<string, AppEntry>>(APPS_INDEX_URL);

	const apps = appsData
		? Object.entries(appsData).map(([path, entry]) => ({
				...entry,
				path,
				blueprintUrl: `${APPS_BASE_URL}${path}`,
			}))
		: [];

	async function handleStartOver() {
		if (!activeSite || activeSite.metadata.storage === 'none') {
			return;
		}

		const { backupHistory = [] } = activeSite.metadata;
		const hasBackup = backupHistory.length > 0;

		const message = hasBackup
			? 'Are you sure you want to start over? This will delete all your data and reset WordPress to a fresh install.'
			: 'Are you sure you want to start over? You have never made a backup – all your data will be permanently lost.';

		const proceed = window.confirm(message);
		if (!proceed) {
			return;
		}

		setIsDeleting(true);
		try {
			broadcastSiteReset(activeSite.slug);
			await opfsSiteStorage?.delete(activeSite.slug);
			window.location.href =
				window.location.origin + window.location.pathname;
		} catch (error) {
			logger.error(error);
			alert('Failed to reset. Please try again.');
			setIsDeleting(false);
		}
	}

	return (
		<Overlay onClose={onClose}>
			<OverlayHeader onClose={onClose} />
			<OverlayBody>
				<TabInfoWindow />

				<OverlaySection title="Install Apps">
					{appsLoading ? (
						<div className={css.loadingContainer}>
							<Spinner />
						</div>
					) : appsError ? (
						<p className={css.errorMessage}>
							Unable to load apps. Check your connection.
						</p>
					) : (
						<div className={css.featuresList}>
							{apps.map((app) => (
								<a
									key={app.path}
									className={css.featureItem}
									href={getAppBlueprintUrl(app.blueprintUrl)}
								>
									<span className={css.featureIcon}>
										<WordPressIcon />
									</span>
									<span className={css.featureContent}>
										<span className={css.featureTitle}>
											{app.title}
										</span>
										<span
											className={css.featureDescription}
										>
											{app.description}
										</span>
									</span>
								</a>
							))}
						</div>
					)}
				</OverlaySection>

				<OverlaySection title="Backup">
					<BackupReminder />
				</OverlaySection>

				<div className={css.bottomRow}>
					<OverlaySection title="More Playgrounds">
						<p>
							Want multiple Playgrounds? Open temporary instances
							that reset on refresh.
						</p>
						<a
							href="https://playground.wordpress.net"
							target="_blank"
							rel="noopener noreferrer"
							className={css.externalLink}
						>
							<Icon icon={external} size={20} />
							<span>Open playground.wordpress.net</span>
						</a>
					</OverlaySection>

					<OverlaySection title="Start over">
						{isDependentMode ? (
							<p>
								To reset this WordPress, use the main tab that
								has the active connection.
							</p>
						) : (
							<>
								<p>
									If you want to start over,{' '}
									<button
										className={css.textButton}
										onClick={() =>
											setShowDeleteButton(
												!showDeleteButton
											)
										}
									>
										you can reset this WordPress
									</button>
									.
								</p>
								{showDeleteButton && (
									<button
										className={css.dangerButton}
										onClick={handleStartOver}
										disabled={isDeleting}
									>
										<Icon icon={trash} size={20} />
										<span>
											{isDeleting
												? 'Deleting...'
												: 'Delete everything'}
										</span>
									</button>
								)}
							</>
						)}
					</OverlaySection>
				</div>

				<OverlaySection title="Recovery">
					<p>
						If WordPress crashed,{' '}
						<button
							className={css.textButton}
							onClick={() =>
								setShowRecoveryButton(!showRecoveryButton)
							}
						>
							you can troubleshoot
						</button>
						.
					</p>
					{showRecoveryButton && (
						<a
							href={getBlueprintUrl(healthCheckRecoveryBlueprint)}
							className={css.primaryButton}
						>
							Install Health Check &amp; Troubleshoot
						</a>
					)}
				</OverlaySection>
			</OverlayBody>
		</Overlay>
	);
}
