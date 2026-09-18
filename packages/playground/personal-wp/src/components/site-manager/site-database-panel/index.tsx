import { useState, useEffect } from 'react';
import type { PlaygroundClient } from '@wp-playground/client';
import { getSqliteDatabasePath } from '@wp-playground/tools';
import { Notice, __experimentalVStack as VStack } from '@wordpress/components';
import { DownloadButton } from './download-button';
import { AdminerButton } from './adminer-button';
import { PhpMyAdminButton } from './phpmyadmin-button';
import css from './style.module.css';
import { formatBytes } from '../../../lib/utils/format-bytes';

export function SiteDatabasePanel({
	playground,
}: {
	playground: PlaygroundClient | undefined;
}) {
	const [databasePath, setDatabasePath] = useState<string | null>(null);
	const [databaseSize, setDatabaseSize] = useState<number | null>(null);

	useEffect(() => {
		setDatabasePath(null);
		setDatabaseSize(null);
		if (!playground) {
			return;
		}

		let cancelled = false;

		async function fetchDatabaseSize() {
			if (!playground) return;

			try {
				const path = await getSqliteDatabasePath(playground);
				if (cancelled) return;
				setDatabasePath(path);
				const fileExists = await playground.fileExists(path);
				if (fileExists) {
					const buffer = await playground.readFileAsBuffer(path);
					if (cancelled) return;
					setDatabaseSize(buffer.byteLength);
				}
			} catch {
				if (!cancelled) setDatabaseSize(null);
			}
		}

		void fetchDatabaseSize();
		return () => {
			cancelled = true;
		};
	}, [playground]);

	return (
		<VStack spacing={4}>
			<Notice
				className={css.siteNotice}
				status="info"
				isDismissible={false}
			>
				<h3 style={{ fontWeight: 'bold' }}>
					Database management is an early access feature
				</h3>{' '}
				<br />
				<p style={{ fontSize: '1.1rem' }}>
					WordPress Playground{' '}
					<a
						target="_blank"
						rel="noreferrer"
						href="https://make.wordpress.org/playground/2025/06/13/introducing-a-new-sqlite-driver-for-wordpress/"
					>
						emulates MySQL using SQLite
					</a>
					. The database tools are a work in progress and are
					improving every week. Help shape them – report issues on the{' '}
					<a
						target="_blank"
						rel="noreferrer"
						href="https://github.com/WordPress/wordpress-playground/issues"
					>
						GitHub issue tracker
					</a>
					.
				</p>{' '}
			</Notice>

			<VStack spacing={3} style={{ alignItems: 'flex-start' }}>
				<div className={css.databaseInfo}>
					<span className={css.label}>Database driver:</span>
					<span className={css.value}>
						MySQL emulation backed by SQLite
					</span>
					<span className={css.label}>SQLite database path:</span>
					<span className={css.value}>
						<code>{databasePath ?? 'Unavailable'}</code>
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

			<div className={css.buttonGroup}>
				<DownloadButton
					playground={playground}
					databasePath={databasePath}
				/>
				<AdminerButton playground={playground} />
				<PhpMyAdminButton playground={playground} />
			</div>
		</VStack>
	);
}
