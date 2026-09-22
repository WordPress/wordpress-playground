import { useState, useCallback, useEffect, useRef } from 'react';
import {
	usePlaygroundClient,
	usePlaygroundClientInfo,
} from '../use-playground-client';
import { useActiveSite, useAppDispatch } from '../state/redux/store';
import { updateSiteMetadata } from '../state/redux/slice-sites';
import { setAutoBackupDue } from '../state/redux/slice-ui';
import { zipWpContent } from '@wp-playground/client';
import { getLegacyPlaygroundRuntimeWpContentPaths } from '@wp-playground/blueprints';
import { joinPaths, phpVars } from '@php-wasm/util';
import { logger } from '@php-wasm/logger';
import saveAs from 'file-saver';
import {
	setBackupRequestCallback,
	requestRemoteBackup,
} from '../state/redux/tab-coordinator';

function sanitizeForFilename(name: string): string {
	return name
		.trim()
		.replaceAll(/[^a-zA-Z0-9_-]/g, '-')
		.replaceAll(/-+/g, '-')
		.replace(/^-|-$/g, '');
}

function formatBackupFilename(siteName: string): string {
	const now = new Date();
	const date = now.toISOString().slice(0, 10);
	const time = now.toTimeString().slice(0, 8).replace(/:/g, '');
	const sanitized = sanitizeForFilename(siteName);
	return `${sanitized}-backup-${date}-${time}.zip`;
}

/**
 * Estimates the size of the zip zipWpContent() would produce: wp-content
 * minus the legacy runtime paths, plus wp-config.php.
 *
 * Files in formats that are already compressed (images, fonts, media,
 * archives) barely shrink under deflate, while text and SQLite files
 * typically end up at 10-30% of their size. The factors below were
 * calibrated against a real backup and land within ~10% of the zip size,
 * erring high.
 */
export async function estimateBackupSize(
	playground: NonNullable<ReturnType<typeof usePlaygroundClient>>
): Promise<number | null> {
	const COMPRESSED_FORMAT_FACTOR = 0.97;
	const OTHER_FORMAT_FACTOR = 0.25;
	try {
		const documentRoot = await playground.documentRoot;
		const wpContentPath = joinPaths(documentRoot, 'wp-content');
		const excludedPaths = (
			await getLegacyPlaygroundRuntimeWpContentPaths(
				playground,
				wpContentPath
			)
		).map((path) => joinPaths(wpContentPath, path));
		const js = phpVars({
			wpContentPath,
			wpConfigPath: joinPaths(documentRoot, 'wp-config.php'),
			excludedPaths,
			compressedExtensions: [
				'jpg',
				'jpeg',
				'png',
				'gif',
				'webp',
				'avif',
				'heic',
				'woff',
				'woff2',
				'mp3',
				'mp4',
				'm4a',
				'webm',
				'ogg',
				'zip',
				'gz',
				'bz2',
				'xz',
				'zst',
				'7z',
				'rar',
				'pdf',
			],
		});
		const response = await playground.run({
			code: `<?php
				$excluded = ${js.excludedPaths};
				$compressedExtensions = array_flip(${js.compressedExtensions});
				$compressed = 0;
				$other = @filesize(${js.wpConfigPath}) ?: 0;
				$iterator = new RecursiveIteratorIterator(
					new RecursiveCallbackFilterIterator(
						new RecursiveDirectoryIterator(
							${js.wpContentPath},
							FilesystemIterator::SKIP_DOTS
						),
						function ($current) use ($excluded) {
							return !in_array($current->getPathname(), $excluded, true);
						}
					)
				);
				foreach ($iterator as $file) {
					if (!$file->isFile()) {
						continue;
					}
					$extension = strtolower($file->getExtension());
					if (isset($compressedExtensions[$extension])) {
						$compressed += $file->getSize();
					} else {
						$other += $file->getSize();
					}
				}
				echo json_encode(array('compressed' => $compressed, 'other' => $other));
			`,
		});
		const { compressed, other } = JSON.parse(response.text.trim());
		if (!Number.isFinite(compressed) || !Number.isFinite(other)) {
			return null;
		}
		return Math.round(
			compressed * COMPRESSED_FORMAT_FACTOR + other * OTHER_FORMAT_FACTOR
		);
	} catch (error) {
		logger.debug('Could not estimate backup size:', error);
		return null;
	}
}

async function getWordPressSiteName(
	playground: NonNullable<ReturnType<typeof usePlaygroundClient>>
): Promise<string | null> {
	try {
		const response = await playground.run({
			code: `<?php
				require_once '/wordpress/wp-load.php';
				$name = get_option('blogname', 'WordPress');
				echo html_entity_decode($name, ENT_QUOTES, 'UTF-8');
			`,
		});
		const name = response.text.trim();
		return name || null;
	} catch (error) {
		logger.debug('Could not retrieve WordPress site name:', error);
		return null;
	}
}

export function useBackup() {
	const playground = usePlaygroundClient();
	const clientInfo = usePlaygroundClientInfo();
	const activeSite = useActiveSite();
	const dispatch = useAppDispatch();
	const [isBackingUp, setIsBackingUp] = useState(false);
	const [isRequestingRemote, setIsRequestingRemote] = useState(false);
	// The state above renders the buttons; these guard the work itself. Two
	// calls in the same turn — a double click, or two relay requests from a
	// WordPress page — would both read the state as false and start a backup
	// each, racing over the backup history.
	const isBackingUpRef = useRef(false);
	const isRequestingRemoteRef = useRef(false);

	const isMainMode = clientInfo && !clientInfo.isDependentMode;
	const isDependentMode = clientInfo?.isDependentMode ?? false;

	const performBackup = useCallback(async (): Promise<boolean> => {
		// In dependent mode, request backup from the main tab
		if (isDependentMode && activeSite) {
			if (isRequestingRemoteRef.current) return false;
			isRequestingRemoteRef.current = true;
			setIsRequestingRemote(true);
			try {
				const succeeded = await requestRemoteBackup(activeSite.slug);
				if (succeeded) {
					dispatch(setAutoBackupDue(false));
				}
				return succeeded;
			} finally {
				isRequestingRemoteRef.current = false;
				setIsRequestingRemote(false);
			}
		}

		if (!playground || !activeSite || isBackingUpRef.current) {
			return false;
		}

		isBackingUpRef.current = true;
		setIsBackingUp(true);
		try {
			// Get site name from WordPress, fall back to metadata
			const wpSiteName = await getWordPressSiteName(playground);
			const siteName =
				wpSiteName || activeSite.metadata.name || 'playground';

			const bytes = await zipWpContent(playground);
			const filename = formatBackupFilename(siteName);
			const timestamp = Date.now();
			saveAs(new File([bytes], filename));

			// Update backup history for persistent sites
			// TODO: For local directory sites, the directory itself could be the
			// source of truth for backup history (scan for backup zips).
			if (activeSite.metadata.storage !== 'none') {
				const backupHistory = activeSite.metadata.backupHistory || [];
				const newHistory = [
					{ filename, timestamp },
					...backupHistory.slice(0, 9),
				];
				await dispatch(
					updateSiteMetadata({
						slug: activeSite.slug,
						metadata: {
							backupHistory: newHistory,
						},
					})
				);
			}
			// A backup from any entry point satisfies the reminder.
			dispatch(setAutoBackupDue(false));

			return true;
		} finally {
			isBackingUpRef.current = false;
			setIsBackingUp(false);
		}
	}, [playground, activeSite, isDependentMode, dispatch]);

	// Register this tab as the backup handler when in main mode
	useEffect(() => {
		if (isMainMode && playground && activeSite) {
			setBackupRequestCallback(performBackup);
			return () => {
				setBackupRequestCallback(null);
			};
		}
	}, [isMainMode, playground, activeSite, performBackup]);

	return {
		performBackup,
		isBackingUp,
		isRequestingRemote,
		isDependentMode,
		canBackup: !!playground && !!activeSite,
	};
}
