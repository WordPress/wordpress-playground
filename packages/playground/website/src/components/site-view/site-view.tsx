import { DropdownMenu, MenuGroup, MenuItem } from '@wordpress/components';
import { menu, external } from '@wordpress/icons';
import {
	DisplayMode,
	PlaygroundViewport,
	supportedDisplayModes,
} from '../playground-viewport';
import buttonCss from '../button/style.module.css';
import '../../styles.css';
import css from './style.module.css';

import PlaygroundConfigurationGroup from '../playground-configuration-group';
import { ResetSiteMenuItem } from '../toolbar-buttons/reset-site';
import { DownloadAsZipMenuItem } from '../toolbar-buttons/download-as-zip';
import { RestoreFromZipMenuItem } from '../toolbar-buttons/restore-from-zip';
import { ReportError } from '../toolbar-buttons/report-error';
import { ViewLogs } from '../toolbar-buttons/view-logs';
import { GithubImportMenuItem } from '../toolbar-buttons/github-import-menu-item';
import { GithubImportModal } from '../../github/github-import-form';
import { GithubExportMenuItem } from '../toolbar-buttons/github-export-menu-item';
import { GithubExportModal } from '../../github/github-export-form';
import { useState, useEffect } from 'react';
import {
	ExportFormValues,
	asPullRequestAction,
} from '../../github/github-export-form/form';
import { joinPaths } from '@php-wasm/util';
import { PlaygroundContext } from '../../playground-context';
import { addCrashListener, logger } from '@php-wasm/logger';
import { asContentType } from '../../github/import-from-github';
import { GitHubOAuthGuardModal } from '../../github/github-oauth-guard';
import { OfflineNotice } from '../offline-notice';
import { useDispatch, useSelector } from 'react-redux';
import {
	PlaygroundDispatch,
	PlaygroundReduxState,
	setActiveModal,
} from '../../lib/redux-store';
import {
	Blueprint,
	PlaygroundClient,
	StepDefinition,
} from '@wp-playground/client';
import { acquireOAuthTokenIfNeeded } from '../../github/acquire-oauth-token-if-needed';
import { LogModal } from '../log-modal';
import { ErrorReportModal } from '../error-report-modal';
import { StartErrorModal } from '../start-error-modal';
import { PlaygroundConfiguration } from '../playground-configuration-group/form';
import { logTrackingEvent } from '../../lib/tracking';
import { SiteStorageType } from '../../lib/site-storage';

acquireOAuthTokenIfNeeded();

function Modals(blueprint: Blueprint) {
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

	return null;
}

export function SiteView({
	blueprint,
	currentConfiguration,
	storage,
	playground,
	url,
	hideToolbar,
	iframeRef,
	siteViewRef,
	className = '',
}: {
	blueprint: Blueprint;
	currentConfiguration: PlaygroundConfiguration;
	storage: SiteStorageType;
	playground?: PlaygroundClient;
	hideToolbar?: boolean;
	url?: string;
	iframeRef: React.RefObject<HTMLIFrameElement>;
	siteViewRef: React.RefObject<HTMLDivElement>;
	className?: string;
}) {
	const dispatch: PlaygroundDispatch = useDispatch();
	const offline = useSelector((state: PlaygroundReduxState) => state.offline);

	const query = new URL(document.location.href).searchParams;
	const displayMode: DisplayMode = supportedDisplayModes.includes(
		query.get('mode') as any
	)
		? (query.get('mode') as DisplayMode)
		: 'browser-full-screen';

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

	// Add GA events for blueprint steps. For more information, see the README.md
	// file.
	useEffect(() => {
		logTrackingEvent('load');
		// Log the names of provided Blueprint's steps.
		// Only the names (e.g. "runPhp" or "login") are logged. Step options like
		// code, password, URLs are never sent anywhere.
		const steps = (blueprint?.steps || [])
			?.filter((step: any) => !!(typeof step === 'object' && step?.step))
			.map((step) => (step as StepDefinition).step);
		for (const step of steps) {
			logTrackingEvent('step', { step });
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [blueprint?.steps]);

	return (
		<PlaygroundContext.Provider
			value={{
				storage,
				playground,
				currentUrl: url,
			}}
		>
			<div className={`${css.siteView} ${className}`} ref={siteViewRef}>
				<Modals />

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
						(query.get('ghexport-allow-include-zip') ?? 'yes') ===
						'yes'
					}
					initialValues={githubExportValues}
					initialFilesBeforeChanges={githubExportFiles}
					onExported={(prUrl, formValues) => {
						setGithubExportValues(formValues);
						setGithubExportFiles(undefined);
					}}
				/>
				<PlaygroundViewport
					ref={iframeRef}
					storage={storage}
					displayMode={displayMode}
					hideToolbar={hideToolbar}
					toolbarButtons={[
						<PlaygroundConfigurationGroup
							key="configuration"
							initialConfiguration={currentConfiguration}
						/>,
						<DropdownMenu
							key="menu"
							icon={menu}
							label="Additional actions"
							className={css.dropdownMenu}
							toggleProps={
								{
									className: `${buttonCss.button} ${buttonCss.isBrowserChrome}`,
									'data-cy': 'dropdown-menu',
								} as any
							}
						>
							{({ onClose }) => (
								<>
									{offline ? <OfflineNotice /> : null}
									<MenuGroup>
										<ResetSiteMenuItem
											storage={
												currentConfiguration.storage
											}
											onClose={onClose}
										/>
										<ReportError
											onClose={onClose}
											disabled={offline}
										/>
										<DownloadAsZipMenuItem
											onClose={onClose}
										/>
										<RestoreFromZipMenuItem
											onClose={onClose}
										/>
										<GithubImportMenuItem
											onClose={onClose}
											disabled={offline}
										/>
										<GithubExportMenuItem
											onClose={onClose}
											disabled={offline}
										/>
										<ViewLogs onClose={onClose} />
										<MenuItem
											icon={external}
											iconPosition="left"
											aria-label="Go to Blueprints Builder"
											// @ts-ignore-next-line
											href={
												[
													joinPaths(
														document.location
															.pathname,
														'builder/builder.html'
													),
													'#',
													btoa(
														JSON.stringify(
															blueprint
														) as string
													) as string,
												].join('') as any
											}
											target="_blank"
											disabled={offline}
										>
											Edit the Blueprint
										</MenuItem>
									</MenuGroup>
									<MenuGroup label="More resources">
										<MenuItem
											icon={external}
											iconPosition="left"
											aria-label="Go to WordPress PR previewer"
											// @ts-ignore-next-line
											href={
												joinPaths(
													document.location.pathname,
													'wordpress.html'
												) as any
											}
											target="_blank"
											disabled={offline}
										>
											Preview WordPress Pull Request
										</MenuItem>
										<MenuItem
											icon={external}
											iconPosition="left"
											aria-label="Go to a list of Playground demos"
											// @ts-ignore-next-line
											href={
												joinPaths(
													document.location.pathname,
													'demos/index.html'
												) as any
											}
											target="_blank"
											disabled={offline}
										>
											More demos
										</MenuItem>
										<MenuItem
											icon={external}
											iconPosition="left"
											aria-label="Go to Playground documentation"
											// @ts-ignore-next-line
											href={
												'https://wordpress.github.io/wordpress-playground/' as any
											}
											target="_blank"
											disabled={offline}
										>
											Documentation
										</MenuItem>
										<MenuItem
											icon={external}
											iconPosition="left"
											aria-label="Go to the Playground git repository"
											// @ts-ignore-next-line
											href={
												'https://github.com/WordPress/wordpress-playground' as any
											}
											target="_blank"
											disabled={offline}
										>
											GitHub
										</MenuItem>
									</MenuGroup>
								</>
							)}
						</DropdownMenu>,
					]}
				/>
			</div>
		</PlaygroundContext.Provider>
	);
}
