import { useRef, useState } from 'react';
import { Button, Icon, Flex, FlexItem } from '@wordpress/components';
import { download } from '@wordpress/icons';
import type { PlaygroundClient } from '@wp-playground/client';
import { downloadDatabase } from '@wp-playground/components';
import { logger } from '@php-wasm/logger';
import css from './style.module.css';

const DATABASE_PATH = '/wordpress/wp-content/database/.ht.sqlite';

export function DownloadButton({
	playground,
}: {
	playground: PlaygroundClient | undefined;
}) {
	const isDownloadingRef = useRef(false);
	const [downloadError, setDownloadError] = useState<string | null>(null);

	const handleDownload = async () => {
		if (!playground || isDownloadingRef.current) {
			return;
		}
		isDownloadingRef.current = true;
		setDownloadError(null);
		try {
			await downloadDatabase(playground, DATABASE_PATH);
		} catch (error) {
			logger.error('Failed to download database', error);
			setDownloadError('Could not download the database. Try again.');
		} finally {
			isDownloadingRef.current = false;
		}
	};

	return (
		<div>
			<Button
				variant="secondary"
				disabled={!playground}
				onClick={() => void handleDownload()}
			>
				<Flex justify="space-between" gap={2} expanded={true}>
					<FlexItem>Download database.sqlite</FlexItem>
					<FlexItem>
						<Icon icon={download} size={16} />
					</FlexItem>
				</Flex>
			</Button>
			{downloadError ? (
				<div className={css.error}>{downloadError}</div>
			) : null}
		</div>
	);
}
