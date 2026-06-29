import { useState, useEffect } from 'react';
import { joinPaths } from '@php-wasm/util';
import type { PlaygroundClient } from '@wp-playground/client';
import { Notice } from '@wordpress/components';
import { DownloadButton } from './download-button';
import { AdminerButton } from './adminer-button';
import { PhpMyAdminButton } from './phpmyadmin-button';
import { PlaygroundBootNotice } from '../../pane-loading';
import css from './style.module.css';

const RELATIVE_DATABASE_PATH = 'wp-content/database/.ht.sqlite';

export function SiteDatabasePanel({
	playground,
}: {
	playground: PlaygroundClient | undefined;
}) {
	const [documentRoot, setDocumentRoot] = useState<string | null>(null);
	const [databaseSize, setDatabaseSize] = useState<number | null>(null);
	const [sizeStatus, setSizeStatus] = useState<
		'loading' | 'ready' | 'unavailable'
	>('loading');

	// Resolve the real document root instead of assuming /wordpress, which is
	// wrong for Playgrounds mounted at a different root.
	useEffect(() => {
		if (!playground) {
			setDocumentRoot(null);
			return;
		}
		let cancelled = false;
		void playground.documentRoot.then((root) => {
			if (!cancelled) {
				setDocumentRoot(root);
			}
		});
		return () => {
			cancelled = true;
		};
	}, [playground]);

	const databasePath = documentRoot
		? joinPaths(documentRoot, RELATIVE_DATABASE_PATH)
		: null;

	useEffect(() => {
		if (!playground) {
			// No client to inspect — don't sit on "Calculating…" forever.
			setSizeStatus('unavailable');
			return;
		}
		if (!databasePath) {
			// Client present but the document root is still resolving.
			setSizeStatus('loading');
			return;
		}
		let cancelled = false;
		setSizeStatus('loading');

		async function fetchDatabaseSize() {
			if (!playground || !databasePath) return;
			try {
				const fileExists = await playground.fileExists(databasePath);
				if (cancelled) return;
				if (fileExists) {
					const buffer =
						await playground.readFileAsBuffer(databasePath);
					if (cancelled) return;
					setDatabaseSize(buffer.byteLength);
					setSizeStatus('ready');
				} else {
					setSizeStatus('unavailable');
				}
			} catch {
				if (!cancelled) {
					setSizeStatus('unavailable');
				}
			}
		}

		void fetchDatabaseSize();
		return () => {
			cancelled = true;
		};
	}, [playground, databasePath]);

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
					<code>{databasePath ?? `…/${RELATIVE_DATABASE_PATH}`}</code>
				</dd>
				<dt className={css.label}>Size:</dt>
				<dd className={css.value}>
					{sizeStatus === 'loading'
						? 'Calculating…'
						: sizeStatus === 'ready' && databaseSize !== null
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

			<PlaygroundBootNotice
				show={!playground}
				gap="var(--space-6)"
				message="The Playground is still loading — database tools will be ready in a moment."
			/>

			<div className={css.buttonGroup}>
				<AdminerButton playground={playground} />
				<DownloadButton
					playground={playground}
					databasePath={databasePath}
				/>
				<PhpMyAdminButton playground={playground} />
			</div>
		</div>
	);
}
