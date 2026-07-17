import React, { useEffect } from 'react';
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
import { joinPaths } from '@php-wasm/util';
import MultiplePathsInput from './multiple-paths-input';

export interface GitHubExportFormProps {
	playground: PlaygroundClient;
	className?: string;
	initialValues?: Partial<ExportFormValues>;
	initialFilesBeforeChanges?: any[];
	allowZipExport?: boolean;
	onExported?: (prURL: string, formValues: ExportFormValues) => void;
	onClose: () => void;
}

export type PullRequestAction = 'update' | 'create';

export function asPullRequestAction(value: any): PullRequestAction | undefined {
	if (value === 'update' || value === 'create') {
		return value;
	}
	return 'create';
}

const NO_CHANGES_TO_EXPORT_MESSAGE =
	'There are no changes to export. Make an edit in the Playground before exporting to GitHub.';

class NoChangesToExportError extends Error {
	constructor() {
		super(NO_CHANGES_TO_EXPORT_MESSAGE);
		this.name = 'NoChangesToExportError';
	}
}

export interface ExportFormValues {
	repoUrl: string;
	prAction?: PullRequestAction;
	prNumber: string;
	contentType?: ContentType;
	toPathInRepo: string;
	fromPlaygroundRoot: string;
	relativeExportPaths: string[];
	commitMessage: string;
	plugin?: string;
	theme?: string;
	includeZip: boolean;
}

export default function GitHubExportForm({
	playground,
	className,
	onExported,
	onClose,
	initialValues = {},
	initialFilesBeforeChanges,
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
	const [repoDetails, setRepoDetails] = useState<{
		owner: string;
		repo: string;
	}>(() => {
		if (formValues.repoUrl) {
			const { owner, repo, type } = staticAnalyzeGitHubURL(
				formValues.repoUrl
			);
			if (type !== 'unknown' && owner && repo) {
				return { owner: owner!, repo: repo! };
			}
		}

		return { owner: '', repo: '' };
	});
	function setFormValues(values: ExportFormValues) {
		if (values.theme && !themes.includes(values.theme)) {
			values.theme = '';
		}
		if (values.plugin && !plugins.includes(values.plugin)) {
			values.plugin = '';
		}
		// The initialFilesBeforeChanges is valid for the repository
		// and path that the user initially entered. If those change,
		// we need to invalidate the initialFilesBeforeChanges.
		if (
			values.toPathInRepo !== formValues.toPathInRepo ||
			values.repoUrl !== formValues.repoUrl
		) {
			setFilesBeforeChanges(undefined);
		}
		_setFormValues(values);
	}

	const [errors, setErrors] = useState<Record<string, string>>({});
	const [plugins, setPlugins] = useState<string[]>([]);
	const [themes, setThemes] = useState<string[]>([]);
	const [filesBeforeChanges, setFilesBeforeChanges] = useState<
		any[] | undefined
	>(initialFilesBeforeChanges);

	useEffect(() => {
		if (!playground) return;
		async function computePluginsAndThemes() {
			const docRoot = await playground.documentRoot;
			const plugins = (
				await playground.listFiles(`${docRoot}/wp-content/plugins`)
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
				`${docRoot}/wp-content/themes`
			);
			setPlugins(plugins);
			setThemes(themes);
		}
		computePluginsAndThemes();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [!playground]);

	// Function to update form field values
	const setValue = <Field extends keyof ExportFormValues>(
		field: Field,
		value: ExportFormValues[Field]
	) => {
		setFormValues({
			...formValues,
			[field]: value,
		});
	};
	const setError = <Field extends keyof ExportFormValues>(
		field: Field,
		value: string
	) => {
		setErrors({
			...errors,
			[field]: value,
		});
	};

	const [isExporting, setIsExporting] = useState<boolean>(false);
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
			const analyzed = staticAnalyzeGitHubURL(formValues.repoUrl);
			let { type, owner, repo, path, pr } = analyzed;
			if (!['pr', 'branch', 'repo'].includes(type)) {
				setError('repoUrl', 'This URL is not supported');
				return;
			}
			if (type === 'branch') {
				try {
					const resolved = await resolveGitHubBranchPath(
						getClient(),
						analyzed
					);
					({ type, owner, repo, path, pr } = resolved);
				} catch (error: any) {
					if (error?.status === 401) {
						setOAuthToken(undefined);
						resetClient();
						return;
					}
					setError(
						'repoUrl',
						'Could not analyze this GitHub branch URL. Please paste the repository URL and enter the path manually.'
					);
					return;
				}
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
			if (path) {
				updatedValues['toPathInRepo'] = path;
			} else if (formValues.contentType === 'theme') {
				updatedValues['toPathInRepo'] = `/${formValues.theme}`;
			} else if (formValues.contentType === 'plugin') {
				updatedValues['toPathInRepo'] = `/${formValues.plugin}`;
			} else {
				updatedValues['toPathInRepo'] = '/';
			}
			setFormValues({
				...formValues,
				...updatedValues,
			});
			setURLNeedsAnalyzing(false);
			return;
		}
		if (!formValues.prAction) {
			setError('prAction', 'Please select an option');
			return;
		}
		if (formValues.prAction === 'update' && !formValues.prNumber) {
			setError('prNumber', 'Please enter a PR number');
			return;
		}
		if (!formValues.commitMessage) {
			setError('commitMessage', 'Specify a commit message');
			return;
		}

		let toPathInRepo = formValues.toPathInRepo.replace(/^\//g, '');
		if (!toPathInRepo) {
			toPathInRepo = '.';
		}

		setIsExporting(true);
		try {
			const octokit = getClient();

			const { data: ghRepo } = await octokit.rest.repos.get({
				owner: repoDetails.owner,
				repo: repoDetails.repo,
			});
			const defaultBranch = ghRepo.default_branch;

			let comparisonOwner = repoDetails.owner;
			let comparisonRepo = repoDetails.repo;
			let comparisonRef = defaultBranch;
			if (formValues.prAction === 'update') {
				const { data: pullRequest } = await octokit.rest.pulls.get({
					owner: repoDetails.owner,
					repo: repoDetails.repo,
					pull_number: parseInt(formValues.prNumber),
				});
				if (!pullRequest.head.repo) {
					throw new Error(
						'Cannot update this pull request because its source repository is unavailable.'
					);
				}
				// Updating a PR must diff against its head, not the target branch.
				// Otherwise files added only in the PR are invisible to deletions.
				comparisonOwner = pullRequest.head.repo.owner.login;
				comparisonRepo = pullRequest.head.repo.name;
				comparisonRef = pullRequest.head.sha;
			}

			let ghRawFiles: any[] = [];
			try {
				ghRawFiles =
					filesBeforeChanges && formValues.prAction === 'create'
						? filesBeforeChanges
						: await getFilesFromDirectory(
								octokit,
								comparisonOwner,
								comparisonRepo,
								comparisonRef,
								toPathInRepo
							);
			} catch {
				// ignore
			}
			const ghComparableFiles = filesListToObject(ghRawFiles);

			let fromPlaygroundRoot = '';
			let relativeExportPaths = [];
			let prTitle: string;
			const docroot = await playground.documentRoot;
			if (formValues.contentType === 'wp-content') {
				fromPlaygroundRoot = docroot;
				relativeExportPaths = ['/wp-content'];
				prTitle = 'Update wp-content';
			} else if (formValues.contentType === 'theme') {
				fromPlaygroundRoot = `${docroot}/wp-content/themes/${formValues.theme}`;
				relativeExportPaths = [`./`];
				prTitle = `Update theme ${formValues.theme}`;
			} else if (formValues.contentType === 'plugin') {
				fromPlaygroundRoot = `${docroot}/wp-content/plugins/${formValues.plugin}`;
				relativeExportPaths = [`./`];
				prTitle = `Update plugin ${formValues.plugin}`;
			} else if (formValues.contentType === 'custom-paths') {
				fromPlaygroundRoot = formValues.fromPlaygroundRoot;
				relativeExportPaths = formValues.relativeExportPaths
					.map((path) => path.replace(/^\//g, ''))
					.filter(Boolean);
				prTitle = `Update wp-content`;
			} else {
				throw new Error(
					`Unknown content type ${formValues.contentType}`
				);
			}

			if (relativeExportPaths.length === 0) {
				relativeExportPaths = ['/'];
			}

			const isoDateSlug = new Date().toISOString().replace(/[:.]/g, '-');
			const newBranchName = `playground-changes-${isoDateSlug}`;
			const commitMessage = formValues.commitMessage;
			let zipPathForPreview: string | undefined;

			if (allowZipExport && formValues.includeZip) {
				const zipFilename = `playground.zip`;
				const zipPath = joinPaths(fromPlaygroundRoot, zipFilename);
				relativeExportPaths.push(zipFilename);
				if (await playground.fileExists(zipPath)) {
					await playground.unlink(zipPath);
				}
				const zipContents = await zipWpContent(playground);
				await playground.writeFile(zipPath, zipContents);
				zipPathForPreview = [
					toPathInRepo === '.' ? '' : toPathInRepo,
					zipFilename,
				]
					.filter(Boolean)
					.join('/');
			}

			const allPlaygroundFiles: FileEntry[] = [];
			for (const path of relativeExportPaths) {
				const iterator = iterateFiles(
					playground,
					joinPaths(fromPlaygroundRoot, path),
					{
						exceptPaths: wpContentFilesExcludedFromExport,
					}
				);
				for await (const file of iterator) {
					allPlaygroundFiles.push({
						path: joinPaths(
							toPathInRepo,
							file.path.substring(fromPlaygroundRoot.length)
						),
						read: file.read,
					});
				}
			}
			const changes = await changeset(
				new Map(Object.entries(ghComparableFiles)),
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
					title: prTitle,
				},
				update: {
					prNumber: parseInt(formValues.prNumber),
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

			if (e instanceof NoChangesToExportError) {
				setError('repoUrl', e.message);
				return;
			}

			let eMessage = (e as any)?.message;
			eMessage = eMessage ? `(${eMessage})` : '';
			setError(
				'repoUrl',
				`There was an unexpected error ${eMessage}, please try again. If the problem persists, please report it at https://github.com/WordPress/wordpress-playground/issues.`
			);
			throw e;
		} finally {
			setIsExporting(false);
		}
	}

	if (pushResult) {
		return (
			<form
				id="export-playground-form"
				className={className}
				onSubmit={handleSubmit}
			>
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
			<form
				id="export-playground-form"
				className={className}
				onSubmit={handleSubmit}
			>
				<p>
					You may export WordPress plugins, themes, and entire
					wp-content directories as pull requests to any public GitHub
					repository.
				</p>

				<div className={`${forms.formGroup} ${forms.formGroupLast}`}>
					<label>
						I am exporting:
						<select
							className={css.repoInput}
							value={formValues.contentType}
							onChange={(e) =>
								setValue(
									'contentType',
									e.target.value as ContentType | undefined
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
						<div className={forms.error}>{errors.contentType}</div>
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
										placeholder="e.g. wp-content"
										autoFocus
									/>
								</label>
								<span className={css.pathMappingArrow}>➔</span>
								<label>
									To repository path
									<input
										type="text"
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
								<div className={forms.error}>
									{errors.fromPlaygroundRoot}
								</div>
							)}
							{'toPathInRepo' in errors && (
								<div className={forms.error}>
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
								<div className={forms.error}>
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
								className={css.repoInput}
								value={formValues.theme}
								onChange={(e) =>
									setValue('theme', e.target.value)
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
							<div className={forms.error}>{errors.theme}</div>
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
								className={css.repoInput}
								value={formValues.plugin}
								onChange={(e) =>
									setValue('plugin', e.target.value)
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
							<div className={forms.error}>{errors.plugin}</div>
						)}
					</div>
				) : null}
				<div className={`${forms.formGroup} ${forms.formGroupLast}`}>
					<label>
						{' '}
						I want my Pull Request to target this GitHub repo:
						<input
							type="text"
							value={formValues.repoUrl}
							className={css.repoInput}
							onChange={(
								e: React.ChangeEvent<HTMLInputElement>
							) => {
								setValue('repoUrl', e.target.value);
								setURLNeedsAnalyzing(true);
							}}
							placeholder="https://github.com/my-org/my-repo/..."
							autoFocus
						/>
					</label>
					{'repoUrl' in errors ? (
						<div className={forms.error}>{errors.repoUrl}</div>
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
										className={css.repoInput}
										value={formValues.prNumber}
										onChange={(e) =>
											setValue('prNumber', e.target.value)
										}
									/>
								</label>
								{errors.prNumber && (
									<div className={forms.error}>
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
								{errors.pathInRepo && (
									<div className={forms.error}>
										{errors.pathInRepo}
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
										<div className={forms.error}>
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
						disabled={!formValues.repoUrl || isExporting}
						type="submit"
						variant="primary"
						size="large"
					>
						{isExporting ? (
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

type CreatePROptions = {
	title: string;
	branchName: string;
	againstBranch: string;
};
type UpdatePROptions = {
	prNumber: number;
};
type PushToGitHubOptions = {
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

interface PushResult {
	url: string;
	forked: boolean;
}

/**
 * Pushes a Playground export to GitHub and returns the pull request URL.
 *
 * New pull requests branch from the target repository and may fall back to the
 * user's fork. Existing pull requests are updated through their head
 * repository, which may be a fork of the target repository.
 */
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
		create: { againstBranch, branchName: branchToCreate, title: prTitle },
		update: { prNumber },
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
			throw new NoChangesToExportError();
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

/**
 * Adds before-merge and after-merge zip preview links to the commit message.
 *
 * The before-merge link must read from the branch that receives the export
 * commit. The after-merge link must read from the target branch, because that
 * is where the zip file becomes available after the pull request is merged.
 */
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
	// The pre-merge preview reads from the commit we just pushed, while the
	// post-merge preview reads from the branch the pull request targets.
	const branchPreviewUrl = (owner: string, repo: string, branch: string) => {
		const rawZipUrl = buildGitHubRawUrl(owner, repo, branch, zipPath);
		const url = new URL(document.location.origin);
		url.pathname = document.location.pathname;
		url.searchParams.set('import-site', rawZipUrl);
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

function buildGitHubRawUrl(
	owner: string,
	repo: string,
	branchName: string,
	filePath: string
) {
	// Use refs/heads so branch names with slashes do not compete with file paths.
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
