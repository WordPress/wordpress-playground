import React, { useEffect, useRef } from 'react';
import { useState } from 'react';
import type { PlaygroundClient } from '@wp-playground/client';
import {
	wpContentFilesExcludedFromExport,
	zipWpContent,
} from '@wp-playground/client';

import css from './style.module.css';
import forms from '../../forms.module.css';
import Button from '../../components/button';
import {
	resolveGitHubBranchPath,
	staticAnalyzeGitHubURL,
} from '../analyze-github-url';
import type {
	Changeset,
	FileEntry,
	GithubClient,
} from '@wp-playground/storage';
import {
	changeset,
	createCommit,
	createOrUpdateBranch,
	createTree,
	decodeGitHubBase64Content,
	filesListToObject,
	fork,
	getFilesFromDirectory,
	iterateFiles,
	mayPush,
} from '@wp-playground/storage';
import { setOAuthToken } from '../state';
import {
	getAuthenticatedGitHubClient as getClient,
	resetAuthenticatedGitHubClient as resetClient,
} from '../client';
import { Spinner } from '../../components/spinner';
import GitHubOAuthGuard from '../github-oauth-guard';
import type { ContentType } from '../import-from-github';
import type { ExportFormValues, PullRequestAction } from './form-types';
import { basename, dirname, joinPaths } from '@php-wasm/util';
import MultiplePathsInput from './multiple-paths-input';
import { logger } from '@php-wasm/logger';
import {
	filterRepositoryFilesToScopes,
	joinRepositoryPath,
	normalizePlaygroundPath,
	normalizeRepositoryPath,
	relativePathFromRoot,
	resolvePathInsideRoot,
} from './export-paths';
import type { RepositoryPathScope } from './export-paths';

export interface GitHubExportFormProps {
	playground: PlaygroundClient;
	initialValues?: Partial<ExportFormValues>;
	initialFilesBeforeChanges?: any[];
	initialFilesBeforeChangesCommitSha?: string;
	allowZipExport?: boolean;
	onExported?: (prURL: string, formValues: ExportFormValues) => void;
	onValuesChange?: (formValues: ExportFormValues) => void;
	onClose: () => void;
}

const PULL_REQUEST_CHANGED_AFTER_IMPORT_MESSAGE =
	"This pull request changed after you imported it. Re-import the latest files before exporting so Playground does not overwrite someone else's changes.";
const PULL_REQUEST_CHANGED_DURING_EXPORT_MESSAGE =
	'This pull request changed while Playground was preparing the export. Review the latest PR changes and try the export again.';
const TARGET_BRANCH_CHANGED_DURING_EXPORT_MESSAGE =
	'The target branch changed while Playground was preparing the export. Review the latest repository changes and try the export again.';
const NO_CHANGES_TO_EXPORT_MESSAGE =
	'There are no changes to export. Make an edit in the Playground before exporting to GitHub.';
const REPOSITORY_TARGET_IS_DIRECTORY_MESSAGE =
	'The selected repository path is a directory. Enter a file path for a single-file export.';

export default function GitHubExportForm({
	playground,
	onExported,
	onValuesChange,
	onClose,
	initialValues = {},
	initialFilesBeforeChanges,
	initialFilesBeforeChangesCommitSha,
	allowZipExport = true,
}: GitHubExportFormProps) {
	const [pushResult, setPushResult] = useState<PushResult>();
	const [formValues, _setFormValues] = useState<ExportFormValues>({
		repoUrl: '',
		prNumber: '',
		prAction: 'create',
		commitMessage: 'Changes from WordPress Playground',
		relativeExportPaths: ['/'],
		toPathInRepo: '/',
		fromPlaygroundRoot: '/wordpress',
		includeZip: false,
		...initialValues,
	});
	const formValuesRef = useRef(formValues);
	const latestRepoUrlRef = useRef(formValues.repoUrl);
	const urlAnalysisRunRef = useRef(0);
	const [repoDetails, setRepoDetails] = useState<{
		owner: string;
		repo: string;
	}>(() => {
		if (formValues.repoUrl) {
			const { owner, repo, type } = staticAnalyzeGitHubURL(
				formValues.repoUrl
			);
			if (type !== 'unknown' && owner && repo) {
				return { owner, repo };
			}
		}

		return { owner: '', repo: '' };
	});
	function setFormValues(values: ExportFormValues) {
		const nextValues = { ...values };
		if (
			nextValues.theme &&
			themes.length > 0 &&
			!themes.includes(nextValues.theme)
		) {
			nextValues.theme = '';
		}
		if (
			nextValues.plugin &&
			plugins.length > 0 &&
			!plugins.includes(nextValues.plugin)
		) {
			nextValues.plugin = '';
		}
		// The cached baseline is valid only for the repository,
		// target PR, and path that the user initially imported. If those
		// change, we need to fetch the GitHub files again.
		const currentValues = formValuesRef.current;
		if (
			nextValues.toPathInRepo !== currentValues.toPathInRepo ||
			nextValues.repoUrl !== currentValues.repoUrl ||
			nextValues.prAction !== currentValues.prAction ||
			nextValues.prNumber !== currentValues.prNumber ||
			nextValues.contentType !== currentValues.contentType ||
			nextValues.plugin !== currentValues.plugin ||
			nextValues.theme !== currentValues.theme ||
			nextValues.includeZip !== currentValues.includeZip ||
			nextValues.fromPlaygroundRoot !==
				currentValues.fromPlaygroundRoot ||
			nextValues.relativeExportPaths.join('\n') !==
				currentValues.relativeExportPaths.join('\n')
		) {
			setFilesBeforeChanges(undefined);
			setFilesBeforeChangesCommitSha(undefined);
		}
		formValuesRef.current = nextValues;
		_setFormValues(nextValues);
		onValuesChange?.(nextValues);
	}

	const [errors, setErrors] = useState<Record<string, string>>({});
	const [plugins, setPlugins] = useState<string[]>([]);
	const [themes, setThemes] = useState<string[]>([]);
	const [filesBeforeChanges, setFilesBeforeChanges] = useState<
		any[] | undefined
	>(initialFilesBeforeChanges);
	const [filesBeforeChangesCommitSha, setFilesBeforeChangesCommitSha] =
		useState<string | undefined>(initialFilesBeforeChangesCommitSha);

	useEffect(() => {
		if (!playground) return;
		let cancelled = false;
		async function computePluginsAndThemes() {
			try {
				const docRoot = await playground.documentRoot;
				const plugins = (
					await playground.listFiles(
						joinPaths(docRoot, 'wp-content/plugins')
					)
				).filter(
					(pluginName) =>
						![
							'akismet',
							'wordpress-importer',
							'sqlite-database-integration',
							'hello.php',
							'index.php',
						].includes(pluginName)
				);
				const themes = await playground.listFiles(
					joinPaths(docRoot, 'wp-content/themes')
				);
				if (!cancelled) {
					setPlugins(plugins);
					setThemes(themes);
				}
			} catch (error) {
				logger.error(
					'Failed to list exportable plugins and themes',
					error
				);
				if (!cancelled) {
					setPlugins([]);
					setThemes([]);
				}
			}
		}
		computePluginsAndThemes();
		return () => {
			cancelled = true;
		};
	}, [playground]);

	const setValue = <Field extends keyof ExportFormValues>(
		field: Field,
		value: ExportFormValues[Field]
	) => {
		setFormValues({
			...formValuesRef.current,
			[field]: value,
		});
	};
	const setExportSelectionValue = <
		Field extends 'contentType' | 'theme' | 'plugin',
	>(
		field: Field,
		value: ExportFormValues[Field]
	) => {
		const currentValues = formValuesRef.current;
		const previousDefaultPath =
			getDefaultRepositoryPathForSelection(currentValues);
		const nextValues = {
			...currentValues,
			[field]: value,
		};
		if (
			repositoryPathsAreEquivalent(
				currentValues.toPathInRepo,
				previousDefaultPath
			)
		) {
			nextValues.toPathInRepo =
				getDefaultRepositoryPathForSelection(nextValues);
		}
		setFormValues(nextValues);
	};
	const setError = <Field extends keyof ExportFormValues>(
		field: Field,
		value: string
	) => {
		setErrors((currentErrors) => ({
			...currentErrors,
			[field]: value,
		}));
	};

	const [isExporting, setIsExporting] = useState<boolean>(false);
	const [isAnalyzingUrl, setIsAnalyzingUrl] = useState<boolean>(false);
	const [URLNeedsAnalyzing, setURLNeedsAnalyzing] = useState<boolean>(
		!initialValues.repoUrl || !initialValues.prAction
	);

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setErrors({});

		const url = formValues.repoUrl?.trim();
		if (!url) {
			setError('repoUrl', 'Please enter a URL');
			return;
		}
		if (!formValues.contentType) {
			setError('contentType', 'Specify what you want to export');
			return;
		}
		if (formValues.contentType === 'theme' && !formValues.theme) {
			setError('theme', 'Specify the theme to export');
			return;
		}
		if (formValues.contentType === 'plugin' && !formValues.plugin) {
			setError('plugin', 'Specify the plugin to export');
			return;
		}
		if (URLNeedsAnalyzing) {
			const analysisRun = ++urlAnalysisRunRef.current;
			latestRepoUrlRef.current = url;
			setIsAnalyzingUrl(true);
			const analyzed = staticAnalyzeGitHubURL(url);
			const { type, owner, repo, pr } = analyzed;
			let { path } = analyzed;
			try {
				if (type === 'unknown') {
					setError('repoUrl', 'This URL is not supported');
					return;
				}
				if (!['pr', 'branch', 'repo'].includes(type)) {
					setError('repoUrl', 'This URL is not supported');
					return;
				}
				if (type === 'branch') {
					const resolved = await resolveGitHubBranchPath(
						getClient(),
						analyzed
					);
					if (
						urlAnalysisRunRef.current !== analysisRun ||
						latestRepoUrlRef.current.trim() !== url
					) {
						return;
					}
					path = resolved.path;
				}
				if (
					urlAnalysisRunRef.current !== analysisRun ||
					latestRepoUrlRef.current.trim() !== url
				) {
					return;
				}
				setRepoDetails({
					owner: owner || '',
					repo: repo || '',
				});
				const updatedValues: Partial<ExportFormValues> = {};
				if (pr) {
					updatedValues['prNumber'] = pr + '';
					updatedValues['prAction'] = 'update';
				}
				const currentValues = formValuesRef.current;
				if (path) {
					updatedValues['toPathInRepo'] = path;
				} else if (currentValues.contentType === 'theme') {
					updatedValues['toPathInRepo'] = `/${currentValues.theme}`;
				} else if (currentValues.contentType === 'plugin') {
					updatedValues['toPathInRepo'] = `/${currentValues.plugin}`;
				} else {
					updatedValues['toPathInRepo'] = '/';
				}
				setFormValues({
					...currentValues,
					repoUrl: url,
					...updatedValues,
				});
				setURLNeedsAnalyzing(false);
				return;
			} catch (error: any) {
				if (
					urlAnalysisRunRef.current !== analysisRun ||
					latestRepoUrlRef.current.trim() !== url
				) {
					return;
				}
				if (type === 'branch') {
					if (error?.status === 401) {
						setOAuthToken(undefined);
						resetClient();
						return;
					}
					logger.error('Could not analyze GitHub branch URL', error);
					setError(
						'repoUrl',
						'Could not analyze this GitHub branch URL. Please paste the repository URL and enter the path manually.'
					);
					return;
				}
				logger.error('Could not analyze GitHub URL', error);
				setError('repoUrl', 'Could not analyze this GitHub URL.');
				return;
			} finally {
				if (urlAnalysisRunRef.current === analysisRun) {
					setIsAnalyzingUrl(false);
				}
			}
		}
		if (!formValues.prAction) {
			setError('prAction', 'Please select an option');
			return;
		}
		const prNumber = (formValues.prNumber ?? '').trim();
		if (formValues.prAction === 'update') {
			if (!prNumber) {
				setError('prNumber', 'Please enter a PR number');
				return;
			}
			if (!/^[1-9]\d*$/.test(prNumber)) {
				setError('prNumber', 'Please enter a valid PR number');
				return;
			}
		}
		if (!formValues.commitMessage) {
			setError('commitMessage', 'Specify a commit message');
			return;
		}

		const toPathInRepo = normalizeRepositoryPath(formValues.toPathInRepo);
		if (!toPathInRepo) {
			setError(
				'toPathInRepo',
				'Enter a repository path that stays inside the repository.'
			);
			return;
		}

		setIsExporting(true);
		try {
			const octokit = getClient();

			const { data: ghRepo } = await octokit.rest.repos.get({
				owner: repoDetails.owner,
				repo: repoDetails.repo,
			});
			const defaultBranch = ghRepo.default_branch;
			// Updating a PR must diff against its head, not the target branch.
			// Otherwise files added only in the PR are invisible to deletions.
			let comparisonOwner = repoDetails.owner;
			let comparisonRepo = repoDetails.repo;
			let comparisonRef = defaultBranch;
			let comparisonCommitSha: string | undefined;
			if (formValues.prAction === 'update') {
				const { data: pullRequest } = await octokit.rest.pulls.get({
					owner: repoDetails.owner,
					repo: repoDetails.repo,
					pull_number: Number(prNumber),
				});
				if (!pullRequest.head.repo) {
					throw new Error(
						'Cannot update this pull request because its source repository is unavailable.'
					);
				}
				comparisonOwner = pullRequest.head.repo.owner.login;
				comparisonRepo = pullRequest.head.repo.name;
				comparisonRef = pullRequest.head.sha;
				comparisonCommitSha = pullRequest.head.sha;
			} else {
				const { data: branch } = await octokit.rest.repos.getBranch({
					owner: repoDetails.owner,
					repo: repoDetails.repo,
					branch: defaultBranch,
				});
				comparisonRef = branch.commit.sha;
				comparisonCommitSha = branch.commit.sha;
			}

			let fromPlaygroundRoot = '';
			let relativeExportPaths = [];
			let prTitle: string;
			const docroot = await playground.documentRoot;
			if (formValues.contentType === 'wp-content') {
				fromPlaygroundRoot = docroot;
				relativeExportPaths = ['/wp-content'];
				prTitle = 'Update wp-content';
			} else if (formValues.contentType === 'theme') {
				fromPlaygroundRoot = joinPaths(
					docroot,
					'wp-content/themes',
					formValues.theme ?? ''
				);
				relativeExportPaths = [`./`];
				prTitle = `Update theme ${formValues.theme}`;
			} else if (formValues.contentType === 'plugin') {
				fromPlaygroundRoot = joinPaths(
					docroot,
					'wp-content/plugins',
					formValues.plugin ?? ''
				);
				relativeExportPaths = [`./`];
				prTitle = `Update plugin ${formValues.plugin}`;
			} else if (formValues.contentType === 'custom-paths') {
				fromPlaygroundRoot = formValues.fromPlaygroundRoot;
				relativeExportPaths = formValues.relativeExportPaths
					.map((path) => path.trim().replace(/^\//g, ''))
					.filter(Boolean);
				prTitle = `Update wp-content`;
			} else {
				throw new Error(
					`Unknown content type ${formValues.contentType}`
				);
			}
			const normalizedPlaygroundRoot =
				normalizePlaygroundPath(fromPlaygroundRoot);
			if (!normalizedPlaygroundRoot) {
				setError(
					'fromPlaygroundRoot',
					'Enter an absolute Playground path, such as /wordpress/wp-content.'
				);
				return;
			}
			fromPlaygroundRoot = normalizedPlaygroundRoot;

			if (relativeExportPaths.length === 0) {
				relativeExportPaths = ['/'];
			}
			for (const path of relativeExportPaths) {
				if (!resolvePathInsideRoot(fromPlaygroundRoot, path)) {
					setError(
						'relativeExportPaths',
						'Paths to export must stay inside the Playground path root.'
					);
					return;
				}
			}

			const isoDateSlug = new Date().toISOString().replace(/[:.]/g, '-');
			const newBranchName = `playground-changes-${isoDateSlug}`;
			const commitMessage = formValues.commitMessage;
			let zipPathForPreview: string | undefined;
			let singleFileRepositoryPath: string | undefined;

			const allPlaygroundFiles: FileEntry[] = [];
			const repositoryPathScopes: RepositoryPathScope[] = [];
			for (const path of relativeExportPaths) {
				const sourcePath = resolvePathInsideRoot(
					fromPlaygroundRoot,
					path
				);
				if (!sourcePath) {
					throw new Error(
						`Export path ${path} is outside ${fromPlaygroundRoot}.`
					);
				}
				const sourceIsDir = await playground
					.isDir(sourcePath)
					.catch(() => false);
				if (
					!sourceIsDir &&
					!(await playground.fileExists(sourcePath))
				) {
					setError(
						'relativeExportPaths',
						`Path "${path}" does not exist in the Playground.`
					);
					return;
				}
				const relativeSourcePath = relativePathFromRoot(
					fromPlaygroundRoot,
					sourcePath
				);
				const repositoryPath = joinRepositoryPath(
					toPathInRepo,
					relativeSourcePath
				);
				if (!repositoryPath) {
					setError(
						'relativeExportPaths',
						'Exported files must stay inside the repository.'
					);
					return;
				}
				if (!sourceIsDir && repositoryPath === '.') {
					setError(
						'toPathInRepo',
						'Enter a repository file path when exporting a single Playground file.'
					);
					return;
				}
				if (
					!sourceIsDir &&
					relativeExportPaths.length === 1 &&
					relativeSourcePath === ''
				) {
					singleFileRepositoryPath = repositoryPath;
				}
				repositoryPathScopes.push({
					path: repositoryPath,
					recursive: sourceIsDir,
				});
				const iterator = iterateFiles(playground, sourcePath, {
					exceptPaths: wpContentFilesExcludedFromExport,
				});
				for await (const file of iterator) {
					const repositoryPath = joinRepositoryPath(
						toPathInRepo,
						relativePathFromRoot(fromPlaygroundRoot, file.path)
					);
					if (!repositoryPath) {
						throw new Error(
							`Exported file ${file.path} is outside the repository.`
						);
					}
					allPlaygroundFiles.push({
						path: repositoryPath,
						read: file.read,
					});
				}
			}
			if (allowZipExport && formValues.includeZip) {
				const zipFilename = `playground.zip`;
				const zipRoot = singleFileRepositoryPath
					? normalizeRepositoryPath(dirname(singleFileRepositoryPath))
					: toPathInRepo;
				const zipPath = joinRepositoryPath(zipRoot ?? '.', zipFilename);
				if (!zipPath) {
					setError(
						'toPathInRepo',
						'The zip export path must stay inside the repository.'
					);
					return;
				}
				const zipContents = await zipWpContent(playground);
				zipPathForPreview = zipPath;
				repositoryPathScopes.push({
					path: zipPath,
					recursive: false,
				});
				allPlaygroundFiles.push({
					path: zipPath,
					read: async () => zipContents,
				});
			}
			if (
				filesBeforeChangesCommitSha &&
				comparisonCommitSha &&
				filesBeforeChangesCommitSha !== comparisonCommitSha
			) {
				if (formValues.prAction === 'update') {
					throw new Error(PULL_REQUEST_CHANGED_AFTER_IMPORT_MESSAGE);
				}
			}
			// Imported files are a safe comparison baseline only when they come
			// from the exact commit we are about to branch from. Otherwise fetch
			// the current base so a new PR does not silently apply a stale diff.
			const shouldUseCachedFiles = Boolean(
				filesBeforeChanges &&
				filesBeforeChangesCommitSha &&
				filesBeforeChangesCommitSha === comparisonCommitSha
			);
			const ghRawFiles = shouldUseCachedFiles
				? filesBeforeChanges!
				: await getRepositoryFilesForScopes(
						octokit,
						comparisonOwner,
						comparisonRepo,
						comparisonRef,
						toPathInRepo,
						repositoryPathScopes
					);
			const ghComparableFiles = filesListToObject(ghRawFiles);
			const comparableFiles = filterRepositoryFilesToScopes(
				ghComparableFiles,
				repositoryPathScopes
			);
			const changes = await changeset(
				new Map(Object.entries(comparableFiles)),
				allPlaygroundFiles
			);

			const pushResult = await pushToGithub(getClient(), {
				owner: repoDetails.owner,
				repo: repoDetails.repo,
				commitMessage,
				changeset: changes,
				zipPathForPreview,

				shouldCreateNewPR: formValues.prAction === 'create',
				create: {
					againstBranch: defaultBranch,
					branchName: newBranchName,
					expectedBaseSha: comparisonCommitSha,
					title: prTitle,
				},
				update: {
					prNumber: Number(prNumber),
					expectedHeadSha: comparisonCommitSha,
				},
			});

			setPushResult(pushResult);
			onExported?.(pushResult.url, formValues);
			return;
		} catch (e: any) {
			// Handle the "Bad Credentials" error
			if (e && e.status === 401) {
				setOAuthToken(undefined);
				resetClient();
				return;
			}

			if (e?.message === REPOSITORY_TARGET_IS_DIRECTORY_MESSAGE) {
				setError('toPathInRepo', e.message);
				return;
			}

			if (
				e?.message === PULL_REQUEST_CHANGED_AFTER_IMPORT_MESSAGE ||
				e?.message === PULL_REQUEST_CHANGED_DURING_EXPORT_MESSAGE ||
				e?.message === TARGET_BRANCH_CHANGED_DURING_EXPORT_MESSAGE ||
				e?.message === NO_CHANGES_TO_EXPORT_MESSAGE
			) {
				setError('repoUrl', e.message);
				return;
			}

			let eMessage = (e as any)?.message;
			eMessage = eMessage ? `(${eMessage})` : '';
			setError(
				'repoUrl',
				`There was an unexpected error ${eMessage}, please try again. If the problem persists, please report it at https://github.com/WordPress/wordpress-playground/issues.`
			);
			return;
		} finally {
			setIsExporting(false);
		}
	}

	if (pushResult) {
		return (
			<form id="export-playground-form" onSubmit={handleSubmit}>
				<h2>
					Pull Request{' '}
					{formValues.prAction === 'create' ? 'created' : 'updated'}!
				</h2>
				<p>
					Your changes have been submitted to GitHub. You can view
					them here:{' '}
					<a
						href={pushResult.url}
						target="_blank"
						rel="noopener noreferrer"
					>
						{pushResult.url}
					</a>
				</p>

				{pushResult.forked && (
					<p>
						Because of access restrictions set by your organization,
						these changes could not be submitted directly to the
						repository. Instead, they were submitted to your fork of
						the repository.
					</p>
				)}

				<div className={forms.submitRow}>
					<Button
						type="button"
						variant="primary"
						size="large"
						onClick={onClose}
					>
						Done
					</Button>
				</div>
			</form>
		);
	}

	return (
		<GitHubOAuthGuard intro="Export plugins, themes, or a wp-content directory to a GitHub repository.">
			<form id="export-playground-form" onSubmit={handleSubmit}>
				<p>
					You may export WordPress plugins, themes, and entire
					wp-content directories as pull requests to any public GitHub
					repository.
				</p>

				<div className={`${forms.formGroup} ${forms.formGroupLast}`}>
					<label>
						I am exporting:
						<select
							name="github-export-content-type"
							className={css.repoInput}
							value={formValues.contentType ?? ''}
							onChange={(e) =>
								setExportSelectionValue(
									'contentType',
									(e.target.value || undefined) as
										| ContentType
										| undefined
								)
							}
						>
							<option value="">-- Select an option --</option>
							<option value="theme">A theme</option>
							<option value="plugin">A plugin</option>
							<option value="wp-content">
								wp-content directory
							</option>
							<option value="custom-paths">Specific paths</option>
						</select>
					</label>
					{errors.contentType && (
						<div role="alert" className={forms.error}>
							{errors.contentType}
						</div>
					)}
				</div>
				{formValues.contentType === 'custom-paths' ? (
					<>
						<div
							className={`${forms.formGroup} ${forms.formGroupLast}`}
						>
							<div className={`${css.pathMappingGroup}`}>
								<label>
									From Playground path
									<input
										type="text"
										name="github-export-source-root"
										value={formValues.fromPlaygroundRoot}
										className={css.repoInput}
										onChange={(
											e: React.ChangeEvent<HTMLInputElement>
										) => {
											setValue(
												'fromPlaygroundRoot',
												e.target.value
											);
										}}
										placeholder="e.g. /wordpress/wp-content"
										autoFocus
									/>
								</label>
								<span className={css.pathMappingArrow}>➔</span>
								<label>
									To repository path
									<input
										type="text"
										name="github-export-target-path"
										className={css.repoInput}
										value={formValues.toPathInRepo}
										onChange={(e) =>
											setValue(
												'toPathInRepo',
												e.target.value
											)
										}
									/>
								</label>
							</div>
							{'fromPlaygroundRoot' in errors && (
								<div role="alert" className={forms.error}>
									{errors.fromPlaygroundRoot}
								</div>
							)}
							{'toPathInRepo' in errors && (
								<div role="alert" className={forms.error}>
									{errors.toPathInRepo}
								</div>
							)}
						</div>
						<div
							className={`${forms.formGroup} ${forms.formGroupLast}`}
						>
							<label>
								Paths to export – relative to the path root
								<MultiplePathsInput
									initialValue={
										formValues.relativeExportPaths
									}
									onChange={(paths) =>
										setValue('relativeExportPaths', paths)
									}
								/>
							</label>
							{errors.relativeExportPaths && (
								<div role="alert" className={forms.error}>
									{errors.relativeExportPaths}
								</div>
							)}
						</div>
					</>
				) : null}
				{formValues.contentType === 'theme' ? (
					<div
						className={`${forms.formGroup} ${forms.formGroupLast}`}
					>
						<label>
							Which theme?
							<select
								name="github-export-theme"
								className={css.repoInput}
								value={formValues.theme ?? ''}
								onChange={(e) =>
									setExportSelectionValue(
										'theme',
										e.target.value
									)
								}
							>
								<option value="">-- Select a theme --</option>
								{themes.map((theme) => (
									<option key={theme} value={theme}>
										{theme}
									</option>
								))}
							</select>
						</label>
						{errors.theme && (
							<div role="alert" className={forms.error}>
								{errors.theme}
							</div>
						)}
					</div>
				) : null}
				{formValues.contentType === 'plugin' ? (
					<div
						className={`${forms.formGroup} ${forms.formGroupLast}`}
					>
						<label>
							Which plugin?
							<select
								name="github-export-plugin"
								className={css.repoInput}
								value={formValues.plugin ?? ''}
								onChange={(e) =>
									setExportSelectionValue(
										'plugin',
										e.target.value
									)
								}
							>
								<option value="">-- Select a plugin --</option>
								{plugins.map((plugin) => (
									<option key={plugin} value={plugin}>
										{plugin}
									</option>
								))}
							</select>
						</label>
						{errors.plugin && (
							<div role="alert" className={forms.error}>
								{errors.plugin}
							</div>
						)}
					</div>
				) : null}
				<div className={`${forms.formGroup} ${forms.formGroupLast}`}>
					<label>
						{' '}
						I want my Pull Request to target this GitHub repo:
						<input
							type="text"
							name="github-export-repo-url"
							value={formValues.repoUrl}
							className={css.repoInput}
							onChange={(
								e: React.ChangeEvent<HTMLInputElement>
							) => {
								const nextUrl = e.target.value;
								latestRepoUrlRef.current = nextUrl;
								urlAnalysisRunRef.current++;
								setIsAnalyzingUrl(false);
								setValue('repoUrl', nextUrl);
								setURLNeedsAnalyzing(true);
							}}
							placeholder="https://github.com/my-org/my-repo/..."
							autoFocus
						/>
					</label>
					{'repoUrl' in errors ? (
						<div role="alert" className={forms.error}>
							{errors.repoUrl}
						</div>
					) : null}
				</div>
				{formValues.repoUrl && !URLNeedsAnalyzing ? (
					<>
						<div
							className={`${forms.formGroup} ${forms.formGroupLast}`}
						>
							<label>
								Do you want to update an existing PR or create a
								new one?
								<select
									name="github-export-pr-action"
									className={css.repoInput}
									value={formValues.prAction}
									onChange={(e) =>
										setValue(
											'prAction',
											e.target.value as PullRequestAction
										)
									}
								>
									<option value="update">
										Update an existing PR
									</option>
									<option value="create">
										Create a new PR
									</option>
								</select>
							</label>
						</div>
						{formValues.prAction === 'update' && (
							<div
								className={`${forms.formGroup} ${forms.formGroupLast}`}
							>
								<label>
									I want to update the PR number:
									<input
										type="text"
										name="github-export-pr-number"
										className={css.repoInput}
										value={formValues.prNumber ?? ''}
										onChange={(e) =>
											setValue('prNumber', e.target.value)
										}
									/>
								</label>
								{errors.prNumber && (
									<div role="alert" className={forms.error}>
										{errors.prNumber}
									</div>
								)}
							</div>
						)}
						{formValues.repoUrl &&
						formValues.contentType !== 'custom-paths' ? (
							<div
								className={`${forms.formGroup} ${forms.formGroupLast}`}
							>
								<label>
									Enter the path in the repository where the
									changes should be committed:
									<input
										type="text"
										name="github-export-repo-path"
										className={css.repoInput}
										value={formValues.toPathInRepo}
										onChange={(e) =>
											setValue(
												'toPathInRepo',
												e.target.value
											)
										}
									/>
								</label>
								{errors.toPathInRepo && (
									<div role="alert" className={forms.error}>
										{errors.toPathInRepo}
									</div>
								)}
							</div>
						) : null}
						{formValues.repoUrl ? (
							<>
								<div
									className={`${forms.formGroup} ${forms.formGroupLast}`}
								>
									<label>
										Commit message:
										<textarea
											name="github-export-commit-message"
											className={css.repoInput}
											rows={4}
											value={formValues.commitMessage}
											onChange={(e) =>
												setValue(
													'commitMessage',
													e.target.value
												)
											}
										/>
									</label>
									{errors.commitMessage && (
										<div
											role="alert"
											className={forms.error}
										>
											{errors.commitMessage}
										</div>
									)}
								</div>
								{allowZipExport ? (
									<div
										className={`${forms.formGroup} ${forms.formGroupLast}`}
									>
										<label>
											<input
												type="checkbox"
												name="github-export-include-zip"
												checked={formValues.includeZip}
												onChange={(e) =>
													setValue(
														'includeZip',
														e.target.checked
													)
												}
											/>
											Also export the changes as a zip
											file, so they can be imported into
											another Playground instance.
										</label>
									</div>
								) : null}
							</>
						) : null}
					</>
				) : null}
				<div className={forms.submitRow}>
					<Button
						disabled={
							!formValues.repoUrl || isAnalyzingUrl || isExporting
						}
						type="submit"
						variant="primary"
						size="large"
					>
						{isAnalyzingUrl ? (
							<>
								<Spinner size={20} />
								Analyzing the repository
							</>
						) : isExporting ? (
							formValues.prAction === 'update' ? (
								<>
									<Spinner size={20} />
									Updating the Pull Request
								</>
							) : (
								<>
									<Spinner size={20} />
									Creating the Pull Request
								</>
							)
						) : URLNeedsAnalyzing ? (
							'Next step'
						) : formValues.prAction === 'update' ? (
							`Update Pull Request #${formValues.prNumber}`
						) : (
							'Create Pull Request'
						)}
					</Button>
				</div>
			</form>
		</GitHubOAuthGuard>
	);
}

function getDefaultRepositoryPathForSelection(values: ExportFormValues) {
	if (values.contentType === 'theme' && values.theme) {
		return `/${values.theme}`;
	}
	if (values.contentType === 'plugin' && values.plugin) {
		return `/${values.plugin}`;
	}
	return '/';
}

function repositoryPathsAreEquivalent(left: string, right: string) {
	return normalizeRepositoryPath(left) === normalizeRepositoryPath(right);
}

export async function getRepositoryFilesForScopes(
	octokit: GithubClient,
	owner: string,
	repo: string,
	ref: string,
	fallbackPath: string,
	scopes: RepositoryPathScope[]
) {
	const scopesToFetch = scopes.length
		? scopes
		: [{ path: fallbackPath, recursive: true }];
	const filesByPath = new Map<string, any>();
	for (const scope of scopesToFetch) {
		let files: any[];
		try {
			files = await getRepositoryFilesForScope(
				octokit,
				owner,
				repo,
				ref,
				scope
			);
		} catch (error: any) {
			if (error?.status === 404) {
				// Missing target paths are valid first-time exports; compare
				// against an empty tree and let every Playground file be added.
				continue;
			}
			throw error;
		}
		for (const file of files) {
			filesByPath.set(file.path, file);
		}
	}
	return [...filesByPath.values()];
}

async function getRepositoryFilesForScope(
	octokit: GithubClient,
	owner: string,
	repo: string,
	ref: string,
	scope: RepositoryPathScope
) {
	const path = normalizeRepositoryPath(scope.path);
	if (!path) {
		return [];
	}
	if (scope.recursive) {
		return getFilesFromDirectory(
			octokit,
			owner,
			repo,
			ref,
			path === '.' ? '' : path
		);
	}
	if (path === '.') {
		return [];
	}
	return getRepositoryFile(octokit, owner, repo, ref, path);
}

async function getRepositoryFile(
	octokit: GithubClient,
	owner: string,
	repo: string,
	ref: string,
	path: string
) {
	const { data } = await octokit.rest.repos.getContent({
		owner,
		repo,
		ref,
		path,
	});
	if (Array.isArray(data)) {
		throw new Error(REPOSITORY_TARGET_IS_DIRECTORY_MESSAGE);
	}
	return [
		{
			name: data.name ?? basename(path),
			path: data.path ?? path,
			content: decodeGitHubBase64Content(
				data as unknown as {
					content?: unknown;
					encoding?: unknown;
				},
				path
			),
		},
	];
}

function buildGitHubRawUrl(
	owner: string,
	repo: string,
	branchName: string,
	filePath: string
) {
	return `https://raw.githubusercontent.com/${encodeURIComponent(
		owner
	)}/${encodeURIComponent(repo)}/refs/heads/${encodePathSegments(
		branchName
	)}/${encodePathSegments(filePath)}`;
}

function encodePathSegments(path: string) {
	return path
		.split('/')
		.filter(Boolean)
		.map((segment) => encodeURIComponent(segment))
		.join('/');
}

export type CreatePROptions = {
	title: string;
	branchName: string;
	againstBranch: string;
	expectedBaseSha?: string;
};
export type UpdatePROptions = {
	prNumber: number;
	expectedHeadSha?: string;
};
export type PushToGitHubOptions = {
	owner: string;
	repo: string;
	commitMessage: string;
	changeset: Changeset;
	zipPathForPreview?: string;
	shouldCreateNewPR: boolean;
	create: CreatePROptions;
	update: UpdatePROptions;
	shouldFork?: boolean;
};

export interface PushResult {
	url: string;
	forked: boolean;
}

export async function pushToGithub(
	octokit: GithubClient,
	options: PushToGitHubOptions
): Promise<PushResult> {
	const {
		owner,
		repo,
		shouldCreateNewPR,
		commitMessage,
		changeset,
		zipPathForPreview,
		shouldFork,
		create: {
			againstBranch,
			branchName: branchToCreate,
			expectedBaseSha,
			title: prTitle,
		},
		update: { prNumber, expectedHeadSha },
	} = options;

	try {
		let parentSha: string;
		let pushToBranch: string;
		let pushToOwner = owner;
		let pushToRepo = repo;
		let PR: Awaited<
			ReturnType<GithubClient['rest']['pulls']['create']>
		>['data'];
		if (shouldCreateNewPR) {
			if (shouldFork || !(await mayPush(octokit, owner, repo))) {
				pushToOwner = await fork(octokit, owner, repo);
			}
			const { data: branch } = await octokit.rest.repos.getBranch({
				owner,
				repo,
				branch: againstBranch,
			});

			if (expectedBaseSha && branch.commit.sha !== expectedBaseSha) {
				throw new Error(TARGET_BRANCH_CHANGED_DURING_EXPORT_MESSAGE);
			}
			parentSha = branch.commit.sha;
			pushToBranch = branchToCreate!;
		} else {
			const { data } = await octokit.rest.pulls.get({
				owner,
				repo,
				pull_number: prNumber!,
			});
			PR = data;
			if (!PR.head.repo) {
				throw new Error(
					'Cannot update this pull request because its source repository is unavailable.'
				);
			}
			pushToOwner = PR.head.repo.owner.login;
			pushToRepo = PR.head.repo.name;
			if (expectedHeadSha && PR.head.sha !== expectedHeadSha) {
				throw new Error(PULL_REQUEST_CHANGED_DURING_EXPORT_MESSAGE);
			}
			parentSha = PR.head.sha;
			pushToBranch = PR.head.ref;
			if (!(await mayPush(octokit, pushToOwner, pushToRepo))) {
				throw new Error(
					"Cannot update this pull request because you don't have permission to push to its source branch. Create a new pull request instead."
				);
			}
		}

		const finalCommitMessage = zipPathForPreview
			? appendZipPreviewLinks(commitMessage, {
					sourceOwner: pushToOwner,
					sourceRepo: pushToRepo,
					sourceBranch: pushToBranch,
					targetOwner: owner,
					targetRepo: repo,
					targetBranch: shouldCreateNewPR
						? againstBranch
						: PR!.base.ref,
					zipPath: zipPathForPreview,
				})
			: commitMessage;
		const newTreeSha = await createTree(
			octokit,
			pushToOwner,
			pushToRepo,
			parentSha,
			changeset
		);
		if (!newTreeSha) {
			throw new Error(NO_CHANGES_TO_EXPORT_MESSAGE);
		}
		const commitSha = await createCommit(
			octokit,
			pushToOwner,
			pushToRepo,
			finalCommitMessage,
			parentSha,
			newTreeSha
		);
		if (shouldCreateNewPR) {
			await octokit.rest.git.createRef({
				owner: pushToOwner,
				repo: pushToRepo,
				sha: commitSha,
				ref: `refs/heads/${pushToBranch}`,
			});
		} else {
			await createOrUpdateBranch(
				octokit,
				pushToOwner,
				pushToRepo,
				pushToBranch,
				commitSha
			);
		}

		if (shouldCreateNewPR) {
			const { data } = await octokit.rest.pulls.create({
				owner,
				repo,
				title: prTitle || commitMessage,
				body: finalCommitMessage,
				head: `${pushToOwner}:${pushToBranch}`,
				base: againstBranch,
			});
			PR = data;
		}

		return {
			url: PR!.html_url,
			forked: shouldCreateNewPR && pushToOwner !== owner,
		};
	} catch (e: any) {
		if (
			shouldCreateNewPR &&
			e.status === 403 &&
			e.message?.includes(
				'organization has enabled OAuth App access restrictions'
			) &&
			!shouldFork
		) {
			return await pushToGithub(octokit, {
				...options,
				shouldFork: true,
			});
		}
		throw e;
	}
}

function appendZipPreviewLinks(
	commitMessage: string,
	{
		sourceOwner,
		sourceRepo,
		sourceBranch,
		targetOwner,
		targetRepo,
		targetBranch,
		zipPath,
	}: {
		sourceOwner: string;
		sourceRepo: string;
		sourceBranch: string;
		targetOwner: string;
		targetRepo: string;
		targetBranch: string;
		zipPath: string;
	}
) {
	const branchPreviewUrl = (owner: string, repo: string, branch: string) => {
		const zipballURL = buildGitHubRawUrl(owner, repo, branch, zipPath);
		const url = new URL(document.location.origin);
		url.pathname = document.location.pathname;
		url.searchParams.set('import-site', zipballURL);
		return url.toString();
	};

	return (
		commitMessage +
		'\n\n' +
		[
			'Also exported as a zip file.',
			'',
			`* [Preview loaded from this PR – available **before** this PR is merged](${branchPreviewUrl(
				sourceOwner,
				sourceRepo,
				sourceBranch
			)})`,
			`* [Preview loaded from the target branch – available **after** this PR is merged](${branchPreviewUrl(
				targetOwner,
				targetRepo,
				targetBranch
			)})`,
		].join('\n')
	);
}
