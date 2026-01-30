import { useState, useEffect, useCallback } from 'react';
import { external, trash, copy, check } from '@wordpress/icons';
import { Icon } from '@wordpress/icons';
import { Spinner } from '@wordpress/components';
import { logger } from '@php-wasm/logger';
import { useActiveSite } from '../../lib/state/redux/store';
import { opfsSiteStorage } from '../../lib/state/opfs/opfs-site-storage';
import { broadcastSiteReset } from '../../lib/state/redux/tab-coordinator';
import { useBackup } from '../../lib/hooks/use-backup';
import useFetch from '../../lib/hooks/use-fetch';
import { useCustomApps } from '../../lib/hooks/use-custom-apps';
import { WordPressIcon } from '@wp-playground/components';
import { encodeStringAsBase64, decodeBase64ToString } from '../../lib/base64';
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
	'https://raw.githubusercontent.com/WordPress/blueprints/trunk/apps.json';
const APPS_BASE_URL =
	'https://raw.githubusercontent.com/WordPress/blueprints/trunk/';

function getAppBlueprintUrl(blueprintUrl: string): string {
	const url = new URL(window.location.href);
	url.hash = '';
	url.searchParams.set('blueprint-url', blueprintUrl);
	return url.toString();
}

interface MenuOverlayProps {
	onClose: () => void;
}

function isValidUrl(str: string): boolean {
	try {
		new URL(str);
		return true;
	} catch {
		return false;
	}
}

function blueprintToDataUrl(blueprint: string): string {
	const encoded = encodeStringAsBase64(blueprint);
	return `data:application/json;base64,${encoded}`;
}

function getBlueprintPreview(url: string): string {
	if (url.startsWith('data:application/json;base64,')) {
		try {
			const base64 = url.replace('data:application/json;base64,', '');
			return decodeBase64ToString(base64);
		} catch {
			return url;
		}
	}
	return url;
}

function looksLikeBlueprint(text: string): boolean {
	const trimmed = text.trim();
	if (isValidUrl(trimmed)) {
		return true;
	}
	if (trimmed.startsWith('{')) {
		try {
			JSON.parse(trimmed);
			return true;
		} catch {
			return false;
		}
	}
	return false;
}

export function MenuOverlay({ onClose }: MenuOverlayProps) {
	const activeSite = useActiveSite();
	const { isDependentMode } = useBackup();
	const { customApps, addApp, removeApp } = useCustomApps();

	const [showDeleteButton, setShowDeleteButton] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [showRecoveryButton, setShowRecoveryButton] = useState(false);
	const [copiedAppPath, setCopiedAppPath] = useState<string | null>(null);

	const handlePaste = useCallback(
		(e: ClipboardEvent) => {
			const text = e.clipboardData?.getData('text');
			if (!text) return;

			const trimmed = text.trim();
			if (!looksLikeBlueprint(trimmed)) return;

			e.preventDefault();

			let title = 'Custom app';
			let description = '';
			let author = '';
			let blueprintUrl: string;

			if (isValidUrl(trimmed)) {
				blueprintUrl = trimmed;
				const urlPath = new URL(trimmed).pathname;
				const filename = urlPath.split('/').pop() || '';
				if (filename) {
					title = filename
						.replace(/\.json$/, '')
						.replace(/[-_]/g, ' ');
				}
			} else {
				try {
					const blueprint = JSON.parse(trimmed);
					if (blueprint.meta?.title) {
						title = blueprint.meta.title;
					}
					if (blueprint.meta?.description) {
						description = blueprint.meta.description;
					}
					if (blueprint.meta?.author) {
						author = blueprint.meta.author;
					}
					// eslint-disable-next-line no-console
					console.log(
						'[CustomApps] Blueprint pasted with meta:',
						blueprint.meta
					);
				} catch {
					return;
				}
				blueprintUrl = blueprintToDataUrl(trimmed);
			}

			addApp({
				title,
				description: description || 'Custom app',
				author: author || undefined,
				blueprintUrl,
			});
		},
		[addApp]
	);

	useEffect(() => {
		document.addEventListener('paste', handlePaste);
		return () => document.removeEventListener('paste', handlePaste);
	}, [handlePaste]);

	const {
		data: appsData,
		isLoading: appsLoading,
		isError: appsError,
	} = useFetch<Record<string, AppEntry>>(APPS_INDEX_URL);

	const remoteApps = appsData
		? Object.entries(appsData).map(([path, entry]) => ({
				...entry,
				path,
				blueprintUrl: `${APPS_BASE_URL}${path}`,
				isCustom: false as const,
			}))
		: [];

	const customAppsByTitle = new Map(
		customApps.map((app) => [app.title.toLowerCase(), app])
	);

	const allApps = [
		...remoteApps.map((app) => {
			const customOverride = customAppsByTitle.get(
				app.title.toLowerCase()
			);
			if (customOverride) {
				customAppsByTitle.delete(app.title.toLowerCase());
				return {
					...customOverride,
					path: customOverride.id,
					isCustom: true as const,
				};
			}
			return app;
		}),
		...[...customAppsByTitle.values()].map((app) => ({
			...app,
			path: app.id,
			isCustom: true as const,
		})),
	];

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
					) : appsError && customApps.length === 0 ? (
						<p className={css.errorMessage}>
							Unable to load apps. Check your connection.
						</p>
					) : (
						<div className={css.featuresList}>
							{allApps.map((app) => (
								<div key={app.path} className={css.appRow}>
									<a
										className={css.featureItem}
										href={getAppBlueprintUrl(
											app.blueprintUrl
										)}
									>
										<span className={css.featureIcon}>
											<WordPressIcon />
										</span>
										<span className={css.featureContent}>
											<span className={css.featureTitle}>
												{app.title}
											</span>
											<span
												className={
													css.featureDescription
												}
											>
												{app.description}
												{app.author && (
													<span
														className={css.author}
													>
														{' '}
														by {app.author}
													</span>
												)}
											</span>
										</span>
									</a>
									<button
										className={css.copyButton}
										onClick={(e) => {
											e.preventDefault();
											navigator.clipboard.writeText(
												getBlueprintPreview(
													app.blueprintUrl
												)
											);
											setCopiedAppPath(app.path);
											setTimeout(
												() => setCopiedAppPath(null),
												2000
											);
										}}
										title="Copy blueprint"
									>
										<Icon
											icon={
												copiedAppPath === app.path
													? check
													: copy
											}
											size={16}
										/>
									</button>
									{app.isCustom && (
										<button
											className={css.removeButton}
											onClick={() => removeApp(app.path)}
											title="Remove app"
										>
											<Icon icon={trash} size={16} />
										</button>
									)}
								</div>
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
