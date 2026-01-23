import { useState } from 'react';
import { external, trash } from '@wordpress/icons';
import { Icon } from '@wordpress/icons';
import { logger } from '@php-wasm/logger';
import { useActiveSite } from '../../lib/state/redux/store';
import { opfsSiteStorage } from '../../lib/state/opfs/opfs-site-storage';
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

interface MenuOverlayProps {
	onClose: () => void;
}

export function MenuOverlay({ onClose }: MenuOverlayProps) {
	const activeSite = useActiveSite();

	const [showDeleteButton, setShowDeleteButton] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [showRecoveryButton, setShowRecoveryButton] = useState(false);

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
				<OverlaySection
					title="Personal Playground"
					description="Your WordPress data is stored in your browser and will persist across sessions."
				>
					<p>
						This is a personal WordPress installation. Changes you
						make will be saved automatically in your browser's
						storage.
					</p>
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
						<p>
							If you want to start over,{' '}
							<button
								className={css.textButton}
								onClick={() =>
									setShowDeleteButton(!showDeleteButton)
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
