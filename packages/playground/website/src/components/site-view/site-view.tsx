import {
	DisplayMode,
	PlaygroundViewport,
	supportedDisplayModes,
} from '../playground-viewport';
import '../../styles.css';
import css from './style.module.css';

import PlaygroundConfigurationGroup from '../playground-configuration-group';
import { GithubImportModal } from '../../github/github-import-form';
import { GithubExportModal } from '../../github/github-export-form';
import { useState, useEffect } from 'react';
import {
	ExportFormValues,
	asPullRequestAction,
} from '../../github/github-export-form/form';
import { addCrashListener, logger } from '@php-wasm/logger';
import { asContentType } from '../../github/import-from-github';
import { GitHubOAuthGuardModal } from '../../github/github-oauth-guard';
import { useDispatch, useSelector } from 'react-redux';
import {
	PlaygroundDispatch,
	PlaygroundReduxState,
	setActiveModal,
} from '../../lib/redux-store';
import { Blueprint, StepDefinition } from '@wp-playground/client';
import { acquireOAuthTokenIfNeeded } from '../../github/acquire-oauth-token-if-needed';
import { LogModal } from '../log-modal';
import { ErrorReportModal } from '../error-report-modal';
import { StartErrorModal } from '../start-error-modal';
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
	storage,
	hideToolbar,
	className = '',
}: {
	blueprint: Blueprint;
	storage: SiteStorageType;
	hideToolbar?: boolean;
	className?: string;
}) {
	const dispatch: PlaygroundDispatch = useDispatch();

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
		// @TODO: Log this in the addSite() action
		const steps = (blueprint?.steps || [])
			?.filter((step: any) => !!(typeof step === 'object' && step?.step))
			.map((step) => (step as StepDefinition).step);
		for (const step of steps) {
			logTrackingEvent('step', { step });
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [blueprint?.steps]);

	return (
		<div className={`${css.siteView} ${className}`}>
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
					(query.get('ghexport-allow-include-zip') ?? 'yes') === 'yes'
				}
				initialValues={githubExportValues}
				initialFilesBeforeChanges={githubExportFiles}
				onExported={(prUrl, formValues) => {
					setGithubExportValues(formValues);
					setGithubExportFiles(undefined);
				}}
			/>
			<PlaygroundViewport
				displayMode={displayMode}
				hideToolbar={hideToolbar}
				toolbarButtons={[
					<PlaygroundConfigurationGroup key="configuration" />,
				]}
			/>
		</div>
	);
}
