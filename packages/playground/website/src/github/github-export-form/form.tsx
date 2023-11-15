import React, { useEffect } from 'react';
import { useState } from 'react';
import { PlaygroundClient } from '@wp-playground/client';

import css from './style.module.css';
import forms from '../../forms.module.css';
import Button from '../../components/button';
import {
	ContentType,
	GitHubPointer,
	analyzeGitHubURL,
} from '../analyze-github-url';
import {
	GetFilesProgress,
	changeset,
	createClient,
	filesListToObject,
	getFilesFromDirectory,
	iterateFiles,
} from '@wp-playground/storage';
import { oAuthState, setOAuthToken } from '../state';
import { Spinner } from '../../components/spinner';
import GitHubOAuthGuard from '../github-oauth-guard';
import { basename, normalizePath } from '@php-wasm/util';

export interface GitHubExportFormProps {
	playground: PlaygroundClient;
	initialValues?: Partial<ExportFormValues>;
	onExported: (pointer: GitHubPointer) => void;
	onClose: () => void;
}

let octokitClient: any;
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
	branchName: string;
	contentType?: GitHubPointer['contentType'];
	pathInRepo: string;
	commitMessage: string;
	plugin: string;
	theme: string;
}

export function githubPointerToExportFormValues(
	pointer: GitHubPointer
): Partial<ExportFormValues> {
	const shouldCreatePr = !pointer.pr;
	const isoDateSlug = new Date().toISOString().replace(/[:.]/g, '-');
	return {
		pathInRepo: normalizePath('/' + pointer.path || '/'),
		contentType: pointer.contentType,
		prAction: shouldCreatePr ? 'create' : 'update',
		branchName: shouldCreatePr
			? `playground-changes-${isoDateSlug}`
			: pointer.ref || '',
		prNumber: pointer ? pointer.pr + '' : '',
		plugin: pointer.contentType === 'plugin' ? basename(pointer.path) : '',
		theme: pointer.contentType === 'theme' ? basename(pointer.path) : '',
	};
}

export default function GitHubExportForm({
	playground,
	onExported,
	initialValues = {},
}: GitHubExportFormProps) {
	const [formValues, setFormValues] = useState<ExportFormValues>({
		repoUrl: 'https://github.com/WordPress/community-themes/pull/51',
		prAction: 'create',
		prNumber: '',
		branchName: '',
		pathInRepo: '',
		commitMessage: 'Changes made in WordPress Playground',
		plugin: '',
		theme: '',
		...initialValues,
	});

	const [errors, setErrors] = useState<Record<string, string>>({});

	const [plugins, setPlugins] = useState<string[]>([]);
	const [themes, setThemes] = useState<string[]>([]);

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
			console.log({ themes });
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

	const [ghPointer, setGhPointer] = useState<GitHubPointer>();
	const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
	const [isExporting, setIsExporting] = useState<boolean>(false);
	const [exportProgress, setExportProgress] = useState<GetFilesProgress>({
		downloadedFiles: 0,
		foundFiles: 0,
	});
	const [URLNeedsAnalyzing, setURLNeedsAnalyzing] = useState<boolean>(false);

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setErrors({});
		const url = formValues.repoUrl?.trim();
		if (!url) {
			setError('repoUrl', 'Please enter a URL');
			return;
		}
		if (URLNeedsAnalyzing) {
			setGhPointer(undefined);
			const pointer = await analyzeUrl();
			if (pointer?.type === 'unknown') {
				setError('repoUrl', 'This URL is not supported');
				return;
			}
			setGhPointer(pointer);
			setFormValues({
				...formValues,
				...githubPointerToExportFormValues(pointer!),
				prAction: pointer?.pr ? 'update' : 'create',
			});
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
		if (formValues.prAction === 'create' && !formValues.branchName) {
			setError('branchName', 'Please enter a branch name');
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
		if (!formValues.pathInRepo) {
			setError('pathInRepo', 'Specify the path in the repo');
			return;
		}
		if (!formValues.commitMessage) {
			setError('commitMessage', 'Specify a commit message');
			return;
		}

		await doExport();
	}

	async function analyzeUrl() {
		setURLNeedsAnalyzing(false);
		setIsAnalyzing(true);
		try {
			const octokit = getClient();
			return await analyzeGitHubURL(octokit, formValues.repoUrl);
		} catch (e: any) {
			console.error(e);
			// Handle the "Bad Credentials" error
			if (e && e.status) {
				switch (e.status) {
					case 401:
						setOAuthToken(undefined);
						return;
					case 404:
						setError(
							'repoUrl',
							"This repo (or the resource in it) doesn't exist"
						);
						return;
				}
			}
			setError('repoUrl', e.message);
			throw e;
		} finally {
			setIsAnalyzing(false);
		}
	}

	async function doExport() {
		setIsExporting(true);
		setExportProgress({ downloadedFiles: 0, foundFiles: 0 });
		try {
			const octokit = getClient();

			const relativeRepoPath = ghPointer!.path.replace(/^\//g, '');
			const ghRawFiles = await getFilesFromDirectory(
				octokit,
				ghPointer!.owner,
				ghPointer!.repo,
				ghPointer!.ref,
				relativeRepoPath,
				{
					fetchFilesContents: false,
				}
			);
			const comparableFiles = filesListToObject(ghRawFiles);
			console.log(comparableFiles);

			const playgroundPath =
				formValues.contentType === 'wp-content'
					? '/wordpress/wp-content'
					: formValues.contentType === 'theme'
					? `/wordpress/wp-content/themes/${formValues.theme}`
					: formValues.contentType === 'plugin'
					? `/wordpress/wp-content/plugins/${formValues.plugin}`
					: '';
			const changes = await changeset(
				new Map(Object.entries(comparableFiles)),
				await iterateFiles(playground, playgroundPath)
			);

			console.log({ changes });

			return;

			// const newBranchName = `playground-changes-at-${Date.now()}`;
			// await createBranch(
			// 	'Automattic',
			// 	'themes',
			// 	newBranchName,
			// 	'trunk'
			// );

			// 4. Create (or update!) the PR
			// See https://github.com/type-challenges/octokit-create-pull-request
			await octokit
				.createPullRequest({
					owner: 'Automattic',
					repo: 'themes',
					title: 'Test PR from Playground',
					body: 'This is a description',
					head: newBranchName,
					// base: 'trunk' /* optional: defaults to default branch */,
					update: true /* optional: set to `true` to enable updating existing pull requests */,
					forceFork:
						false /* optional: force creating fork even when user has write rights */,
					labels: [
						'bug',
					] /* optional: applies the given labels when user has permissions. When updating an existing pull request, already present labels will not be deleted. */,
					changes: [
						{
							/* optional: if `files` is not passed, an empty commit is created instead */
							files: changes,
							commit: 'Test commit desc file1.txt, file2.png, deleting file3.txt, updating file4.txt (if it exists), file5.sh',
							/* optional: if not passed, will be the authenticated user and the current date */
							author: {
								name: 'Adam Zielinski',
								email: 'adam@adamziel.com',
								date: new Date().toISOString(), // must be ISO date string
							},
							/* optional: if not passed, will use the information set in author */
							committer: {
								name: 'Adam Zielinski',
								email: 'adam@adamziel.com',
								date: new Date().toISOString(), // must be ISO date string
							},
						},
					],
				})
				.then((pr) => console.log(`PR #${pr.data.number} created`));

			setIsExporting(false);
			// onExported(immutablePointer);
		} catch (e) {
			let eMessage = (e as any)?.message;
			eMessage = eMessage ? `(${eMessage})` : '';
			setError(
				'repoUrl',
				`There was an unexpected error ${eMessage}, please try again. If the problem persists, please report it at https://github.com/WordPress/wordpress-playground/issues.`
			);
			throw e;
		}
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
						{' '}
						I want to export to this GitHub repo:
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
						<div className={forms.error}>{errors.url}</div>
					) : null}
				</div>

				{formValues.repoUrl && !errors.repoUrl && (
					<div
						className={`${forms.formGroup} ${forms.formGroupLast}`}
					>
						<label>
							Do you want to update an existing PR or create a new
							one?
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
								<option value="create">Create a new PR</option>
							</select>
						</label>
					</div>
				)}
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
							<div className={forms.error}>{errors.prNumber}</div>
						)}
					</div>
				)}
				{formValues.prAction === 'create' && (
					<div
						className={`${forms.formGroup} ${forms.formGroupLast}`}
					>
						<label>
							I want to push to the following branch (new or existing):
							<input
								type="text"
								className={css.repoInput}
								value={formValues.branchName}
								onChange={(e) =>
									setValue('branchName', e.target.value)
								}
							/>
						</label>
						{errors.branchName && (
							<div className={forms.error}>
								{errors.branchName}
							</div>
						)}
					</div>
				)}
				{formValues.repoUrl && !errors.repoUrl ? (
					<div
						className={`${forms.formGroup} ${forms.formGroupLast}`}
					>
						<label>
							I am exporting a:
							<select
								className={css.repoInput}
								value={formValues.contentType}
								onChange={(e) =>
									setValue(
										'contentType',
										e.target.value as
											| ContentType
											| undefined
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
							<div className={forms.error}>
								{errors.contentType}
							</div>
						)}
					</div>
				) : null}
				{formValues.contentType === 'theme' && (
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
				)}
				{formValues.contentType === 'plugin' && (
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
				)}
				{formValues.repoUrl && !errors.repoUrl ? (
					<>
						<div
							className={`${forms.formGroup} ${forms.formGroupLast}`}
						>
							<label>
								Enter the path in the repository where the
								changes should be committed:
								<input
									type="text"
									className={css.repoInput}
									value={formValues.pathInRepo}
									onChange={(e) =>
										setValue('pathInRepo', e.target.value)
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
				<div className={forms.submitRow}>
					<Button
						disabled={
							!formValues.repoUrl || isAnalyzing || isExporting
						}
						type="submit"
						variant="primary"
						size="large"
					>
						{isAnalyzing ? (
							<>
								<Spinner size={20} />
								Analyzing the URL...
							</>
						) : isExporting ? (
							<>
								<Spinner size={20} />
								{` Exporting... ${exportProgress.downloadedFiles}/${exportProgress.foundFiles} files downloaded`}
							</>
						) : (
							'Export'
						)}
					</Button>
				</div>
			</form>
		</GitHubOAuthGuard>
	);
}
