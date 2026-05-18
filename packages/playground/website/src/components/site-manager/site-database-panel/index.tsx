import { useState, useEffect } from 'react';
import {
	getSqliteDatabasePath,
	getSqliteDatabaseSize,
} from '@wp-playground/tools';
import type { PlaygroundClient } from '@wp-playground/client';
import { Notice } from '@wordpress/components';
import { createInterpolateElement } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { PlaygroundBootNotice } from '../../pane-loading';
import { AdminerButton } from './adminer-button';
import { DownloadButton } from './download-button';
import { PhpMyAdminButton } from './phpmyadmin-button';
import css from './style.module.css';

export function SiteDatabasePanel({
	playground,
	isBooting,
}: {
	playground: PlaygroundClient | undefined;
	isBooting: boolean;
}) {
	const [databasePath, setDatabasePath] = useState<string | null>(null);
	const [databaseSize, setDatabaseSize] = useState<number | null>(null);
	const [sizeStatus, setSizeStatus] = useState<
		'loading' | 'ready' | 'unavailable'
	>(isBooting || playground ? 'loading' : 'unavailable');

	useEffect(() => {
		setDatabasePath(null);
		setDatabaseSize(null);
		if (!playground) {
			setSizeStatus(isBooting ? 'loading' : 'unavailable');
			return;
		}
		let cancelled = false;
		setSizeStatus('loading');

		async function fetchDatabaseSize() {
			if (!playground) return;
			try {
				const path = await getSqliteDatabasePath(playground);
				if (cancelled) return;
				setDatabasePath(path);
				if (await playground.fileExists(path)) {
					const size = await getSqliteDatabaseSize(playground, path);
					if (cancelled) return;
					setDatabaseSize(size);
					setSizeStatus('ready');
				} else if (!cancelled) {
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
	}, [playground, isBooting]);

	return (
		<div className={css.databasePanel}>
			<dl className={css.databaseInfo}>
				<dt className={css.label}>
					{__('Driver:', 'playground-website')}
				</dt>
				<dd className={css.value}>
					{__(
						'MySQL emulation backed by SQLite',
						'playground-website'
					)}
				</dd>
				<dt className={css.label}>
					{__('Path:', 'playground-website')}
				</dt>
				<dd className={css.value}>
					<code>
						{databasePath ??
							(sizeStatus === 'loading'
								? __('Loading…', 'playground-website')
								: __('Unavailable', 'playground-website'))}
					</code>
				</dd>
				<dt className={css.label}>
					{__('Size:', 'playground-website')}
				</dt>
				<dd className={css.value}>
					{sizeStatus === 'loading'
						? __('Calculating…', 'playground-website')
						: sizeStatus === 'ready' && databaseSize !== null
							? formatBytes(databaseSize)
							: __('Unavailable', 'playground-website')}
				</dd>
			</dl>

			<Notice
				className={css.siteNotice}
				status="info"
				isDismissible={false}
			>
				<p className={css.noticeEyebrow}>
					{__('Early access', 'playground-website')}
				</p>
				<p className={css.noticeBody}>
					{createInterpolateElement(
						__(
							'Playground <sqliteLink>emulates MySQL with SQLite</sqliteLink>. These tools are a work in progress — <issuesLink>report issues</issuesLink>.',
							'playground-website'
						),
						{
							sqliteLink: (
								<a
									target="_blank"
									rel="noreferrer"
									href="https://make.wordpress.org/playground/2025/06/13/introducing-a-new-sqlite-driver-for-wordpress/"
								/>
							),
							issuesLink: (
								<a
									target="_blank"
									rel="noreferrer"
									href="https://github.com/WordPress/wordpress-playground/issues"
								/>
							),
						}
					)}
				</p>
			</Notice>

			{playground ? (
				<div className={css.buttonGroup}>
					<AdminerButton playground={playground} />
					<PhpMyAdminButton playground={playground} />
					<DownloadButton
						playground={playground}
						databasePath={databasePath}
					/>
				</div>
			) : (
				<PlaygroundBootNotice
					show={isBooting}
					message={__(
						'The Playground is still loading — database tools will be ready in a moment.',
						'playground-website'
					)}
				/>
			)}
		</div>
	);
}

function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 B';
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
