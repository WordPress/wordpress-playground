import React from 'react';
import { useState } from 'react';
import { Notice, Button as WPButton } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import type { PlaygroundClient } from '@wp-playground/client';

import css from './style.module.css';
import forms from '../../forms.module.css';
import Button from '../../components/button';
import type { GitHubURLInformation } from '../analyze-github-url';
import { staticAnalyzeGitHubURL } from '../analyze-github-url';
import type { GetFilesProgress, GithubClient } from '@wp-playground/storage';
import { createClient, getFilesFromDirectory } from '@wp-playground/storage';
import { oAuthState, setOAuthToken } from '../state';
import type { ContentType } from '../import-from-github';
import { importFromGitHub } from '../import-from-github';
import { Spinner } from '../../components/spinner';
import GitHubOAuthGuard from '../github-oauth-guard';
import { basename, normalizePath } from '@php-wasm/util';
import { logger } from '@php-wasm/logger';

export interface GitHubImportFormProps {
	playground: PlaygroundClient;
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

let octokitClient: any;
function getClient() {
	if (!octokitClient) {
		octokitClient = createClient(oAuthState.value.token!);
	}
	return octokitClient;
}

export default function GitHubImportForm({
	playground,
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
		setErrors({});
		if (!newUrl) {
			setErrors({
				url: __('Please enter a URL', 'playground-website'),
			});
			return;
		}
		if (!urlInformation) {
			const info = staticAnalyzeGitHubURL(newUrl);
			if (info.type === 'unknown') {
				setErrors({
					url: __('This URL is not supported', 'playground-website'),
				});
			}
			logger.log(info);
			setUrlInformation(info);
			const octokit = getClient();
			setIsAnalyzing(true);
			try {
				if (!info.ref) {
					info.ref = (await guessDefaultBranch(octokit, info))!;
				}
				if (info.path) {
					setPath(info.path);
				}
				setBranch(info.ref);
				setContentType(await guessContentType(octokit, info));
				return;
			} catch (e: any) {
				logger.error(e);
				// Handle the "Bad Credentials" error
				if (e && e.status) {
					switch (e.status) {
						case 401:
							setOAuthToken(undefined);
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
				throw e;
			} finally {
				setIsAnalyzing(false);
			}
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
			const ghFiles = await getFilesFromDirectory(
				octokit,
				urlInformation!.owner!,
				urlInformation!.repo!,
				branch!,
				relativeRepoPath,
				{
					onProgress: (progress) =>
						setImportProgress({ ...progress }),
				}
			);
			await importFromGitHub(
				playground,
				ghFiles,
				contentType!,
				relativeRepoPath,
				pluginOrThemeName
			);
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
			let eMessage = (e as any)?.message;
			eMessage = eMessage ? `(${eMessage})` : '';
			setErrors({
				url: sprintf(
					__(
						'There was an unexpected error %s, please try again. If the problem persists, please report it at https://github.com/WordPress/wordpress-playground/issues.',
						'playground-website'
					),
					eMessage
				),
			});
			throw e;
		} finally {
			setIsImporting(false);
		}
	}

	return (
		<GitHubOAuthGuard>
			<form id="import-playground-form" onSubmit={handleSubmit}>
				<p>
					{__(
						'You may import WordPress plugins, themes, and entire wp-content directories from any public GitHub repository.',
						'playground-website'
					)}
				</p>
				<div className={`${forms.formGroup} ${forms.formGroupLast}`}>
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
								setUrl(e.target.value);
								setUrlInformation(undefined);
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
				{urlInformation && !isAnalyzing ? (
					<>
						{urlInformation ? (
							<div>
								<h3>
									{urlInformation.type === 'pr' ? (
										<>
											{sprintf(
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
									className={`${forms.formGroup} ${forms.formGroupLast}`}
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
									className={`${forms.formGroup} ${forms.formGroupLast}`}
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
				<div className={forms.submitRow}>
					<Button
						disabled={!url || isAnalyzing || isImporting}
						type="submit"
						variant="primary"
						size="large"
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
									__(
										'Importing... %1$d/%2$d files downloaded',
										'playground-website'
									),
									importProgress.downloadedFiles,
									importProgress.foundFiles
								)}
							</>
						) : (
							__('Import', 'playground-website')
						)}
					</Button>
				</div>
			</form>
		</GitHubOAuthGuard>
	);
}

async function guessDefaultBranch(
	octokit: GithubClient,
	urlDetails: GitHubURLInformation
): Promise<string | undefined> {
	if (urlDetails.type === 'pr') {
		const prDetails = await octokit.rest.pulls.get({
			owner: urlDetails.owner!,
			repo: urlDetails.repo!,
			pull_number: urlDetails.pr!,
		});
		return prDetails.data.head.ref;
	}
	if (urlDetails.type === 'repo') {
		const {
			data: { default_branch },
		} = await octokit.rest.repos.get({
			owner: urlDetails.owner!,
			repo: urlDetails.repo!,
		});
		return default_branch;
	}
}

async function guessContentType(
	octokit: GithubClient,
	{ owner, repo, path, ref }: GitHubURLInformation
): Promise<ContentType | undefined> {
	// Guess the content type
	const { data: files } = await octokit.rest.repos.getContent({
		owner: owner!,
		repo: repo!,
		path: path!,
		ref,
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
