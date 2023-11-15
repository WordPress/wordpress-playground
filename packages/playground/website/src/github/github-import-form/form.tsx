import React from 'react';
import { useRef, useState } from 'react';
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
import { GitHubFormDetails } from './form-details';
import { ContentType, importFromGitHub } from '../import-from-github';
import { Spinner } from '../../components/spinner';
import { normalizePath } from '@php-wasm/util';
import GitHubOAuthGuard from '../github-oauth-guard';
import { GitHubIcon } from './github';

interface GitHubFormProps {
	playground: PlaygroundClient;
	onImported: () => void;
	onClose: () => void;
}

let octokitClient: any;
function getClient() {
	if (!octokitClient) {
		octokitClient = createClient(oAuthState.value.token!);
	}
	return octokitClient;
}

export default function GitHubForm({
	playground,
	onImported,
	onClose,
}: GitHubFormProps) {
	const form = useRef<any>();
	const [error] = useState<string>('');
	const [url, setUrl] = useState<string>('');
	const [urlType, setUrlType] = useState<GitHubPointer['type'] | undefined>();
	const [contentType, setContentType] = useState<ContentType | undefined>();
	const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
	const [isImporting, setIsImporting] = useState<boolean>(false);
	const [urlDetails, setURLDetails] = useState<GitHubPointer>();
	const [importProgress, setImportProgress] = useState<GetFilesProgress>({
		downloadedFiles: 0,
		foundFiles: 0,
	});
	const [repoPath, setRepoPath] = useState<string>('');
	const [repoBranch, setRepoBranch] = useState<string>('');
	const [showExample, setShowExample] = useState<boolean>(false);
	const [URLNeedsAnalyzing, setURLNeedsAnalyzing] = useState<boolean>(false);
	function handleChangeUrl(e: React.ChangeEvent<HTMLInputElement>) {
		setUrl(e.target.value.trim());
		setURLNeedsAnalyzing(true);
	}

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		if (!url) {
			return;
		}
		if (URLNeedsAnalyzing) {
			analyzeUrl();
			return;
		}
		await importUrl();
	}

	async function analyzeUrl() {
		setUrlType(undefined);
		setURLNeedsAnalyzing(false);

		const details = analyzeGitHubURL(url);
		setURLDetails(details);
		setUrlType(details.type);
		if (details.type === 'unknown') {
			return;
		}

		setRepoPath(normalizePath('/' + details.path));

		setIsAnalyzing(true);
		const octokit = getClient();
		try {
			// Get the requested branch name
			let branch: string;
			if (details.type === 'pr') {
				const { data: pr } = await octokit.rest.pulls.get({
					owner: details.owner,
					repo: details.repo,
					pull_number: details.pr,
				});
				branch = pr.head.ref;
			} else {
				const repo = await octokit.rest.repos.get({
					owner: details.owner,
					repo: details.repo,
				});
				branch = repo.data.default_branch;
			}
			setRepoBranch(branch);

			const { data: files } = await octokit.rest.repos.getContent({
				owner: details.owner,
				repo: details.repo,
				path: details.path,
				ref: branch,
			});
			if (Array.isArray(files)) {
				for (const { name } of files) {
					if (name === 'theme.json') {
						setContentType('theme');
					} else if (
						['plugins', 'themes', 'mu-plugins'].includes(name)
					) {
						setContentType('wp-content');
					} else if (name.endsWith('.php')) {
						setContentType('plugin');
					}
				}
			}
		} catch (e: any) {
			// Handle the "Bad Credentials" error
			if (e && e.status && e.status === 401) {
				setOAuthToken(undefined);
			}
		} finally {
			setIsAnalyzing(false);
		}
	}

	async function importUrl() {
		setIsImporting(true);
		const octokit = getClient();
		const { owner, repo } = analyzeGitHubURL(url);

		setImportProgress({ downloadedFiles: 0, foundFiles: 0 });
		const relativeRepoPath = repoPath.replace(/^\//g, '');
		const ghFiles = await getFilesFromDirectory(
			octokit,
			owner,
			repo,
			repoBranch,
			relativeRepoPath,
			(progress) => setImportProgress({ ...progress })
		);
		await importFromGitHub(
			playground,
			ghFiles,
			contentType!,
			repo,
			relativeRepoPath
		);
		setIsImporting(false);
		onImported();
	}

	return (
		<GitHubOAuthGuard AuthRequest={Authenticate}>
			<form
				id="import-playground-form"
				ref={form}
				onSubmit={handleSubmit}
			>
				<h2 tabIndex={0} style={{ marginTop: 0, textAlign: 'center' }}>
					Import from GitHub
				</h2>
				<p className={css.modalText}>
					You may import WordPress plugins, themes, and entire
					wp-content directories from any public GitHub repository.
				</p>
				<div className={`${forms.formGroup} ${forms.formGroupLast}`}>
					{error ? <div className={forms.error}>{error}</div> : null}
					<label>
						{' '}
						I want to import from this GitHub URL:
						<input
							type="text"
							value={url}
							className={css.repoInput}
							onChange={handleChangeUrl}
							placeholder="https://github.com/my-org/my-repo/..."
							autoFocus
						/>
					</label>
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
				{url && !URLNeedsAnalyzing && !isAnalyzing ? (
					<>
						{urlDetails ? (
							<div>
								<h3>
									{urlType === 'pr' ? (
										<>
											Importing from Pull Request #
											{urlDetails.pr} to{' '}
											{urlDetails.owner}/{urlDetails.repo}
										</>
									) : urlType === 'branch' ? (
										<>
											Importing from branch{' '}
											{urlDetails.ref} at{' '}
											{urlDetails.owner}/{urlDetails.repo}
										</>
									) : urlType === 'repo' ? (
										<>
											Importing from the{' '}
											{urlDetails.owner}/{urlDetails.repo}{' '}
											repository
										</>
									) : (
										<>Playground doesn't support this URL</>
									)}
								</h3>
							</div>
						) : (
							false
						)}
						<GitHubFormDetails
							contentType={contentType}
							setContentType={setContentType}
							repoPath={repoPath}
							setRepoPath={setRepoPath}
							urlType={urlType}
						/>
					</>
				) : (
					false
				)}
				{urlType !== 'unknown' ? (
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
				) : (
					false
				)}
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
				The access token will be stored in your browser's local storage.
				WordPress Playground will utilize it solely when you actively
				engage with GitHub repositories.
			</p>
		</div>
	);
}
