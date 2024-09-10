import css from './style.module.css';

import { SiteManager } from '../site-manager';
import { CSSTransition } from 'react-transition-group';
import {
	useAppSelector,
	useAppDispatch,
	setSiteManagerIsOpen,
	useActiveSite,
	PlaygroundDispatch,
	PlaygroundReduxState,
	setActiveModal,
} from '../../lib/state/redux/store';
import { addCrashListener, logger } from '@php-wasm/logger';
import { Blueprint } from '@wp-playground/blueprints';
import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { acquireOAuthTokenIfNeeded } from '../../github/acquire-oauth-token-if-needed';
import { GithubExportModal } from '../../github/github-export-form';
import {
	ExportFormValues,
	asPullRequestAction,
} from '../../github/github-export-form/form';
import { GithubImportModal } from '../../github/github-import-form';
import { GitHubOAuthGuardModal } from '../../github/github-oauth-guard';
import { asContentType } from '../../github/import-from-github';
import { ErrorReportModal } from '../error-report-modal';
import { LogModal } from '../log-modal';
import { StartErrorModal } from '../start-error-modal';
import {
	DisplayMode,
	supportedDisplayModes,
	PlaygroundViewport,
} from '../playground-viewport';

acquireOAuthTokenIfNeeded();

const query = new URL(document.location.href).searchParams;
const displayMode: DisplayMode = supportedDisplayModes.includes(
	query.get('mode') as any
)
	? (query.get('mode') as DisplayMode)
	: 'browser-full-screen';

export function Layout() {
	const siteManagerIsOpen = useAppSelector(
		(state) => state.siteManagerIsOpen
	);
	const siteManagerWrapperRef = useRef<HTMLDivElement>(null);
	const dispatch = useAppDispatch();
	const activeSite = useActiveSite()!;
	if (!activeSite) {
		// @TODO: Why does this happen for a brief moment when updating a local site?
		return null;
	}

	return (
		<div className={css.layout}>
			<Modals />
			<CSSTransition
				nodeRef={siteManagerWrapperRef}
				in={siteManagerIsOpen}
				timeout={500}
				classNames={{
					enter: css.siteManagerWrapperEnter,
					enterActive: css.siteManagerWrapperEnterActive,
					exit: css.siteManagerWrapperExit,
					exitActive: css.siteManagerWrapperExitActive,
				}}
				unmountOnExit
			>
				<div
					ref={siteManagerWrapperRef}
					className={css.siteManagerWrapper}
				>
					<SiteManager />
				</div>
			</CSSTransition>
			<div className={css.siteView}>
				{siteManagerIsOpen && (
					<div
						title="Open site"
						className={css.siteViewOverlay}
						onClick={() => {
							dispatch(setSiteManagerIsOpen(false));
						}}
					/>
				)}
				<div className={css.siteViewContent}>
					<PlaygroundViewport
						displayMode={displayMode}
						hideToolbar={siteManagerIsOpen}
					/>
				</div>
			</div>
		</div>
	);
}

/**
 * @TODO: Think through a mobile-friendly modal architecture that doesn't
 *        stack modals, allows dismissing. Discuss whether modals should
 *        be declared at the top level, like here, or contextual to where
 *        the "Show modal" button is rendered.
 */
function Modals(blueprint: Blueprint) {
	const dispatch: PlaygroundDispatch = useDispatch();

	const query = new URL(document.location.href).searchParams;

	const [githubExportFiles, setGithubExportFiles] = useState<any[]>();
	const [githubExportValues, setGithubExportValues] = useState<
		Partial<ExportFormValues>
	>(() => {
		const values: Partial<ExportFormValues> = {};
		if (query.get('ghexport-repo-url')) {
			values.repoUrl = query.get('ghexport-repo-url')!;
		}
		if (query.get('ghexport-content-type')) {
			values.contentType = asContentType(
				query.get('ghexport-content-type')
			);
		}
		if (query.get('ghexport-pr-action')) {
			values.prAction = asPullRequestAction(
				query.get('ghexport-pr-action')
			);
		}
		if (query.get('ghexport-pr-number')) {
			values.prNumber = query.get('ghexport-pr-number')?.toString();
		}
		if (query.get('ghexport-playground-root')) {
			values.fromPlaygroundRoot = query.get('ghexport-playground-root')!;
		}
		if (query.get('ghexport-repo-root')) {
			values.toPathInRepo = query.get('ghexport-repo-root')!;
		}
		if (query.get('ghexport-path')) {
			values.relativeExportPaths = query.getAll('ghexport-path');
		}
		if (query.get('ghexport-commit-message')) {
			values.commitMessage = query.get('ghexport-commit-message')!;
		}
		if (query.get('ghexport-plugin')) {
			values.plugin = query.get('ghexport-plugin')!;
		}
		if (query.get('ghexport-theme')) {
			values.theme = query.get('ghexport-theme')!;
		}
		return values;
	});

	useEffect(() => {
		addCrashListener(logger, (e) => {
			const error = e as CustomEvent;
			if (error.detail?.source === 'php-wasm') {
				dispatch(setActiveModal('error-report'));
			}
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const currentModal = useSelector(
		(state: PlaygroundReduxState) => state.activeModal
	);

	if (currentModal === 'log') {
		return <LogModal />;
	} else if (currentModal === 'error-report') {
		return <ErrorReportModal blueprint={blueprint} />;
	} else if (currentModal === 'start-error') {
		return <StartErrorModal />;
	}

	return (
		<>
			{query.get('gh-ensure-auth') === 'yes' ? (
				<GitHubOAuthGuardModal />
			) : (
				''
			)}
			<GithubImportModal
				onImported={({
					url,
					path,
					files,
					pluginOrThemeName,
					contentType,
					urlInformation: { owner, repo, type, pr },
				}) => {
					setGithubExportValues({
						repoUrl: url,
						prNumber: pr?.toString(),
						toPathInRepo: path,
						prAction: pr ? 'update' : 'create',
						contentType,
						plugin: pluginOrThemeName,
						theme: pluginOrThemeName,
					});
					setGithubExportFiles(files);
				}}
			/>
			<GithubExportModal
				allowZipExport={
					(query.get('ghexport-allow-include-zip') ?? 'yes') === 'yes'
				}
				initialValues={githubExportValues}
				initialFilesBeforeChanges={githubExportFiles}
				onExported={(prUrl, formValues) => {
					setGithubExportValues(formValues);
					setGithubExportFiles(undefined);
				}}
			/>
		</>
	);
}
