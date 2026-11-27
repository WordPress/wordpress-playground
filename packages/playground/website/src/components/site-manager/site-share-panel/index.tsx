import { logger } from '@php-wasm/logger';
import { Button, Icon } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { download, link } from '@wordpress/icons';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { GitHubIcon } from '../../../github/github';
import { useGitHubExportSession } from '../../../github/github-export-session';
import { downloadPlaygroundAsZip } from '../../../lib/download-playground-as-zip';
import { getSetupUrlFromSite } from '../../../lib/state/playground-identity';
import { setShareExportOpen } from '../../../lib/state/redux/slice-ui';
import {
	useActiveSite,
	useAppDispatch,
	useAppSelector,
} from '../../../lib/state/redux/store';
import { usePlaygroundClient } from '../../../lib/use-playground-client';
import { PlaygroundBootNotice } from '../../pane-loading';
import { Spinner } from '../../spinner';
import css from './style.module.css';

type CopyStatus = 'idle' | 'copied' | 'failed';

// The export form pulls in the GitHub/storage stack, so load it only when the
// user opens that option.
const GitHubExportForm = lazy(
	() => import('../../../github/github-export-form/form')
);

/**
 * Offers the active Playground as a zip, a reproducible setup URL, or a GitHub
 * export.
 */
export function SiteSharePanel() {
	const activeSite = useActiveSite();
	const playground = usePlaygroundClient();
	const offline = useAppSelector((state) => state.ui.offline);
	const dispatch = useAppDispatch();
	const [isDownloading, setIsDownloading] = useState(false);
	const [downloadError, setDownloadError] = useState('');
	const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle');
	const showGitHubExport = useAppSelector(
		(state) => state.ui.shareExportOpen
	);
	const githubExportSession = useGitHubExportSession();
	const exportButtonRef = useRef<HTMLButtonElement>(null);
	const exportWasOpenRef = useRef(false);

	useEffect(() => {
		return () => {
			dispatch(setShareExportOpen(false));
		};
	}, [dispatch]);

	useEffect(() => {
		if (!showGitHubExport && exportWasOpenRef.current) {
			exportButtonRef.current?.focus();
		}
		exportWasOpenRef.current = showGitHubExport;
	}, [showGitHubExport]);

	/** Packages the running site's wp-content and database into a local zip. */
	async function downloadZip() {
		if (!playground) {
			return;
		}

		setIsDownloading(true);
		setDownloadError('');
		try {
			await downloadPlaygroundAsZip(playground);
		} catch (error) {
			logger.error('Failed to download Playground zip', error);
			setDownloadError(
				__(
					'Unable to prepare the .zip download. Please try again.',
					'playground-website'
				)
			);
		} finally {
			setIsDownloading(false);
		}
	}

	/** Copies the site's original setup URL, falling back to the current URL. */
	async function copySetupUrl() {
		setCopyStatus('idle');
		try {
			const setupUrl = activeSite
				? getSetupUrlFromSite(
						activeSite,
						window.location.href
					).toString()
				: window.location.href;
			await navigator.clipboard.writeText(setupUrl);
			setCopyStatus('copied');
		} catch {
			setCopyStatus('failed');
		}
	}

	/** Warms the export form chunk before the user opens it. */
	function preloadExportForm() {
		void import('../../../github/github-export-form/form');
	}

	if (showGitHubExport) {
		return (
			<section
				className={`${css.sharePanel} ${css.githubExportPanel}`}
				aria-label={__('Export to GitHub form', 'playground-website')}
			>
				{playground ? (
					<Suspense
						fallback={
							<div className={css.exportLoading}>
								<Spinner />
							</div>
						}
					>
						<GitHubExportForm
							className={css.githubExportForm}
							playground={playground}
							onClose={() => dispatch(setShareExportOpen(false))}
							onExported={(_prUrl, formValues) =>
								githubExportSession.recordExport(formValues)
							}
							initialValues={githubExportSession.values}
							initialFilesBeforeChanges={
								githubExportSession.filesBeforeChanges
							}
							allowZipExport={githubExportSession.allowZipExport}
						/>
					</Suspense>
				) : (
					<PlaygroundBootNotice
						show
						message={__(
							'The Playground is still loading — Export to GitHub will be ready in a moment.',
							'playground-website'
						)}
					/>
				)}
			</section>
		);
	}

	return (
		<section
			className={css.sharePanel}
			aria-label={__('Export options', 'playground-website')}
		>
			<PlaygroundBootNotice
				show={!playground}
				message={__(
					'The Playground is still loading — Download and Export to GitHub will be ready in a moment.',
					'playground-website'
				)}
			/>
			<div className={css.group}>
				<span className={css.groupIcon} aria-hidden="true">
					<Icon icon={download} size={22} />
				</span>
				<div className={css.groupBody}>
					<h3 className={css.groupTitle}>
						{__('Download a copy', 'playground-website')}
					</h3>
					<p className={css.hint}>
						{__(
							'Saves everything as it is right now — files, database, and your edits — to a .zip you can re-import later.',
							'playground-website'
						)}
					</p>
					<div className={css.actions}>
						<Button
							variant="primary"
							data-cy="download-as-zip"
							disabled={!playground || isDownloading}
							onClick={downloadZip}
						>
							{isDownloading
								? __('Preparing .zip…', 'playground-website')
								: __('Download as .zip', 'playground-website')}
						</Button>
						{downloadError && (
							<p className={css.error} role="alert">
								{downloadError}
							</p>
						)}
					</div>
				</div>
			</div>

			<div className={css.group}>
				<span className={css.groupIcon} aria-hidden="true">
					<Icon icon={link} size={22} />
				</span>
				<div className={css.groupBody}>
					<h3 className={css.groupTitle}>
						{__('Copy original setup link', 'playground-website')}
					</h3>
					<p className={css.hint}>
						{__(
							"Copies a URL that rebuilds this Playground from its original Blueprint on any device. It restores the starting setup only — your edits to files and content aren't included.",
							'playground-website'
						)}
					</p>
					<div className={css.actions}>
						<Button variant="secondary" onClick={copySetupUrl}>
							{copyStatus === 'copied'
								? __('Link copied', 'playground-website')
								: __('Copy link', 'playground-website')}
						</Button>
						{copyStatus !== 'idle' && (
							<p
								className={
									copyStatus === 'failed'
										? css.error
										: css.status
								}
								role={
									copyStatus === 'failed' ? 'alert' : 'status'
								}
							>
								{copyStatus === 'failed'
									? __(
											'Clipboard access was blocked. Please try again.',
											'playground-website'
										)
									: __(
											'Setup URL copied to the clipboard.',
											'playground-website'
										)}
							</p>
						)}
					</div>
				</div>
			</div>

			<div className={css.group}>
				<span className={css.groupIcon} aria-hidden="true">
					<Icon icon={GitHubIcon} size={22} />
				</span>
				<div className={css.groupBody}>
					<h3 className={css.groupTitle}>
						{__('Export to GitHub', 'playground-website')}
					</h3>
					<p className={css.hint}>
						{__(
							'Pushes the current state — including your edits — to a GitHub repository.',
							'playground-website'
						)}
					</p>
					<div className={css.actions}>
						<Button
							ref={exportButtonRef}
							variant="secondary"
							disabled={offline || !playground}
							onMouseEnter={preloadExportForm}
							onFocus={preloadExportForm}
							onClick={() => dispatch(setShareExportOpen(true))}
						>
							{__('Export to GitHub', 'playground-website')}
						</Button>
					</div>
				</div>
			</div>
		</section>
	);
}
