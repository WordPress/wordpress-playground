import React from 'react';
import { useRef, useState } from 'react';
import { Notice, Button as WPButton } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import type { PlaygroundClient } from '@wp-playground/client';

import css from './style.module.css';
import forms from '../../forms.module.css';
import type { GitHubURLInformation } from '../analyze-github-url';
import {
	resolveGitHubBranchPath,
	staticAnalyzeGitHubURL,
} from '../analyze-github-url';
import type { GetFilesProgress, GithubClient } from '@wp-playground/storage';
import { getFilesFromDirectory } from '@wp-playground/storage';
import { setOAuthToken } from '../state';
import {
	getAuthenticatedGitHubClient as getClient,
	resetAuthenticatedGitHubClient as resetClient,
} from '../client';
import type { ContentType } from '../import-from-github';
import { importFromGitHub } from '../import-from-github';
import { Spinner } from '../../components/spinner';
import GitHubOAuthGuard from '../github-oauth-guard';
import { basename, normalizePath } from '@php-wasm/util';
import { logger } from '@php-wasm/logger';

export interface GitHubImportFormProps {
	playground: PlaygroundClient;
	getPlaygroundBeforeImport?: () => Promise<PlaygroundClient>;
	onRepositoryResolved?: () => void;
	showRepositoryDetails?: boolean;
	/** Use the compact, left-aligned action layout in the Dock pane. */
	inline?: boolean;
	onImported: (details: {
		url: string;
		urlInformation: GitHubURLInformation;
		branch: string;
		path: string;
		contentType: ContentType;
		pluginOrThemeName: string;
		files: any[];
	}) => void;
	onClose: () => void;
}

export default function GitHubImportForm({
	playground,
	getPlaygroundBeforeImport,
	onRepositoryResolved,
	showRepositoryDetails = true,
	inline = false,
	onImported,
}: GitHubImportFormProps) {
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
	const [isImporting, setIsImporting] = useState<boolean>(false);
	const [importProgress, setImportProgress] = useState<GetFilesProgress>({
		downloadedFiles: 0,
		foundFiles: 0,
	});
	const [showExample, setShowExample] = useState<boolean>(false);

	const [url, setUrl] = useState<string>('');
	const latestUrlRef = useRef(url);
	const analysisRunRef = useRef(0);
	const [urlInformation, setUrlInformation] = useState<
		GitHubURLInformation | undefined
	>();
	const [contentType, setContentType] = useState<ContentType | undefined>(
		undefined
	);
	const [path, setPath] = useState<string>('');
	const [branch, setBranch] = useState<string>('');

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const newUrl = url.trim();
		setUrl(newUrl);
		latestUrlRef.current = newUrl;
		setErrors({});
		if (!newUrl) {
			setErrors({
				url: __('Please enter a URL', 'playground-website'),
			});
			return;
		}
		if (!urlInformation) {
			const info = staticAnalyzeGitHubURL(newUrl);
			if (!['pr', 'branch', 'repo'].includes(info.type)) {
				setErrors({
					url: __('This URL is not supported', 'playground-website'),
				});
				return;
			}
			const octokit = getClient();
			// Only keep the most recent analysis run if the user triggers
			// multiple analysis attempts.
			const analysisRun = ++analysisRunRef.current;
			setIsAnalyzing(true);
			try {
				const importSource = await resolveImportSource(octokit, info);
				if (
					analysisRunRef.current !== analysisRun ||
					latestUrlRef.current.trim() !== newUrl
				) {
					return;
				}
				const guessedContentType = await guessContentType(
					octokit,
					importSource
				);
				if (
					analysisRunRef.current !== analysisRun ||
					latestUrlRef.current.trim() !== newUrl
				) {
					return;
				}
				setUrlInformation(importSource);
				setPath(importSource.path ?? '');
				setBranch(importSource.ref ?? '');
				setContentType(guessedContentType);
				onRepositoryResolved?.();
				return;
			} catch (e: any) {
				if (
					analysisRunRef.current !== analysisRun ||
					latestUrlRef.current.trim() !== newUrl
				) {
					return;
				}
				logger.error(e);
				// Handle the "Bad Credentials" error
				if (e && e.status) {
					switch (e.status) {
						case 401:
							setOAuthToken(undefined);
							resetClient();
							return;
						case 404:
							setErrors({
								url: __(
									"This repo (or the resource in it) doesn't exist",
									'playground-website'
								),
							});
							return;
					}
				}
				setErrors({ url: e.message });
				return;
			} finally {
				if (analysisRunRef.current === analysisRun) {
					setIsAnalyzing(false);
				}
			}
		}
		if (!showRepositoryDetails) {
			onRepositoryResolved?.();
			return;
		}
		if (!contentType) {
			setErrors({
				contentType: __(
					'Please select what you want to import',
					'playground-website'
				),
			});
			return;
		}
		setIsImporting(true);
		setImportProgress({ downloadedFiles: 0, foundFiles: 0 });
		try {
			const octokit = getClient();
			const pluginOrThemeName = basename(path!) || urlInformation!.repo!;

			const relativeRepoPath = path!.replace(/^\//g, '');
			// Use the commit resolved during analysis so a branch moving
			// mid-flow cannot change the files being imported.
			const ghFiles = await getFilesFromDirectory(
				octokit,
				urlInformation!.owner!,
				urlInformation!.repo!,
				urlInformation!.commitSha || branch!,
				relativeRepoPath,
				{
					onProgress: (progress) =>
						setImportProgress({ ...progress }),
				}
			);
			const targetPlayground = getPlaygroundBeforeImport
				? await getPlaygroundBeforeImport()
				: playground;
			await importFromGitHub(
				targetPlayground,
				ghFiles,
				contentType!,
				relativeRepoPath,
				pluginOrThemeName
			);
			targetPlayground.goTo('/');
			onImported({
				url: newUrl,
				urlInformation: urlInformation!,
				path: path!,
				contentType,
				branch: branch!,
				pluginOrThemeName,
				files: ghFiles,
			});
		} catch (e) {
			if ((e as any)?.status === 401) {
				setOAuthToken(undefined);
				resetClient();
				return;
			}
			const eMessage = (e as any)?.message;
			setErrors({
				url: eMessage
					? sprintf(
							/* translators: %s: Error message details. */
							__(
								'There was an unexpected error (%s), please try again. If the problem persists, please report it at https://github.com/WordPress/wordpress-playground/issues.',
								'playground-website'
							),
							eMessage
						)
					: __(
							'There was an unexpected error, please try again. If the problem persists, please report it at https://github.com/WordPress/wordpress-playground/issues.',
							'playground-website'
						),
			});
			return;
		} finally {
			setIsImporting(false);
		}
	}

	return (
		<GitHubOAuthGuard>
			<form
				id="import-playground-form"
				className={inline ? css.inlineForm : undefined}
				onSubmit={handleSubmit}
			>
				<p>
					{__(
						'You may import WordPress plugins, themes, and entire wp-content directories from any public GitHub repository.',
						'playground-website'
					)}
				</p>
				<div
					className={`${forms.formGroup} ${forms.formGroupLast} ${
						inline ? css.inlineFieldGroup : ''
					}`}
				>
					<label>
						{__(
							'I want to import from this GitHub URL:',
							'playground-website'
						)}
						<input
							type="text"
							value={url}
							className={css.repoInput}
							onChange={(
								e: React.ChangeEvent<HTMLInputElement>
							) => {
								const nextUrl = e.target.value;
								latestUrlRef.current = nextUrl;
								analysisRunRef.current++;
								setUrl(nextUrl);
								setIsAnalyzing(false);
								setUrlInformation(undefined);
								setContentType(undefined);
								setPath('');
								setBranch('');
							}}
							placeholder="https://github.com/my-org/my-repo/..."
							autoFocus
						/>
					</label>
					{'url' in errors ? (
						<div className={forms.error}>{errors.url}</div>
					) : null}
					<WPButton
						variant="link"
						style={{ marginTop: 5 }}
						onClick={() => setShowExample(!showExample)}
					>
						{showExample
							? __('Hide examples', 'playground-website')
							: __('Need an example?', 'playground-website')}
					</WPButton>
				</div>
				{showExample ? (
					<Notice isDismissible={false} className={css.notice}>
						<p style={{ marginTop: 0 }}>
							{__(
								"Here's a few examples of URLs you can use:",
								'playground-website'
							)}
						</p>
						<dl className={css.examplesDl}>
							<dt>{__('A repository:', 'playground-website')}</dt>
							<dd>https://github.com/org/repo-name</dd>

							<dt>
								{__(
									'A path inside a repository:',
									'playground-website'
								)}
							</dt>
							<dd>
								https://github.com/org/repo-name/tree/trunk/my-theme
							</dd>

							<dt>
								{__('A Pull Request:', 'playground-website')}
							</dt>
							<dd>https://github.com/org/repo-name/pull/733</dd>
						</dl>
					</Notice>
				) : (
					false
				)}
				{urlInformation && showRepositoryDetails && !isAnalyzing ? (
					<>
						{urlInformation ? (
							<div>
								<h3>
									{urlInformation.type === 'pr' ? (
										<>
											{sprintf(
												/* translators: 1: Pull Request number, 2: Repository owner, 3: Repository name. */
												__(
													'Importing from Pull Request #%1$s at %2$s/%3$s',
													'playground-website'
												),
												urlInformation.pr,
												urlInformation.owner,
												urlInformation.repo
											)}
										</>
									) : urlInformation.type === 'branch' ? (
										<>
											{sprintf(
												/* translators: 1: Branch name, 2: Repository owner, 3: Repository name. */
												__(
													'Importing from branch %1$s at %2$s/%3$s',
													'playground-website'
												),
												urlInformation.ref,
												urlInformation.owner,
												urlInformation.repo
											)}
										</>
									) : urlInformation.type === 'repo' ? (
										<>
											{sprintf(
												/* translators: 1: Repository owner, 2: Repository name. */
												__(
													'Importing from the %1$s/%2$s repository',
													'playground-website'
												),
												urlInformation.owner,
												urlInformation.repo
											)}
										</>
									) : (
										false
									)}
								</h3>
							</div>
						) : (
							false
						)}
						{['pr', 'branch', 'repo'].includes(
							urlInformation.type
						) ? (
							<>
								<div
									className={`${forms.formGroup} ${
										forms.formGroupLast
									} ${inline ? css.inlineFieldGroup : ''}`}
								>
									<label>
										{__(
											'I am importing a:',
											'playground-website'
										)}
										<select
											value={contentType}
											className={css.repoInput}
											onChange={(e) =>
												setContentType(
													e.target
														.value as ContentType
												)
											}
										>
											<option value="">
												{__(
													'-- Select an option --',
													'playground-website'
												)}
											</option>
											<option value="theme">
												{__(
													'Theme',
													'playground-website'
												)}
											</option>
											<option value="plugin">
												{__(
													'Plugin',
													'playground-website'
												)}
											</option>
											<option value="wp-content">
												{__(
													'wp-content directory',
													'playground-website'
												)}
											</option>
										</select>
									</label>
									{'contentType' in errors ? (
										<div className={forms.error}>
											{errors.contentType}
										</div>
									) : null}
								</div>
								<div
									className={`${forms.formGroup} ${
										forms.formGroupLast
									} ${inline ? css.inlineFieldGroup : ''}`}
								>
									<label>
										{__(
											'From the following path in the repo:',
											'playground-website'
										)}
										<input
											type="text"
											className={css.repoInput}
											value={normalizePath('/' + path)}
											onChange={(e) => {
												setPath(
													e.target.value.replace(
														/^\/+/,
														''
													)
												);
											}}
										/>
									</label>
									{'path' in errors ? (
										<div className={forms.error}>
											{errors.path}
										</div>
									) : null}
								</div>
							</>
						) : (
							false
						)}
					</>
				) : (
					false
				)}
				<div className={inline ? css.inlineActions : forms.submitRow}>
					<WPButton
						disabled={!url || isAnalyzing || isImporting}
						type="submit"
						variant="primary"
					>
						{isAnalyzing ? (
							<>
								<Spinner size={20} />
								{__(
									'Analyzing the repository...',
									'playground-website'
								)}
							</>
						) : isImporting ? (
							<>
								<Spinner size={20} />
								{sprintf(
									/* translators: 1: Number of downloaded files, 2: Total number of files found. */
									__(
										'Importing... %1$d/%2$d files downloaded',
										'playground-website'
									),
									importProgress.downloadedFiles,
									importProgress.foundFiles
								)}
							</>
						) : showRepositoryDetails ? (
							__('Import', 'playground-website')
						) : (
							__('Continue', 'playground-website')
						)}
					</WPButton>
				</div>
			</form>
		</GitHubOAuthGuard>
	);
}

/**
 * Resolves the exact repository ref that should be imported.
 */
async function resolveImportSource(
	octokit: GithubClient,
	urlDetails: GitHubURLInformation
): Promise<GitHubURLInformation> {
	if (urlDetails.type === 'pr') {
		const prDetails = await octokit.rest.pulls.get({
			owner: urlDetails.owner!,
			repo: urlDetails.repo!,
			pull_number: urlDetails.pr!,
		});
		if (!prDetails.data.head.repo) {
			throw new Error(
				__(
					'This pull request cannot be imported because its source repository is unavailable.',
					'playground-website'
				)
			);
		}
		return {
			...urlDetails,
			owner: prDetails.data.head.repo.owner.login,
			repo: prDetails.data.head.repo.name,
			ref: prDetails.data.head.ref,
			commitSha: prDetails.data.head.sha,
		};
	}
	if (urlDetails.type === 'repo') {
		const {
			data: { default_branch },
		} = await octokit.rest.repos.get({
			owner: urlDetails.owner!,
			repo: urlDetails.repo!,
		});
		const { data: branch } = await octokit.rest.repos.getBranch({
			owner: urlDetails.owner!,
			repo: urlDetails.repo!,
			branch: default_branch,
		});
		return {
			...urlDetails,
			ref: default_branch,
			commitSha: branch.commit.sha,
		};
	}
	return resolveGitHubBranchPath(octokit, urlDetails);
}

async function guessContentType(
	octokit: GithubClient,
	{ owner, repo, path, ref, commitSha }: GitHubURLInformation
): Promise<ContentType | undefined> {
	// Guess the content type
	const { data: files } = await octokit.rest.repos.getContent({
		owner: owner!,
		repo: repo!,
		path: path!,
		ref: commitSha || ref,
	});
	if (Array.isArray(files)) {
		if (files.some(({ name }) => name === 'theme.json')) {
			return 'theme';
		} else if (
			files.some(({ name }) =>
				['plugins', 'themes', 'mu-plugins'].includes(name)
			)
		) {
			return 'wp-content';
		} else if (files.some(({ name }) => name.endsWith('.php'))) {
			return 'plugin';
		}
	}
}
