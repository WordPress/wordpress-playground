import React from 'react';
import { useState } from 'react';
import { Icon, Notice, Button as WPButton } from '@wordpress/components';
import { PlaygroundClient } from '@wp-playground/client';

import css from './style.module.css';
import forms from '../../forms.module.css';
import Button from '../../components/button';
import { GitHubPointer, analyzeGitHubURL } from '../analyze-github-url';
import {
	GetFilesProgress,
	createClient,
	getFilesFromDirectory,
} from '@wp-playground/storage';
import { oAuthState, setOAuthToken } from '../state';
import { ContentType, importFromGitHub } from '../import-from-github';
import { Spinner } from '../../components/spinner';
import GitHubOAuthGuard from '../github-oauth-guard';
import { GitHubIcon } from './github';
import { normalizePath } from '@php-wasm/util';
import { signal } from '@preact/signals-react';

interface GitHubFormProps {
	playground: PlaygroundClient;
	onImported: (pointer: GitHubPointer) => void;
	onClose: () => void;
}

let octokitClient: any;
function getClient() {
	if (!octokitClient) {
		octokitClient = createClient(oAuthState.value.token!);
	}
	return octokitClient;
}

const url = signal('');
const errors = signal<Record<string, string>>({});
const pointer = signal<GitHubPointer | undefined>(undefined);

export default function GitHubForm({
	playground,
	onImported,
}: GitHubFormProps) {
	const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
	const [isImporting, setIsImporting] = useState<boolean>(false);
	const [importProgress, setImportProgress] = useState<GetFilesProgress>({
		downloadedFiles: 0,
		foundFiles: 0,
	});
	const [showExample, setShowExample] = useState<boolean>(false);
	const [URLNeedsAnalyzing, setURLNeedsAnalyzing] = useState<boolean>(false);

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		url.value = url.value.trim();
		errors.value = {};
		if (!url.value) {
			errors.value = {
				url: 'Please enter a URL',
			};
			return;
		}
		if (URLNeedsAnalyzing) {
			await analyzeUrl();
			if (pointer.value?.type === 'unknown') {
				errors.value = {
					url: 'This URL is not supported',
				};
			}
			return;
		}
		if (!pointer.value?.contentType) {
			errors.value = {
				contentType: 'Please select what you want to import',
			};
			return;
		}
		await importUrl();
	}

	async function analyzeUrl() {
		setURLNeedsAnalyzing(false);
		pointer.value = undefined;

		setIsAnalyzing(true);
		try {
			const octokit = getClient();
			pointer.value = await analyzeGitHubURL(octokit, url.value);
			if (pointer.value.type === 'unknown') {
				return;
			}

			return pointer;
		} catch (e: any) {
			console.error(e);
			// Handle the "Bad Credentials" error
			if (e && e.status) {
				switch (e.status) {
					case 401:
						setOAuthToken(undefined);
						return;
					case 404:
						errors.value = {
							url: "This repo (or the resource in it) doesn't exist",
						};
						return;
				}
			}
			errors.value = { url: e.message };
			throw e;
		} finally {
			setIsAnalyzing(false);
		}
	}

	async function importUrl() {
		setIsImporting(true);
		setImportProgress({ downloadedFiles: 0, foundFiles: 0 });
		try {
			const octokit = getClient();

			const immutablePointer = pointer.value!;

			const relativeRepoPath = immutablePointer.path.replace(/^\//g, '');
			const ghFiles = await getFilesFromDirectory(
				octokit,
				immutablePointer.owner,
				immutablePointer.repo,
				immutablePointer.ref,
				relativeRepoPath,
				(progress) => setImportProgress({ ...progress })
			);
			await importFromGitHub(
				playground,
				ghFiles,
				immutablePointer.contentType!,
				immutablePointer.repo,
				relativeRepoPath
			);
			setIsImporting(false);
			onImported(immutablePointer);
		} catch (e) {
			let eMessage = (e as any)?.message;
			eMessage = eMessage ? `(${eMessage})` : '';
			errors.value = {
				url: `There was an unexpected error ${eMessage}, please try again. If the problem persists, please report it at https://github.com/WordPress/wordpress-playground/issues.`,
			};
			throw e;
		}
	}

	return (
		<GitHubOAuthGuard AuthRequest={Authenticate}>
			<form id="import-playground-form" onSubmit={handleSubmit}>
				<h2 tabIndex={0} style={{ marginTop: 0, textAlign: 'center' }}>
					Import from GitHub
				</h2>
				<p className={css.modalText}>
					You may import WordPress plugins, themes, and entire
					wp-content directories from any public GitHub repository.
				</p>
				<div className={`${forms.formGroup} ${forms.formGroupLast}`}>
					<label>
						{' '}
						I want to import from this GitHub URL:
						<input
							type="text"
							value={url.value}
							className={css.repoInput}
							onChange={(
								e: React.ChangeEvent<HTMLInputElement>
							) => {
								url.value = e.target.value;
								setURLNeedsAnalyzing(true);
							}}
							placeholder="https://github.com/my-org/my-repo/..."
							autoFocus
						/>
					</label>
					{'url' in errors.value ? (
						<div className={forms.error}>{errors.value.url}</div>
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
				{pointer.value && !URLNeedsAnalyzing && !isAnalyzing ? (
					<>
						{pointer.value ? (
							<div>
								<h3>
									{pointer.value.type === 'pr' ? (
										<>
											Importing from Pull Request #
											{pointer.value.pr} at{' '}
											{pointer.value.owner}/
											{pointer.value.repo}
										</>
									) : pointer.value.type === 'branch' ? (
										<>
											Importing from branch{' '}
											{pointer.value.ref} at{' '}
											{pointer.value.owner}/
											{pointer.value.repo}
										</>
									) : pointer.value.type === 'repo' ? (
										<>
											Importing from the{' '}
											{pointer.value.owner}/
											{pointer.value.repo} repository
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
							pointer.value.type as any
						) ? (
							<>
								<div
									className={`${forms.formGroup} ${forms.formGroupLast}`}
								>
									<label>
										I am importing a:
										<select
											value={
												pointer.value
													.contentType as string
											}
											className={css.repoInput}
											onChange={(e) => {
												pointer.value = {
													...pointer.value!,
													contentType: e.target
														.value as ContentType,
												};
											}}
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
									{'contentType' in errors.value ? (
										<div className={forms.error}>
											{errors.value.contentType}
										</div>
									) : null}
								</div>
								<div
									className={`${forms.formGroup} ${forms.formGroupLast}`}
								>
									<label>
										From the following path in the repo:
										<input
											type="text"
											className={css.repoInput}
											value={normalizePath(
												'/' + pointer.value.path
											)}
											onChange={(e) => {
												pointer.value = {
													...pointer.value!,
													path: e.target.value.replace(
														/^\/+/,
														''
													),
												};
											}}
										/>
									</label>
									{'path' in errors.value ? (
										<div className={forms.error}>
											{errors.value.path}
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
								Analyzing the URL...
							</>
						) : isImporting ? (
							<>
								<Spinner size={20} />
								{` Importing... ${importProgress.downloadedFiles}/${importProgress.foundFiles} files downloaded`}
							</>
						) : (
							'Import'
						)}
					</Button>
				</div>
			</form>
		</GitHubOAuthGuard>
	);
}

function Authenticate({ authenticateUrl }: { authenticateUrl: string }) {
	return (
		<div>
			<h2 tabIndex={0} style={{ marginTop: 0, textAlign: 'center' }}>
				Connect to GitHub
			</h2>
			<p>
				Importing plugins, themes, and wp-content directories directly
				from your public GitHub repositories.
			</p>
			<p>
				To enable this feature, connect your GitHub account with
				WordPress Playground:
			</p>
			<p>
				<a
					aria-label="Connect your GitHub account"
					className={css.githubButton}
					href={authenticateUrl}
				>
					<Icon icon={GitHubIcon} />
					Connect your GitHub account
				</a>
			</p>
			<p>
				Your access token is not stored anywhere, which means you'll
				have to re-authenticate after every page refresh.
			</p>
		</div>
	);
}
