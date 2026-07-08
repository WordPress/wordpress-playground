import { Button } from '@wordpress/components';
import { Icon, chevronLeft, download, link } from '@wordpress/icons';
import { zipWpContent } from '@wp-playground/client';
import saveAs from 'file-saver';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
	selectActiveSite,
	useAppDispatch,
	useAppSelector,
} from '../../../lib/state/redux/store';
import { setShareExportOpen } from '../../../lib/state/redux/slice-ui';
import { updateUrl } from '../../../lib/state/url/router-hooks';
import { usePlaygroundClient } from '../../../lib/use-playground-client';
import { GitHubIcon } from '../../../github/github';
import { Spinner } from '../../spinner';
import { PlaygroundBootNotice } from '../../pane-loading';
import type { ExportFormValues } from '../../../github/github-export-form/form-types';
import {
	clearGitHubImportBaselineForExport,
	exportValuesMatchGitHubImportBaseline,
	getGitHubImportBaselineForExport,
} from '../../../github/github-export-form/import-baseline';
import css from './style.module.css';
import { logger } from '@php-wasm/logger';

// The export form pulls in the GitHub/storage stack, so load it only when the
// user actually opens it.
const GitHubExportForm = lazy(
	() => import('../../../github/github-export-form/form')
);

export function SiteSharePanel() {
	const offline = useAppSelector((state) => state.ui.offline);
	const activeSite = useAppSelector(selectActiveSite);
	const playground = usePlaygroundClient();
	const dispatch = useAppDispatch();
	const [isDownloading, setIsDownloading] = useState(false);
	const [downloadError, setDownloadError] = useState('');
	const [linkCopied, setLinkCopied] = useState(false);
	// Announced to screen readers since the visual "Link copied" swap isn't.
	const [copyStatus, setCopyStatus] = useState('');
	const copyStatusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
		null
	);
	// Lives in Redux so the dock can drop its own header while the export
	// sub-view is open (a single header instead of two).
	const showGitHubExport = useAppSelector(
		(state) => state.ui.shareExportOpen
	);
	const setShowGitHubExport = (open: boolean) =>
		dispatch(setShareExportOpen(open));
	useEffect(() => {
		if (showGitHubExport && !playground) {
			dispatch(setShareExportOpen(false));
		}
	}, [dispatch, playground, showGitHubExport]);
	// Reset when leaving the Share pane so it always reopens on the list.
	useEffect(() => {
		return () => {
			dispatch(setShareExportOpen(false));
		};
	}, [dispatch]);
	useEffect(() => {
		return () => {
			if (copyStatusTimeoutRef.current) {
				clearTimeout(copyStatusTimeoutRef.current);
			}
		};
	}, []);
	// Remember the form values so collapsing and reopening the export doesn't
	// wipe the repo URL the user already typed.
	const [exportValues, setExportValues] = useState<
		Partial<ExportFormValues> | undefined
	>();
	const [exportFilesCommitSha, setExportFilesCommitSha] = useState<
		string | undefined
	>();
	const activeSiteSlug = activeSite?.slug;
	const disabled = !playground;

	useEffect(() => {
		if (!activeSiteSlug) {
			setExportValues(undefined);
			setExportFilesCommitSha(undefined);
			return;
		}
		const baseline = getGitHubImportBaselineForExport(activeSiteSlug);
		setExportValues(baseline?.initialValues);
		setExportFilesCommitSha(baseline?.filesCommitSha);
	}, [activeSiteSlug]);

	const copyLink = async () => {
		try {
			await navigator.clipboard.writeText(
				getOriginalSetupUrl(activeSite)
			);
			showTemporaryCopyStatus('Link copied', true);
		} catch {
			// Clipboard can be blocked; announce the failure to screen readers
			// rather than alerting visually.
			showTemporaryCopyStatus("Couldn't copy link");
		}
	};

	const showTemporaryCopyStatus = (message: string, copied = false) => {
		if (copyStatusTimeoutRef.current) {
			clearTimeout(copyStatusTimeoutRef.current);
		}
		setLinkCopied(copied);
		setCopyStatus(message);
		copyStatusTimeoutRef.current = setTimeout(() => {
			setLinkCopied(false);
			setCopyStatus('');
			copyStatusTimeoutRef.current = null;
		}, 2000);
	};

	// Warm the export-form chunk on intent (hover/focus) so it renders without a
	// spinner when opened — keeping the open animation smooth.
	const preloadExportForm = () => {
		void import('../../../github/github-export-form/form');
	};

	const rememberExportValues = (values: ExportFormValues) => {
		setExportValues(values);
		if (!activeSiteSlug) {
			return;
		}
		const baseline = getGitHubImportBaselineForExport(activeSiteSlug);
		if (
			baseline &&
			!exportValuesMatchGitHubImportBaseline(
				values,
				baseline.initialValues
			)
		) {
			setExportFilesCommitSha(undefined);
			clearGitHubImportBaselineForExport(activeSiteSlug);
		}
	};

	const markExported = (formValues: ExportFormValues) => {
		setExportValues(formValues);
		setExportFilesCommitSha(undefined);
		if (activeSiteSlug) {
			clearGitHubImportBaselineForExport(activeSiteSlug);
		}
	};

	const downloadZip = async () => {
		if (!playground) {
			return;
		}
		setIsDownloading(true);
		setDownloadError('');
		try {
			const bytes = await zipWpContent(playground, {
				selfContained: true,
			});
			saveAs(new File([bytes], 'wordpress-playground.zip'));
		} catch (error) {
			logger.error('Failed to download Playground zip', error);
			setDownloadError(
				'Unable to prepare the .zip download. Please try again.'
			);
		} finally {
			setIsDownloading(false);
		}
	};

	// The GitHub export runs inline as a sub-view of this pane (no modal).
	if (showGitHubExport && playground) {
		return (
			<section className={css.sharePanel}>
				<button
					type="button"
					className={css.backButton}
					onClick={() => setShowGitHubExport(false)}
				>
					<Icon icon={chevronLeft} size={24} />
					Export to GitHub
				</button>
				<Suspense
					fallback={
						<div className={css.exportLoading}>
							<Spinner />
						</div>
					}
				>
					<GitHubExportForm
						playground={playground}
						onClose={() => setShowGitHubExport(false)}
						onExported={(_prUrl, formValues) =>
							markExported(formValues)
						}
						onValuesChange={rememberExportValues}
						initialValues={exportValues}
						initialFilesBeforeChangesCommitSha={
							exportFilesCommitSha
						}
					/>
				</Suspense>
			</section>
		);
	}

	return (
		<section className={css.sharePanel}>
			<PlaygroundBootNotice
				show={disabled}
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
							disabled={disabled || isDownloading}
							onClick={downloadZip}
						>
							{isDownloading
								? 'Preparing .zip…'
								: 'Download as .zip'}
						</Button>
						{downloadError && (
							<div role="alert" className={css.error}>
								{downloadError}
							</div>
						)}
					</div>
				</div>
			</div>
			<div className={css.group}>
				<span className={css.groupIcon} aria-hidden="true">
					<Icon icon={link} size={22} />
				</span>
				<div className={css.groupBody}>
					<h3 className={css.groupTitle}>Share a link</h3>
					<p className={css.hint}>
						Copies a URL that rebuilds this Playground from its
						original Blueprint on any device. It restores the
						starting setup only — your edits to files and content
						aren&apos;t included.
					</p>
					<div className={css.actions}>
						<Button variant="secondary" onClick={copyLink}>
							{linkCopied ? 'Link copied' : 'Copy link'}
						</Button>
						<span
							role="status"
							aria-live="polite"
							className="sr-only"
						>
							{copyStatus}
						</span>
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
							variant="secondary"
							disabled={offline || disabled}
							onMouseEnter={preloadExportForm}
							onFocus={preloadExportForm}
							onClick={() => setShowGitHubExport(true)}
						>
							Export to GitHub
						</Button>
					</div>
				</div>
			</div>
		</section>
	);
}

function getOriginalSetupUrl(
	activeSite: ReturnType<typeof selectActiveSite>
): string {
	const setupParams = activeSite?.originalUrlParams;
	if (!setupParams) {
		return window.location.href;
	}
	return updateUrl(window.location.href, {
		searchParams: setupParams.searchParams ?? {},
		hash: setupParams.hash ?? '',
	});
}
