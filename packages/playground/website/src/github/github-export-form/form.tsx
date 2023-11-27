import React, { useEffect } from 'react';
import { useState } from 'react';
import { PlaygroundClient } from '@wp-playground/client';

import css from './style.module.css';
import forms from '../../forms.module.css';
import Button from '../../components/button';
import { staticAnalyzeGitHubURL } from '../analyze-github-url';
import {
	Changeset,
	GithubClient,
	changeset,
	createClient,
	createCommit,
	createOrUpdateBranch,
	createTree,
	filesListToObject,
	fork,
	getFilesFromDirectory,
	iterateFiles,
	mayPush,
} from '@wp-playground/storage';
import { oAuthState, setOAuthToken } from '../state';
import { Spinner } from '../../components/spinner';
import GitHubOAuthGuard from '../github-oauth-guard';
import { ContentType } from '../import-from-github';

export interface GitHubExportFormProps {
	playground: PlaygroundClient;
	initialValues?: Partial<ExportFormValues>;
	initialFilesBeforeChanges?: any[];
	onExported?: (prURL: string, formValues: ExportFormValues) => void;
	onClose: () => void;
}

let octokitClient: GithubClient;
function getClient() {
	if (!octokitClient) {
		octokitClient = createClient(oAuthState.value.token!);
	}
	return octokitClient;
}

export type PullRequestAction = 'update' | 'create';

export interface ExportFormValues {
	repoUrl: string;
	prAction?: PullRequestAction;
	prNumber: string;
	contentType?: ContentType;
	pathInRepo: string;
	commitMessage: string;
	plugin?: string;
	theme?: string;
}

export default function GitHubExportForm({
	playground,
	onExported,
	onClose,
	initialValues = {},
	initialFilesBeforeChanges,
}: GitHubExportFormProps) {
	const [pushResult, setPushResult] = useState<PushResult>();
	const [formValues, _setFormValues] = useState<ExportFormValues>({
		repoUrl: '',
		prNumber: '',
		prAction: 'create',
		commitMessage: 'Changes from WordPress Playground',
		pathInRepo: '/',
		...initialValues,
	});
	const [repoDetails, setRepoDetails] = useState<{
		owner: string;
		repo: string;
	}>({
		owner: '',
		repo: '',
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
			values.pathInRepo !== formValues.pathInRepo ||
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
			const { type, owner, repo, path, pr } = staticAnalyzeGitHubURL(
				formValues.repoUrl
			);
			if (type === 'unknown') {
				setError('repoUrl', 'This URL is not supported');
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
			if (path) {
				updatedValues['pathInRepo'] = path;
			} else if (formValues.contentType === 'theme') {
				updatedValues['pathInRepo'] = `/${formValues.theme}`;
			} else if (formValues.contentType === 'plugin') {
				updatedValues['pathInRepo'] = `/${formValues.plugin}`;
			} else {
				updatedValues['pathInRepo'] = '/my-directory';
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
		if (!formValues.pathInRepo) {
			setError('pathInRepo', 'Specify the path in the repo');
			return;
		}
		if (!formValues.commitMessage) {
			setError('commitMessage', 'Specify a commit message');
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

			const relativeRepoPath = formValues.pathInRepo.replace(/^\//g, '');

			let ghRawFiles: any[];
			try {
				ghRawFiles =
					filesBeforeChanges ||
					(await getFilesFromDirectory(
						octokit,
						repoDetails.owner,
						repoDetails.repo,
						defaultBranch,
						relativeRepoPath
					));
			} catch (e) {
				ghRawFiles = [];
			}
			const comparableFiles = filesListToObject(ghRawFiles);

			let playgroundPath: string;
			let prTitle: string;
			const docroot = await playground.documentRoot;
			if (formValues.contentType === 'wp-content') {
				playgroundPath = `${docroot}/wp-content`;
				prTitle = 'Update wp-content';
			} else if (formValues.contentType === 'theme') {
				playgroundPath = `${docroot}/wp-content/themes/${formValues.theme}`;
				prTitle = `Update theme ${formValues.theme}`;
			} else if (formValues.contentType === 'plugin') {
				playgroundPath = `${docroot}/wp-content/plugins/${formValues.plugin}`;
				prTitle = `Update plugin ${formValues.plugin}`;
			} else {
				throw new Error(
					`Unknown content type ${formValues.contentType}`
				);
			}
			const changes = await changeset(
				new Map(Object.entries(comparableFiles)),
				iterateFiles(playground, playgroundPath!, {
					relativePaths: true,
					pathPrefix: relativeRepoPath,
				})
			);

			const isoDateSlug = new Date().toISOString().replace(/[:.]/g, '-');
			const pushResult = await pushToGithub(getClient(), {
				owner: repoDetails.owner,
				repo: repoDetails.repo,
				commitMessage: formValues.commitMessage,
				changeset: changes,

				shouldCreateNewPR: formValues.prAction === 'create',
				create: {
					againstBranch: defaultBranch,
					branchName: `playground-changes-${isoDateSlug}`,
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
				throw e;
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
			<form id="export-playground-form" onSubmit={handleSubmit}>
				<h2 tabIndex={0} style={{ marginTop: 0, textAlign: 'center' }}>
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

				{pushResult.forked ? (
					<p>
						Because of access restrictions set by your organization,
						these changes could not be submitted directly to the
						repository. Instead, they were submitted to your fork of
						the repository.
					</p>
				) : (
					false
				)}

				<div className={forms.submitRow}>
					<Button variant="primary" size="large" onClick={onClose}>
						Close this modal
					</Button>
				</div>
			</form>
		);
	}

	return (
		<GitHubOAuthGuard>
			<form id="export-playground-form" onSubmit={handleSubmit}>
				<h2 tabIndex={0} style={{ marginTop: 0, textAlign: 'center' }}>
					Export to GitHub
				</h2>
				<p className={css.modalText}>
					You may export WordPress plugins, themes, and entire
					wp-content directories as pull requests to any public GitHub
					repository.
				</p>

				<div className={`${forms.formGroup} ${forms.formGroupLast}`}>
					<label>
						I am exporting a:
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
							<option value="theme">Theme</option>
							<option value="plugin">Plugin</option>
							<option value="wp-content">
								wp-content directory
							</option>
						</select>
					</label>
					{errors.contentType && (
						<div className={forms.error}>{errors.contentType}</div>
					)}
				</div>
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
						{formValues.repoUrl && !errors.repoUrl ? (
							<>
								<div
									className={`${forms.formGroup} ${forms.formGroupLast}`}
								>
									<label>
										Enter the path in the repository where
										the changes should be committed:
										<input
											type="text"
											className={css.repoInput}
											value={formValues.pathInRepo}
											onChange={(e) =>
												setValue(
													'pathInRepo',
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
	shouldCreateNewPR: boolean;
	create: CreatePROptions;
	update: UpdatePROptions;
	shouldFork?: boolean;
};

interface PushResult {
	url: string;
	forked: boolean;
}

async function pushToGithub(
	octokit: GithubClient,
	options: PushToGitHubOptions
): Promise<PushResult> {
	const {
		owner,
		repo,
		shouldCreateNewPR,
		commitMessage,
		changeset,
		shouldFork,
		create: { againstBranch, branchName: branchToCreate, title: prTitle },
		update: { prNumber },
	} = options;

	let pushToOwner = owner;
	if (shouldFork || !(await mayPush(octokit, owner, repo))) {
		pushToOwner = await fork(octokit, owner, repo);
	}
	try {
		let parentSha: string;
		let pushToBranch: string;
		let PR: Awaited<
			ReturnType<GithubClient['rest']['pulls']['create']>
		>['data'];
		if (shouldCreateNewPR) {
			const { data: branch } = await octokit.rest.repos.getBranch({
				owner,
				repo,
				branch: againstBranch,
			});

			parentSha = branch.commit.sha;
			pushToBranch = branchToCreate!;
			await octokit.rest.git.createRef({
				owner: pushToOwner,
				repo,
				sha: parentSha,
				ref: `refs/heads/${pushToBranch}`,
			});
		} else {
			const { data } = await octokit.rest.pulls.get({
				owner,
				repo,
				pull_number: prNumber!,
			});
			PR = data;
			parentSha = PR.head.sha;
			pushToBranch = PR.head.ref;
		}

		const newTreeSha = await createTree(
			octokit,
			pushToOwner,
			repo,
			parentSha,
			changeset
		);
		if (!newTreeSha) {
			throw new Error(
				'No changes were detected so there is nothing to commit.'
			);
		}
		const commitSha = await createCommit(
			octokit,
			pushToOwner,
			repo,
			commitMessage,
			parentSha,
			newTreeSha || parentSha
		);
		await createOrUpdateBranch(
			octokit,
			pushToOwner,
			repo,
			pushToBranch,
			commitSha
		);

		if (shouldCreateNewPR) {
			const { data } = await octokit.rest.pulls.create({
				owner,
				repo,
				title: prTitle || commitMessage,
				body: commitMessage,
				head: `${pushToOwner}:${pushToBranch}`,
				base: againstBranch,
			});
			PR = data;
		}

		return {
			url: PR!.html_url,
			forked: pushToOwner !== owner,
		};
	} catch (e: any) {
		if (
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
