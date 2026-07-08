import { useState } from 'react';
import { Button } from '@wordpress/components';
import { download } from '@wordpress/icons';
import { logger } from '@php-wasm/logger';
import type { PlaygroundClient } from '@wp-playground/client';
import css from './style.module.css';

export function DownloadButton({
	playground,
	databasePath,
}: {
	playground: PlaygroundClient | undefined;
	databasePath: string | null;
}) {
	const [isDownloading, setIsDownloading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleDownload = async () => {
		if (!playground || !databasePath) {
			return;
		}
		setIsDownloading(true);
		setError(null);
		try {
			await downloadDatabase(playground, databasePath);
		} catch (downloadError) {
			// Surface the failure inline (matching the Adminer/phpMyAdmin
			// buttons) instead of swallowing it or using a blocking alert.
			logger.error('Failed to download database', downloadError);
			setError('Could not download the database. Please try again.');
		} finally {
			setIsDownloading(false);
		}
	};

	return (
		<>
			<Button
				variant="secondary"
				disabled={!playground || !databasePath || isDownloading}
				isBusy={isDownloading}
				onClick={handleDownload}
				icon={download}
				iconPosition="right"
				iconSize={16}
			>
				{isDownloading ? 'Preparing…' : 'Download database.sqlite'}
			</Button>
			{error && <div className={css.error}>{error}</div>}
		</>
	);
}

async function downloadDatabase(
	playground: PlaygroundClient,
	databasePath: string
): Promise<void> {
	const fileExists = await playground.fileExists(databasePath);
	if (!fileExists) {
		throw new Error('Database file does not exist');
	}

	const buffer = await playground.readFileAsBuffer(databasePath);
	const blob = new Blob([new Uint8Array(buffer)], {
		type: 'application/x-sqlite3',
	});

	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	try {
		link.href = url;
		link.download = 'database.sqlite';
		document.body.appendChild(link);
		link.click();
	} finally {
		link.remove();
		setTimeout(() => URL.revokeObjectURL(url), 60_000);
	}
}
