import { useState, useEffect } from 'react';
import type { PlaygroundClient } from '@wp-playground/client';
import { __experimentalVStack as VStack } from '@wordpress/components';
import { DownloadButton } from './download-button';
import { AdminerButton } from './adminer-button';
import { PhpMyAdminButton } from './phpmyadmin-button';
import css from './style.module.css';

const DATABASE_PATH = '/wordpress/wp-content/database/.ht.sqlite';

export function SiteDatabasePanel({
	playground,
}: {
	playground: PlaygroundClient | undefined;
}) {
	const [databaseSize, setDatabaseSize] = useState<number | null>(null);

	useEffect(() => {
		if (!playground) {
			setDatabaseSize(null);
			return;
		}

		async function fetchDatabaseSize() {
			if (!playground) return;

			try {
				const fileExists = await playground.fileExists(DATABASE_PATH);
				if (fileExists) {
					const buffer = await playground.readFileAsBuffer(
						DATABASE_PATH
					);
					setDatabaseSize(buffer.byteLength);
				} else {
					setDatabaseSize(null);
				}
			} catch {
				setDatabaseSize(null);
			}
		}

		void fetchDatabaseSize();
	}, [playground]);

	const formatBytes = (bytes: number): string => {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
	};

	return (
		<VStack spacing={4}>
			<p>
				WordPress Playground runs a MySQL database emulation powered by
				SQLite.
			</p>

			<VStack spacing={3} style={{ alignItems: 'flex-start' }}>
				<div className={css.databaseInfo}>
					<span className={css.label}>Engine:</span>
					<span className={css.value}>SQLite</span>
					<span className={css.label}>Driver:</span>
					<span className={css.value}>MySQL on SQLite</span>
					<span className={css.label}>Path:</span>
					<span className={css.value}>
						<code>{DATABASE_PATH}</code>
					</span>
					{databaseSize !== null && (
						<>
							<span className={css.label}>Size:</span>
							<span className={css.value}>
								{formatBytes(databaseSize)}
							</span>
						</>
					)}
				</div>
			</VStack>

			<VStack spacing={3}>
				<DownloadButton playground={playground} />
				<AdminerButton playground={playground} />
				<PhpMyAdminButton playground={playground} />
			</VStack>
		</VStack>
	);
}
