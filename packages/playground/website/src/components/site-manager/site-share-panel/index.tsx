import { Button } from '@wordpress/components';
import { Icon, chevronLeft, download, link } from '@wordpress/icons';
import { zipWpContent } from '@wp-playground/client';
import saveAs from 'file-saver';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../lib/state/redux/store';
import { setShareExportOpen } from '../../../lib/state/redux/slice-ui';
import { usePlaygroundClient } from '../../../lib/use-playground-client';
import { GitHubIcon } from '../../../github/github';
import { Spinner } from '../../spinner';
import { PlaygroundBootNotice } from '../../pane-loading';
import type { ExportFormValues } from '../../../github/github-export-form/form';
import css from './style.module.css';

// The export form pulls in the GitHub/storage stack, so load it only when the
// user actually opens it.
const GitHubExportForm = lazy(
	() => import('../../../github/github-export-form/form')
);

export function SiteSharePanel() {
	const offline = useAppSelector((state) => state.ui.offline);
	const playground = usePlaygroundClient();
	const dispatch = useAppDispatch();
	const [isDownloading, setIsDownloading] = useState(false);
	const [linkCopied, setLinkCopied] = useState(false);
	// Announced to screen readers since the visual "Link copied" swap isn't.
	const [copyStatus, setCopyStatus] = useState('');
	// Lives in Redux so the dock can drop its own header while the export
	// sub-view is open (a single header instead of two).
	const showGitHubExport = useAppSelector(
		(state) => state.ui.shareExportOpen
	);
	const setShowGitHubExport = (open: boolean) =>
		dispatch(setShareExportOpen(open));
	// Reset when leaving the Share pane so it always reopens on the list.
	useEffect(() => {
		return () => {
			dispatch(setShareExportOpen(false));
		};
	}, [dispatch]);
	// Remember the form values so collapsing and reopening the export doesn't
	// wipe the repo URL the user already typed.
	const [exportValues, setExportValues] = useState<
		Partial<ExportFormValues> | undefined
	>();
	const disabled = !playground;

	const copyLink = async () => {
		try {
			await navigator.clipboard.writeText(window.location.href);
			setLinkCopied(true);
			setCopyStatus('Link copied');
			setTimeout(() => {
				setLinkCopied(false);
				setCopyStatus('');
			}, 2000);
		} catch {
			// Clipboard can be blocked; announce the failure to screen readers
			// rather than alerting visually.
			setCopyStatus("Couldn't copy link");
			setTimeout(() => setCopyStatus(''), 2000);
		}
	};

	// Warm the export-form chunk on intent (hover/focus) so it renders without a
	// spinner when opened — keeping the open animation smooth.
	const preloadExportForm = () => {
		void import('../../../github/github-export-form/form');
	};

	const downloadZip = async () => {
		if (!playground) {
			return;
		}
		setIsDownloading(true);
		try {
			const bytes = await zipWpContent(playground, {
				selfContained: true,
			});
			saveAs(new File([bytes], 'wordpress-playground.zip'));
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
							setExportValues(formValues)
						}
						initialValues={exportValues}
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
