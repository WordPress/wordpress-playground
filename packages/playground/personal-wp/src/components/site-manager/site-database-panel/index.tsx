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
	const [documentRoot, setDocumentRoot] = useState<{
		playground: PlaygroundClient;
		root: string;
	} | null>(null);
	const [databaseSize, setDatabaseSize] = useState<number | null>(null);

	useEffect(() => {
		if (!playground) {
			setDocumentRoot(null);
			setDatabaseSize(null);
			return;
		}
		let cancelled = false;
		setDocumentRoot(null);
		setDatabaseSize(null);
		void playground.documentRoot.then(
			(root) => {
				if (!cancelled) {
					setDocumentRoot({ playground, root });
				}
			},
			() => {
				if (!cancelled) {
					setDocumentRoot(null);
				}
			}
		);
		return () => {
			cancelled = true;
		};
	}, [playground]);

	const currentDocumentRoot =
		documentRoot && documentRoot.playground === playground
			? documentRoot.root
			: null;
	const databasePath = currentDocumentRoot
		? joinPaths(currentDocumentRoot, RELATIVE_DATABASE_PATH)
		: null;

	useEffect(() => {
		if (!playground || !databasePath) {
			setDatabaseSize(null);
			return;
		}
		let cancelled = false;
		const activePlayground = playground;
		const path = databasePath;

		async function fetchDatabaseSize() {
			try {
				const fileExists = await activePlayground.fileExists(path);
				if (cancelled) return;
				if (fileExists) {
					const size = await getRemoteFileSize(
						activePlayground,
						path
					);
					if (!cancelled) {
						setDatabaseSize(size);
					}
				} else {
					setDatabaseSize(null);
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
	}, [playground, databasePath]);

	const formatBytes = (bytes: number): string => {
		const safeBytes = Math.max(0, bytes);
		if (safeBytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
		const i = Math.min(
			Math.floor(Math.log(safeBytes) / Math.log(k)),
			sizes.length - 1
		);
		return `${parseFloat((safeBytes / Math.pow(k, i)).toFixed(2))} ${
			sizes[i]
		}`;
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

async function getRemoteFileSize(
	playground: PlaygroundClient,
	path: string
): Promise<number> {
	const escapedPath = escapePhpSingleQuotedString(path);
	const response = await playground.run({
		code:
			`<?php clearstatcache(true, '${escapedPath}');` +
			` echo filesize('${escapedPath}');`,
	});
	const sizeText = response.text.trim();
	if (!/^\d+$/.test(sizeText)) {
		throw new Error(`Could not read the size of ${path}.`);
	}
	return Number(sizeText);
}

function escapePhpSingleQuotedString(value: string): string {
	return value.replace(/['\\]/g, '\\$&');
}
