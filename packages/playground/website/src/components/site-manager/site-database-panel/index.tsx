import { useState, useEffect } from 'react';
import { joinPaths } from '@php-wasm/util';
import type { PlaygroundClient } from '@wp-playground/client';
import { Notice, __experimentalVStack as VStack } from '@wordpress/components';
import { DownloadButton } from './download-button';
import { AdminerButton } from './adminer-button';
import { PhpMyAdminButton } from './phpmyadmin-button';
import css from './style.module.css';

const RELATIVE_DATABASE_PATH = 'wp-content/database/.ht.sqlite';

export function SiteDatabasePanel({
	playground,
}: {
	playground: PlaygroundClient | undefined;
}) {
	const [databasePath, setDatabasePath] = useState<string | null>(null);
	const [databaseSize, setDatabaseSize] = useState<number | null>(null);

	useEffect(() => {
		if (!playground) {
			setDatabasePath(null);
			setDatabaseSize(null);
			return;
		}
		setDatabasePath(null);
		setDatabaseSize(null);
		let cancelled = false;

		async function fetchDatabaseSize() {
			if (!playground) return;

			try {
				const path = joinPaths(
					await playground.documentRoot,
					RELATIVE_DATABASE_PATH
				);
				if (!cancelled) {
					setDatabasePath(path);
				}
				const size = await readDatabaseSize(playground, path);
				if (!cancelled) {
					setDatabaseSize(size);
				}
			} catch {
				if (!cancelled) {
					setDatabaseSize(null);
				}
			}
		}

		void fetchDatabaseSize();
		return () => {
			cancelled = true;
		};
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
						<code>
							{databasePath ?? `…/${RELATIVE_DATABASE_PATH}`}
						</code>
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

/** Stats the database inside PHP without copying its contents into JavaScript. */
async function readDatabaseSize(
	playground: PlaygroundClient,
	databasePath: string
): Promise<number> {
	const response = await playground.run({
		code: `<?php
$stat = stat(getenv('DATABASE_PATH'));
if ($stat === false) {
	throw new RuntimeException('Could not stat the database.');
}
echo $stat['size'];
`,
		env: {
			DATABASE_PATH: databasePath,
		},
	});
	const sizeText = response.text.trim();
	const size = Number(sizeText);
	if (sizeText === '' || !Number.isSafeInteger(size) || size < 0) {
		throw new Error('Database stat returned an invalid size.');
	}
	return size;
}
