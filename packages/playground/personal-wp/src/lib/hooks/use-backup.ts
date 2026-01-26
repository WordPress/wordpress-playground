import { useState, useCallback } from 'react';
import { usePlaygroundClient } from '../use-playground-client';
import { useActiveSite, useAppDispatch } from '../state/redux/store';
import { updateSiteMetadata } from '../state/redux/slice-sites';
import { zipWpContent } from '@wp-playground/client';
import { logger } from '@php-wasm/logger';
import saveAs from 'file-saver';

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
	const activeSite = useActiveSite();
	const dispatch = useAppDispatch();
	const [isBackingUp, setIsBackingUp] = useState(false);

	const performBackup = useCallback(async (): Promise<boolean> => {
		if (!playground || !activeSite || isBackingUp) {
			return false;
		}

		setIsBackingUp(true);
		try {
			// Get site name from WordPress, fall back to metadata
			const wpSiteName = await getWordPressSiteName(playground);
			const siteName =
				wpSiteName || activeSite.metadata.name || 'playground';

			const bytes = await zipWpContent(playground, {
				selfContained: true,
			});
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
						changes: {
							backupHistory: newHistory,
						},
					})
				);
			}

			return true;
		} finally {
			setIsBackingUp(false);
		}
	}, [playground, activeSite, isBackingUp, dispatch]);

	return {
		performBackup,
		isBackingUp,
		canBackup: !!playground && !!activeSite,
	};
}
