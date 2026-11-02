import { logger } from '@php-wasm/logger';
import { Button, Icon } from '@wordpress/components';
import { download, link } from '@wordpress/icons';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { GitHubIcon } from '../../../github/github';
import { useGitHubExportSession } from '../../../github/github-export-session';
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
import { downloadPlaygroundAsZip } from '../../toolbar-buttons/download-as-zip';
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
				'Unable to prepare the .zip download. Please try again.'
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
				aria-label="Export to GitHub form"
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
						message="The Playground is still loading — Export to GitHub will be ready in a moment."
					/>
				)}
			</section>
		);
	}

	return (
		<section className={css.sharePanel} aria-label="Export options">
			<PlaygroundBootNotice
				show={!playground}
				message="The Playground is still loading — Download and Export to GitHub will be ready in a moment."
			/>
			<div className={css.group}>
				<span className={css.groupIcon} aria-hidden="true">
					<Icon icon={download} size={22} />
				</span>
				<div className={css.groupBody}>
					<h3 className={css.groupTitle}>Download a copy</h3>
					<p className={css.hint}>
						Saves everything as it is right now — files, database,
						and your edits — to a .zip you can re-import later.
					</p>
					<div className={css.actions}>
						<Button
							variant="primary"
							data-cy="download-as-zip"
							disabled={!playground || isDownloading}
							onClick={downloadZip}
						>
							{isDownloading
								? 'Preparing .zip…'
								: 'Download as .zip'}
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
					<h3 className={css.groupTitle}>Copy original setup link</h3>
					<p className={css.hint}>
						Copies a URL that rebuilds this Playground from its
						original Blueprint on any device. It restores the
						starting setup only — your edits to files and content
						aren&apos;t included.
					</p>
					<div className={css.actions}>
						<Button variant="secondary" onClick={copySetupUrl}>
							{copyStatus === 'copied'
								? 'Link copied'
								: 'Copy link'}
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
									? 'Clipboard access was blocked. Please try again.'
									: 'Setup URL copied to the clipboard.'}
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
					<h3 className={css.groupTitle}>Export to GitHub</h3>
					<p className={css.hint}>
						Pushes the current state — including your edits — to a
						GitHub repository.
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
							Export to GitHub
						</Button>
					</div>
				</div>
			</div>
		</section>
	);
}
