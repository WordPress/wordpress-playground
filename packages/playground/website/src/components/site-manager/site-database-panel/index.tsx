import { useState, useEffect } from 'react';
import type { PlaygroundClient } from '@wp-playground/client';
import { Notice, __experimentalVStack as VStack } from '@wordpress/components';
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
					const buffer =
						await playground.readFileAsBuffer(DATABASE_PATH);
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
			<Notice
				className={css.earlyAccessNotice}
				status="info"
				isDismissible={false}
			>
				<h3 style={{ fontWeight: 'bold' }}>
					Database management is an early access feature.
				</h3>{' '}
				<br />
				<p>
					WordPress Playground{' '}
					<a
						target="_blank"
						rel="noreferrer"
						href="https://make.wordpress.org/playground/2025/06/13/introducing-a-new-sqlite-driver-for-wordpress/"
					>
						emulates a MySQL database using SQLite as a backend
					</a>
					. The database tools you see may not work perfectly yet, but
					are being actively improved every week. You can have real
					impact on those tools – just report any issues you find
					using the{' '}
					<a
						target="_blank"
						rel="noreferrer"
						href="https://github.com/WordPress/wordpress-playground/issues"
					>
						GitHub issue tracker.
					</a>
				</p>
			</Notice>

			<VStack spacing={3} style={{ alignItems: 'flex-start' }}>
				<div className={css.databaseInfo}>
					<span className={css.label}>Database driver:</span>
					<span className={css.value}>
						MySQL emulation backed by SQLite
					</span>
					<span className={css.label}>SQLite database path:</span>
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
