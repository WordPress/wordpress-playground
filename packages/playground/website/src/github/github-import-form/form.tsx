import React from 'react';
import { useRef, useState } from 'react';
import { Notice, Button as WPButton } from '@wordpress/components';
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
				url: 'Please enter a URL',
			});
			return;
		}
		if (!urlInformation) {
			const info = staticAnalyzeGitHubURL(newUrl);
			if (!['pr', 'branch', 'repo'].includes(info.type)) {
				setErrors({
					url: 'This URL is not supported',
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
								url: "This repo (or the resource in it) doesn't exist",
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
				contentType: 'Please select what you want to import',
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
			let eMessage = (e as any)?.message;
			eMessage = eMessage ? `(${eMessage})` : '';
			setErrors({
				url: `There was an unexpected error ${eMessage}, please try again. If the problem persists, please report it at https://github.com/WordPress/wordpress-playground/issues.`,
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
					You may import WordPress plugins, themes, and entire
					wp-content directories from any public GitHub repository.
				</p>
				<div
					className={`${forms.formGroup} ${forms.formGroupLast} ${
						inline ? css.inlineFieldGroup : ''
					}`}
				>
					<label>
						{' '}
						I want to import from this GitHub URL:
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
						{showExample ? 'Hide examples' : 'Need an example?'}
					</WPButton>
				</div>
				{showExample ? (
					<Notice isDismissible={false} className={css.notice}>
						<p style={{ marginTop: 0 }}>
							Here's a few examples of URLs you can use:
						</p>
						<dl className={css.examplesDl}>
							<dt>A repository:</dt>
							<dd>https://github.com/org/repo-name</dd>

							<dt>A path inside a repository:</dt>
							<dd>
								https://github.com/org/repo-name/tree/trunk/my-theme
							</dd>

							<dt>A Pull Request:</dt>
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
											Importing from Pull Request #
											{urlInformation.pr} at{' '}
											{urlInformation.owner}/
											{urlInformation.repo}
										</>
									) : urlInformation.type === 'branch' ? (
										<>
											Importing from branch{' '}
											{urlInformation.ref} at{' '}
											{urlInformation.owner}/
											{urlInformation.repo}
										</>
									) : urlInformation.type === 'repo' ? (
										<>
											Importing from the{' '}
											{urlInformation.owner}/
											{urlInformation.repo} repository
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
										I am importing a:
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
												-- Select an option --
											</option>
											<option value="theme">Theme</option>
											<option value="plugin">
												Plugin
											</option>
											<option value="wp-content">
												wp-content directory
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
										From the following path in the repo:
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
								Analyzing the repository...
							</>
						) : isImporting ? (
							<>
								<Spinner size={20} />
								{` Importing... ${importProgress.downloadedFiles}/${importProgress.foundFiles} files downloaded`}
							</>
						) : showRepositoryDetails ? (
							'Import'
						) : (
							'Continue'
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
				'This pull request cannot be imported because its source repository is unavailable.'
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
