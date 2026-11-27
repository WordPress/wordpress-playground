import { useState } from 'react';
import { logger } from '@php-wasm/logger';
import { Button, Icon, Flex, FlexItem } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { download } from '@wordpress/icons';
import type { PlaygroundClient } from '@wp-playground/client';
import css from './style.module.css';

export const OBJECT_URL_REVOKE_DELAY_MS = 60_000;

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
			logger.error('Failed to download database', downloadError);
			setError(
				__(
					'Could not download the database. Please try again.',
					'playground-website'
				)
			);
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
			>
				<Flex justify="space-between" gap={2} expanded={true}>
					<FlexItem>
						{__('Download database.sqlite', 'playground-website')}
					</FlexItem>
					<FlexItem>
						<Icon icon={download} size={16} />
					</FlexItem>
				</Flex>
			</Button>
			{error && (
				<div className={css.error} role="alert">
					{error}
				</div>
			)}
		</>
	);
}

export async function downloadDatabase(
	playground: PlaygroundClient,
	databasePath: string
): Promise<void> {
	const fileExists = await playground.fileExists(databasePath);
	if (!fileExists) {
		throw new Error(
			__('Database file does not exist', 'playground-website')
		);
	}

	const buffer = await playground.readFileAsBuffer(databasePath);
	const blob = new Blob([new Uint8Array(buffer)], {
		type: 'application/x-sqlite3',
	});

	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = 'database.sqlite';
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	setTimeout(() => URL.revokeObjectURL(url), OBJECT_URL_REVOKE_DELAY_MS);
}
