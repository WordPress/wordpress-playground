import { useState, useEffect } from 'react';
import type { PlaygroundClient } from '@wp-playground/client';
import { Notice } from '@wordpress/components';
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
		<div className={css.databasePanel}>
			<dl className={css.databaseInfo}>
				<dt className={css.label}>Driver:</dt>
				<dd className={css.value}>MySQL emulation backed by SQLite</dd>
				<dt className={css.label}>Path:</dt>
				<dd className={css.value}>
					<code>{DATABASE_PATH}</code>
				</dd>
				<dt className={css.label}>Size:</dt>
				<dd className={css.value}>
					{databaseSize !== null
						? formatBytes(databaseSize)
						: 'Unavailable'}
				</dd>
			</dl>

			<Notice
				className={css.siteNotice}
				status="info"
				isDismissible={false}
			>
				<p className={css.noticeEyebrow}>Early access</p>
				<p className={css.noticeBody}>
					Playground{' '}
					<a
						target="_blank"
						rel="noreferrer"
						href="https://make.wordpress.org/playground/2025/06/13/introducing-a-new-sqlite-driver-for-wordpress/"
					>
						emulates MySQL with SQLite
					</a>
					. These tools are a work in progress —{' '}
					<a
						target="_blank"
						rel="noreferrer"
						href="https://github.com/WordPress/wordpress-playground/issues"
					>
						report issues
					</a>
					.
				</p>
			</Notice>

			<div className={css.buttonGroup}>
				<AdminerButton playground={playground} />
				<DownloadButton playground={playground} />
				<PhpMyAdminButton playground={playground} />
			</div>
		</div>
	);
}
